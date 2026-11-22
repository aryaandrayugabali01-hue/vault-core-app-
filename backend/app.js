import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pool, databaseRequestContext } from './db/pool.js';
import catalogRoutes from './routes/catalog.js';
import ordersRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import telegramWebhookRoutes from './routes/telegramWebhook.js';
import ownerAuthRoutes from './routes/ownerAuth.js';
import { requireOwnerSession } from './middleware/ownerSession.js';
import { requireTelegramUser } from './middleware/telegramAuth.js';
import { isOwnerTelegramUser, requireOwner } from './middleware/adminAuth.js';
import { apiRateLimit, checkoutRateLimit, ownerRateLimit } from './middleware/rateLimit.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',').map((v) => v.trim()) ?? false, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(databaseRequestContext);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'vault-core-api', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'vault-core-api', database: 'unavailable' });
  }
});
app.get('/api/session', apiRateLimit, requireTelegramUser, async (req, res) => {
  try {
    const userId = String(req.telegramUser.id);
    const isOwner = await isOwnerTelegramUser(userId);
    return res.json({ userId, username: req.telegramUser.username ?? null, isOwner });
  } catch (error) {
    console.error('[session-check]', error.message);
    return res.status(503).json({ error: 'SESSION_CHECK_UNAVAILABLE' });
  }
});
app.use('/api/owner-auth', apiRateLimit, ownerAuthRoutes);
app.get('/api/owner-auth/session', apiRateLimit, requireOwnerSession, requireOwner, (req, res) => res.json({ authenticated: true, user: { id: String(req.telegramUser.id), username: req.telegramUser.username ?? null, first_name: req.telegramUser.first_name ?? '' } }));
app.use('/api/catalog', apiRateLimit, catalogRoutes);
app.use('/api/orders', apiRateLimit, checkoutRateLimit, requireTelegramUser, ordersRoutes);
app.use('/api/admin', apiRateLimit, ownerRateLimit, requireOwnerSession, requireOwner, adminRoutes);
app.use('/api/telegram/webhook', telegramWebhookRoutes);
app.use((error, _req, res, _next) => {
  const stack = String(error?.stack ?? '').split('\n').slice(0, 7).join('\n');
  console.error('[api-error]', error?.name ?? 'Error', error?.message ?? 'Unknown error', stack);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});
