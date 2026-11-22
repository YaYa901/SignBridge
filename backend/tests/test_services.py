"""Service-layer tests (stdlib only):  python -m unittest discover -s tests -v   (from backend/)"""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import security  # noqa: E402
import services as sv  # noqa: E402
from database import Database  # noqa: E402

ITER = 1000  # fast hashing for tests


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(Path(self.tmp.name) / "t.db")
        self.db.migrate()

    def tearDown(self):
        self.tmp.cleanup()

    def user(self, conn, email="a@example.com", name="Maryam"):
        return sv.register_user(conn, email=email, password="password123", display_name=name, iterations=ITER)["id"]

    # --- migrations
    def test_migrations_idempotent_and_seeded(self):
        self.assertEqual(self.db.migrate(), [])
        with self.db.session() as c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0], 4)
            counts = {r["id"]: r["item_count"] for r in sv.list_lessons(c, "x")}
            self.assertEqual(counts, {"lesson-greetings": 12, "lesson-numbers": 10, "lesson-family": 8, "lesson-school": 14})

    def test_upgrade_from_legacy_starter_db(self):
        path = Path(self.tmp.name) / "legacy.db"
        legacy = sqlite3.connect(path)
        legacy.executescript(
            "CREATE TABLE translations (id TEXT PRIMARY KEY, direction TEXT NOT NULL, language_code TEXT NOT NULL,"
            " input_text TEXT, output_text TEXT, status TEXT NOT NULL, confidence REAL, created_at TEXT NOT NULL);"
            "CREATE TABLE feedback (id TEXT PRIMARY KEY, message TEXT, created_at TEXT);"
            "INSERT INTO translations VALUES ('old','text_to_sign','ar-EG-ESL','x',NULL,'model_unavailable',NULL,'2025-01-01');")
        legacy.commit(); legacy.close()
        d = Database(path)
        self.assertEqual(len(d.migrate()), 4)
        with d.session() as c:
            self.assertEqual(c.execute("SELECT user_id FROM translations WHERE id='old'").fetchone()[0], None)

    # --- auth
    def test_register_login_and_errors(self):
        with self.db.session() as c:
            row = sv.register_user(c, email=" Maryam@Example.com ", password="password123", display_name=" مريم ", iterations=ITER)
            self.assertEqual(row["email"], "maryam@example.com")
            self.assertEqual(row["display_name"], "مريم")
            self.assertEqual(row["role"], "user")
            with self.assertRaises(sv.Conflict):
                sv.register_user(c, email="MARYAM@example.com", password="password123", display_name="x", iterations=ITER)
            with self.assertRaises(sv.ValidationFailed):
                sv.register_user(c, email="bad", password="password123", display_name="x", iterations=ITER)
            with self.assertRaises(sv.ValidationFailed):
                sv.register_user(c, email="b@example.com", password="short", display_name="x", iterations=ITER)
            self.assertEqual(sv.authenticate(c, "maryam@example.com", "password123")["id"], row["id"])
            for bad in (("maryam@example.com", "wrong-pass"), ("nobody@example.com", "password123"), ("", "")):
                with self.assertRaises(sv.Unauthorized):
                    sv.authenticate(c, *bad)

    def test_admin_email_does_not_grant_admin_role(self):
        with self.db.session() as c:
            row = sv.register_user(c, email="boss@example.com", password="password123", display_name="Boss",
                                   admin_emails=frozenset({"boss@example.com"}), iterations=ITER)
            self.assertEqual(row["role"], "user")
            self.assertEqual(sv.admin_stats(c)["users"], 1)

    def test_password_change_invalidates_fingerprint(self):
        with self.db.session() as c:
            row = sv.register_user(c, email='a@example.com', password='password123', display_name='A', iterations=ITER)
            old = security.fingerprint(row['password_hash'])
            self.assertTrue(security.verify_password('password123',row['password_hash']))
            self.assertFalse(security.verify_password('bad',row['password_hash']))
            new = sv.change_password(c,row['id'],'password123','newpassword456',ITER)
            self.assertNotEqual(security.fingerprint(new['password_hash']),old)
            with self.assertRaises(sv.Forbidden):
                sv.change_password(c,row['id'],'wrong','newpassword456',ITER)

    def test_settings_validation(self):
        with self.db.session() as c:
            uid = self.user(c)
            row = sv.update_settings(c, uid, {"player_speed": 1.3, "speech_rate": None})
            self.assertEqual(sv.public_user(row)["settings"], {"player_speed": 1.3, "speech_rate": 1.0})
            with self.assertRaises(sv.ValidationFailed):
                sv.update_settings(c, uid, {"player_speed": 9})
            with self.assertRaises(sv.ValidationFailed):
                sv.update_settings(c, uid, {"evil": 1})

    # --- translations: honesty + isolation
    def test_translations_never_invent_output_and_are_per_user(self):
        with self.db.session() as c:
            a, b = self.user(c), self.user(c, "b@example.com", "B")
            t = sv.create_translation(c, a, "text_to_sign", "  صباح الخير ")
            self.assertEqual((t["status"], t["output_text"], t["confidence"], t["input_text"]), ("dictionary_match", "صباح الخير", None, "صباح الخير"))
            self.assertEqual(len(t['clips']),1)
            sv.create_translation(c, a, "sign_to_text", "يدوي")
            self.assertEqual([x["direction"] for x in sv.list_translations(c, a)], ["sign_to_text", "text_to_sign"])
            self.assertEqual(sv.list_translations(c, b), [])
            with self.assertRaises(sv.ValidationFailed):
                sv.create_translation(c, a, "text_to_sign", "   ")
            with self.assertRaises(sv.ValidationFailed):
                sv.create_translation(c, a, "text_to_sign", "x" * 501)
            self.assertEqual(len(sv.list_translations(c, a, 0)),1)
            self.assertEqual(sv.delete_translations(c, b), 0)
            self.assertEqual(sv.delete_translations(c, a), 2)

    # --- phrases
    def test_phrases_dedupe_and_ownership(self):
        with self.db.session() as c:
            a, b = self.user(c), self.user(c, "b@example.com", "B")
            p1 = sv.add_phrase(c, a, "شكراً")
            self.assertEqual(sv.add_phrase(c, a, "شكراً")["id"], p1["id"])
            self.assertEqual(len(sv.list_phrases(c, a)), 1)
            with self.assertRaises(sv.NotFound):
                sv.delete_phrase(c, b, p1["id"])
            sv.delete_phrase(c, a, p1["id"])
            self.assertEqual(sv.list_phrases(c, a), [])

    # --- lessons
    def test_lessons_progress_bookmark(self):
        with self.db.session() as c:
            a = self.user(c)
            lesson = sv.set_progress(c, a, "lesson-numbers", 1)
            self.assertEqual((lesson["progress"], len(lesson["items"])), (1.0, 10))
            self.assertTrue(sv.set_bookmark(c, a, "lesson-numbers", True)["bookmarked"])
            self.assertFalse(sv.set_bookmark(c, a, "lesson-numbers", False)["bookmarked"])
            with self.assertRaises(sv.NotFound):
                sv.set_progress(c, a, "nope", 0.5)
            with self.assertRaises(sv.ValidationFailed):
                sv.set_progress(c, a, "lesson-numbers", 2)
            first = sv.list_lessons(c, a)[0]
            self.assertEqual(first["id"], "lesson-greetings")

    # --- conversation
    def test_conversation_flow(self):
        with self.db.session() as c:
            a = self.user(c)
            self.assertEqual(sv.current_conversation(c, a)["messages"], [])
            sv.add_message(c, a, "مرحباً", "me", "typed")
            sv.add_message(c, a, "أهلاً", "other", "dictation")
            conv = sv.current_conversation(c, a)
            self.assertEqual([m["text"] for m in conv["messages"]], ["مرحباً", "أهلاً"])
            with self.assertRaises(sv.ValidationFailed):
                sv.add_message(c, a, "x", "stranger", "typed")
            fresh = sv.reset_conversation(c, a)
            self.assertNotEqual(fresh["id"], conv["id"])
            self.assertEqual(fresh["messages"], [])

    # --- feedback / export / delete
    def test_feedback_export_and_account_deletion(self):
        with self.db.session() as c:
            a, b = self.user(c), self.user(c, "b@example.com", "B")
            t = sv.create_translation(c, a, "text_to_sign", "hi")
            sv.add_feedback(c, a, "ممتاز", t["id"])
            with self.assertRaises(sv.NotFound):
                sv.add_feedback(c, b, "no", t["id"])
            sv.add_phrase(c, a, "p"); sv.add_message(c, a, "m", "me", "typed"); sv.set_bookmark(c, a, "lesson-family", True)
            data = sv.export_user_data(c, a)
            self.assertEqual((len(data["translations"]), len(data["saved_phrases"]), len(data["conversations"][0]["messages"])), (1, 1, 1))
            self.assertNotIn("password_hash", str(data))
            with self.assertRaises(sv.Forbidden):
                sv.delete_account(c, a, "wrong")
            sv.delete_account(c, a, "password123")
            for table in ("users", "translations", "saved_phrases", "conversation_sessions", "conversation_messages",
                          "user_feedback", "lesson_bookmarks", "user_profiles"):
                n = c.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                self.assertEqual(n, 1 if table in ("users", "user_profiles") else 0, table)  # only user b remains


if __name__ == "__main__":
    unittest.main()
