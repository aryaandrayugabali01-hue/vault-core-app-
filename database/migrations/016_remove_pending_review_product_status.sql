-- Remove the legacy PENDING_REVIEW product lifecycle status.
-- Eligible legacy rows become ACTIVE only when the Owner review, XTR price,
-- fulfillment type, and source-bound available inventory are all valid.
-- Other legacy rows return to DRAFT; no inventory or approval data is fabricated.

UPDATE products p
SET status = CASE
  WHEN COALESCE(p.is_test,FALSE)=FALSE
    AND p.fulfillment_type IS NOT NULL
    AND p.sale_price_xtr > 1
    AND EXISTS (
      SELECT 1 FROM product_rights_reviews r
      WHERE r.id=p.current_rights_review_id
        AND r.product_id=p.id
        AND r.review_status='APPROVED'
        AND r.owner_attested=TRUE
        AND r.valid_until>NOW()
    )
    AND EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.product_id=p.id
        AND i.status='AVAILABLE'
        AND i.rights_review_id=p.current_rights_review_id
        AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
    )
  THEN 'ACTIVE'
  ELSE 'DRAFT'
END,
updated_at=NOW()
WHERE p.status='PENDING_REVIEW';

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products
  ADD CONSTRAINT products_status_check
  CHECK (status = ANY (ARRAY['DRAFT','ACTIVE','PAUSED','ARCHIVED']::text[]));
