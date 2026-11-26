import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';

let handlerPromise;

async function createHandler() {
  const { app } = await import('../backend/app.js');
  return httpServerHandler(createServer(app));
}

function configureEnvironment(env) {
  process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
  const names = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'TELEGRAM_MINI_APP_URL',
    'APP_ENCRYPTION_KEY',
    'FRONTEND_ORIGIN',
    'SUPPORT_CONTACT',
    'DATABASE_CONNECTION_MODE'
  ];
  for (const name of names) {
    if (typeof env[name] === 'string') process.env[name] = env[name];
  }
}

export default {
  async fetch(request, env, ctx) {
    if (!env.HYPERDRIVE?.connectionString) {
      return Response.json({ error: 'DATABASE_BINDING_NOT_CONFIGURED' }, { status: 503 });
    }
    configureEnvironment(env);
    handlerPromise ??= createHandler();
    const handler = await handlerPromise;
    if (!handler || typeof handler.fetch !== 'function') {
      throw new Error('CLOUDFLARE_NODE_HTTP_HANDLER_INVALID');
    }
    return handler.fetch(request, env, ctx);
  }
};
