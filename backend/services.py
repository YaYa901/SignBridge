"""Business logic. Pure Python + sqlite3 (no web framework), so it is easy to test."""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import security

SIGN_LANGUAGE_ID = "sample-esl"
LANGUAGE_CODE = "ar-EG-ESL"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_SPEEDS = (0.7, 1.0, 1.3)
DEFAULT_SETTINGS: dict[str, float] = {"player_speed": 1.0, "speech_rate": 1.0}
MESSAGE_LIMIT = 200


# ---------------------------------------------------------------- errors
class ServiceError(Exception):
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ValidationFailed(ServiceError):
    status_code = 422


class Unauthorized(ServiceError):
    status_code = 401


class Forbidden(ServiceError):
    status_code = 403


class NotFound(ServiceError):
    status_code = 404


class Conflict(ServiceError):
    status_code = 409


# ---------------------------------------------------------------- helpers
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def new_id() -> str:
    return uuid4().hex


def normalize_email(email: str) -> str:
    value = (email or "").strip().lower()
    if len(value) > 254 or not EMAIL_RE.match(value):
        raise ValidationFailed("البريد الإلكتروني غير صالح.")
    return value


def clean_text(value: str, *, minimum: int = 1, maximum: int = 500, label: str = "النص") -> str:
    text = (value or "").strip()
    if len(text) < minimum:
        raise ValidationFailed(f"{label} مطلوب.")
    if len(text) > maximum:
        raise ValidationFailed(f"{label} يجب ألا يتجاوز {maximum} حرفاً.")
    return text


def check_password_rules(password: str) -> None:
    if not isinstance(password, str) or not (8 <= len(password) <= 128):
        raise ValidationFailed("كلمة المرور يجب أن تكون بين ٨ و١٢٨ حرفاً.")


# ---------------------------------------------------------------- users
_USER_SQL = """
SELECT u.id, u.email, u.email_verified_at, u.password_hash, u.created_at, u.disabled_at, r.name AS role,
       COALESCE(p.display_name, u.email) AS display_name,
       COALESCE(p.locale, 'ar-EG') AS locale,
       COALESCE(p.settings_json, '{}') AS settings_json
FROM users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN user_profiles p ON p.user_id = u.id
"""


def get_user_record(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute(_USER_SQL + " WHERE u.id = ?", (user_id,)).fetchone()


def _settings_from_json(raw: str) -> dict[str, float]:
    settings = dict(DEFAULT_SETTINGS)
    try:
        stored = json.loads(raw or "{}")
    except ValueError:
        stored = {}
    if isinstance(stored, dict):
        for key in DEFAULT_SETTINGS:
            if stored.get(key) in ALLOWED_SPEEDS:
                settings[key] = float(stored[key])
    return settings


def public_user(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "email_verified": bool(row["email_verified_at"]),
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"],
        "role": row["role"],
        "locale": row["locale"],
        "settings": _settings_from_json(row["settings_json"]),
        "created_at": row["created_at"],
    }


def register_user(conn, *, email, password, display_name, admin_emails=frozenset(), iterations=security.DEFAULT_ITERATIONS):
    email = normalize_email(email)
    check_password_rules(password)
    display_name = clean_text(display_name, maximum=80, label="الاسم")
    if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise Conflict("هذا البريد الإلكتروني مسجّل بالفعل.")
    user_id, now = new_id(), now_iso()
    # Roles are granted by an operator, never by a self-asserted email address.
    role_id = "role-user"
    try:
        conn.execute(
            "INSERT INTO users(id, email, password_hash, role_id, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, email, security.hash_password(password, iterations), role_id, now),
        )
    except sqlite3.IntegrityError:
        raise Conflict("هذا البريد الإلكتروني مسجّل بالفعل.") from None
    conn.execute(
        "INSERT INTO user_profiles(user_id, display_name, locale, created_at) VALUES (?, ?, 'ar-EG', ?)",
        (user_id, display_name, now),
    )
    return get_user_record(conn, user_id)


def authenticate(conn, email: str, password: str) -> sqlite3.Row:
    try:
        email = normalize_email(email)
    except ValidationFailed:
        email = ""
    row = conn.execute(_USER_SQL + " WHERE u.email = ?", (email,)).fetchone() if email else None
    ok = security.verify_password(password or "", row["password_hash"] if row else security.DUMMY_HASH)
    if not row or not ok or row["disabled_at"]:
        raise Unauthorized("البريد الإلكتروني أو كلمة المرور غير صحيحة.")
    return row


def update_display_name(conn, user_id: str, display_name: str):
    name = clean_text(display_name, maximum=80, label="الاسم")
    conn.execute("UPDATE user_profiles SET display_name = ? WHERE user_id = ?", (name, user_id))
    return get_user_record(conn, user_id)


def update_settings(conn, user_id: str, patch: dict[str, Any]):
    row = get_user_record(conn, user_id)
    if row is None:
        raise NotFound("الحساب غير موجود.")
    settings = _settings_from_json(row["settings_json"])
    for key, value in patch.items():
        if value is None:
            continue
        if key not in DEFAULT_SETTINGS or value not in ALLOWED_SPEEDS:
            raise ValidationFailed("قيمة الإعداد غير مدعومة.")
        settings[key] = float(value)
    conn.execute("UPDATE user_profiles SET settings_json = ? WHERE user_id = ?", (json.dumps(settings), user_id))
    return get_user_record(conn, user_id)


def change_password(conn, user_id: str, current: str, new: str, iterations=security.DEFAULT_ITERATIONS):
    row = get_user_record(conn, user_id)
    if row is None:
        raise NotFound("الحساب غير موجود.")
    if not security.verify_password(current or "", row["password_hash"]):
        raise Forbidden("كلمة المرور الحالية غير صحيحة.")
    check_password_rules(new)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (security.hash_password(new, iterations), user_id))
    return get_user_record(conn, user_id)


def delete_account(conn, user_id: str, password: str) -> None:
    row = get_user_record(conn, user_id)
    if row is None:
        raise NotFound("الحساب غير موجود.")
    if not security.verify_password(password or "", row["password_hash"]):
        raise Forbidden("كلمة المرور غير صحيحة.")
    # Rows whose FK is SET NULL / has no cascade would otherwise outlive the account.
    conn.execute("DELETE FROM conversation_sessions WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM user_feedback WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM quiz_results WHERE user_id = ?", (user_id,))
    import hashlib
    conn.execute('DELETE FROM login_attempts WHERE email_hash=?',(hashlib.sha256(row['email'].encode()).hexdigest(),))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


# ---------------------------------------------------------------- translations
def create_translation(conn, user_id: str, direction: str, input_text: str) -> dict[str, Any]:
    import translation
    text = clean_text(input_text, label="النص")
    if direction not in ('text_to_sign', 'sign_to_text'):
        raise ValidationFailed('اتجاه غير مدعوم.')
    result = translation.translator.translate(text) if direction == 'text_to_sign' else {
        'status': 'model_unavailable', 'output_text': None, 'clips': [], 'unknown': [],
        'segments': [], 'message': 'التعرف بالكاميرا غير متاح. النص اليدوي ليس نتيجة تعرف.'}
    row_id, created = new_id(), now_iso()
    conn.execute('INSERT INTO translations(id,direction,language_code,input_text,output_text,status,confidence,created_at,user_id,result_json) VALUES (?,?,?,?,?,?,NULL,?,?,?)',
                 (row_id,direction,LANGUAGE_CODE,text,result['output_text'],result['status'],created,user_id,json.dumps(result,ensure_ascii=False)))
    return dict(id=row_id,direction=direction,language_code=LANGUAGE_CODE,input_text=text,confidence=None,created_at=created,**result)


def list_translations(conn, user_id: str, limit: int = 30, offset: int = 0) -> list[dict[str, Any]]:
    limit = max(1, min(100, limit))
    offset = max(0, offset)
    rows = conn.execute(
        "SELECT id, direction, language_code, input_text, output_text, status, confidence, created_at, result_json"
        " FROM translations WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?",
        (user_id, limit, offset),
    ).fetchall()
    output=[]
    for row in rows:
        item=dict(row)
        result=json.loads(item.pop('result_json') or '{}')
        output.append({**item, **result})
    return output


def delete_translations(conn, user_id: str) -> int:
    return conn.execute("DELETE FROM translations WHERE user_id = ?", (user_id,)).rowcount


# ---------------------------------------------------------------- saved phrases
def list_phrases(conn, user_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, text, created_at FROM saved_phrases WHERE user_id = ? ORDER BY created_at DESC, rowid DESC",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def add_phrase(conn, user_id: str, text: str) -> dict[str, Any]:
    text = clean_text(text)
    existing = conn.execute("SELECT id, text, created_at FROM saved_phrases WHERE user_id = ? AND text = ?", (user_id, text)).fetchone()
    if existing:
        return dict(existing)
    phrase = {"id": new_id(), "text": text, "created_at": now_iso()}
    conn.execute(
        "INSERT INTO saved_phrases(id, user_id, text, created_at) VALUES (?, ?, ?, ?)",
        (phrase["id"], user_id, text, phrase["created_at"]),
    )
    return phrase


def delete_phrase(conn, user_id: str, phrase_id: str) -> None:
    if conn.execute("DELETE FROM saved_phrases WHERE id = ? AND user_id = ?", (phrase_id, user_id)).rowcount == 0:
        raise NotFound("العبارة غير موجودة.")


def clear_phrases(conn, user_id: str) -> int:
    return conn.execute("DELETE FROM saved_phrases WHERE user_id = ?", (user_id,)).rowcount


# ---------------------------------------------------------------- lessons
_LESSON_SQL = """
SELECT l.id, l.title, l.category, l.level, l.icon, l.color, l.is_sample,
       (SELECT COUNT(*) FROM lesson_items i WHERE i.lesson_id = l.id) AS item_count,
       COALESCE(p.progress, 0) AS progress,
       EXISTS(SELECT 1 FROM lesson_bookmarks b WHERE b.lesson_id = l.id AND b.user_id = ?) AS bookmarked
FROM lessons l
LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = ?
WHERE l.published = 1
"""


def _lesson_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["is_sample"] = bool(data["is_sample"])
    data["bookmarked"] = bool(data["bookmarked"])
    data["progress"] = float(data["progress"])
    return data


def list_lessons(conn, user_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(_LESSON_SQL + " ORDER BY l.position, l.title", (user_id, user_id)).fetchall()
    return [_lesson_dict(r) for r in rows]


def get_lesson(conn, user_id: str, lesson_id: str) -> dict[str, Any]:
    row = conn.execute(_LESSON_SQL + " AND l.id = ?", (user_id, user_id, lesson_id)).fetchone()
    if row is None:
        raise NotFound("الدرس غير موجود.")
    lesson = _lesson_dict(row)
    items = conn.execute("SELECT position, gloss FROM lesson_items WHERE lesson_id = ? ORDER BY position", (lesson_id,)).fetchall()
    from translation import MANIFEST
    by_gloss = {s['gloss']: s for s in MANIFEST}
    lesson["items"] = [{**dict(i), 'sign': by_gloss.get(i['gloss'])} for i in items]
    return lesson


def _require_lesson(conn, lesson_id: str) -> None:
    if not conn.execute("SELECT 1 FROM lessons WHERE id = ? AND published = 1", (lesson_id,)).fetchone():
        raise NotFound("الدرس غير موجود.")


def set_progress(conn, user_id: str, lesson_id: str, progress: float) -> dict[str, Any]:
    if not 0 <= progress <= 1:
        raise ValidationFailed("التقدّم يجب أن يكون بين 0 و1.")
    _require_lesson(conn, lesson_id)
    conn.execute(
        "INSERT INTO lesson_progress(user_id, lesson_id, progress, updated_at) VALUES (?, ?, ?, ?)"
        " ON CONFLICT(user_id, lesson_id) DO UPDATE SET progress = excluded.progress, updated_at = excluded.updated_at",
        (user_id, lesson_id, progress, now_iso()),
    )
    return get_lesson(conn, user_id, lesson_id)


def set_bookmark(conn, user_id: str, lesson_id: str, on: bool) -> dict[str, Any]:
    _require_lesson(conn, lesson_id)
    if on:
        conn.execute(
            "INSERT OR IGNORE INTO lesson_bookmarks(user_id, lesson_id, created_at) VALUES (?, ?, ?)",
            (user_id, lesson_id, now_iso()),
        )
    else:
        conn.execute("DELETE FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?", (user_id, lesson_id))
    return get_lesson(conn, user_id, lesson_id)


# ---------------------------------------------------------------- conversation
def _open_session(conn, user_id: str) -> sqlite3.Row:
    row = conn.execute(
        "SELECT id, created_at FROM conversation_sessions WHERE user_id = ? AND ended_at IS NULL"
        " ORDER BY created_at DESC, rowid DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    if row:
        return row
    session_id = new_id()
    conn.execute(
        "INSERT INTO conversation_sessions(id, user_id, language_id, created_at) VALUES (?, ?, ?, ?)",
        (session_id, user_id, SIGN_LANGUAGE_ID, now_iso()),
    )
    return conn.execute("SELECT id, created_at FROM conversation_sessions WHERE id = ?", (session_id,)).fetchone()


def _messages(conn, session_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, speaker_label, text, source, created_at FROM conversation_messages WHERE session_id = ?"
        " ORDER BY created_at DESC, rowid DESC LIMIT ?",
        (session_id, MESSAGE_LIMIT),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


def current_conversation(conn, user_id: str) -> dict[str, Any]:
    session = _open_session(conn, user_id)
    return {"id": session["id"], "created_at": session["created_at"], "messages": _messages(conn, session["id"])}


def add_message(conn, user_id: str, text: str, speaker: str, source: str) -> dict[str, Any]:
    if speaker not in ("me", "other"):
        raise ValidationFailed("المتحدث غير صالح.")
    if source not in ("typed", "dictation"):
        raise ValidationFailed("مصدر الرسالة غير صالح.")
    text = clean_text(text, maximum=1000, label="الرسالة")
    session = _open_session(conn, user_id)
    message = {"id": new_id(), "speaker_label": speaker, "text": text, "source": source, "created_at": now_iso()}
    conn.execute(
        "INSERT INTO conversation_messages(id, session_id, speaker_label, text, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (message["id"], session["id"], speaker, text, source, message["created_at"]),
    )
    return message


def reset_conversation(conn, user_id: str) -> dict[str, Any]:
    conn.execute("UPDATE conversation_sessions SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL", (now_iso(), user_id))
    return current_conversation(conn, user_id)


# ---------------------------------------------------------------- feedback / export / admin
def add_feedback(conn, user_id: str, message: str, translation_id: str | None = None) -> dict[str, Any]:
    message = clean_text(message, minimum=2, maximum=2000, label="الرسالة")
    if translation_id and not conn.execute(
        "SELECT 1 FROM translations WHERE id = ? AND user_id = ?", (translation_id, user_id)
    ).fetchone():
        raise NotFound("الترجمة غير موجودة.")
    feedback_id = new_id()
    conn.execute(
        "INSERT INTO user_feedback(id, user_id, translation_id, message, created_at) VALUES (?, ?, ?, ?, ?)",
        (feedback_id, user_id, translation_id, message, now_iso()),
    )
    return {"id": feedback_id, "created": True}


def export_user_data(conn, user_id: str) -> dict[str, Any]:
    row = get_user_record(conn, user_id)
    if row is None:
        raise NotFound("الحساب غير موجود.")
    sessions = conn.execute(
        "SELECT id, created_at, ended_at FROM conversation_sessions WHERE user_id = ? ORDER BY created_at", (user_id,)
    ).fetchall()
    conversations = []
    for s in sessions:
        msgs = conn.execute(
            "SELECT speaker_label, text, source, created_at FROM conversation_messages WHERE session_id = ? ORDER BY created_at, rowid",
            (s["id"],),
        ).fetchall()
        conversations.append({**dict(s), "messages": [dict(m) for m in msgs]})
    q = lambda sql: [dict(r) for r in conn.execute(sql, (user_id,)).fetchall()]  # noqa: E731
    return {
        "exported_at": now_iso(),
        "account": public_user(row),
        "translations": q("SELECT id, direction, language_code, input_text, output_text, status, result_json, created_at FROM translations WHERE user_id = ? ORDER BY created_at"),
        "saved_phrases": q("SELECT text, created_at FROM saved_phrases WHERE user_id = ? ORDER BY created_at"),
        "lesson_progress": q("SELECT lesson_id, progress, updated_at FROM lesson_progress WHERE user_id = ?"),
        "lesson_bookmarks": q("SELECT lesson_id, created_at FROM lesson_bookmarks WHERE user_id = ?"),
        "feedback": q("SELECT message, created_at FROM user_feedback WHERE user_id = ? ORDER BY created_at"),
        "quiz_results": q("SELECT quiz_id,score,completed_at FROM quiz_results WHERE user_id=? ORDER BY completed_at"),
        "saved_signs": q("SELECT sign_id,created_at FROM saved_signs WHERE user_id=? ORDER BY created_at"),
        "conversations": conversations,
    }


def admin_stats(conn) -> dict[str, int]:
    count = lambda table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]  # noqa: E731
    return {
        "users": count("users"), "translations": count("translations"), "saved_phrases": count("saved_phrases"),
        "conversation_messages": count("conversation_messages"), "feedback": count("user_feedback"),
    }
