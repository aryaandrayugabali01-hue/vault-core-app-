import { isSafeProductImageUrl, normalizeProductText } from './productDetailsService.js';

const ALLOWED_ACCOUNT_CATEGORY_SLUGS = new Set(['mlbb-akun','free-fire-akun','roblox-akun','genshin-akun']);

export function validateMarketplaceCategory(input = {}) {
  const name = normalizeProductText(input.name, 80);
  const slug = String(input.slug ?? '').trim().toLowerCase();
  const description = normalizeProductText(input.description, 500);
  const icon = normalizeProductText(input.icon || '◇', 24);
  const sortOrder = Number(input.sortOrder ?? 100);
  const isActive = input.isActive ?? true;
  const rawGuide = input.purchaseGuide ?? [];
  const errors = [];

  if (name.length < 2) errors.push('CATEGORY_NAME_REQUIRED');
  if (!ALLOWED_ACCOUNT_CATEGORY_SLUGS.has(slug)) errors.push('CATEGORY_SLUG_NOT_ALLOWED');
  if (!icon) errors.push('CATEGORY_ICON_REQUIRED');
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) errors.push('CATEGORY_SORT_ORDER_INVALID');
  if (typeof isActive !== 'boolean') errors.push('CATEGORY_ACTIVE_INVALID');
  if (!Array.isArray(rawGuide) || rawGuide.length > 12) errors.push('CATEGORY_GUIDE_INVALID');

  const purchaseGuide = Array.isArray(rawGuide) ? rawGuide.map((step) => ({
    title: normalizeProductText(step?.title, 80),
    content: normalizeProductText(step?.content, 1000)
  })) : [];
  if (purchaseGuide.some((step) => step.title.length < 2 || step.content.length < 2)) {
    errors.push('CATEGORY_GUIDE_STEP_INVALID');
  }

  if (errors.length) return { ok:false, errors };
  return { ok:true, value:{ slug,name,description,icon,sortOrder,isActive,purchaseGuide } };
}

export function normalizeImageGallery(input, primaryImageUrl = null) {
  if (input === undefined) return { ok:true, value:undefined };
  if (!Array.isArray(input) || input.length > 8) return { ok:false, error:'PRODUCT_IMAGE_GALLERY_INVALID' };
  const images = [];
  for (const raw of input) {
    const value = raw == null ? '' : String(raw).trim();
    if (!value) continue;
    if (!isSafeProductImageUrl(value)) return { ok:false, error:'INVALID_PRODUCT_IMAGE_URL' };
    if (!images.includes(value)) images.push(value);
  }
  const primary = primaryImageUrl == null ? '' : String(primaryImageUrl).trim();
  if (primary && !isSafeProductImageUrl(primary)) return { ok:false, error:'INVALID_PRODUCT_IMAGE_URL' };
  if (primary && !images.includes(primary)) images.unshift(primary);
  return { ok:true, value:images.slice(0,8) };
}
