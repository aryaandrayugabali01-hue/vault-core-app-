ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS reserved_order_id BIGINT REFERENCES orders(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_reservation_owner_check'
      AND conrelid = 'inventory_items'::regclass
  ) THEN
    ALTER TABLE inventory_items
      ADD CONSTRAINT inventory_reservation_owner_check
      CHECK (
        (status = 'RESERVED' AND reserved_order_id IS NOT NULL AND reserved_until IS NOT NULL)
        OR
        (status <> 'RESERVED' AND reserved_order_id IS NULL AND reserved_until IS NULL)
      );
  END IF;
END
$$;

ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_status_check;

ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_status_check
  CHECK (status IN ('PENDING','READY','DELIVERED','FAILED','REVOKED','REVIEW_REQUIRED'));

CREATE INDEX IF NOT EXISTS idx_inventory_reservation_order_status
  ON inventory_items(reserved_order_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_active_inventory
  ON deliveries(inventory_item_id)
  WHERE inventory_item_id IS NOT NULL
    AND status IN ('PENDING','READY','FAILED','REVIEW_REQUIRED');
