import os
import tempfile
import unittest
from dataclasses import replace
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import accounts
from config import Settings
from database import Database
from main import create_app
import test_api as helpers

class SecurityExtraTests(unittest.TestCase):
    setUp=helpers.ApiTests.setUp
    tearDown=helpers.ApiTests.tearDown
    register=helpers.ApiTests.register

    def test_expired_session_and_secure_production_cookie(self):
        self.register()
        with self.client.app.state.db.session() as conn:conn.execute('UPDATE auth_sessions SET expires_at=0')
        self.assertEqual(self.client.get('/api/auth/me').status_code,401)
        with TestClient(create_app(replace(self.client.app.state.settings,environment='production')),headers={'X-SignBridge':'1'},base_url='https://testserver') as client:
            r=client.post('/api/auth/login',json={'email':'a@example.com','password':'password123'})
            self.assertIn('Secure',r.headers['set-cookie'])
            self.assertIn('SameSite=strict',r.headers['set-cookie'])
            self.assertIn('HttpOnly',r.headers['set-cookie'])
            self.assertEqual(client.get('/api/auth/me').status_code,200)

    def test_unverified_admin_cannot_access_private_feedback(self):
        self.register()
        with self.client.app.state.db.session() as conn:
            conn.execute("UPDATE users SET role_id='role-admin'")
        self.assertEqual(self.client.get('/api/admin/feedback').status_code,403)

    def test_smtp_tls_and_failure_cleanup(self):
        self.register()
        db=self.client.app.state.db;settings=self.client.app.state.settings
        environment={'SMTP_HOST':'smtp.example.test','SMTP_PORT':'587','SMTP_USER':'test-user','SMTP_PASSWORD':'temporary-test-value','MAIL_FROM':'demo@example.test','APP_URL':'https://example.test','SMTP_STARTTLS':'1'}
        with patch.dict(os.environ,environment),patch('accounts.smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value=MagicMock()
            accounts.request_email(db,settings,'a@example.com','reset')
            server=smtp.return_value.__enter__.return_value
            server.starttls.assert_called_once()
            server.send_message.assert_called_once()
            mail=server.send_message.call_args.args[0]
            self.assertEqual(mail['To'],'a@example.com')
            self.assertIn('#token=',mail.get_content())
            self.assertNotIn('&token=',mail.get_content())
        with patch.dict(os.environ,environment),patch('accounts.smtplib.SMTP',side_effect=OSError('test transport error')):
            with self.assertRaises(Exception):accounts.request_email(db,settings,'a@example.com','reset')
        with db.session() as conn:self.assertEqual(conn.execute("SELECT COUNT(*) FROM email_actions WHERE purpose='reset'").fetchone()[0],0)

    def test_production_never_uses_plaintext_demo_smtp(self):
        with patch.dict(os.environ,{'SMTP_HOST':'mailpit','MAIL_FROM':'a@example.test','APP_URL':'https://example.test','SMTP_STARTTLS':'0'}):
            self.assertFalse(accounts.mail_configured(replace(self.client.app.state.settings,environment='production')))

    def test_concurrent_migrations(self):
        with tempfile.TemporaryDirectory() as folder:
            db=Database(Path(folder)/'concurrent.db')
            with ThreadPoolExecutor(max_workers=4) as pool:
                results=list(pool.map(lambda _:db.migrate(),range(4)))
            self.assertEqual(sum(len(r) for r in results),4)
            with db.session() as conn:
                self.assertEqual(conn.execute('SELECT COUNT(*) FROM schema_migrations').fetchone()[0],4)
                self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(),[])
