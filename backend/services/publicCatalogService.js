import { pool } from '../db/pool.js';
import { resolveDisplayStock } from './catalogService.js';
import { releaseExpiredPendingOrders } from './reservationService.js';

const SENSITIVE_ATTRIBUTE = /(login|password|sandi|otp|session|recovery|token|credential|email|username)/i;
const PRIVATE_CUSTOMER_ATTRIBUTE_KEYS = new Set([
  'sku','skucode','productcode','kodeproduk',
  'subcategory','subkategori','deliverymethod','metodepenyerahan','handovermethod','transfermethod',
  'pricenote','priceminidr','pricemaxidr','pricecurrency','xtrprice',
  'costpricenote','costpricestatus','costpricextr','fulfillmentmode','fulfillmenttype',
  'ownerattestationref','authorizationevidencestatus','authorizationevidencereference',
  'rightsbasis','publisherplatform','officialtermsurl','chainoftitle','reviewstatus','reviewnotes',
  'reviewertelegramuserid','validuntil'
]);
const PRIVATE_CUSTOMER_ATTRIBUTE_PREFIXES = [
  'xtrconversion','ownerattestation','authorizationevidence','costprice','rightsreview','stocksource'
];
function normalizeCustomerAttributeKey(key) {
  return String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g,'');
}
export function sanitizeCustomerProductAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return {};
  return Object.fromEntries(Object.entries(attributes).filter(([key]) => {
    const normalized = normalizeCustomerAttributeKey(key);
    return !SENSITIVE_ATTRIBUTE.test(key)
      && !/(^|[^a-z0-9])pass(?:word)?(?:$|[^a-z0-9])/i.test(key)
      && !PRIVATE_CUSTOMER_ATTRIBUTE_KEYS.has(normalized)
      && !PRIVATE_CUSTOMER_ATTRIBUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }));
}
export function sanitizeCustomerInputFields(fields) {
  if (!Array.isArray(fields)) return [];
  const sensitive=/(login|password|sandi|otp|session|recovery|backup|token|credential|email|username|cookie)/i;
  const seen=new Set();
  return fields.slice(0,12).flatMap((field)=>{
    const label=String(field?.label??'').trim().slice(0,80);
    if(!label||sensitive.test(label)||seen.has(label.toLowerCase()))return [];
    seen.add(label.toLowerCase());
    const type=['text','number','textarea'].includes(String(field?.type||'').toLowerCase())?String(field.type).toLowerCase():'text';
    return [{label,type,required:field?.required===true,maxLength:Math.min(240,Math.max(1,Number(field?.maxLength||240)))}];
  });
}
export function toPublicCatalogProduct(sku) {
  const actual = Math.max(0,Number(sku?.actual_stock) || 0);
  const price = Number(sku?.sale_price_xtr);
  return {
    id:Number(sku?.id),
    name:sku?.name ?? '',
    description:sku?.description ?? '',
    tier:sku?.tier ?? 'SERVICE',
    sale_price_xtr:price,
    image_url:sku?.image_url ?? null,
    image_gallery:Array.isArray(sku?.image_gallery) ? sku.image_gallery : [],
    attributes:sanitizeCustomerProductAttributes(sku?.attributes),
    customer_terms:sku?.customer_terms ?? '',
    fulfillment_eta:sku?.fulfillment_eta ?? '',
    availability_mode:sku?.availability_mode ?? 'READY',
    indent_deadline_days:sku?.indent_deadline_days ?? null,
    customer_input_fields:sanitizeCustomerInputFields(sku?.customer_input_fields),
    display_stock:resolveDisplayStock({actualStock:actual,mode:sku?.display_stock_mode,override:sku?.display_stock_override}) === 1 ? 1 : null,
    is_purchaseable:Number.isSafeInteger(price) && price>1,
    is_available:actual>0
  };
}
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
             'tier',p.tier,
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
           LEFT JOIN marketplace_categories mc
             ON mc.id=p.marketplace_category_id AND mc.is_active=TRUE
           CROSS JOIN LATERAL (
             SELECT COUNT(*)::int AS available_stock
             FROM inventory_items i
             WHERE i.product_id=p.id AND i.status='AVAILABLE'
               AND i.reserved_order_id IS NULL AND i.reserved_until IS NULL
               AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL

           ) stock
           WHERE p.variant_id=v.variant_id
             AND p.status='ACTIVE' AND COALESCE(p.is_test,FALSE)=FALSE
             AND p.sale_price_xtr>1
             AND (
               (v.kategori_produk='Akun' AND p.fulfillment_type='GAME_ACCOUNT_TRANSFER')
               OR (v.kategori_produk='Jasa Joki' AND p.fulfillment_type='SERVICE_INSTRUCTIONS')
               OR (v.kategori_produk='Item In-Game' AND p.fulfillment_type IN ('SERVICE_INSTRUCTIONS','GIFT_CODE','REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','DIGITAL_FILE'))
             )
             AND stock.available_stock>0
         ),'[]'::jsonb) AS skus
  FROM vault_core_varian_wajib v
  ORDER BY v.variant_id
`;

const STANDALONE_PRODUCTS_SQL = `
  SELECT p.id,p.game_category,p.name,p.description,p.tier,p.sale_price_xtr,p.image_url,p.image_gallery,
         p.attributes,p.customer_terms,p.fulfillment_eta,p.availability_mode,p.indent_deadline_days,
         p.customer_input_fields,p.display_stock_mode,p.display_stock_override,
         stock.available_stock AS actual_stock
  FROM products p
  CROSS JOIN LATERAL (
    SELECT COUNT(*)::int AS available_stock
    FROM inventory_items i
    WHERE i.product_id=p.id AND i.status='AVAILABLE'
      AND i.reserved_order_id IS NULL AND i.reserved_until IS NULL
      AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
  ) stock
  WHERE p.variant_id IS NULL AND p.status='ACTIVE'
    AND COALESCE(p.is_test,FALSE)=FALSE AND p.sale_price_xtr>1
    AND p.fulfillment_type IN ('GAME_ACCOUNT_TRANSFER','SERVICE_INSTRUCTIONS','GIFT_CODE','REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','DIGITAL_FILE')
    AND stock.available_stock>0
  ORDER BY p.created_at DESC,p.id DESC
`;

export async function getPublicCatalogVariants(db = pool) {
  await releaseExpiredPendingOrders(db);
  const [{ rows }, { rows:standaloneRows }] = await Promise.all([
    db.query(PUBLIC_VARIANTS_SQL),
    db.query(STANDALONE_PRODUCTS_SQL)
  ]);

  const masterVariants = rows.map((variant) => ({
    variant_id:Number(variant.variant_id),
    game_code:variant.game_code,
    game:variant.nama_game,
    category:variant.kategori_produk,
    name:variant.jenis_varian,
    order_ready:true,
    skus:(variant.skus ?? []).map(toPublicCatalogProduct)
  }));

  const gameLabels = {MLBB:'Mobile Legends',FREE_FIRE:'Free Fire',ROBLOX:'Roblox',GENSHIN:'Genshin Impact'};
  const gameCodes = {MLBB:'MLBB',FREE_FIRE:'FF',ROBLOX:'ROBLOX',GENSHIN:'GI'};
  const standaloneVariants = standaloneRows.map((product) => ({
    variant_id:-Number(product.id),
    game_code:gameCodes[product.game_category] || product.game_category,
    game:gameLabels[product.game_category] || product.game_category,
    category:'Produk Lainnya',
    name:product.name,
    order_ready:true,
    skus:[toPublicCatalogProduct(product)]
  }));

  return [...masterVariants,...standaloneVariants];
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
