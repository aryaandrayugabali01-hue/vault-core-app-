import { Router } from 'express';
import { pool } from '../db/pool.js';
import { resolveDisplayStock } from '../services/catalogService.js';

const router = Router();

router.get('/variants', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT v.variant_id,v.game_code,v.nama_game,v.kategori_produk,v.jenis_varian,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id',p.id,'sku',p.sku,'name',p.name,'description',p.description,
                'sale_price_xtr',p.sale_price_xtr,'image_url',p.image_url,
                'image_gallery',p.image_gallery,'attributes',p.attributes,
                'customer_terms',p.customer_terms,'fulfillment_eta',p.fulfillment_eta,
                'display_stock_mode',p.display_stock_mode,
                'display_stock_override',p.display_stock_override,
                'actual_stock',stock.available_stock
              ) ORDER BY p.created_at DESC)
              FROM products p
              JOIN product_rights_reviews rr
                ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
              CROSS JOIN LATERAL (
                SELECT COUNT(*)::int AS available_stock
                FROM inventory_items i
                WHERE i.product_id=p.id AND i.status='AVAILABLE'
                  AND i.rights_review_id=p.current_rights_review_id
                  AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
              ) stock
              WHERE p.variant_id=v.variant_id
                AND p.status='ACTIVE' AND COALESCE(p.is_test,FALSE)=FALSE
                AND p.sale_price_xtr>1
                AND rr.review_status='APPROVED' AND rr.owner_attested=TRUE
                AND rr.valid_until>NOW()
                AND (
                  (v.kategori_produk='Akun' AND p.fulfillment_type='GAME_ACCOUNT_TRANSFER')
                  OR (v.kategori_produk='Jasa Joki' AND p.fulfillment_type='SERVICE_INSTRUCTIONS')
                  OR (v.kategori_produk='Item In-Game' AND p.fulfillment_type IN
                    ('SERVICE_INSTRUCTIONS','REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','GIFT_CODE','DIGITAL_FILE'))
                )
                AND stock.available_stock>0
            ),'[]'::jsonb) AS skus
     FROM vault_core_varian_wajib v
     ORDER BY v.variant_id`
  );

  const variants = rows.map((variant) => ({
    variant_id: Number(variant.variant_id),
    game_code: variant.game_code,
    game: variant.nama_game,
    category: variant.kategori_produk,
    name: variant.jenis_varian,
    order_ready: variant.kategori_produk === 'Akun',
    skus: (variant.skus ?? []).map((sku) => {
      const actual = Math.max(0, Number(sku.actual_stock) || 0);
      return {
        ...sku,
        display_stock: resolveDisplayStock({
          actualStock: actual,
          mode: sku.display_stock_mode,
          override: sku.display_stock_override
        }),
        is_available: actual > 0
      };
    })
  }));

  return res.json({ variants, counts: { variants: variants.length, sku: variants.reduce((n, v) => n + v.skus.length, 0) } });
});

export default router;
