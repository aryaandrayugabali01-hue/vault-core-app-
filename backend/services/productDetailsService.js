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
