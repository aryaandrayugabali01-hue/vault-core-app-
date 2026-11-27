-- CR-17: remove publisher-specific requirements from commercial account activation.
-- Publisher/platform details and references remain optional product-review metadata.

ALTER TABLE product_rights_reviews
  ALTER COLUMN publisher_platform DROP NOT NULL;

ALTER TABLE product_rights_reviews
  DROP CONSTRAINT IF EXISTS product_rights_review_publisher_check;

ALTER TABLE product_rights_reviews
  ADD CONSTRAINT product_rights_review_publisher_check
  CHECK (
    publisher_platform IS NULL
    OR length(btrim(publisher_platform)) BETWEEN 2 AND 160
  );

ALTER TABLE product_rights_reviews
  DROP CONSTRAINT IF EXISTS product_rights_review_evidence_required;

ALTER TABLE product_rights_reviews
  DROP CONSTRAINT IF EXISTS product_rights_review_owner_attestation_required;

ALTER TABLE product_rights_reviews
  ADD CONSTRAINT product_rights_review_owner_attestation_required
  CHECK (
    review_status <> 'APPROVED'
    OR owner_attested IS TRUE
  );

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
     OR length(btrim(review.region)) < 2 THEN
    RAISE EXCEPTION 'PRODUCT_RIGHTS_REVIEW_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_current_rights_review';
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

-- Reactivate only existing account SKUs whose current internal review, category,
-- variant and commercial price are already valid. Stock continues to control visibility.
WITH account_skus AS (
  SELECT p.id, p.sku
  FROM products p
  JOIN product_rights_reviews rr
    ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
  JOIN vault_core_varian_wajib v
    ON v.variant_id=p.variant_id AND v.kategori_produk='Akun'
  JOIN marketplace_categories mc
    ON mc.id=p.marketplace_category_id AND mc.is_active=TRUE
  WHERE COALESCE(p.is_test,FALSE)=FALSE
    AND p.status='PAUSED'
    AND p.fulfillment_type='GAME_ACCOUNT_TRANSFER'
    AND p.sale_price_xtr>1
    AND rr.review_status='APPROVED'
    AND rr.owner_attested=TRUE
    AND rr.valid_until>NOW()
    AND mc.slug=CASE p.game_category
      WHEN 'MLBB' THEN 'mlbb-akun'
      WHEN 'FREE_FIRE' THEN 'free-fire-akun'
      WHEN 'ROBLOX' THEN 'roblox-akun'
      WHEN 'GENSHIN' THEN 'genshin-akun'
      ELSE NULL
    END
),
reactivated AS (
  UPDATE products p
  SET status='ACTIVE',updated_at=NOW()
  FROM account_skus a
  WHERE p.id=a.id
  RETURNING p.id,p.sku
)
INSERT INTO admin_audit_logs
  (actor_telegram_user_id,action,entity_type,entity_id,metadata)
SELECT
  'SYSTEM_MIGRATION_029',
  'PRODUCT_REACTIVATED_AFTER_PUBLISHER_GATE_REMOVAL',
  'PRODUCT',
  id::text,
  jsonb_build_object(
    'sku',sku,
    'migration','029_remove_publisher_sales_gate.sql',
    'reason','Publisher-specific rules are no longer an internal activation gate.'
  )
FROM reactivated;
