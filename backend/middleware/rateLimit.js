import { rateLimit } from 'express-rate-limit';

const common = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Terlalu banyak permintaan. Silakan coba kembali beberapa saat lagi.' }
};

// The built-in memory store is suitable for a single API instance.
// Use an external shared store before horizontally scaling the API.
export const apiRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 300 });
export const checkoutRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 12 });
export const ownerRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 120 });
