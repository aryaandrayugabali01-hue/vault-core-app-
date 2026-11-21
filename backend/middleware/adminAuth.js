import { pool } from '../db/pool.js';

export async function isOwnerTelegramUser(userId) {
  const id = String(userId ?? '');
  if (!id) return false;
  const configured = new Set(
    String(process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  );
  if (configured.has(id)) return true;
  const { rows } = await pool.query(
    'SELECT 1 FROM owner_accounts WHERE telegram_user_id=$1 AND is_active=TRUE LIMIT 1',
    [id]
  );
  return rows.length > 0;
}

export async function requireOwner(req, res, next) {
  try {
    if (!await isOwnerTelegramUser(req.telegramUser?.id)) {
      return res.status(403).json({ error: 'ADMIN_ACCESS_REQUIRED', message: 'Akun Telegram ini belum terdaftar sebagai pemilik VAULT CORE.' });
    }
    return next();
  } catch (error) {
    console.error('[owner-auth]', error.message);
    return res.status(503).json({ error: 'OWNER_ACCESS_CHECK_UNAVAILABLE', message: 'Verifikasi akses pemilik sedang tidak tersedia. Coba kembali sebentar lagi.' });
  }
}
