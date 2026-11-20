import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pool } from './db/pool.js';
import catalogRoutes from './routes/catalog.js';
import ordersRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import telegramWebhookRoutes from './routes/telegramWebhook.js';
import { requireTelegramUser } from './middleware/telegramAuth.js';
import { requireOwner } from './middleware/adminAuth.js';
import { apiRateLimit, checkoutRateLimit, ownerRateLimit } from './middleware/rateLimit.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',').map((v) => v.trim()) ?? false }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', apiRateLimit);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'vault-core-api', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'vault-core-api', database: 'unavailable' });
  }
});
app.use('/api/catalog', catalogRoutes);
app.use('/api/orders', checkoutRateLimit, requireTelegramUser, ordersRoutes);
app.use('/api/admin', ownerRateLimit, requireTelegramUser, requireOwner, adminRoutes);
app.use('/api/telegram/webhook', telegramWebhookRoutes);
app.use((error, _req, res, _next) => {
  console.error('[api-error]', error.message);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`VAULT CORE API listening on ${port}`));

async function shutdown() {
  server.close();
  await pool.end();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
