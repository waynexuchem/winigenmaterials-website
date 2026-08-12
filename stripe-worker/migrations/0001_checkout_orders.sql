CREATE TABLE IF NOT EXISTS order_sequences (
  order_date TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_orders (
  winigen_order_id TEXT PRIMARY KEY,
  checkout_attempt_id TEXT NOT NULL UNIQUE,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_event_id TEXT,
  customer_email TEXT,
  amount INTEGER,
  currency TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  fulfillment_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  checkout_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_orders_session
  ON test_orders(stripe_checkout_session_id);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
