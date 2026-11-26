import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'vault_customer_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function sessionKey() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN_MISSING');
  return createHmac('sha256', token).update('vault-core-customer-session-v1').digest();
}

export function createCustomerSession(user) {
  const id = String(user?.id ?? '');
  if (!/^\d+$/.test(id)) throw new Error('CUSTOMER_SESSION_USER_INVALID');
  const payload = Buffer.from(JSON.stringify({
    id,
    username: typeof user.username === 'string' ? user.username : null,
    first_name: typeof user.first_name === 'string' ? user.first_name : '',
    last_name: typeof user.last_name === 'string' ? user.last_name : '',
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  const signature = createHmac('sha256', sessionKey()).update(payload).digest('base64url');
  return payload + '.' + signature;
}

export function readCustomerSession(cookieHeader = '') {
  try {
    const token = parseCookies(cookieHeader)[COOKIE_NAME];
    if (!token) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const expected = createHmac('sha256', sessionKey()).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!/^\d+$/.test(String(user.id ?? '')) || !Number.isFinite(user.exp) || user.exp <= Math.floor(Date.now() / 1000)) return null;
    return {
      id: String(user.id),
      username: user.username ?? undefined,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? ''
    };
  } catch {
    return null;
  }
}

export function customerCookieHeader(token, maxAge = SESSION_SECONDS) {
  const parts = [COOKIE_NAME + '=' + token, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAge];
  if (process.env.NODE_ENV === 'production') parts.push('Secure', 'Domain=.vaultcore.biz.id');
  return parts.join('; ');
}

export async function requireCustomerSession(req, res, next) {
  try {
    const user = readCustomerSession(req.headers.cookie);
    if (!user) return res.status(401).json({
      error: 'CUSTOMER_AUTH_REQUIRED',
      message: 'Masuk menggunakan akun Telegram untuk mengakses akun pelanggan.'
    });
    req.telegramUser = user;
    return next();
  } catch (error) {
    console.error('[customer-session-auth]', error.message);
    return res.status(503).json({ error: 'CUSTOMER_SESSION_UNAVAILABLE' });
  }
}
