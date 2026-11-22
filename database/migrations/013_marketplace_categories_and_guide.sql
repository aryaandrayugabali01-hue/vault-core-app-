-- CR-07: Owner-managed marketplace categories, purchase guides and product image gallery.
-- Additive only. Existing products remain uncategorized until the Owner assigns a category.
CREATE TABLE marketplace_categories (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '◇',
  purchase_guide JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_categories_slug_check CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 64
  ),
  CONSTRAINT marketplace_categories_name_check CHECK (length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT marketplace_categories_description_check CHECK (length(description) <= 500),
  CONSTRAINT marketplace_categories_icon_check CHECK (length(btrim(icon)) BETWEEN 1 AND 24),
  CONSTRAINT marketplace_categories_guide_check CHECK (
    jsonb_typeof(purchase_guide) = 'array' AND jsonb_array_length(purchase_guide) <= 12
  ),
  CONSTRAINT marketplace_categories_sort_check CHECK (sort_order BETWEEN 0 AND 10000)
);

ALTER TABLE products
  ADD COLUMN marketplace_category_id BIGINT REFERENCES marketplace_categories(id) ON DELETE RESTRICT,
  ADD COLUMN image_gallery JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
  ADD CONSTRAINT products_image_gallery_check CHECK (
    jsonb_typeof(image_gallery) = 'array' AND jsonb_array_length(image_gallery) <= 8
  );

CREATE INDEX idx_products_marketplace_category_status
  ON products(marketplace_category_id,status);

CREATE INDEX idx_marketplace_categories_active_sort
  ON marketplace_categories(is_active,sort_order,name);

COMMENT ON COLUMN products.marketplace_category_id IS
  'Owner-selected marketplace category. NULL preserves legacy SKU until Owner assigns a category.';
COMMENT ON COLUMN products.image_gallery IS
  'Owner-managed HTTPS or local /assets image URLs; maximum eight gallery images.';
