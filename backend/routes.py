"""HTTP routes. Thin wrappers around services.py."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, Query
import accounts
import json
import os

import schemas
import services
from database import Database
from config import Settings

router = APIRouter(prefix="/api")


def _db(request: Request) -> Database:
    return request.app.state.db


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def current_user(request: Request) -> dict:
    token=request.cookies.get(accounts.COOKIE)
    if not token:
        raise services.Unauthorized('يلزم تسجيل الدخول.')
    with _db(request).session() as conn:
        row=accounts.get_user(conn,token)
        return services.public_user(row)


CurrentUser = Annotated[dict, Depends(current_user)]


def require_admin(user: CurrentUser) -> dict:
    if user["role"] != "admin" or not user.get('email_verified'):
        raise services.Forbidden("هذه الصلاحية لمسؤول ببريد مؤكد فقط.")
    return user


def _token_response(request: Request, response: Response, row) -> dict:
    s = _settings(request)
    with _db(request).session() as conn:
        token=accounts.issue_session(conn,row,s)
    accounts.set_cookie(response,token,s)
    return {'expires_in':s.session_expire_minutes*60,'user':services.public_user(row)}


# ------------------------------------------------------------------ health
@router.get("/health")
def health(request: Request):
    with _db(request).session() as conn:
        conn.execute("SELECT 1").fetchone()
    return {"status": "ok", "database": "ok", "disposable_demo": _settings(request).demo_mode, "dictionary_entries": 32, "text_to_sign": "isolated_word_dictionary", "recognition_model": "not_configured", "sign_language": services.LANGUAGE_CODE}


# ------------------------------------------------------------------ auth
@router.post("/auth/register", status_code=201)
def register(body: schemas.RegisterBody, request: Request, response: Response):
    s = _settings(request)
    with _db(request).session() as conn:
        row = services.register_user(
            conn, email=body.email, password=body.password, display_name=body.display_name,
            iterations=s.password_iterations,
        )
    result=_token_response(request, response, row)
    try:
        accounts.request_email(_db(request),s,row['email'],'verify')
        result['verification_delivery']='smtp_accepted' if os.getenv('SMTP_HOST') else 'development_outbox'
    except services.ServiceError:
        result['verification_delivery']='unavailable'
    return result


@router.post("/auth/login")
def login(body: schemas.LoginBody, request: Request, response: Response):
    row=accounts.login(_db(request),body.email,body.password,_settings(request).password_iterations)
    return _token_response(request, response, row)


@router.get("/auth/me")
def me(user: CurrentUser):
    return user


@router.patch("/auth/me")
def update_me(body: schemas.ProfileBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.public_user(services.update_display_name(conn, user["id"], body.display_name))


@router.put("/settings")
def put_settings(body: schemas.SettingsBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        row = services.update_settings(conn, user["id"], body.model_dump())
    return services.public_user(row)


@router.post("/auth/change-password")
def change_password(body: schemas.ChangePasswordBody, request: Request, response: Response, user: CurrentUser):
    s = _settings(request)
    with _db(request).session() as conn:
        row = services.change_password(conn, user["id"], body.current_password, body.new_password, s.password_iterations)
        conn.execute('DELETE FROM auth_sessions WHERE user_id=?',(user['id'],))
    return _token_response(request, response, row)


@router.post("/auth/delete-account")
def delete_account(body: schemas.DeleteAccountBody, request: Request, response: Response, user: CurrentUser):
    with _db(request).session() as conn:
        services.delete_account(conn, user["id"], body.password)
    response.delete_cookie(accounts.COOKIE,path='/')
    return {"deleted": True}


@router.post('/auth/logout')
def logout(request: Request, response: Response):
    with _db(request).session() as conn:
        conn.execute('DELETE FROM auth_sessions WHERE token_hash=?',(accounts.digest(request.cookies.get(accounts.COOKIE,'')),))
    response.delete_cookie(accounts.COOKIE,path='/')
    return {'logged_out':True}


@router.post('/auth/request-email')
def request_email(body: schemas.EmailRequestBody, request: Request):
    return accounts.request_email(_db(request),_settings(request),body.email,body.purpose)


@router.post('/auth/complete-email')
def complete_email(body: schemas.EmailActionBody, request: Request):
    with _db(request).session() as conn:
        return accounts.consume_email(conn,body.token,body.purpose,body.password,_settings(request))


@router.get("/me/export")
def export_data(request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.export_user_data(conn, user["id"])


# ------------------------------------------------------------------ translations
@router.post("/translations", status_code=201)
def create_translation(body: schemas.TranslationBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.create_translation(conn, user["id"], body.direction, body.input_text)


@router.get("/translations")
def list_translations(request: Request, user: CurrentUser, limit: int = 30, offset: int = Query(0,ge=0,le=1000000)):
    with _db(request).session() as conn:
        return services.list_translations(conn, user["id"], limit, offset)


@router.delete("/translations")
def delete_translations(request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return {"deleted": services.delete_translations(conn, user["id"])}


# ------------------------------------------------------------------ saved phrases
@router.get("/saved-phrases")
def list_phrases(request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.list_phrases(conn, user["id"])


@router.post("/saved-phrases", status_code=201)
def add_phrase(body: schemas.PhraseBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.add_phrase(conn, user["id"], body.text)


@router.delete("/saved-phrases")
def clear_phrases(request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return {"deleted": services.clear_phrases(conn, user["id"])}


@router.delete("/saved-phrases/{phrase_id}")
def delete_phrase(phrase_id: str, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        services.delete_phrase(conn, user["id"], phrase_id)
    return {"deleted": True}


# ------------------------------------------------------------------ lessons
@router.get("/lessons")
def list_lessons(request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.list_lessons(conn, user["id"])


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.get_lesson(conn, user["id"], lesson_id)


@router.put("/lessons/{lesson_id}/progress")
def set_progress(lesson_id: str, body: schemas.ProgressBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        if lesson_id.startswith('dictionary-'):
            best=conn.execute('SELECT MAX(r.score) FROM quiz_results r JOIN quizzes q ON q.id=r.quiz_id WHERE r.user_id=? AND q.lesson_id=?',(user['id'],lesson_id)).fetchone()[0] or 0
            if body.progress > best:
                raise services.ValidationFailed('التقدم في دروس الفيديو يعتمد على نتيجة الاختبار.')
        return services.set_progress(conn, user["id"], lesson_id, body.progress)


@router.put("/lessons/{lesson_id}/bookmark")
def add_bookmark(lesson_id: str, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.set_bookmark(conn, user["id"], lesson_id, True)


@router.delete("/lessons/{lesson_id}/bookmark")
def remove_bookmark(lesson_id: str, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.set_bookmark(conn, user["id"], lesson_id, False)


# ------------------------------------------------------------------ conversation
@router.get("/conversation")
def get_conversation(request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.current_conversation(conn, user["id"])


@router.post("/conversation/messages", status_code=201)
def post_message(body: schemas.MessageBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.add_message(conn, user["id"], body.text, body.speaker, body.source)


@router.post("/conversation/reset")
def reset_conversation(request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.reset_conversation(conn, user["id"])


# ------------------------------------------------------------------ feedback / admin
@router.post("/feedback", status_code=201)
def create_feedback(body: schemas.FeedbackBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        return services.add_feedback(conn, user["id"], body.message, body.translation_id)


@router.get("/admin/stats")
def admin_stats(request: Request, admin: Annotated[dict, Depends(require_admin)]):
    with _db(request).session() as conn:
        return services.admin_stats(conn)


@router.get('/dictionary')
def dictionary(request: Request, user: CurrentUser):
    from translation import MANIFEST
    with _db(request).session() as conn:
        saved={r[0] for r in conn.execute('SELECT sign_id FROM saved_signs WHERE user_id=?',(user['id'],))}
    return [{**s,'saved':s['id'] in saved} for s in MANIFEST]


@router.put('/dictionary/{sign_id}/saved')
def save_sign(sign_id: str, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        if not conn.execute('SELECT 1 FROM signs WHERE id=?',(sign_id,)).fetchone():
            raise services.NotFound('الإشارة غير موجودة.')
        conn.execute('INSERT OR IGNORE INTO saved_signs VALUES (?,?,?)',(user['id'],sign_id,services.now_iso()))
    return {'saved':True}


@router.delete('/dictionary/{sign_id}/saved')
def unsave_sign(sign_id: str, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        conn.execute('DELETE FROM saved_signs WHERE user_id=? AND sign_id=?',(user['id'],sign_id))
    return {'saved':False}


@router.get('/lessons/{lesson_id}/quiz')
def get_quiz(lesson_id: str, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        row=conn.execute('SELECT * FROM quizzes WHERE lesson_id=?',(lesson_id,)).fetchone()
        if not row:
            raise services.NotFound('لا يوجد اختبار لهذا الدرس النصي.')
        questions=json.loads(row['content_json'])
        best=conn.execute('SELECT MAX(score) FROM quiz_results WHERE user_id=? AND quiz_id=?',(user['id'],row['id'])).fetchone()[0]
    return {'id':row['id'],'title':row['title'],'best_score':best,'questions':[{k:v for k,v in q.items() if k!='answer'} for q in questions]}


@router.post('/lessons/{lesson_id}/quiz')
def submit_quiz(lesson_id: str, body: schemas.QuizAnswersBody, request: Request, user: CurrentUser):
    with _db(request).session() as conn:
        row=conn.execute('SELECT * FROM quizzes WHERE lesson_id=?',(lesson_id,)).fetchone()
        if not row:
            raise services.NotFound('الاختبار غير موجود.')
        questions=json.loads(row['content_json'])
        if set(body.answers)!={q['id'] for q in questions} or any(body.answers[q['id']] not in q['options'] for q in questions):
            raise services.ValidationFailed('أجب عن كل الأسئلة باختيار من الاختيارات المتاحة.')
        correct=sum(body.answers[q['id']]==q['answer'] for q in questions)
        score=correct/len(questions)
        conn.execute('INSERT INTO quiz_results VALUES (?,?,?,?,?)',(services.new_id(),row['id'],user['id'],score,services.now_iso()))
        old=conn.execute('SELECT progress FROM lesson_progress WHERE user_id=? AND lesson_id=?',(user['id'],lesson_id)).fetchone()
        services.set_progress(conn,user['id'],lesson_id,max(old[0] if old else 0,score))
        return {'score':score,'correct':correct,'total':len(questions),'answers':{q['id']:q['answer'] for q in questions}}


@router.get('/admin/feedback')
def feedback_list(request: Request, admin: Annotated[dict, Depends(require_admin)], limit: int=50, offset: int=Query(0,ge=0,le=1000000)):
    with _db(request).session() as conn:
        return [dict(r) for r in conn.execute('SELECT id,user_id,translation_id,message,created_at FROM user_feedback ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',(max(1,min(100,limit)),offset))]


@router.get('/auth/email-status')
def email_status(request: Request):
    import os
    s=_settings(request)
    if not accounts.mail_configured(s):return {'mode':'unavailable'}
    if os.getenv('SMTP_HOST') and os.getenv('SMTP_TEST_MAILBOX')=='1':return {'mode':'ethereal_test'}
    if os.getenv('SMTP_HOST'):
        return {'mode':'test_mailbox' if s.environment!='production' and os.getenv('SMTP_DEMO')=='1' else 'smtp'}
    return {'mode':'local_outbox'}
