export function resolveDisplayStock({ actualStock, mode = 'EXACT_COUNT', override = null }) {
  const actual = Math.max(0, Number(actualStock) || 0);
  if (mode === 'HIDE_COUNT') return null;
  if (mode === 'IN_STOCK_ONLY') return actual > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
  const cap = override == null ? actual : Math.max(0, Number(override) || 0);
  return Math.min(actual, cap);
}
