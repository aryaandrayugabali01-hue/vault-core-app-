import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

const { Client, Pool } = pg;

export function createDatabaseAdapter({
  ClientClass = Client,
  PoolClass = Pool,
  connectionString,
  requestScoped = false,
  poolOptions = {}
}) {
  const requestStorage = new AsyncLocalStorage();
  const localPool = requestScoped
    ? null
    : new PoolClass({
        connectionString,
        ...poolOptions
      });

  function currentClient() {
    const context = requestStorage.getStore();
    if (!requestScoped) return null;
    if (!context) throw new Error('DATABASE_REQUEST_CONTEXT_MISSING');
    if (context.error) throw context.error;
    if (!context.client) throw new Error('DATABASE_CLIENT_NOT_READY');
    return context.client;
  }

  const database = {
    query(...args) {
      if (requestScoped) {
        try {
          return currentClient().query(...args);
        } catch (error) {
          return Promise.reject(error);
        }
      }
      return localPool.query(...args);
    },

    async connect() {
      if (requestScoped) {
        const client = currentClient();
        return {
          query: client.query.bind(client),
          // A request-scoped client is shared by all DB calls in this request.
          // Hyperdrive cleans it up when the Worker invocation completes.
          release() {}
        };
      }
      return localPool.connect();
    },

    end() {
      return localPool ? localPool.end() : Promise.resolve();
    }
  };

  async function requestContextMiddleware(_req, _res, next) {
    if (!requestScoped) return next();

    const context = { client: null, error: null };
    return requestStorage.run(context, async () => {
      try {
        context.client = new ClientClass({ connectionString });
        await context.client.connect();
      } catch (error) {
        context.error = error;
      }
      return next();
    });
  }

  return {
    pool: database,
    requestContextMiddleware,
    requestScoped
  };
}

const adapter = createDatabaseAdapter({
  connectionString: process.env.DATABASE_URL,
  requestScoped: process.env.DATABASE_CONNECTION_MODE === 'request',
  poolOptions: {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined
  }
});

export const pool = adapter.pool;
export const databaseRequestContext = adapter.requestContextMiddleware;
