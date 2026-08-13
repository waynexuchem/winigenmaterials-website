ALTER TABLE test_orders ADD COLUMN checkout_cart_hash TEXT;
ALTER TABLE test_orders ADD COLUMN merchandise_amount INTEGER;
ALTER TABLE test_orders ADD COLUMN shipping_amount INTEGER;
ALTER TABLE test_orders ADD COLUMN shipping_class TEXT;
ALTER TABLE test_orders ADD COLUMN catalog_version TEXT;

CREATE TABLE IF NOT EXISTS test_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  winigen_order_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  package_label TEXT NOT NULL,
  package_unit TEXT NOT NULL,
  package_quantity REAL NOT NULL,
  unit_amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  stripe_price_id TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (winigen_order_id) REFERENCES test_orders(winigen_order_id)
);

CREATE INDEX IF NOT EXISTS idx_test_order_lines_order
  ON test_order_lines(winigen_order_id);
