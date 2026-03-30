CREATE TABLE IF NOT EXISTS foods (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_foods_owner_created_at
  ON foods(owner_type, owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trash_items (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_trash_owner_created_at
  ON trash_items(owner_type, owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_state (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, key)
);

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
