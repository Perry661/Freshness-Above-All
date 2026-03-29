PRAGMA foreign_keys=off;

ALTER TABLE foods RENAME TO foods_legacy;
CREATE TABLE foods (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, id)
);
CREATE INDEX idx_foods_owner_created_at
  ON foods(owner_type, owner_id, created_at DESC);
INSERT INTO foods (owner_type, owner_id, id, created_at, payload)
SELECT
  'guest',
  'legacy-import',
  id,
  COALESCE(json_extract(payload, '$.createdAt'), CURRENT_TIMESTAMP),
  payload
FROM foods_legacy;
DROP TABLE foods_legacy;

ALTER TABLE trash_items RENAME TO trash_items_legacy;
CREATE TABLE trash_items (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, id)
);
CREATE INDEX idx_trash_owner_created_at
  ON trash_items(owner_type, owner_id, created_at DESC);
INSERT INTO trash_items (owner_type, owner_id, id, created_at, payload)
SELECT
  'guest',
  'legacy-import',
  id,
  COALESCE(json_extract(payload, '$.deletedAt'), CURRENT_TIMESTAMP),
  payload
FROM trash_items_legacy;
DROP TABLE trash_items_legacy;

ALTER TABLE app_state RENAME TO app_state_legacy;
CREATE TABLE app_state (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, key)
);
INSERT INTO app_state (owner_type, owner_id, key, value)
SELECT 'guest', 'legacy-import', key, value
FROM app_state_legacy;
DROP TABLE app_state_legacy;

PRAGMA foreign_keys=on;
