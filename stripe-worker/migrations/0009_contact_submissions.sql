-- Unapplied replacement for the paused contact acknowledgement migration.
-- No existing order/checkout tables or data are changed.
CREATE TABLE contact_submissions (
  id TEXT PRIMARY KEY,
  submission_key TEXT NOT NULL UNIQUE,
  content_fingerprint TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  inquiry_type TEXT NOT NULL,
  product_interest TEXT NOT NULL,
  quantity_scale TEXT NOT NULL,
  message TEXT NOT NULL,
  source_page TEXT NOT NULL,
  form_location TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACCEPTED','QUEUED','PROCESSED','REVIEW','FAILED')),
  ack_requested INTEGER NOT NULL CHECK(ack_requested IN (0,1)),
  queued_at INTEGER,
  processed_at INTEGER,
  queue_lease_until INTEGER NOT NULL DEFAULT 0,
  queue_claim TEXT,
  last_error TEXT
);
CREATE INDEX contact_outbox ON contact_submissions(queued_at, queue_lease_until);
CREATE INDEX contact_status_created ON contact_submissions(status, created_at);
CREATE TABLE contact_deliveries (
  submission_id TEXT NOT NULL REFERENCES contact_submissions(id),
  kind TEXT NOT NULL CHECK(kind IN ('ack','internal')),
  status TEXT NOT NULL CHECK(status IN ('PENDING','SENT','FAILED','SKIPPED')),
  first_attempt_at INTEGER,
  lease_until INTEGER NOT NULL DEFAULT 0,
  claim_token TEXT,
  payload_hash TEXT,
  provider_message_id TEXT,
  sent_at INTEGER,
  last_error TEXT,
  PRIMARY KEY(submission_id, kind)
);

-- Non-unique: observability only; identical content is still accepted.
CREATE INDEX contact_content_fingerprint ON contact_submissions(content_fingerprint);
CREATE TABLE maintenance_monitor_state (
  monitor_key TEXT PRIMARY KEY CHECK(monitor_key = 'd1-storage'),
  last_checked_at INTEGER,
  last_size_bytes INTEGER,
  last_tier TEXT NOT NULL DEFAULT 'NORMAL',
  last_alert_sent_at INTEGER,
  last_alert_tier TEXT,
  pending_alert TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  claim_token TEXT
);
