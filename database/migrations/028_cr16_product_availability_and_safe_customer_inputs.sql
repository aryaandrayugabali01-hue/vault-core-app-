ALTER TABLE products
 ADD COLUMN IF NOT EXISTS availability_mode TEXT NOT NULL DEFAULT 'READY',
 ADD COLUMN IF NOT EXISTS indent_deadline_days INTEGER,
 ADD COLUMN IF NOT EXISTS stock_quantity_declared INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS stock_source_reference TEXT,
 ADD COLUMN IF NOT EXISTS customer_input_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE order_items
 ADD COLUMN IF NOT EXISTS availability_mode_snapshot TEXT NOT NULL DEFAULT 'READY',
 ADD COLUMN IF NOT EXISTS indent_deadline_days_snapshot INTEGER,
 ADD COLUMN IF NOT EXISTS fulfillment_deadline_at TIMESTAMPTZ;
ALTER TABLE products
 ADD CONSTRAINT products_availability_mode_check
 CHECK ((availability_mode='READY' AND indent_deadline_days IS NULL) OR (availability_mode='INDENT' AND indent_deadline_days>0));
ALTER TABLE products
 ADD CONSTRAINT products_customer_input_fields_array_check
 CHECK (jsonb_typeof(customer_input_fields)='array');
ALTER TABLE order_items
 ADD CONSTRAINT order_items_availability_mode_snapshot_check
 CHECK (availability_mode_snapshot IN ('READY','INDENT'));

COMMENT ON COLUMN products.availability_mode IS 'READY/INDENT for game account; READY for Joki and item service slots.';
COMMENT ON COLUMN products.indent_deadline_days IS 'Calendar-day INDENT deadline shown before checkout.';
COMMENT ON COLUMN products.customer_input_fields IS 'Safe buyer game identity and service parameters; no authentication secrets.';
COMMENT ON COLUMN order_items.fulfillment_deadline_at IS 'Deadline snapshot at order creation.';

-- Preserve the exact account availability and fulfillment deadline agreed at checkout.
UPDATE order_items
 SET availability_mode_snapshot='READY'
 WHERE availability_mode_snapshot IS NULL;
