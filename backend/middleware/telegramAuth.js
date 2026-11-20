import { validateTelegramInitData } from '../utils/telegram.js';
import { pool } from '../db/pool.js';

export async function requireTelegramUser(req, res, next) {
  try {
    const initData = req.get('x-telegram-init-data');
    const user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
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
    next();
  } catch (error) {
    res.status(401).json({ error: 'TELEGRAM_AUTH_REQUIRED', message: error.message });
  }
}
