ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
UPDATE sessions SET last_seen = CAST(strftime('%s','now') AS INTEGER) * 1000;
