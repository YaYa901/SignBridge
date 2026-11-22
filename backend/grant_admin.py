import argparse
from config import Settings
from database import Database

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description='Grant admin only to a verified existing account. Run on the server.')
    parser.add_argument('email')
    args=parser.parse_args()
    db=Database(Settings.from_env().database_path);db.migrate()
    with db.session() as conn:
        row=conn.execute('SELECT id FROM users WHERE email=? AND email_verified_at IS NOT NULL AND disabled_at IS NULL',(args.email.strip().lower(),)).fetchone()
        if not row:
            parser.error('An active, email-verified account is required. No role was changed.')
        conn.execute("UPDATE users SET role_id='role-admin' WHERE id=?",(row['id'],))
    print('Admin role granted to the verified account.')
