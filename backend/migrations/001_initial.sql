-- SIGNBRIDGE relational schema baseline. Sample content must be labeled sample.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, description TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY(role_id, permission_id));
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role_id TEXT NOT NULL REFERENCES roles(id), created_at TEXT NOT NULL, disabled_at TEXT);
CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, display_name TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'ar-EG', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sign_languages (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, region TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('planned','active','retired')));
CREATE TABLE IF NOT EXISTS sign_categories (id TEXT PRIMARY KEY, language_id TEXT NOT NULL REFERENCES sign_languages(id), name TEXT NOT NULL, slug TEXT NOT NULL, UNIQUE(language_id,slug));
CREATE TABLE IF NOT EXISTS signs (id TEXT PRIMARY KEY, language_id TEXT NOT NULL REFERENCES sign_languages(id), category_id TEXT REFERENCES sign_categories(id), gloss TEXT NOT NULL, description TEXT, review_status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sign_media (id TEXT PRIMARY KEY, sign_id TEXT NOT NULL REFERENCES signs(id) ON DELETE CASCADE, media_url TEXT NOT NULL, media_type TEXT NOT NULL, license TEXT NOT NULL, attribution TEXT, reviewed_by TEXT REFERENCES users(id));
CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, language_id TEXT NOT NULL REFERENCES sign_languages(id), title TEXT NOT NULL, level TEXT NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS lesson_progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, progress REAL NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 1), updated_at TEXT NOT NULL, PRIMARY KEY(user_id,lesson_id));
CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, title TEXT NOT NULL, content_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quiz_results (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quizzes(id), user_id TEXT NOT NULL REFERENCES users(id), score REAL NOT NULL, completed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS translations (id TEXT PRIMARY KEY, direction TEXT NOT NULL, language_code TEXT NOT NULL, input_text TEXT, output_text TEXT, status TEXT NOT NULL, confidence REAL CHECK(confidence IS NULL OR confidence BETWEEN 0 AND 1), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS conversation_sessions (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, language_id TEXT REFERENCES sign_languages(id), created_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE IF NOT EXISTS conversation_messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE, speaker_label TEXT, text TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_signs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, sign_id TEXT NOT NULL REFERENCES signs(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(user_id,sign_id));
CREATE TABLE IF NOT EXISTS user_feedback (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, translation_id TEXT REFERENCES translations(id) ON DELETE SET NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS model_versions (id TEXT PRIMARY KEY, language_id TEXT NOT NULL REFERENCES sign_languages(id), version TEXT NOT NULL, model_card_url TEXT, dataset_license TEXT NOT NULL, evaluation_json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_translations_created ON translations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sign_language_category ON signs(language_id,category_id);
CREATE INDEX IF NOT EXISTS idx_conversation_session_created ON conversation_messages(session_id,created_at);
-- Explicitly labeled sample language metadata. Not a deployed or evaluated model.
INSERT OR IGNORE INTO sign_languages(id,code,name,region,status) VALUES ('sample-esl','ar-EG-ESL','Egyptian Sign Language','Egypt','planned');
INSERT OR IGNORE INTO roles(id,name) VALUES ('role-user','user'),('role-student','student'),('role-instructor','instructor'),('role-admin','admin');
