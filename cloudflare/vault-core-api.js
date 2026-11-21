import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';

let handlerPromise;

async function createHandler() {
  const { app } = await import('../backend/app.js');
  return httpServerHandler(createServer(app));
}

function configureEnvironment(env) {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
  const names = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'TELEGRAM_MINI_APP_URL',
    'ADMIN_TELEGRAM_IDS',
    'APP_ENCRYPTION_KEY',
    'FRONTEND_ORIGIN',
    'SUPPORT_CONTACT'
  ];
  for (const name of names) {
    if (typeof env[name] === 'string') process.env[name] = env[name];
  }
}

export default {
  async fetch(request, env) {
    if (!env.HYPERDRIVE?.connectionString) {
      return Response.json({ error: 'DATABASE_BINDING_NOT_CONFIGURED' }, { status: 503 });
    }
    configureEnvironment(env);
    handlerPromise ??= createHandler();
    const handler = await handlerPromise;
    return handler(request);
  }
};
