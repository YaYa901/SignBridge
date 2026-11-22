"""HTTP tests. Need the real dependencies:  pip install -r requirements.txt httpx
Run from backend/:  python -m unittest discover -s tests -v
"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from fastapi.testclient import TestClient
    HAVE_DEPS = True
except ImportError:  # fastapi/httpx not installed
    HAVE_DEPS = False

if HAVE_DEPS:
    from config import Settings
    from main import create_app


@unittest.skipUnless(HAVE_DEPS, "fastapi + httpx are required (pip install -r requirements.txt httpx)")
class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        settings = Settings(
            database_path=Path(self.tmp.name) / "api.db", cors_origins=("http://localhost:5173",),
            rate_limit_per_minute=10_000, auth_rate_limit_per_minute=1000, password_iterations=1000,
        )
        self.client = TestClient(create_app(settings))
        self.client.headers['X-SignBridge']='1'
        self.client.__enter__()  # runs lifespan => migrations

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.tmp.cleanup()

    def register(self, email="a@example.com", name="مريم"):
        r = self.client.post("/api/auth/register", json={"email": email, "password": "password123", "display_name": name})
        self.assertEqual(r.status_code, 201, r.text)
        return {'Cookie':f"signbridge_session={self.client.cookies.get('signbridge_session')}"}

    def test_health_and_auth_required(self):
        self.assertEqual(self.client.get("/api/health").json()["database"], "ok")
        r = self.client.get("/api/translations")
        self.assertEqual(r.status_code, 401)

    def test_register_login_me(self):
        h = self.register()
        self.assertEqual(self.client.get("/api/auth/me", headers=h).json()["display_name"], "مريم")
        self.assertEqual(self.client.post("/api/auth/register", json={"email": "a@example.com", "password": "password123", "display_name": "x"}).status_code, 409)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "a@example.com", "password": "bad"}).status_code, 401)
        ok = self.client.post("/api/auth/login", json={"email": "A@example.com", "password": "password123"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(self.client.post("/api/auth/register", json={"email": "z"}).status_code, 422)

    def test_translation_is_honest_and_private(self):
        h1, h2 = self.register(), self.register("b@example.com", "B")
        r = self.client.post("/api/translations", headers=h1, json={"direction": "text_to_sign", "input_text": "صباح الخير"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.json()["status"], r.json()["output_text"]), ("dictionary_match", "صباح الخير"))
        self.assertEqual(len(self.client.get("/api/translations", headers=h1).json()), 1)
        self.assertEqual(self.client.get("/api/translations", headers=h2).json(), [])
        self.assertEqual(self.client.delete("/api/translations", headers=h1).json()["deleted"], 1)

    def test_phrases_lessons_conversation(self):
        h = self.register()
        pid = self.client.post("/api/saved-phrases", headers=h, json={"text": "شكراً"}).json()["id"]
        self.assertEqual(self.client.delete(f"/api/saved-phrases/{pid}", headers=h).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/saved-phrases/{pid}", headers=h).status_code, 404)
        self.assertEqual(len(self.client.get("/api/lessons", headers=h).json()), 10)
        self.assertEqual(self.client.put("/api/lessons/lesson-numbers/progress", headers=h, json={"progress": 1}).json()["progress"], 1.0)
        self.assertTrue(self.client.put("/api/lessons/lesson-numbers/bookmark", headers=h).json()["bookmarked"])
        self.client.post("/api/conversation/messages", headers=h, json={"text": "مرحباً", "speaker": "me"})
        self.assertEqual(len(self.client.get("/api/conversation", headers=h).json()["messages"]), 1)
        self.assertEqual(self.client.post("/api/conversation/reset", headers=h).json()["messages"], [])

    def test_password_change_invalidates_old_token_and_delete_account(self):
        h = self.register()
        r = self.client.post("/api/auth/change-password", headers=h, json={"current_password": "password123", "new_password": "another-pass-1"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers=h).status_code, 401)
        h2 = {'Cookie':f"signbridge_session={self.client.cookies.get('signbridge_session')}"}
        self.assertEqual(self.client.get("/api/auth/me", headers=h2).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/delete-account", headers=h2, json={"password": "nope"}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/delete-account", headers=h2, json={"password": "another-pass-1"}).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers=h2).status_code, 401)

    def test_admin_only_stats(self):
        user, admin = self.register(), self.register("admin@example.com", "Admin")
        self.assertEqual(self.client.get('/api/admin/stats',headers=admin).status_code,403)
        with self.client.app.state.db.session() as conn:
            conn.execute("UPDATE users SET role_id='role-admin',email_verified_at='2026-11-22' WHERE email='admin@example.com'")
        self.assertEqual(self.client.get("/api/admin/stats", headers=user).status_code, 403)
        self.assertEqual(self.client.get("/api/admin/stats", headers=admin).json()["users"], 2)


if __name__ == "__main__":
    unittest.main()
