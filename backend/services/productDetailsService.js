const LOCAL_ASSET_PATTERN = /^\/assets\/[A-Za-z0-9_./-]+$/;

export function isSafeProductImageUrl(value) {
  if (value == null || String(value).trim() === '') return true;
  const candidate = String(value).trim();
  if (candidate.length > 2048) return false;
  if (candidate.startsWith('/')) {
    if (!LOCAL_ASSET_PATTERN.test(candidate)) return false;
    return !candidate.split('/').includes('..');
  }
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:'
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export function normalizeProductText(value, maxLength = 4000) {
  return String(value ?? '').trim().slice(0, maxLength);
}


export function normalizeProductAttributes(value = {}) {
  if (value == null) value = {};
  if (typeof value !== 'object' || Array.isArray(value)) return { ok:false, error:'INVALID_PRODUCT_ATTRIBUTES' };
  const entries = Object.entries(value);
  if (entries.length > 24) return { ok:false, error:'INVALID_PRODUCT_ATTRIBUTES' };
  const normalized = [];
  const seen = new Set();
  for (const [rawKey, rawValue] of entries) {
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number' && typeof rawValue !== 'boolean') {
      return { ok:false, error:'INVALID_PRODUCT_ATTRIBUTES' };
    }
    const key = String(rawKey).trim().replace(/\s+/g, ' ');
    const text = String(rawValue).trim();
    const folded = key.toLocaleLowerCase('en');
    if (key.length < 2 || key.length > 40 || text.length < 1 || text.length > 500
        || /[\u0000-\u001f\u007f]/.test(key + text)
        || ['__proto__','prototype','constructor'].includes(folded) || seen.has(folded)) {
      return { ok:false, error:'INVALID_PRODUCT_ATTRIBUTES' };
    }
    seen.add(folded);
    normalized.push([key,text]);
  }
  normalized.sort(([a],[b]) => a.localeCompare(b, 'en'));
  const result = Object.fromEntries(normalized);
  if (new TextEncoder().encode(JSON.stringify(result)).length > 8192) return { ok:false, error:'INVALID_PRODUCT_ATTRIBUTES' };
  return { ok:true, value:result };
}
