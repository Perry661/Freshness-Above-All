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

CREATE TABLE IF NOT EXISTS push_subscriptions (
  email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  subscription_json TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (email, endpoint),
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_email
  ON push_subscriptions(email);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  email TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (email, delivery_date, notification_type),
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_email_date
  ON notification_deliveries(email, delivery_date DESC);
