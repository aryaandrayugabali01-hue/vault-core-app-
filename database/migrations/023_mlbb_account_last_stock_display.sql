-- 023: Show the last available MLBB-001 account as a customer-facing stock status.
-- This is limited to the single SKU explicitly selected for the approved detail page.
UPDATE products
SET display_stock_mode='EXACT_COUNT',
    display_stock_override=NULL,
    updated_at=NOW()
WHERE sku='ML-001'
  AND game_category='MLBB'
  AND status='ACTIVE'
  AND fulfillment_type='GAME_ACCOUNT_TRANSFER';
