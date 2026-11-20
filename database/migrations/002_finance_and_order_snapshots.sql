ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_sale_idr BIGINT NOT NULL DEFAULT 0;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_sale_idr BIGINT;

CREATE TABLE IF NOT EXISTS operating_expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_idr BIGINT NOT NULL CHECK (amount_idr > 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_telegram_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_paid_at ON transactions(status, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_occurred_at ON operating_expenses(occurred_at DESC);
