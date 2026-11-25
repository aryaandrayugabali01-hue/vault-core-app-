import { Router } from 'express';
import { pool } from '../db/pool.js';
import { resolveDisplayStock, isCatalogOnDemandProduct, isCatalogListedAvailable, isEligibleCheckoutProduct } from '../services/catalogService.js';
import { releaseExpiredPendingOrders } from '../services/reservationService.js';
const router = Router();

router.get('/', async (_req, res) => {
  await releaseExpiredPendingOrders();
  const { rows } = await pool.query(
    `SELECT p.id, p.status, p.sku, p.game_category, p.tier, p.name, p.description,
            p.fulfillment_type, p.sale_price_xtr, p.is_test,
            p.image_url, p.image_gallery, p.attributes, p.customer_terms, p.fulfillment_eta,
            p.marketplace_category_id, c.slug AS marketplace_category_slug,
            c.name AS marketplace_category_name, c.description AS marketplace_category_description,
            c.icon AS marketplace_category_icon, c.purchase_guide,
            p.display_stock_mode, p.display_stock_override, p.low_stock_threshold,
            rr.review_status AS rights_review_status, rr.owner_attested AS rights_owner_attested,
            rr.valid_until AS rights_valid_until, rr.rights_basis, rr.publisher_platform,
            rr.authorization_evidence_reference, rr.official_terms_url,
            GREATEST(COUNT(i.id) FILTER (WHERE i.status='AVAILABLE'
              AND i.rights_review_id=p.current_rights_review_id
              AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
              AND rr.review_status='APPROVED' AND rr.owner_attested=TRUE
              AND rr.valid_until>NOW()),0)::int AS sellable_stock
     FROM products p
     LEFT JOIN product_rights_reviews rr
       ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
     LEFT JOIN marketplace_categories c ON c.id=p.marketplace_category_id AND c.is_active=TRUE
     LEFT JOIN inventory_items i ON i.product_id=p.id
     WHERE COALESCE(p.is_test,FALSE)=FALSE
       AND (
         (p.status='ACTIVE'
          AND COALESCE(p.attributes->>'public_preview','false')='true'
          AND COALESCE(p.attributes->>'sales_enabled','false') <> 'true')
         OR (p.status='PAUSED' AND COALESCE(p.attributes->>'public_preview','false')='true')
         OR (
           p.status='ACTIVE'
           AND rr.review_status='APPROVED'
           AND rr.owner_attested=TRUE
           AND rr.valid_until>NOW()
         )
       )
       AND p.fulfillment_type IS NOT NULL
       AND p.sale_price_xtr > 1
     GROUP BY p.id,c.id,rr.id ORDER BY p.game_category, p.name`
  );
  const products = rows.map((product) => {
    const actual = Number(product.sellable_stock);
    const previewOnly = product.attributes?.public_preview === true
      && product.attributes?.sales_enabled !== true;
    const onDemand = isCatalogOnDemandProduct(product);
    const purchaseable = !previewOnly
      && isEligibleCheckoutProduct(product)
      && product.fulfillment_type !== null
      && product.rights_review_status === 'APPROVED'
      && product.rights_owner_attested === true
      && product.rights_valid_until && new Date(product.rights_valid_until) > new Date();
    const available = purchaseable && isCatalogListedAvailable(product, actual);
    const visible = onDemand || !purchaseable
      ? null
      : resolveDisplayStock({ actualStock: actual, mode: product.display_stock_mode, override: product.display_stock_override });
    return {
      ...product,
      is_preview_only: Boolean(previewOnly),
      is_on_demand: Boolean(onDemand),
      is_purchaseable: Boolean(purchaseable),
      is_available: Boolean(available),
      catalog_status_label: previewOnly ? 'Live di katalog' : available ? 'Tersedia' : 'Stok habis',
      display_stock: visible
    };
  });
  const { rows: categories } = await pool.query(
    `SELECT c.id,c.slug,c.name,c.description,c.icon,c.purchase_guide,
            COUNT(p.id)::int AS product_count
     FROM marketplace_categories c
     LEFT JOIN products p ON p.marketplace_category_id=c.id
       AND COALESCE(p.is_test,FALSE)=FALSE
       AND (
         (p.status='ACTIVE'
          AND COALESCE(p.attributes->>'public_preview','false')='true'
          AND COALESCE(p.attributes->>'sales_enabled','false') <> 'true')
         OR (p.status='PAUSED' AND COALESCE(p.attributes->>'public_preview','false')='true')
         OR (
           p.status='ACTIVE'
           AND EXISTS (
             SELECT 1 FROM product_rights_reviews cr
             WHERE cr.id=p.current_rights_review_id
               AND cr.product_id=p.id
               AND cr.review_status='APPROVED'
               AND cr.owner_attested=TRUE
               AND cr.valid_until>NOW()
           )
         )
       )
       AND p.fulfillment_type IS NOT NULL
       AND p.sale_price_xtr > 1
     WHERE c.is_active=TRUE
     GROUP BY c.id ORDER BY c.sort_order,c.name`
  );
  res.json({ products, categories });
});
export default router;
