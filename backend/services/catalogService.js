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
    && Number.isSafeInteger(Number(product?.sale_price_xtr))
    && Number(product.sale_price_xtr) > 1;
}

export function isMlbbAccountTransferProduct(product) {
  return product?.game_category === 'MLBB'
    && product?.fulfillment_type === 'GAME_ACCOUNT_TRANSFER'
    && product?.is_test !== true;
}

function isHttpsReference(value) {
  try { return new URL(String(value ?? '')).protocol === 'https:'; } catch { return false; }
}

export function hasPublisherTransferAuthorization(product) {
  if (!isMlbbAccountTransferProduct(product)) return true;
  return product?.attributes?.sales_enabled === true
    && product?.rights_basis === 'OFFICIAL_DISTRIBUTION'
    && String(product?.publisher_platform ?? '').toUpperCase().includes('MOONTON')
    && isHttpsReference(product?.authorization_evidence_reference)
    && isHttpsReference(product?.official_terms_url);
}

export function isEligibleCheckoutProduct(product, { testMode = false, ownerAuthorized = false } = {}) {
  if (!product || product.status !== 'ACTIVE') return false;
  if (product.is_test === true) return testMode && ownerAuthorized && Number(product.sale_price_xtr) === 1;
  // Catalog-only listings are public but never pass checkout validation.
  if (product?.attributes?.public_preview === true && product?.attributes?.sales_enabled !== true) return false;
  // MLBB account transfers require explicit, publisher-sourced authorization in addition to Owner review.
  if (!hasPublisherTransferAuthorization(product)) return false;
  // 1 XTR is reserved for Owner-only TEST fixtures, never commercial products.
  return !testMode
    && Number.isSafeInteger(Number(product.sale_price_xtr))
    && Number(product.sale_price_xtr) > 1;
}



export function isCatalogOnDemandProduct(product) {
  return product?.is_test !== true
    && product?.attributes?.stock_model === 'CATALOG_ON_DEMAND';
}

export function isCatalogListedAvailable(product, actualStock = 0) {
  if (product?.status !== 'ACTIVE') return false;
  return isCatalogOnDemandProduct(product) || Number(actualStock) > 0;
}
