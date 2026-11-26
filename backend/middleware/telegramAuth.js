import { validateTelegramInitData } from '../utils/telegram.js';
import { pool } from '../db/pool.js';
import { readCustomerSession } from './customerSession.js';

export async function requireTelegramUser(req, res, next) {
  let user = null;
  const initData = req.get('x-telegram-init-data');

  if (initData) {
    try {
      user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    } catch (error) {
      // A supplied Mini App proof must validate; do not silently fall back to a browser cookie.
      console.warn('[telegram-auth] initData rejected:', error.message);
      return res.status(401).json({
        error: 'TELEGRAM_AUTH_REQUIRED',
        message: 'Sesi Telegram tidak dapat diverifikasi. Buka ulang VAULT CORE melalui bot Telegram.'
      });
    }
  } else {
    user = readCustomerSession(req.headers.cookie);
  }

  if (!user) {
    return res.status(401).json({
      error: 'CUSTOMER_AUTH_REQUIRED',
      message: 'Masuk menggunakan akun Telegram atau buka VAULT CORE melalui Telegram Mini App.'
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (telegram_user_id, username, first_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_user_id) DO UPDATE
         SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
       RETURNING id, telegram_user_id, username, first_name`,
      [String(user.id), user.username ?? null, user.first_name ?? '']
    );
    if (!rows[0]) throw new Error('CUSTOMER_SESSION_SYNC_EMPTY');
    req.customer = rows[0];
    req.telegramUser = user;
    req.customerAuthMethod = initData ? 'telegram-mini-app' : 'telegram-oidc-cookie';
    return next();
  } catch (error) {
    console.error('[telegram-customer-sync]', error.message);
    return res.status(503).json({
      error: 'CUSTOMER_SESSION_SYNC_UNAVAILABLE',
      message: 'Sesi berhasil diverifikasi, tetapi data akun belum dapat disinkronkan. Coba kembali.'
    });
  }
}
