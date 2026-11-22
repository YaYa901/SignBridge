-- App tables/columns on top of the baseline schema (001). Applied once by database.py.
ALTER TABLE translations ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_profiles ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE lessons ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN color TEXT NOT NULL DEFAULT 'mint';
ALTER TABLE lessons ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS lesson_items (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  gloss TEXT NOT NULL,
  UNIQUE(lesson_id, position)
);
CREATE TABLE IF NOT EXISTS lesson_bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS saved_phrases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL,
  UNIQUE(user_id, text)
);
CREATE INDEX IF NOT EXISTS idx_translations_user ON translations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_phrases_user ON saved_phrases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON conversation_sessions(user_id, created_at DESC);
