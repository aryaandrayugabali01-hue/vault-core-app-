import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { validateTelegramInitData } from '../utils/telegram.js';

const COOKIE_NAME = 'vault_owner_session';
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
  return createHmac('sha256', token).update('vault-core-owner-session-v1').digest();
}

export function createOwnerSession(user) {
  const payload = Buffer.from(JSON.stringify({
    id: String(user.id),
    username: user.username ?? null,
    first_name: user.first_name ?? '',
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  const signature = createHmac('sha256', sessionKey()).update(payload).digest('base64url');
  return payload + '.' + signature;
}

function readOwnerSession(cookieHeader) {
  try {
    const token = parseCookies(cookieHeader)[COOKIE_NAME];
    if (!token) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', sessionKey()).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!user.id || !Number.isFinite(user.exp) || user.exp <= Math.floor(Date.now() / 1000)) return null;
    return { id: user.id, username: user.username ?? undefined, first_name: user.first_name ?? '' };
  } catch {
    return null;
  }
}

export function validateTelegramLoginPayload(data) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !data || typeof data !== 'object') throw new Error('TELEGRAM_LOGIN_UNAVAILABLE');
  const { hash, ...fields } = data;
  const authDate = fields.auth_date;
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error('INVALID_TELEGRAM_SIGNATURE');
  const timestamp = Number(authDate);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || timestamp > now + 30 || now - timestamp > 600) throw new Error('TELEGRAM_LOGIN_EXPIRED');
  const checkString = Object.keys(fields).sort().map((key) => key + '=' + String(fields[key])).join('\n');
  const secret = createHash('sha256').update(token).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('INVALID_TELEGRAM_SIGNATURE');
  if (!/^\d+$/.test(String(fields.id ?? ''))) throw new Error('INVALID_TELEGRAM_USER');
  return {
    id: String(fields.id),
    username: typeof fields.username === 'string' ? fields.username : undefined,
    first_name: typeof fields.first_name === 'string' ? fields.first_name : ''
  };
}

export function ownerCookieHeader(token, maxAge = SESSION_SECONDS) {
  const parts = [COOKIE_NAME + '=' + token, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAge];
  if (process.env.NODE_ENV === 'production') parts.push('Secure', 'Domain=.vaultcore.biz.id');
  return parts.join('; ');
}

export async function requireOwnerSession(req, res, next) {
  try {
    let user = null;
    const initData = req.get('x-telegram-init-data');
    if (initData) {
      try { user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN); } catch {}
    }
    if (!user) user = readOwnerSession(req.headers.cookie);
    if (!user) return res.status(401).json({ error: 'TELEGRAM_AUTH_REQUIRED', message: 'Masuk menggunakan akun Telegram pemilik VAULT CORE.' });
    req.telegramUser = user;
    return next();
  } catch (error) {
    console.error('[owner-session-auth]', error.message);
    return res.status(503).json({ error: 'OWNER_SESSION_UNAVAILABLE' });
  }
}
