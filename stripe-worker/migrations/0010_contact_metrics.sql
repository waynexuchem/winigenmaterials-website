CREATE TABLE contact_daily_metrics (
  day TEXT PRIMARY KEY,
  accepted INTEGER NOT NULL DEFAULT 0 CHECK (accepted >= 0),
  turnstile_rejected INTEGER NOT NULL DEFAULT 0 CHECK (turnstile_rejected >= 0),
  honeypot_rejected INTEGER NOT NULL DEFAULT 0 CHECK (honeypot_rejected >= 0),
  validation_rejected INTEGER NOT NULL DEFAULT 0 CHECK (validation_rejected >= 0),
  origin_or_security_rejected INTEGER NOT NULL DEFAULT 0 CHECK (origin_or_security_rejected >= 0),
  duplicate_suppressed INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_suppressed >= 0),
  ack_sent INTEGER NOT NULL DEFAULT 0 CHECK (ack_sent >= 0),
  internal_sent INTEGER NOT NULL DEFAULT 0 CHECK (internal_sent >= 0),
  delivery_failed INTEGER NOT NULL DEFAULT 0 CHECK (delivery_failed >= 0)
);

CREATE TABLE contact_weekly_reports (
  week_end TEXT PRIMARY KEY,
  message_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','REVIEW')),
  first_attempt_at INTEGER,
  lease_until INTEGER NOT NULL DEFAULT 0,
  claim_token TEXT,
  provider_message_id TEXT
);
