"""Cookie sessions, durable throttles, SMTP email and one-use account actions."""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import secrets
import smtplib
import ssl
import time
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlencode
import security
import services

COOKIE = 'signbridge_session'

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def issue_session(conn, user, settings):
    now=time.time()
    conn.execute('DELETE FROM auth_sessions WHERE expires_at < ?', (now,))
    token=secrets.token_urlsafe(32)
    conn.execute('INSERT INTO auth_sessions VALUES (?,?,?,?)',
                 (digest(token),user['id'],security.fingerprint(user['password_hash']),now+settings.session_expire_minutes*60))
    return token

def set_cookie(response, token, settings):
    response.set_cookie(COOKIE,token,max_age=settings.session_expire_minutes*60,httponly=True,
                        secure=settings.environment=='production',samesite='strict',path='/')

def get_user(conn, token):
    session=conn.execute('SELECT * FROM auth_sessions WHERE token_hash=? AND expires_at>?',(digest(token),time.time())).fetchone()
    if not session:
        raise services.Unauthorized('انتهت الجلسة. سجل الدخول من جديد.')
    user=services.get_user_record(conn,session['user_id'])
    if not user or user['disabled_at'] or not hmac.compare_digest(session['password_version'],security.fingerprint(user['password_hash'])):
        raise services.Unauthorized('انتهت الجلسة. سجل الدخول من جديد.')
    return user

def allow_rate(db, scope, client, limit):
    now=time.time()
    with db.session() as conn:
        conn.execute('BEGIN IMMEDIATE')
        conn.execute('DELETE FROM rate_hits WHERE at < ?', (now-60,))
        key=digest(client)
        count=conn.execute('SELECT COUNT(*) FROM rate_hits WHERE scope=? AND client_hash=?',(scope,key)).fetchone()[0]
        if count>=limit:
            return False
        conn.execute('INSERT INTO rate_hits VALUES (?,?,?)',(scope,key,now))
    return True

def login(db,email,password,iterations):
    key=digest(email.strip().lower());now=time.time()
    with db.session() as conn:
        attempt=conn.execute('SELECT * FROM login_attempts WHERE email_hash=?',(key,)).fetchone()
        if attempt and attempt['locked_until']>now:
            raise services.Unauthorized('تعذر تسجيل الدخول. حاول بعد ١٥ دقيقة أو استعد كلمة المرور.')
    row=None
    with db.session() as conn:
        try:
            row=services.authenticate(conn,email,password)
        except services.Unauthorized:
            # Match the configured KDF work factor even for an unknown account.
            if not conn.execute('SELECT 1 FROM users WHERE email=?',(email.strip().lower(),)).fetchone():
                security.hash_password(password or '', iterations)
        conn.execute('DELETE FROM login_attempts WHERE last_attempt < ?', (now-86400,))
        if row:
            conn.execute('DELETE FROM login_attempts WHERE email_hash=?',(key,))
        else:
            conn.execute('INSERT INTO login_attempts VALUES (?,1,0,?) ON CONFLICT(email_hash) DO UPDATE SET failures=CASE WHEN last_attempt<? THEN 1 ELSE failures+1 END,last_attempt=excluded.last_attempt', (key,now,now-900))
            conn.execute('UPDATE login_attempts SET locked_until=? WHERE email_hash=? AND failures>=5',(now+900,key))
    if row is None:
        raise services.Unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
    return row

def mail_configured(settings):
    host=os.getenv('SMTP_HOST','')
    if not host:return settings.environment!='production'
    if not os.getenv('MAIL_FROM'):return False
    if settings.environment=='production':
        return os.getenv('APP_URL','').startswith('https://') and os.getenv('SMTP_STARTTLS','1')!='0'
    return True

def request_email(db,settings,email,purpose):
    if not mail_configured(settings):
        raise services.ServiceError('إرسال البريد غير مهيأ. يلزم إعداد SMTP وAPP_URL على الخادم.')
    token=secrets.token_urlsafe(32)
    with db.session() as conn:
        row=conn.execute('SELECT id,email,email_verified_at FROM users WHERE email=? AND disabled_at IS NULL',(email.strip().lower(),)).fetchone()
        if not row or (purpose=='verify' and row['email_verified_at']):
            return {'message':'لو البريد مسجل ومحتاج الإجراء، هتوصلك رسالة.'}
        conn.execute('DELETE FROM email_actions WHERE expires_at < ?', (time.time(),))
        conn.execute('DELETE FROM email_actions WHERE user_id=? AND purpose=?',(row['id'],purpose))
        conn.execute('INSERT INTO email_actions VALUES (?,?,?,?)',(digest(token),row['id'],purpose,time.time()+(1800 if purpose=='reset' else 86400)))
    base=os.getenv('APP_URL','http://localhost:5173').rstrip('/')
    link=base+'/account-action?'+urlencode({'purpose':purpose})+'#'+urlencode({'token':token})
    message=EmailMessage();message['From']=os.getenv('MAIL_FROM') or 'SignBridge <no-reply@localhost>';message['To']=row['email']
    message['Subject']='SignBridge: '+('تأكيد البريد الإلكتروني' if purpose=='verify' else 'استعادة كلمة المرور')
    message.set_content(('افتح الرابط لإتمام الإجراء. لو لم تطلبه تجاهل الرسالة.\n\n')+link)
    try:
        if os.getenv('SMTP_HOST'):
            with smtplib.SMTP(os.environ['SMTP_HOST'],int(os.getenv('SMTP_PORT','587')),timeout=15) as smtp:
                if os.getenv('SMTP_STARTTLS','1')!='0':
                    smtp.starttls(context=ssl.create_default_context())
                elif settings.environment=='production':
                    raise services.ServiceError('Production SMTP requires TLS.')
                if os.getenv('SMTP_USER'):
                    smtp.login(os.environ['SMTP_USER'],os.environ['SMTP_PASSWORD'])
                smtp.send_message(message)
        else:
            folder=db.path.parent/'dev-outbox';folder.mkdir(mode=0o700,parents=True,exist_ok=True)
            path=folder/(secrets.token_hex(12)+'.eml')
            path.write_bytes(message.as_bytes());path.chmod(0o600)
    except (OSError,smtplib.SMTPException):
        with db.session() as conn:
            conn.execute('DELETE FROM email_actions WHERE token_hash=?',(digest(token),))
        raise services.ServiceError('تعذر إرسال الرسالة. حاول لاحقاً.') from None
    return {'message':'لو البريد مسجل ومحتاج الإجراء، هتوصلك رسالة.'}

def consume_email(conn,token,purpose,password,settings):
    conn.execute('BEGIN IMMEDIATE')
    row=conn.execute('SELECT * FROM email_actions WHERE token_hash=? AND purpose=? AND expires_at>?',(digest(token),purpose,time.time())).fetchone()
    if not row:
        raise services.ValidationFailed('الرابط غير صالح أو انتهت صلاحيته.')
    if purpose=='verify':
        conn.execute('UPDATE users SET email_verified_at=? WHERE id=?',(services.now_iso(),row['user_id']))
    else:
        services.check_password_rules(password)
        conn.execute('UPDATE users SET password_hash=? WHERE id=?',(security.hash_password(password,settings.password_iterations),row['user_id']))
        conn.execute('DELETE FROM auth_sessions WHERE user_id=?',(row['user_id'],))
        user=services.get_user_record(conn,row['user_id'])
        conn.execute('DELETE FROM login_attempts WHERE email_hash=?',(digest(user['email']),))
    conn.execute('DELETE FROM email_actions WHERE user_id=? AND purpose=?',(row['user_id'],purpose))
    return {'message':'تم تأكيد البريد.' if purpose=='verify' else 'تم تغيير كلمة المرور. سجل الدخول من جديد.'}
