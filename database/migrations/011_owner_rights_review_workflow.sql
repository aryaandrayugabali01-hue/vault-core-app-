-- CR-05: structured Owner-controlled product rights reviews and inventory source binding.
-- Additive migration; existing commercial examples and TEST ONLY fixtures retain their statuses.

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_fulfillment_type_check;

ALTER TABLE products
  ADD CONSTRAINT products_fulfillment_type_check
  CHECK (fulfillment_type IS NULL OR fulfillment_type IN (
    'REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','GIFT_CODE','DIGITAL_FILE',
    'SERVICE_INSTRUCTIONS','GAME_ACCOUNT_TRANSFER'
  ));

CREATE TABLE IF NOT EXISTS product_rights_reviews (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  rights_basis TEXT NOT NULL CHECK (rights_basis IN (
    'OWNER_CREATED','OWNER_OWNED','AUTHORIZED_VENDOR','OFFICIAL_DISTRIBUTION',
    'LICENSED_CONTENT','SERVICE','OTHER'
  )),
  publisher_platform TEXT NOT NULL,
  official_terms_url TEXT,
  authorization_evidence_reference TEXT,
  chain_of_title TEXT NOT NULL,
  transfer_method TEXT NOT NULL,
  region TEXT NOT NULL,
  reviewer_telegram_user_id TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  review_notes TEXT NOT NULL DEFAULT '',
  owner_attested BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_rights_review_validity_check CHECK (valid_until > reviewed_at),
  CONSTRAINT product_rights_review_publisher_check CHECK (length(btrim(publisher_platform)) BETWEEN 2 AND 160),
  CONSTRAINT product_rights_review_chain_check CHECK (length(btrim(chain_of_title)) BETWEEN 3 AND 4000),
  CONSTRAINT product_rights_review_transfer_check CHECK (length(btrim(transfer_method)) BETWEEN 3 AND 2000),
  CONSTRAINT product_rights_review_region_check CHECK (length(btrim(region)) BETWEEN 2 AND 240),
  CONSTRAINT product_rights_review_terms_url_check CHECK (
    official_terms_url IS NULL OR official_terms_url ~* '^https://'
  ),
  CONSTRAINT product_rights_review_evidence_required CHECK (
    review_status <> 'APPROVED'
    OR (
      owner_attested = TRUE
      AND (
        (rights_basis IN ('OWNER_CREATED','OWNER_OWNED','SERVICE') AND upper(publisher_platform)='INTERNAL_OWNER')
        OR (
          authorization_evidence_reference IS NOT NULL
          AND length(btrim(authorization_evidence_reference)) >= 3
        )
      )
      AND (
        upper(publisher_platform) = 'INTERNAL_OWNER'
        OR (
          official_terms_url IS NOT NULL
          AND length(btrim(official_terms_url)) >= 10
        )
      )
    )
  ),
  UNIQUE (id, product_id)
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS current_rights_review_id BIGINT;

ALTER TABLE products
  ADD CONSTRAINT products_current_rights_review_fk
  FOREIGN KEY (current_rights_review_id, id)
  REFERENCES product_rights_reviews(id, product_id);

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS rights_review_id BIGINT
    REFERENCES product_rights_reviews(id),
  ADD COLUMN IF NOT EXISTS source_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_product_rights_reviews_product_history
  ON product_rights_reviews(product_id, reviewed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_product_rights_reviews_validity
  ON product_rights_reviews(product_id, review_status, valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_rights_review_source
  ON inventory_items(rights_review_id, source_reference);

CREATE TABLE IF NOT EXISTS product_rights_review_events (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  rights_review_id BIGINT NOT NULL REFERENCES product_rights_reviews(id),
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  actor_telegram_user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_rights_review_events_history
  ON product_rights_review_events(product_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION vault_core_prevent_rights_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PRODUCT_RIGHTS_REVIEW_EVENTS_ARE_APPEND_ONLY'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_product_rights_events_append_only ON product_rights_review_events;
CREATE TRIGGER trg_product_rights_events_append_only
BEFORE UPDATE OR DELETE ON product_rights_review_events
FOR EACH ROW
EXECUTE FUNCTION vault_core_prevent_rights_event_mutation();

CREATE OR REPLACE FUNCTION vault_core_enforce_product_rights_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  review product_rights_reviews%ROWTYPE;
BEGIN
  IF NEW.status <> 'ACTIVE' OR COALESCE(NEW.is_test, FALSE) = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO review
  FROM product_rights_reviews
  WHERE id = NEW.current_rights_review_id
    AND product_id = NEW.id;

  IF NOT FOUND
     OR review.review_status <> 'APPROVED'
     OR review.valid_until <= NOW()
     OR review.owner_attested IS NOT TRUE
     OR length(btrim(review.chain_of_title)) < 3
     OR length(btrim(review.transfer_method)) < 3
     OR length(btrim(review.region)) < 2
     OR length(btrim(review.publisher_platform)) < 2 THEN
    RAISE EXCEPTION 'PRODUCT_RIGHTS_REVIEW_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_current_rights_review';
  END IF;

  IF (review.rights_basis NOT IN ('OWNER_CREATED','OWNER_OWNED','SERVICE')
      OR upper(review.publisher_platform) <> 'INTERNAL_OWNER')
     AND (review.authorization_evidence_reference IS NULL
          OR length(btrim(review.authorization_evidence_reference)) < 3) THEN
    RAISE EXCEPTION 'PRODUCT_RIGHTS_AUTHORIZATION_REFERENCE_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_authorization_reference';
  END IF;

  IF upper(review.publisher_platform) <> 'INTERNAL_OWNER'
     AND (review.official_terms_url IS NULL OR review.official_terms_url !~* '^https://') THEN
    RAISE EXCEPTION 'PRODUCT_OFFICIAL_TERMS_URL_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_official_terms_url';
  END IF;

  IF NEW.fulfillment_type IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_FULFILLMENT_TYPE_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_fulfillment_type';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_rights_activation ON products;
CREATE TRIGGER trg_products_rights_activation
BEFORE INSERT OR UPDATE OF status, current_rights_review_id, fulfillment_type, is_test
ON products
FOR EACH ROW
EXECUTE FUNCTION vault_core_enforce_product_rights_activation();

CREATE OR REPLACE FUNCTION vault_core_enforce_inventory_rights_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  product_record products%ROWTYPE;
  review product_rights_reviews%ROWTYPE;
BEGIN
  SELECT * INTO product_record FROM products WHERE id = NEW.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_PRODUCT_NOT_FOUND';
  END IF;

  IF COALESCE(product_record.is_test, FALSE) = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO review
  FROM product_rights_reviews
  WHERE id = NEW.rights_review_id
    AND product_id = NEW.product_id;

  IF NOT FOUND
     OR product_record.current_rights_review_id IS DISTINCT FROM NEW.rights_review_id
     OR review.review_status <> 'APPROVED'
     OR review.valid_until <= NOW()
     OR NEW.source_reference IS NULL
     OR length(btrim(NEW.source_reference)) < 3 THEN
    RAISE EXCEPTION 'INVENTORY_RIGHTS_SOURCE_REVIEW_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'inventory_requires_current_rights_source_review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_rights_source ON inventory_items;
CREATE TRIGGER trg_inventory_rights_source
BEFORE INSERT OR UPDATE OF product_id, rights_review_id, source_reference
ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION vault_core_enforce_inventory_rights_source();
