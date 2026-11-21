import { isIP } from 'node:net';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

export function resolveRateLimitKey(req) {
  const candidates = [
    req.headers?.['cf-connecting-ip'],
    req.ip,
    req.socket?.remoteAddress
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const address = candidate.trim();
    if (isIP(address) === 0) continue;
    try {
      return `ip:${ipKeyGenerator(address)}`;
    } catch {
      // Ignore malformed proxy metadata and try the next trusted source.
    }
  }

  // Keep a conservative shared bucket instead of throwing when the runtime
  // does not expose a client address. Cloudflare normally supplies this header.
  return 'ip:unknown';
}

const common = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: resolveRateLimitKey,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Terlalu banyak permintaan. Silakan coba kembali beberapa saat lagi.' }
};

// The built-in memory store is suitable for a single API instance.
// Use an external shared store before horizontally scaling the API.
export const apiRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 300 });
export const checkoutRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 12 });
export const ownerRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 120 });
