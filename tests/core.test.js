import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateTelegramInitData } from '../backend/utils/telegram.js';
import { encryptPayload, decryptPayload, assertAllowedDigitalPayload } from '../backend/utils/encryption.js';
import { resolveDisplayStock, isPublicCatalogProduct, isEligibleCheckoutProduct, canAddProductInventory } from '../backend/services/catalogService.js';
import { sendStarsInvoice, refundStarPayment, telegramCall } from '../backend/services/telegramApi.js';
import { sanitizeSuccessfulPaymentUpdate } from '../backend/utils/paymentAudit.js';
import { createDatabaseAdapter } from '../backend/db/pool.js';
import { canReconcileDelivery } from '../backend/services/deliveryService.js';
import { resolveRateLimitKey } from '../backend/middleware/rateLimit.js';
import { validateTelegramLoginPayload, createOwnerSession, ownerCookieHeader } from '../backend/middleware/ownerSession.js';
import { splitInventoryPayloads } from '../frontend/src/lib/inventory.js';

function signedInitData(user, token, authDate = Math.floor(Date.now() / 1000), extraParams = {}) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAE-test', user: JSON.stringify(user), ...extraParams });
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

test('Telegram initData validates HMAC when the modern Ed25519 signature field is present', () => {
  const token = 'test-token';
  const user = { id: 6888336983, first_name: 'Vault Owner', username: 'vault_owner' };
  const data = signedInitData(user, token, Math.floor(Date.now() / 1000), {
    signature: 'telegram-third-party-signature-field'
  });
  assert.equal(validateTelegramInitData(data, token).id, user.id);
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


test('test fixtures are never visible through the public catalog policy', () => {
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: false }), true);
  assert.equal(isPublicCatalogProduct({ status: 'DRAFT', is_test: false }), false);
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: true }), false);
});

test('test products require the Owner-only test checkout lane', () => {
  const commercial = { status: 'ACTIVE', is_test: false };
  const fixture = { status: 'ACTIVE', is_test: true, sale_price_xtr: 1 };
  assert.equal(isEligibleCheckoutProduct(commercial), true);
  assert.equal(isEligibleCheckoutProduct(fixture), false);
  assert.equal(isEligibleCheckoutProduct(fixture, { testMode: true, ownerAuthorized: false }), false);
  assert.equal(isEligibleCheckoutProduct(fixture, { testMode: true, ownerAuthorized: true }), true);
  assert.equal(isEligibleCheckoutProduct({ ...fixture, status: 'DRAFT' }, { testMode: true, ownerAuthorized: true }), false);
  assert.equal(isEligibleCheckoutProduct({ ...fixture, sale_price_xtr: 2 }, { testMode: true, ownerAuthorized: true }), false);
  assert.equal(isEligibleCheckoutProduct(commercial, { testMode: true, ownerAuthorized: true }), false);
});

test('rate limiter uses Cloudflare client IP when Express request.ip is unavailable', () => {
  assert.equal(
    resolveRateLimitKey({ headers: { 'cf-connecting-ip': '203.0.113.14' } }),
    'ip:203.0.113.14'
  );
});

test('rate limiter falls back to Express IP or socket address without throwing', () => {
  assert.equal(resolveRateLimitKey({ ip: '198.51.100.8' }), 'ip:198.51.100.8');
  assert.equal(resolveRateLimitKey({ socket: { remoteAddress: '192.0.2.18' } }), 'ip:192.0.2.18');
  assert.equal(resolveRateLimitKey({ headers: {} }), 'ip:unknown');
});

test('rate limiter skips malformed Cloudflare IP metadata and uses a valid fallback', () => {
  assert.equal(
    resolveRateLimitKey({
      headers: { 'cf-connecting-ip': 'not-an-ip' },
      ip: '198.51.100.22'
    }),
    'ip:198.51.100.22'
  );
});

test('manual delivery reconciliation is blocked for refund and terminal order states', () => {
  assert.equal(canReconcileDelivery('PAID'), true);
  assert.equal(canReconcileDelivery('FULFILLING'), true);
  assert.equal(canReconcileDelivery('REFUND_PENDING'), false);
  assert.equal(canReconcileDelivery('REFUNDED'), false);
  assert.equal(canReconcileDelivery('FULFILLED'), false);
  assert.equal(canReconcileDelivery('PENDING_PAYMENT'), false);
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

test('Stars refund reconciles an already-refunded charge from the Telegram ledger', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const calls = [];
  process.env.TELEGRAM_BOT_TOKEN = 'unit-test-token';
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/refundStarPayment')) {
      return { ok: true, json: async () => ({ ok: false, description: 'Bad Request: CHARGE_ALREADY_REFUNDED' }) };
    }
    return { ok: true, json: async () => ({
      ok: true,
      result: { transactions: [{
        id: 'charge-test-002',
        amount: -75,
        receiver: { type: 'user', user: { id: 12345 } }
      }] }
    }) };
  };
  try {
    const result = await refundStarPayment({ userId: 12345, telegramPaymentChargeId: 'charge-test-002' });
    assert.equal(result, true);
    assert.match(calls[0], /refundStarPayment$/);
    assert.match(calls[1], /getStarTransactions$/);
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


function signedTelegramLoginPayload(user, token, authDate = Math.floor(Date.now() / 1000)) {
  const fields = { ...user, auth_date: String(authDate) };
  const check = Object.keys(fields).sort().map((key) => key + '=' + String(fields[key])).join('\n');
  const secret = crypto.createHash('sha256').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(check).digest('hex');
  return { ...fields, hash };
}

test('Telegram web login validates official Login Widget HMAC and fresh auth_date', () => {
  const token = 'vault-core-widget-test-token';
  const payload = signedTelegramLoginPayload({ id: 6888336983, first_name: 'Owner', username: 'vault_owner' }, token);
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = token;
  try {
    const user = validateTelegramLoginPayload(payload);
    assert.equal(user.id, '6888336983');
    assert.equal(user.username, 'vault_owner');
    assert.equal(user.first_name, 'Owner');
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
});

test('Telegram web login rejects modified signatures and expired widget data', () => {
  const token = 'vault-core-widget-test-token';
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = token;
  try {
    const valid = signedTelegramLoginPayload({ id: 123456, first_name: 'Customer' }, token);
    assert.throws(() => validateTelegramLoginPayload({ ...valid, first_name: 'Attacker' }, token), /signature/i);
    const expired = signedTelegramLoginPayload({ id: 123456 }, token, Math.floor(Date.now() / 1000) - 601);
    assert.throws(() => validateTelegramLoginPayload(expired), /expired/i);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
});

test('Owner web session is signed and cookie is HttpOnly with SameSite protection', () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.TELEGRAM_BOT_TOKEN = 'vault-core-session-test-token';
  process.env.NODE_ENV = 'production';
  try {
    const session = createOwnerSession({ id: 6888336983, username: 'vault_owner', first_name: 'Owner' });
    assert.equal(session.split('.').length, 2);
    const cookie = ownerCookieHeader(session);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /Domain=\.vaultcore\.biz\.id/);
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});


test('inventory payload text splits LF and CRLF lines, trims entries, and ignores blanks', () => {
  assert.deepEqual(
    splitInventoryPayloads('  CODE-001  \n\nCODE-002\r\n  CODE-003 \n'),
    ['CODE-001', 'CODE-002', 'CODE-003']
  );
  assert.deepEqual(splitInventoryPayloads('  \r\n\n  '), []);
  assert.deepEqual(splitInventoryPayloads(null), []);
});


test('inventory input is blocked for test fixtures and unreviewed catalog examples', () => {
  assert.equal(canAddProductInventory({ status: 'DRAFT', is_test: false }), true);
  assert.equal(canAddProductInventory({ status: 'ACTIVE', is_test: false }), true);
  assert.equal(canAddProductInventory({ status: 'PENDING_REVIEW', is_test: false }), false);
  assert.equal(canAddProductInventory({ status: 'PAUSED', is_test: false }), false);
  assert.equal(canAddProductInventory({ status: 'ACTIVE', is_test: true }), false);
  assert.equal(canAddProductInventory(null), false);
});
