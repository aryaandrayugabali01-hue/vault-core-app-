-- CR-06: Owner-managed product details and customer-facing fulfillment metadata.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_terms TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fulfillment_eta TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_image_url_https_or_local_asset'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_image_url_https_or_local_asset
      CHECK (
        image_url IS NULL
        OR image_url ~* '^https://'
        OR image_url ~ '^/assets/[A-Za-z0-9_./-]+$'
      );
  END IF;
END $$;

COMMENT ON COLUMN products.image_url IS
  'Owner-managed public HTTPS image URL or local /assets path; binary uploads are not implied.';
COMMENT ON COLUMN products.customer_terms IS
  'Owner-authored product-specific customer purchase and fulfillment terms.';
COMMENT ON COLUMN products.fulfillment_eta IS
  'Owner-authored expected fulfillment time text; blank means not specified.';
