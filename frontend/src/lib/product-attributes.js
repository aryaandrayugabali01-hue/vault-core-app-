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
  'xtr_price',
  'price_note',
  'price_currency',
  'price_min_idr',
  'price_max_idr',
  'cost_price_note',
  'cost_price_status',
  'fulfillment_mode',
  'owner_attestation_ref',
  'authorization_evidence_status'
]);

export function getCustomerVisibleProductAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return [];
  return Object.entries(attributes).filter(([key]) =>
    !HIDDEN_CUSTOMER_PRODUCT_ATTRIBUTE_KEYS.has(key)
    && !key.startsWith('xtr_conversion_')
  );
}
