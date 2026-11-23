-- CR-08: Owner-managed structured product attributes for category-specific filters.
-- Additive only. Existing product rows receive an empty object and remain subject to CR-05.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_attributes_object_check') THEN
    ALTER TABLE products
      ADD CONSTRAINT products_attributes_object_check
      CHECK (
        jsonb_typeof(attributes)='object'
        AND jsonb_object_length(attributes)<=24
        AND pg_column_size(attributes)<=4096
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_attributes_gin
  ON products USING GIN (attributes jsonb_path_ops);

COMMENT ON COLUMN products.attributes IS
  'Owner-managed product attributes; each material change requires a fresh CR-05 review.';
