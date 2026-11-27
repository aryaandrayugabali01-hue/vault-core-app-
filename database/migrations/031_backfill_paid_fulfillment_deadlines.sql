UPDATE order_items oi
SET is_account_snapshot = (p.fulfillment_type = 'GAME_ACCOUNT_TRANSFER')
FROM products p
WHERE p.id = oi.product_id
  AND oi.is_account_snapshot IS DISTINCT FROM (p.fulfillment_type = 'GAME_ACCOUNT_TRANSFER');

UPDATE order_items oi
SET fulfillment_deadline_at = NULL
FROM orders o
WHERE o.id = oi.order_id
  AND o.paid_at IS NULL;

UPDATE order_items oi
SET fulfillment_deadline_at = CASE
  WHEN oi.availability_mode_snapshot = 'INDENT'
       AND oi.indent_deadline_days_snapshot > 0
    THEN o.paid_at + (oi.indent_deadline_days_snapshot * INTERVAL '1 day')
  WHEN oi.availability_mode_snapshot = 'READY'
    THEN o.paid_at + INTERVAL '1 hour'
  ELSE NULL
END
FROM orders o
WHERE o.id = oi.order_id
  AND o.paid_at IS NOT NULL
  AND oi.is_account_snapshot = TRUE;

COMMENT ON COLUMN order_items.fulfillment_deadline_at IS
  'Deadline snapshot calculated from verified paid_at using the READY SLA or accepted INDENT calendar-day snapshot.';
