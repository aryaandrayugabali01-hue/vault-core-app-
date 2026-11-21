import { Router } from 'express';
import { pool } from '../db/pool.js';
import { resolveDisplayStock, isPublicCatalogProduct } from '../services/catalogService.js';
const router = Router();

router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.sku, p.game_category, p.tier, p.name, p.description,
            p.fulfillment_type, p.sale_price_xtr, p.is_test,
            p.display_stock_mode, p.display_stock_override, p.low_stock_threshold,
            GREATEST(COUNT(i.id) FILTER (WHERE i.status='AVAILABLE'),0)::int AS sellable_stock
     FROM products p LEFT JOIN inventory_items i ON i.product_id=p.id
     WHERE p.status='ACTIVE' AND COALESCE(p.is_test,FALSE)=FALSE
     GROUP BY p.id ORDER BY p.game_category, p.tier, p.name`
  );
  const products = rows.filter(isPublicCatalogProduct).map((product) => {
    const actual = Number(product.sellable_stock);
    const visible = resolveDisplayStock({ actualStock: actual, mode: product.display_stock_mode, override: product.display_stock_override });
    return { ...product, is_available: actual > 0, display_stock: visible };
  });
  res.json({ products });
});
export default router;
