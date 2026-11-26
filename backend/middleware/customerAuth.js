import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { validateTelegramInitData } from '../utils/telegram.js';

const COOKIE_NAME = 'vault_customer_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function signingKey() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN_MISSING');
  return crypto.createHmac('sha256', token).update('vault-core-customer-session-v1').digest();
}

function sign(payload) {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function createCustomerSession(user) {
  const payload = Buffer.from(JSON.stringify({
    id: String(user.id),
    username: user.username ?? null,
    first_name: user.first_name ?? '',
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  return payload + '.' + sign(payload);
}

export function customerSessionCookieHeader(token, maxAge = SESSION_SECONDS) {
  const parts = [
    COOKIE_NAME + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + maxAge
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure', 'Domain=.vaultcore.biz.id');
  return parts.join('; ');
}

export function readCustomerSession(cookieHeader = '') {
  try {
    const token = parseCookies(cookieHeader)[COOKIE_NAME];
    if (!token) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload), 'base64url');
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!/^\d+$/.test(String(user.id ?? '')) || !Number.isSafeInteger(Number(user.id))
        || Number(user.id) <= 0 || !Number.isFinite(user.exp)
        || user.exp <= Math.floor(Date.now() / 1000)) return null;
    return {
      id: String(user.id),
      username: typeof user.username === 'string' ? user.username : undefined,
      first_name: typeof user.first_name === 'string' ? user.first_name : ''
    };
  } catch {
    return null;
  }
}

export async function syncTelegramCustomer(user) {
  const { rows } = await pool.query(
    `INSERT INTO customers (telegram_user_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_user_id) DO UPDATE
       SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
     RETURNING id, telegram_user_id, username, first_name`,
    [String(user.id), user.username ?? null, user.first_name ?? '']
  );
  return rows[0];
}

export async function requireCustomerUser(req, res, next) {
  let user = null;
  let authMethod = '';

  const initData = req.get('x-telegram-init-data');
  if (initData) {
    try {
      user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
      authMethod = 'telegram-mini-app';
    } catch (error) {
      console.warn('[customer-auth] Mini App initData rejected:', error.message);
      return res.status(401).json({
        error: 'TELEGRAM_AUTH_REQUIRED',
        message: 'Sesi Telegram tidak dapat diverifikasi. Buka ulang VAULT CORE melalui Telegram.'
      });
    }
  } else {
    user = readCustomerSession(req.headers.cookie);
    if (user) authMethod = 'telegram-oidc';
  }

  if (!user) {
    return res.status(401).json({
      error: 'CUSTOMER_AUTH_REQUIRED',
      message: 'Masuk dengan akun Telegram untuk melanjutkan.'
    });
  }

  try {
    req.customer = await syncTelegramCustomer(user);
    req.telegramUser = user;
    req.authMethod = authMethod;
    return next();
  } catch (error) {
    console.error('[customer-session-sync]', error.message);
    return res.status(503).json({
      error: 'CUSTOMER_SESSION_SYNC_UNAVAILABLE',
      message: 'Akun Telegram berhasil diverifikasi, tetapi data pelanggan belum dapat disinkronkan. Coba kembali.'
    });
  }
}
