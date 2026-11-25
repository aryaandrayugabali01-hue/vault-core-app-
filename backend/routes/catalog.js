import { Router } from 'express';
import { pool } from '../db/pool.js';
import { resolveDisplayStock } from '../services/catalogService.js';
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
            rr.valid_until AS rights_valid_until,
            sales.sold_count,
            sales.average_delivery_minutes,
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
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(oi.quantity),0)::int AS sold_count,
              CASE WHEN COUNT(*)=0 THEN NULL
                   ELSE ROUND(AVG(EXTRACT(EPOCH FROM (o.fulfilled_at-o.paid_at))/60.0))::int
              END AS average_delivery_minutes
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       WHERE oi.product_id=p.id
         AND o.status='FULFILLED'
         AND o.paid_at IS NOT NULL
         AND o.fulfilled_at IS NOT NULL
     ) sales ON TRUE
     WHERE COALESCE(p.is_test,FALSE)=FALSE
       AND p.status='ACTIVE'
       AND p.fulfillment_type='GAME_ACCOUNT_TRANSFER'
       AND p.game_category IN ('MLBB','FREE_FIRE','ROBLOX','GENSHIN')
       AND c.slug IN ('mlbb-akun','free-fire-akun','roblox-akun','genshin-akun')
       AND p.sale_price_xtr > 1
       AND rr.review_status='APPROVED'
       AND rr.owner_attested=TRUE
       AND rr.valid_until>NOW()
     GROUP BY p.id,c.id,rr.id,sales.sold_count,sales.average_delivery_minutes ORDER BY p.game_category, p.name`
  );
  const products = rows.map((product) => {
    const actual = Number(product.sellable_stock);
    const purchaseable = product.status === 'ACTIVE'
      && Number.isSafeInteger(Number(product.sale_price_xtr))
      && Number(product.sale_price_xtr) > 1
      && product.fulfillment_type === 'GAME_ACCOUNT_TRANSFER'
      && ['MLBB','FREE_FIRE','ROBLOX','GENSHIN'].includes(product.game_category)
      && product.rights_review_status === 'APPROVED'
      && product.rights_owner_attested === true
      && product.rights_valid_until && new Date(product.rights_valid_until) > new Date();
    const visible = purchaseable
      ? resolveDisplayStock({ actualStock: actual, mode: product.display_stock_mode, override: product.display_stock_override })
      : 0;
    return {
      ...product,
      is_purchaseable: Boolean(purchaseable),
      is_available: Boolean(purchaseable && actual > 0),
      catalog_status_label: actual > 0 ? 'Tersedia' : 'Stok habis',
      display_stock: visible
    };
  });
  const { rows: categories } = await pool.query(
    `SELECT c.id,c.slug,c.name,c.description,c.icon,c.purchase_guide,
            COUNT(p.id)::int AS product_count
     FROM marketplace_categories c
     LEFT JOIN products p ON p.marketplace_category_id=c.id
       AND COALESCE(p.is_test,FALSE)=FALSE
       AND p.status='ACTIVE'
       AND p.fulfillment_type='GAME_ACCOUNT_TRANSFER'
       AND p.game_category IN ('MLBB','FREE_FIRE','ROBLOX','GENSHIN')
       AND p.sale_price_xtr > 1
       AND EXISTS (
         SELECT 1 FROM product_rights_reviews cr
         WHERE cr.id=p.current_rights_review_id
           AND cr.product_id=p.id
           AND cr.review_status='APPROVED'
           AND cr.owner_attested=TRUE
           AND cr.valid_until>NOW()
       )
     WHERE c.is_active=TRUE AND c.slug IN ('mlbb-akun','free-fire-akun','roblox-akun','genshin-akun')
     GROUP BY c.id ORDER BY c.sort_order,c.name`
  );
  res.json({ products, categories });
});
export default router;
