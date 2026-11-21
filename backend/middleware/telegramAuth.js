import { validateTelegramInitData } from '../utils/telegram.js';
import { pool } from '../db/pool.js';

export async function requireTelegramUser(req, res, next) {
  let user;
  try {
    const initData = req.get('x-telegram-init-data');
    user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
  } catch (error) {
    // Log only the validation reason. Never log raw Telegram initData or its signature.
    console.warn('[telegram-auth] initData rejected:', error.message);
    return res.status(401).json({
      error: 'TELEGRAM_AUTH_REQUIRED',
      message: 'Sesi Telegram tidak dapat diverifikasi. Buka ulang VAULT CORE melalui bot Telegram.'
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
    req.customer = rows[0];
    req.telegramUser = user;
    return next();
  } catch (error) {
    console.error('[telegram-customer-sync]', error.message);
    return res.status(503).json({
      error: 'CUSTOMER_SESSION_SYNC_UNAVAILABLE',
      message: 'Sesi berhasil diverifikasi, tetapi data akun belum dapat disinkronkan. Coba kembali.'
    });
  }
}
