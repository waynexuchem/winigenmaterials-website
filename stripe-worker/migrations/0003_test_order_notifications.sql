CREATE TABLE IF NOT EXISTS test_order_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_event_id TEXT NOT NULL,
  winigen_order_id TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('INTERNAL', 'CUSTOMER_TEST')),
  intended_customer_email TEXT,
  actual_recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (stripe_event_id, notification_type),
  FOREIGN KEY (winigen_order_id) REFERENCES test_orders(winigen_order_id)
);

CREATE INDEX IF NOT EXISTS idx_test_order_notifications_order
  ON test_order_notifications(winigen_order_id);
