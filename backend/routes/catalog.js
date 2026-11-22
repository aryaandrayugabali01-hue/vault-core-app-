import { Router } from 'express';
import { pool } from '../db/pool.js';
import { resolveDisplayStock, isPublicCatalogProduct } from '../services/catalogService.js';
const router = Router();

router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.status, p.sku, p.game_category, p.tier, p.name, p.description,
            p.fulfillment_type, p.sale_price_xtr, p.is_test,
            p.image_url, p.image_gallery, p.customer_terms, p.fulfillment_eta,
            p.marketplace_category_id, c.slug AS marketplace_category_slug,
            c.name AS marketplace_category_name, c.description AS marketplace_category_description,
            c.icon AS marketplace_category_icon, c.purchase_guide,
            p.display_stock_mode, p.display_stock_override, p.low_stock_threshold,
            GREATEST(COUNT(i.id) FILTER (WHERE i.status='AVAILABLE'),0)::int AS sellable_stock
     FROM products p
     JOIN product_rights_reviews rr
       ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
     LEFT JOIN marketplace_categories c ON c.id=p.marketplace_category_id AND c.is_active=TRUE
     LEFT JOIN inventory_items i
       ON i.product_id=p.id AND i.rights_review_id=rr.id AND i.source_reference IS NOT NULL
     WHERE p.status='ACTIVE' AND COALESCE(p.is_test,FALSE)=FALSE
       AND p.fulfillment_type IS NOT NULL
       AND rr.review_status='APPROVED' AND rr.owner_attested=TRUE AND rr.valid_until>NOW()
     GROUP BY p.id,c.id ORDER BY p.game_category, p.tier, p.name`
  );
  const products = rows.filter(isPublicCatalogProduct).map((product) => {
    const actual = Number(product.sellable_stock);
    const visible = resolveDisplayStock({ actualStock: actual, mode: product.display_stock_mode, override: product.display_stock_override });
    return { ...product, is_available: actual > 0, display_stock: visible };
  });
  const categoryMap = new Map();
  for (const product of products) {
    if (!product.marketplace_category_id || !product.marketplace_category_name) continue;
    const key = String(product.marketplace_category_id);
    const current = categoryMap.get(key) || {
      id:product.marketplace_category_id,slug:product.marketplace_category_slug,
      name:product.marketplace_category_name,description:product.marketplace_category_description || '',
      icon:product.marketplace_category_icon || '◇',purchase_guide:Array.isArray(product.purchase_guide)?product.purchase_guide:[],
      product_count:0
    };
    current.product_count += 1;
    categoryMap.set(key,current);
  }
  res.json({ products, categories:[...categoryMap.values()] });
});
export default router;
