export function parseProductAttributesText(input) {
  const lines = String(input ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 24) return { ok:false, error:'Maksimal 24 atribut untuk satu produk.' };
  const value = Object.create(null);
  const seen = new Set();
  for (const line of lines) {
    const separator = line.indexOf('|');
    if (separator < 1) return { ok:false, error:'Format atribut harus Key|Value, satu atribut per baris.' };
    const key = line.slice(0, separator).trim().replace(/\s+/g, ' ');
    const text = line.slice(separator + 1).trim();
    const folded = key.toLocaleLowerCase('en');
    if (key.length < 2 || key.length > 40 || text.length < 1 || text.length > 160
        || /[\u0000-\u001f\u007f]/.test(key + text)
        || ['__proto__','prototype','constructor'].includes(folded) || seen.has(folded)) {
      return { ok:false, error:'Nama atribut harus 2–40 karakter, nilai 1–160 karakter, dan nama atribut harus unik.' };
    }
    seen.add(folded);
    value[key] = text;
  }
  return { ok:true, value:{...value} };
}

export function formatProductAttributesText(attributes) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return '';
  return Object.entries(attributes).map(([key, value]) => `${key}|${value}`).join('\n');
}

export function normalizeCustomerDisplayText(value) {
  return String(value ?? '')
    .replace(/\\+r\\+n/g, '\n')
    .replace(/\\+n/g, '\n')
    .replace(/\\+r/g, '\n');
}

const HIDDEN_CUSTOMER_PRODUCT_ATTRIBUTE_KEYS = new Set([
  'sku','skucode','productcode','kodeproduk',
  'subcategory','subkategori','deliverymethod','metodepenyerahan','handovermethod','transfermethod',
  'xtrprice','pricenote','priceminidr','pricemaxidr','pricecurrency',
  'costpricenote','costpricestatus','costpricextr','fulfillmentmode','fulfillmenttype',
  'ownerattestationref','authorizationevidencestatus','authorizationevidencereference',
  'rightsbasis','publisherplatform','officialtermsurl','chainoftitle','reviewstatus','reviewnotes',
  'reviewertelegramuserid','validuntil'
]);
const HIDDEN_CUSTOMER_ATTRIBUTE_PREFIXES = [
  'xtrconversion','ownerattestation','authorizationevidence','costprice','rightsreview','stocksource','stocksource'
];
export function getCustomerVisibleProductAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return [];
  return Object.entries(attributes).filter(([key]) => {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g,'');
    return !HIDDEN_CUSTOMER_PRODUCT_ATTRIBUTE_KEYS.has(normalized)
      && !HIDDEN_CUSTOMER_ATTRIBUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
      && !/(login|password|sandi|otp|session|recovery|token|credential|email|username)/i.test(key)
      && !/(^|[^a-z0-9])pass(?:word)?(?:$|[^a-z0-9])/i.test(key);
  });
}
