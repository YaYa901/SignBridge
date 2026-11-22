import json
import re
import time
from pathlib import Path
from unittest.mock import patch
import unittest
import test_api as api_helpers
from main import create_app
from fastapi.testclient import TestClient
import accounts
import translation

class FeatureTests(unittest.TestCase):
    setUp=api_helpers.ApiTests.setUp
    tearDown=api_helpers.ApiTests.tearDown
    register=api_helpers.ApiTests.register
    def test_dictionary_normalization_partial_and_unknown(self):
        self.register()
        for text,status,count in [('صَبَاح الخَيْر، عامل ايه!','dictionary_match',2),('مش عايز','dictionary_match',1),('صباح الخير موز','partial',1),('موز','unsupported',0)]:
            r=self.client.post('/api/translations',json={'direction':'text_to_sign','input_text':text})
            self.assertEqual(r.status_code,201,r.text)
            self.assertEqual(r.json()['status'],status)
            self.assertEqual(len(r.json()['clips']),count)
            self.assertIsNone(r.json()['confidence'])
        r=self.client.post('/api/translations',json={'direction':'sign_to_text','input_text':'manual'})
        self.assertIsNone(r.json()['output_text'])
        self.assertEqual(r.json()['status'],'model_unavailable')
        for s in self.client.get('/api/dictionary').json():
            self.assertEqual(self.client.get(s['media_url']).status_code,200)
            self.assertEqual(s['license'],'CC BY 4.0')

    def test_cookie_csrf_logout_revocation(self):
        h=self.register()
        token=self.client.cookies.get(accounts.COOKIE)
        self.assertNotIn('access_token',self.client.post('/api/auth/login',json={'email':'a@example.com','password':'password123'}).json())
        self.assertIn('HttpOnly',self.client.post('/api/auth/login',json={'email':'a@example.com','password':'password123'}).headers['set-cookie'])
        self.assertEqual(self.client.post('/api/auth/logout',headers={**h,'origin':'https://evil.example'}).status_code,403)
        self.client.headers.pop('X-SignBridge')
        self.assertEqual(self.client.post('/api/auth/logout',headers=h).status_code,403)
        self.client.headers['X-SignBridge']='1'
        self.assertEqual(self.client.post('/api/auth/logout',headers=h).status_code,200)
        self.assertEqual(self.client.get('/api/auth/me',headers={'Cookie':accounts.COOKIE+'='+token}).status_code,401)

    def test_lockout_survives_new_app(self):
        self.register()
        for _ in range(5):
            self.assertEqual(self.client.post('/api/auth/login',json={'email':'a@example.com','password':'bad'}).status_code,401)
        with TestClient(create_app(self.client.app.state.settings),headers={'X-SignBridge':'1'}) as other:
            self.assertEqual(other.post('/api/auth/login',json={'email':'a@example.com','password':'password123'}).status_code,401)

    def test_durable_rate_limit(self):
        db=self.client.app.state.db
        self.assertTrue(accounts.allow_rate(db,'unit','ip',1))
        from database import Database
        self.assertFalse(accounts.allow_rate(Database(db.path),'unit','ip',1))

    def email_token(self,purpose):
        files=sorted((self.client.app.state.db.path.parent/'dev-outbox').glob('*.eml'),key=lambda p:p.stat().st_mtime_ns)
        from email import policy
        from email.parser import BytesParser
        for path in reversed(files):
            msg=BytesParser(policy=policy.default).parsebytes(path.read_bytes())
            text=msg.get_content()
            if 'purpose='+purpose in text:
                return re.search(r'token=([A-Za-z0-9_-]+)',text).group(1)
        self.fail('No action email')

    def test_email_verify_reset_one_use_expiry_and_revocation(self):
        h=self.register();settings=self.client.app.state.settings
        token=self.email_token('verify')
        body={'token':token,'purpose':'verify'}
        self.assertEqual(self.client.post('/api/auth/complete-email',json=body).status_code,200)
        self.assertTrue(self.client.get('/api/auth/me').json()['email_verified'])
        self.assertEqual(self.client.post('/api/auth/complete-email',json=body).status_code,422)
        accounts.request_email(self.client.app.state.db,settings,'a@example.com','reset')
        reset=self.email_token('reset')
        body={'token':reset,'purpose':'reset','password':'a-new-password'}
        self.assertEqual(self.client.post('/api/auth/complete-email',json=body).status_code,200)
        self.assertEqual(self.client.get('/api/auth/me',headers=h).status_code,401)
        self.assertEqual(self.client.post('/api/auth/complete-email',json=body).status_code,422)
        self.assertEqual(self.client.post('/api/auth/login',json={'email':'a@example.com','password':'a-new-password'}).status_code,200)
        accounts.request_email(self.client.app.state.db,settings,'a@example.com','reset')
        token=self.email_token('reset')
        with self.client.app.state.db.session() as conn:
            conn.execute('UPDATE email_actions SET expires_at=0')
        self.assertEqual(self.client.post('/api/auth/complete-email',json={'token':token,'purpose':'reset','password':'a-new-password'}).status_code,422)
        unknown=self.client.post('/api/auth/request-email',json={'email':'unknown@example.com','purpose':'reset'})
        self.assertEqual(unknown.status_code,200)
        self.assertNotIn('token',unknown.json())

    def test_quiz_saved_sign_feedback_export_deletion(self):
        h=self.register();db=self.client.app.state.db
        lesson='dictionary-1'
        quiz=self.client.get('/api/lessons/'+lesson+'/quiz').json()
        self.assertTrue(quiz['questions'])
        self.assertNotIn('answer',quiz['questions'][0])
        self.assertEqual(self.client.put('/api/lessons/'+lesson+'/progress',json={'progress':1}).status_code,422)
        with db.session() as conn:
            answers={q['id']:q['answer'] for q in json.loads(conn.execute('SELECT content_json FROM quizzes WHERE lesson_id=?',(lesson,)).fetchone()[0])}
        r=self.client.post('/api/lessons/'+lesson+'/quiz',json={'answers':answers})
        self.assertEqual(r.json()['score'],1)
        self.assertEqual(self.client.get('/api/lessons/'+lesson).json()['progress'],1)
        sign=translation.MANIFEST[0]['id']
        self.assertEqual(self.client.put('/api/dictionary/'+sign+'/saved').status_code,200)
        self.assertTrue(self.client.get('/api/dictionary').json()[0]['saved'])
        tr=self.client.post('/api/translations',json={'direction':'text_to_sign','input_text':'صباح الخير'}).json()
        self.client.post('/api/feedback',json={'message':'review please','translation_id':tr['id']})
        data=self.client.get('/api/me/export').json()
        self.assertEqual(len(data['quiz_results']),1)
        self.assertEqual(len(data['saved_signs']),1)
        self.assertEqual(data['translations'][0]['output_text'],'صباح الخير')
        self.assertEqual(self.client.get('/api/admin/feedback').status_code,403)
        with db.session() as conn:
            uid=conn.execute('SELECT id FROM users').fetchone()[0]
            conn.execute("UPDATE users SET role_id='role-admin',email_verified_at='yes'")
            conn.execute('UPDATE sign_media SET reviewed_by=?',(uid,))
        self.assertEqual(len(self.client.get('/api/admin/feedback').json()),1)
        self.assertEqual(self.client.post('/api/auth/delete-account',json={'password':'password123'}).status_code,200)
        with db.session() as conn:
            for table in ('users','user_profiles','translations','quiz_results','saved_signs','auth_sessions','email_actions','conversation_sessions','conversation_messages','user_feedback'):
                self.assertEqual(conn.execute('SELECT COUNT(*) FROM '+table).fetchone()[0],0,table)
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM sign_media WHERE reviewed_by IS NOT NULL').fetchone()[0],0)
            self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_translation_pagination_limits(self):
        self.register()
        with self.client.app.state.db.session() as conn:
            uid=conn.execute('SELECT id FROM users').fetchone()[0]
            import services
            for _ in range(105): services.create_translation(conn,uid,'text_to_sign','تمام')
        self.assertEqual(len(self.client.get('/api/translations?limit=10000').json()),100)
        self.assertEqual(len(self.client.get('/api/translations?limit=100&offset=100').json()),5)
        self.assertEqual(len(self.client.get('/api/translations?limit=-5').json()),1)
        self.assertEqual(len(self.client.get('/api/me/export').json()['translations']),105)
