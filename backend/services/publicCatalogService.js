import { pool } from '../db/pool.js';
import { resolveDisplayStock } from './catalogService.js';
import { releaseExpiredPendingOrders } from './reservationService.js';

const SENSITIVE_ATTRIBUTE = /(login|password|sandi|otp|session|recovery|token|credential|email|username)/i;
const GAME_CATEGORY_BY_CODE = Object.freeze({
  MLBB:'MLBB',
  FF:'FREE_FIRE',
  ROBLOX:'ROBLOX',
  GI:'GENSHIN'
});

const PUBLIC_VARIANTS_SQL = `
  SELECT v.variant_id,v.game_code,v.nama_game,v.kategori_produk,v.jenis_varian,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id',p.id,
             'sku',p.sku,
             'name',p.name,
             'description',p.description,
             'sale_price_xtr',p.sale_price_xtr,
             'image_url',p.image_url,
             'image_gallery',p.image_gallery,
             'attributes',p.attributes,
             'customer_terms',p.customer_terms,
             'fulfillment_eta',p.fulfillment_eta,
             'availability_mode',p.availability_mode,
             'indent_deadline_days',p.indent_deadline_days,
             'customer_input_fields',p.customer_input_fields,
             'variant_subtype',p.variant_subtype,
             'game_category',p.game_category,
             'fulfillment_type',p.fulfillment_type,
             'marketplace_category_id',p.marketplace_category_id,
             'marketplace_category_slug',mc.slug,
             'marketplace_category_name',mc.name,
             'marketplace_category_description',mc.description,
             'marketplace_category_icon',mc.icon,
             'purchase_guide',mc.purchase_guide,
             'display_stock_mode',p.display_stock_mode,
             'display_stock_override',p.display_stock_override,
             'actual_stock',stock.available_stock
           ) ORDER BY p.created_at DESC)
           FROM products p
           JOIN product_rights_reviews rr
             ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
           LEFT JOIN marketplace_categories mc
             ON mc.id=p.marketplace_category_id AND mc.is_active=TRUE
           CROSS JOIN LATERAL (
             SELECT COUNT(*)::int AS available_stock
             FROM inventory_items i
             WHERE i.product_id=p.id AND i.status='AVAILABLE'
               AND i.reserved_order_id IS NULL AND i.reserved_until IS NULL
               AND i.rights_review_id=p.current_rights_review_id
               AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL

           ) stock
           WHERE p.variant_id=v.variant_id
             AND p.status='ACTIVE' AND COALESCE(p.is_test,FALSE)=FALSE
             AND p.sale_price_xtr>1
             AND rr.review_status='APPROVED'
             AND rr.owner_attested=TRUE
             AND rr.valid_until>NOW()
             AND (
               (v.kategori_produk='Akun' AND p.fulfillment_type='GAME_ACCOUNT_TRANSFER')
               OR (v.kategori_produk='Jasa Joki' AND p.fulfillment_type='SERVICE_INSTRUCTIONS')
               OR (v.kategori_produk='Item In-Game' AND p.fulfillment_type='SERVICE_INSTRUCTIONS')
             )
             AND stock.available_stock>0
         ),'[]'::jsonb) AS skus
  FROM vault_core_varian_wajib v
  ORDER BY v.variant_id
`;

export async function getPublicCatalogVariants(db = pool) {
  await releaseExpiredPendingOrders(db);
  const { rows } = await db.query(PUBLIC_VARIANTS_SQL);

  return rows.map((variant) => ({
    variant_id:Number(variant.variant_id),
    game_code:variant.game_code,
    game:variant.nama_game,
    category:variant.kategori_produk,
    name:variant.jenis_varian,
    order_ready:true,
    skus:(variant.skus ?? []).map((sku) => {
      const actual = Math.max(0,Number(sku.actual_stock) || 0);
      const price = Number(sku.sale_price_xtr);
      return {
        ...sku,
        attributes:Object.fromEntries(
          Object.entries(sku.attributes ?? {}).filter(([key]) => !SENSITIVE_ATTRIBUTE.test(key) && !String(key).toLowerCase().split(/[^a-z0-9]+/).includes('pass'))
        ),
        actual_stock:actual,
        display_stock:resolveDisplayStock({
          actualStock:actual,
          mode:sku.display_stock_mode,
          override:sku.display_stock_override
        }),
        is_purchaseable:Number.isSafeInteger(price) && price>1,
        is_available:actual>0
      };
    })
  }));
}

export function toLegacyCatalogResponse(variants) {
  const products = [];
  const categories = new Map();

  for (const variant of variants) {
    for (const sku of variant.skus ?? []) {
      products.push({
        ...sku,
        game_category:GAME_CATEGORY_BY_CODE[variant.game_code] ?? variant.game_code,
        game_code:variant.game_code,
        variant_id:Number(variant.variant_id),
        variant_name:variant.name,
        variant_category:variant.category,
        fulfillment_type:sku.fulfillment_type ?? (variant.category==='Akun' ? 'GAME_ACCOUNT_TRANSFER' : 'SERVICE_INSTRUCTIONS')
      });

      if (sku.marketplace_category_id != null && sku.marketplace_category_slug) {
        const key=String(sku.marketplace_category_id);
        const existing=categories.get(key) ?? {
          id:sku.marketplace_category_id,
          slug:sku.marketplace_category_slug,
          name:sku.marketplace_category_name ?? variant.name,
          description:sku.marketplace_category_description ?? '',
          icon:sku.marketplace_category_icon ?? null,
          purchase_guide:sku.purchase_guide ?? [],
          product_count:0
        };
        existing.product_count+=1;
        categories.set(key,existing);
      }
    }
  }

  return {
    products,
    categories:[...categories.values()],
    variants,
    counts:{variants:variants.length,sku:products.length}
  };
}
