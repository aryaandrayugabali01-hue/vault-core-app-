ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS customer_input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_account_snapshot BOOLEAN NOT NULL DEFAULT FALSE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='order_items_customer_input_snapshot_object_check'
      AND conrelid='public.order_items'::regclass
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_customer_input_snapshot_object_check
      CHECK (jsonb_typeof(customer_input_snapshot)='object');
  END IF;
END $$;
COMMENT ON COLUMN order_items.customer_input_snapshot IS 'Per-order buyer game identity and service parameters; authentication secrets are prohibited.';
COMMENT ON COLUMN order_items.is_account_snapshot IS 'Whether this order line is a game-account transfer; used to start manual-delivery SLA after verified payment.';
UPDATE order_items oi SET fulfillment_deadline_at=NULL FROM orders o WHERE o.id=oi.order_id AND o.status='PENDING_PAYMENT';