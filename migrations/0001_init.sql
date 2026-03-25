-- Temp Email D1 Schema
CREATE TABLE inbox (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_inbox_expires ON inbox(expires_at);

CREATE TABLE mail (
  id TEXT PRIMARY KEY,
  inbox_id TEXT NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,
  from_addr TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  headers TEXT NOT NULL DEFAULT '{}',
  received_at INTEGER NOT NULL
);
CREATE INDEX idx_mail_inbox ON mail(inbox_id, received_at DESC);
