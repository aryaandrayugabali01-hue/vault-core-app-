import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateTelegramInitData } from '../backend/utils/telegram.js';
import { encryptPayload, decryptPayload, assertAllowedDigitalPayload } from '../backend/utils/encryption.js';
import { resolveDisplayStock } from '../backend/services/catalogService.js';
import { sendStarsInvoice, refundStarPayment, telegramCall } from '../backend/services/telegramApi.js';
import { sanitizeSuccessfulPaymentUpdate } from '../backend/utils/paymentAudit.js';
import { createDatabaseAdapter } from '../backend/db/pool.js';

function signedInitData(user, token, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAE-test', user: JSON.stringify(user) });
  const check = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(check).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('Telegram initData accepts a valid signature', () => {
  const token = 'test-token';
  const user = { id: 123456, first_name: 'Vault Customer' };
  assert.equal(validateTelegramInitData(signedInitData(user, token), token).id, user.id);
});

test('Telegram initData rejects a modified payload', () => {
  const token = 'test-token';
  const data = signedInitData({ id: 123456 }, token).replace('123456', '654321');
  assert.throws(() => validateTelegramInitData(data, token), /signature mismatch/i);
});

test('Telegram initData rejects expired data', () => {
  const token = 'test-token';
  const old = Math.floor(Date.now() / 1000) - 90_000;
  assert.throws(() => validateTelegramInitData(signedInitData({ id: 1 }, token, old), token), /expired/i);
});

test('digital inventory is encrypted and decrypts to original value', () => {
  process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  const original = 'REDEEM-CODE-VAULT-12345';
  assert.equal(decryptPayload(encryptPayload(original)), original);
});

test('credential and authentication secrets are refused as fulfillment payloads', () => {
  assert.throws(() => assertAllowedDigitalPayload('Email: buyer@example.com | Password: secret'), /not supported/i);
  assert.throws(() => assertAllowedDigitalPayload('buyer@example.com:Pass12345'), /not supported/i);
  assert.throws(() => assertAllowedDigitalPayload('username: buyer\npassword: secret'), /not supported/i);
  assert.throws(() => assertAllowedDigitalPayload('session cookie: abcdef'), /not supported/i);
});

test('display stock override caps but cannot inflate actual inventory', () => {
  assert.equal(resolveDisplayStock({ actualStock: 3, override: 99 }), 3);
  assert.equal(resolveDisplayStock({ actualStock: 20, override: 4 }), 4);
  assert.equal(resolveDisplayStock({ actualStock: 0, override: 10 }), 0);
});

test('display stock modes support count, boolean availability, and hidden count', () => {
  assert.equal(resolveDisplayStock({ actualStock: 3, mode: 'IN_STOCK_ONLY' }), 'IN_STOCK');
  assert.equal(resolveDisplayStock({ actualStock: 0, mode: 'IN_STOCK_ONLY' }), 'OUT_OF_STOCK');
  assert.equal(resolveDisplayStock({ actualStock: 5, mode: 'HIDE_COUNT' }), null);
});

test('Telegram network failure is classified as an ambiguous delivery outcome', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'unit-test-token';
  globalThis.fetch = async () => { throw new Error('socket hang up'); };
  try {
    await assert.rejects(
      telegramCall('sendMessage', { chat_id: 123, text: 'test' }),
      (error) => error.deliveryOutcomeUnknown === true && error.telegramRejected !== true
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test('Telegram API rejection is classified as a safe-to-retry rejection', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'unit-test-token';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: false, description: 'chat not found' }) });
  try {
    await assert.rejects(
      telegramCall('sendMessage', { chat_id: 123, text: 'test' }),
      (error) => error.telegramRejected === true
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test('Stars invoice uses XTR and a single price component', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  let captured;
  process.env.TELEGRAM_BOT_TOKEN = 'unit-test-token';
  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ ok: true, result: 'https://t.me/$test-invoice' }) };
  };
  try {
    const link = await sendStarsInvoice({ orderNumber: 'VC-TEST-001', title: 'VAULT CORE Gold', description: 'Digital product', amount: 50 });
    assert.equal(link, 'https://t.me/$test-invoice');
    assert.equal(captured.body.currency, 'XTR');
    assert.equal(captured.body.payload, 'VC-TEST-001');
    assert.equal(captured.body.prices.length, 1);
    assert.equal(captured.body.prices[0].amount, 50);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test('Stars refund calls refundStarPayment with the original charge ID', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  let captured;
  process.env.TELEGRAM_BOT_TOKEN = 'unit-test-token';
  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ ok: true, result: true }) };
  };
  try {
    const result = await refundStarPayment({ userId: 12345, telegramPaymentChargeId: 'charge-test-001' });
    assert.equal(result, true);
    assert.match(captured.url, /refundStarPayment$/);
    assert.equal(captured.body.user_id, 12345);
    assert.equal(captured.body.telegram_payment_charge_id, 'charge-test-001');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test('payment audit snapshot excludes buyer profile and chat data', () => {
  const safe = sanitizeSuccessfulPaymentUpdate({
    message_id: 42,
    date: 1760000000,
    from: { id: 12345, first_name: 'Private Name', username: 'private_user' },
    chat: { id: 12345, title: 'Private Chat' },
    successful_payment: {
      currency: 'XTR',
      total_amount: 50,
      invoice_payload: 'VC-ORDER-001',
      telegram_payment_charge_id: 'charge-001',
      provider_payment_charge_id: 'provider-001'
    }
  });
  assert.equal(safe.telegram_user_id, '12345');
  assert.equal(safe.successful_payment.invoice_payload, 'VC-ORDER-001');
  assert.equal(JSON.stringify(safe).includes('Private Name'), false);
  assert.equal(JSON.stringify(safe).includes('Private Chat'), false);
  assert.equal(JSON.stringify(safe).includes('private_user'), false);
});


test('request-scoped database adapter isolates Hyperdrive clients between concurrent requests', async () => {
  let nextId = 0;
  const clients = [];
  class FakeClient {
    constructor(options) {
      this.options = options;
      this.id = ++nextId;
      this.queries = [];
      clients.push(this);
    }
    async connect() {}
    async query(sql) {
      await new Promise((resolve) => setImmediate(resolve));
      this.queries.push(sql);
      return { rows: [{ clientId: this.id, sql }] };
    }
  }
  class ForbiddenPool {
    constructor() {
      throw new Error('A global pool must not be created in request-scoped mode.');
    }
  }

  const adapter = createDatabaseAdapter({
    ClientClass: FakeClient,
    PoolClass: ForbiddenPool,
    connectionString: 'postgres://hyperdrive.test/vault_core',
    requestScoped: true
  });

  const invokeRequest = async (label) => adapter.requestContextMiddleware({}, {}, async () => {
    await Promise.resolve();
    const first = await adapter.pool.query(`SELECT '${label}'`);
    const transactionClient = await adapter.pool.connect();
    await transactionClient.query('BEGIN');
    transactionClient.release();
    const last = await adapter.pool.query('SELECT 2');
    return { first: first.rows[0], last: last.rows[0] };
  });

  const [firstRequest, secondRequest] = await Promise.all([
    invokeRequest('first'),
    invokeRequest('second')
  ]);

  assert.equal(clients.length, 2);
  assert.notEqual(firstRequest.first.clientId, secondRequest.first.clientId);
  assert.equal(firstRequest.first.clientId, firstRequest.last.clientId);
  assert.equal(secondRequest.first.clientId, secondRequest.last.clientId);
  assert.deepEqual(clients.map((client) => client.queries), [
    ["SELECT 'first'", 'BEGIN', 'SELECT 2'],
    ["SELECT 'second'", 'BEGIN', 'SELECT 2']
  ]);
  await adapter.pool.end();
});

test('request-scoped database adapter rejects DB calls after a connection failure', async () => {
  const connectionFailure = new Error('Hyperdrive connection failed');
  class FailingClient {
    constructor() {}
    async connect() { throw connectionFailure; }
  }
  class ForbiddenPool {
    constructor() {
      throw new Error('A global pool must not be created in request-scoped mode.');
    }
  }

  const adapter = createDatabaseAdapter({
    ClientClass: FailingClient,
    PoolClass: ForbiddenPool,
    connectionString: 'postgres://hyperdrive.test/vault_core',
    requestScoped: true
  });

  await assert.rejects(
    adapter.requestContextMiddleware({}, {}, () => adapter.pool.query('SELECT 1')),
    /Hyperdrive connection failed/
  );
});
