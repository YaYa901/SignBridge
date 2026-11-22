-- Persistent cookie sessions, one-use email actions and abuse controls.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, password_version TEXT NOT NULL, expires_at REAL NOT NULL);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE email_actions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')), expires_at REAL NOT NULL);
CREATE TABLE login_attempts (email_hash TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, locked_until REAL NOT NULL DEFAULT 0, last_attempt REAL NOT NULL);
CREATE TABLE rate_hits (scope TEXT NOT NULL, client_hash TEXT NOT NULL, at REAL NOT NULL);
CREATE INDEX idx_rate_hits ON rate_hits(scope,client_hash,at);
ALTER TABLE translations ADD COLUMN result_json TEXT;
CREATE TRIGGER delete_user_private_rows BEFORE DELETE ON users BEGIN
 DELETE FROM conversation_sessions WHERE user_id=OLD.id;
 DELETE FROM user_feedback WHERE user_id=OLD.id;
 DELETE FROM quiz_results WHERE user_id=OLD.id;
 UPDATE sign_media SET reviewed_by=NULL WHERE reviewed_by=OLD.id;
END;
