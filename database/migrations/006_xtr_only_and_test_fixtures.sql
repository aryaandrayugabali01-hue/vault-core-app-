-- VAULT CORE: move all internal pricing and finance snapshots to XTR.
-- Existing application data was empty when this migration was prepared.
ALTER TABLE products RENAME COLUMN cost_price_idr TO cost_price_xtr;
ALTER TABLE products DROP COLUMN sale_price_idr;
ALTER TABLE products ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders RENAME COLUMN total_cost_idr TO total_cost_xtr;
ALTER TABLE orders DROP COLUMN total_sale_idr;

ALTER TABLE order_items RENAME COLUMN unit_cost_idr TO unit_cost_xtr;
ALTER TABLE order_items DROP COLUMN unit_sale_idr;

ALTER TABLE operating_expenses RENAME COLUMN amount_idr TO amount_xtr;
