ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pre_checkout_query_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_pre_checkout_query_id
  ON orders(pre_checkout_query_id)
  WHERE pre_checkout_query_id IS NOT NULL;
