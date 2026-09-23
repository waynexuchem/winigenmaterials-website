CREATE TABLE private_checkout_attempts (
  winigen_order_id TEXT NOT NULL REFERENCES test_orders(winigen_order_id),
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  state TEXT NOT NULL CHECK (state IN ('CREATING', 'OPEN', 'UNUSABLE')),
  expires_at INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  PRIMARY KEY (winigen_order_id, attempt)
);
