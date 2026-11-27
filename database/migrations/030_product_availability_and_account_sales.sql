-- CR-18: product sale availability is controlled by Owner's three stock states.
-- Historical rights-review rows remain available for audit, but no publisher or
-- review status may prevent account, item, gift, or service SKU publication.

CREATE OR REPLACE FUNCTION vault_core_enforce_product_rights_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status='ACTIVE'
     AND COALESCE(NEW.is_test,FALSE)=FALSE
     AND NEW.fulfillment_type IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_FULFILLMENT_TYPE_REQUIRED'
      USING ERRCODE='23514',
            CONSTRAINT='products_active_requires_fulfillment_type';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION vault_core_enforce_inventory_rights_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  product_record products%ROWTYPE;
BEGIN
  SELECT * INTO product_record FROM products WHERE id=NEW.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_PRODUCT_NOT_FOUND';
  END IF;

  IF COALESCE(product_record.is_test,FALSE)=TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.source_reference IS NULL
     OR length(btrim(NEW.source_reference))<3 THEN
    RAISE EXCEPTION 'INVENTORY_SOURCE_REFERENCE_REQUIRED'
      USING ERRCODE='23514',
            CONSTRAINT='inventory_requires_source_reference';
  END IF;

  RETURN NEW;
END;
$$;

-- Existing commercial SKUs are made visible using their recorded sellable
-- inventory units. Reserved units remain reserved for their current orders.
UPDATE inventory_items i
SET status='AVAILABLE'
FROM products p
WHERE i.product_id=p.id
  AND i.status='UNAVAILABLE'
  AND i.reserved_order_id IS NULL
  AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
  AND COALESCE(p.is_test,FALSE)=FALSE
  AND p.sale_price_xtr>1
  AND p.fulfillment_type IS NOT NULL;

UPDATE products p
SET status='ACTIVE',
    availability_mode='READY',
    indent_deadline_days=NULL,
    updated_at=NOW()
WHERE COALESCE(p.is_test,FALSE)=FALSE
  AND p.sale_price_xtr>1
  AND p.fulfillment_type IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM inventory_items i
    WHERE i.product_id=p.id
      AND i.status IN ('AVAILABLE','RESERVED')
      AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
  );

INSERT INTO admin_audit_logs(actor_telegram_user_id,action,entity_type,entity_id,metadata)
SELECT 0,'CR18_PRODUCTS_SET_AVAILABLE','PRODUCT',p.id::text,
       jsonb_build_object('sku',p.sku,'migration','030_product_availability_and_account_sales.sql')
FROM products p
WHERE COALESCE(p.is_test,FALSE)=FALSE
  AND p.status='ACTIVE'
  AND p.sale_price_xtr>1
  AND p.fulfillment_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM admin_audit_logs l
    WHERE l.entity_type='PRODUCT' AND l.entity_id=p.id::text
      AND l.action='CR18_PRODUCTS_SET_AVAILABLE'
  );
