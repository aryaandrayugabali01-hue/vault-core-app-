const ACCOUNT_CATEGORY_SLUGS = Object.freeze({
  MLBB:'mlbb-akun',
  FREE_FIRE:'free-fire-akun',
  ROBLOX:'roblox-akun',
  GENSHIN:'genshin-akun'
});

function isGameAccount(product) {
  return product?.fulfillment_type === 'GAME_ACCOUNT_TRANSFER'
    && ACCOUNT_CATEGORY_SLUGS[product?.game_category] === product?.marketplace_category_slug;
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
    && isGameAccount(product)
    && Number.isSafeInteger(Number(product?.sale_price_xtr))
    && Number(product.sale_price_xtr) > 1;
}

export function isEligibleCheckoutProduct(product, { testMode = false, ownerAuthorized = false } = {}) {
  if (!product || product.status !== 'ACTIVE' || !isGameAccount(product)) return false;
  if (product.is_test === true) return testMode && ownerAuthorized && Number(product.sale_price_xtr) === 1;
  // 1 XTR is reserved for Owner-only TEST fixtures, never commercial products.
  return !testMode
    && Number.isSafeInteger(Number(product.sale_price_xtr))
    && Number(product.sale_price_xtr) > 1;
}
