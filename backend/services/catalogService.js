const V4_FULFILLMENT_BY_GROUP = Object.freeze({
  'Akun': new Set(['GAME_ACCOUNT_TRANSFER']),
  'Jasa Joki': new Set(['SERVICE_INSTRUCTIONS']),
  'Item In-Game': new Set(['SERVICE_INSTRUCTIONS','GIFT_CODE','REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','DIGITAL_FILE']),
  'Produk Lainnya': new Set(['GAME_ACCOUNT_TRANSFER','SERVICE_INSTRUCTIONS','GIFT_CODE','REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','DIGITAL_FILE'])
});

function isGameAccount(product) {
  return product?.fulfillment_type === 'GAME_ACCOUNT_TRANSFER'
    && product?.variant_category === 'Akun';
}

function isV4VariantProduct(product) {
  return Number.isSafeInteger(Number(product?.variant_id))
    && Number(product?.variant_id) > 0
    && V4_FULFILLMENT_BY_GROUP[product?.variant_category]?.has(product?.fulfillment_type) === true;
}

function isStandaloneCatalogProduct(product) {
  return product?.variant_category === 'Produk Lainnya'
    && V4_FULFILLMENT_BY_GROUP['Produk Lainnya'].has(product?.fulfillment_type) === true;
}

function isCheckoutableProduct(product) {
  return isGameAccount(product) || isV4VariantProduct(product) || isStandaloneCatalogProduct(product);
}

export function resolveDisplayStock({ actualStock, mode = 'EXACT_COUNT', override = null }) {
  const actual = Math.max(0, Number(actualStock) || 0);
  if (mode === 'HIDE_COUNT') return null;
  if (mode === 'IN_STOCK_ONLY') return actual > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
  const cap = override == null ? actual : Math.max(0, Number(override) || 0);
  return Math.min(actual, cap);
}

export function isPublicCatalogProduct(product) {
  return product?.status === 'ACTIVE'
    && product?.is_test !== true
    && isCheckoutableProduct(product)
    && Number.isSafeInteger(Number(product?.sale_price_xtr))
    && Number(product.sale_price_xtr) > 1;
}

export function isEligibleCheckoutProduct(product, { testMode = false, ownerAuthorized = false } = {}) {
  if (!product || product.status !== 'ACTIVE') return false;
  if (product.is_test === true) return testMode && ownerAuthorized
    && isGameAccount(product) && Number(product.sale_price_xtr) === 1;
  // 1 XTR is reserved for Owner-only TEST fixtures, never commercial products.
  return !testMode
    && isCheckoutableProduct(product)
    && Number.isSafeInteger(Number(product.sale_price_xtr))
    && Number(product.sale_price_xtr) > 1;
}
