import { Router } from 'express';
import { validateTelegramLoginPayload, createOwnerSession, ownerCookieHeader } from '../middleware/ownerSession.js';
import { isOwnerTelegramUser } from '../middleware/adminAuth.js';
import { ownerRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.get('/config', async (_req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) return res.status(503).json({ error: 'TELEGRAM_LOGIN_UNAVAILABLE' });
    const response = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/getMe');
    const data = await response.json();
    if (!response.ok || !data.ok || !data.result?.username) throw new Error('TELEGRAM_BOT_PROFILE_UNAVAILABLE');
    return res.json({ botUsername: data.result.username });
  } catch (error) {
    console.error('[owner-login-config]', error.message);
    return res.status(503).json({ error: 'TELEGRAM_LOGIN_UNAVAILABLE', message: 'Konfigurasi login Telegram belum tersedia.' });
  }
});

router.post('/telegram', ownerRateLimit, async (req, res) => {
  try {
    const user = validateTelegramLoginPayload(req.body);
    if (!await isOwnerTelegramUser(user.id)) {
      return res.status(403).json({ error: 'ADMIN_ACCESS_REQUIRED', message: 'Akun Telegram ini belum terdaftar sebagai pemilik VAULT CORE.' });
    }
    const session = createOwnerSession(user);
    res.setHeader('Set-Cookie', ownerCookieHeader(session));
    return res.json({ authenticated: true, user: { id: user.id, username: user.username ?? null, first_name: user.first_name } });
  } catch (error) {
    const known = ['TELEGRAM_LOGIN_UNAVAILABLE','INVALID_TELEGRAM_SIGNATURE','TELEGRAM_LOGIN_EXPIRED','INVALID_TELEGRAM_USER'];
    const code = known.includes(error.message) ? error.message : 'TELEGRAM_LOGIN_FAILED';
    const status = code === 'TELEGRAM_LOGIN_UNAVAILABLE' ? 503 : 401;
    return res.status(status).json({ error: code, message: code === 'TELEGRAM_LOGIN_EXPIRED' ? 'Sesi login Telegram kedaluwarsa. Silakan masuk kembali.' : 'Verifikasi login Telegram gagal.' });
  }
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', ownerCookieHeader('', 0));
  return res.json({ authenticated: false });
});

export default router;
