import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateTelegramInitData } from '../backend/utils/telegram.js';
import { encryptPayload, decryptPayload, assertAllowedDigitalPayload } from '../backend/utils/encryption.js';
import { resolveDisplayStock, isPublicCatalogProduct, isEligibleCheckoutProduct } from '../backend/services/catalogService.js';
import { validateRightsReviewInput, isRightsReviewUsable, canAddProductInventory } from '../backend/services/rightsReviewService.js';
import { sendStarsInvoice, refundStarPayment, telegramCall } from '../backend/services/telegramApi.js';
import { sanitizeSuccessfulPaymentUpdate } from '../backend/utils/paymentAudit.js';
import { createDatabaseAdapter } from '../backend/db/pool.js';
import { canReconcileDelivery, isOwnerManualFulfillmentSource } from '../backend/services/deliveryService.js';
import { resolveRateLimitKey } from '../backend/middleware/rateLimit.js';
import { validateTelegramLoginPayload, createOwnerSession, ownerCookieHeader } from '../backend/middleware/ownerSession.js';
import { splitInventoryPayloads } from '../frontend/src/lib/inventory.js';
import { isSafeProductImageUrl, normalizeProductText, normalizeProductAttributes } from '../backend/services/productDetailsService.js';
import { parseProductAttributesText, formatProductAttributesText } from '../frontend/src/lib/product-attributes.js';
import { validateMarketplaceCategory, normalizeImageGallery } from '../backend/services/marketplaceCategoryService.js';
import { normalizeCartItems } from '../backend/services/cartService.js';
import { releaseExpiredPendingOrders } from '../backend/services/reservationService.js';


test('Owner dashboard has no stale product-form effect references', () => {
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/page.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ownerPage, /\b(?:skuManual|setForm|suggestedSku)\b/);
});

test('expired pending orders are atomically cancelled, unreserved, and hidden from stock counts', async () => {
  let statement = '';
  const db = {
    async query(sql) {
      statement = sql;
      return { rows: [{ expired_orders: 2, revoked_deliveries: 2, released_inventory: 2 }] };
    }
  };
  const result = await releaseExpiredPendingOrders(db);
  assert.deepEqual(result, { expired_orders: 2, revoked_deliveries: 2, released_inventory: 2 });
  assert.match(statement, /status='PENDING_PAYMENT'[\s\S]*INTERVAL '15 minutes'/);
  assert.match(statement, /UPDATE deliveries[\s\S]*status='REVOKED'/);
  assert.match(statement, /UPDATE inventory_items[\s\S]*status='AVAILABLE'/);
  assert.match(statement, /reserved_order_id IS NOT NULL/);
});

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

test('owner manual fulfillment slots are recognized only by their explicit source marker', () => {
  assert.equal(isOwnerManualFulfillmentSource('VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:OWNER_ATTESTED'), true);
  assert.equal(isOwnerManualFulfillmentSource('ordinary vendor invoice reference'), false);
  assert.equal(isOwnerManualFulfillmentSource(null), false);
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


test('Owner-created product review can be approved only with complete internal attestation', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const result = validateRightsReviewInput({
    rightsBasis:'OWNER_OWNED',
    publisherPlatform:'INTERNAL_OWNER',
    chainOfTitle:'Owned and maintained by the store owner.',
    transferMethod:'Deliver the owner-created digital file through the existing protected delivery flow.',
    region:'Global',
    validUntil:'2026-12-31',
    reviewStatus:'APPROVED',
    ownerAttested:true
  }, now);
  assert.equal(result.ok, true);
  assert.equal(result.value.reviewStatus, 'APPROVED');
  assert.equal(result.value.ownerAttested, true);
  assert.ok(new Date(result.value.validUntil) > now);
});

test('external product approval requires an official terms URL and authorization reference', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const base = {
    rightsBasis:'AUTHORIZED_VENDOR',
    publisherPlatform:'Example Publisher',
    chainOfTitle:'Vendor source and seller authority are documented in the reviewed agreement.',
    transferMethod:'Use the publisher-approved transfer process.',
    region:'Indonesia',
    validUntil:'2026-12-31',
    reviewStatus:'APPROVED',
    ownerAttested:true
  };
  assert.deepEqual(
    validateRightsReviewInput(base, now).errors.sort(),
    ['AUTHORIZATION_EVIDENCE_REFERENCE_REQUIRED','OFFICIAL_TERMS_URL_REQUIRED'].sort()
  );
  const complete = validateRightsReviewInput({
    ...base,
    officialTermsUrl:'https://publisher.example/terms',
    authorizationEvidenceReference:'DOC-OWNER-2026-001'
  }, now);
  assert.equal(complete.ok, true);
});

test('Owner review rejects incomplete declarations, invalid URLs and expired validity dates', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const result = validateRightsReviewInput({
    rightsBasis:'OWNER_CREATED',
    publisherPlatform:'INTERNAL_OWNER',
    officialTermsUrl:'http://not-secure.example/terms',
    chainOfTitle:'Internal source',
    transferMethod:'Internal delivery',
    region:'Indonesia',
    validUntil:'2026-11-01',
    reviewStatus:'APPROVED',
    ownerAttested:false
  }, now);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('OWNER_ATTESTATION_REQUIRED'));
  assert.ok(result.errors.includes('VALID_UNTIL_MUST_BE_FUTURE'));
  assert.ok(result.errors.includes('OFFICIAL_TERMS_URL_MUST_BE_HTTPS'));
});

test('rights review validity expires at its date and inventory must use the current review', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const review = { id:12, review_status:'APPROVED', owner_attested:true, valid_until:'2026-12-31T16:59:59.999Z' };
  const product = { id:1, status:'PENDING_REVIEW', is_test:false, current_rights_review_id:12 };
  assert.equal(isRightsReviewUsable(review, now), true);
  assert.equal(canAddProductInventory(product, review, now), true);
  assert.equal(canAddProductInventory({ ...product,current_rights_review_id:11 }, review, now), false);
  assert.equal(canAddProductInventory({ ...product,is_test:true }, review, now), false);
  assert.equal(canAddProductInventory({ ...product,status:'PAUSED' }, review, now), false);
  assert.equal(isRightsReviewUsable({ ...review,valid_until:'2026-11-23T11:59:59.000Z' }, now), false);
});


test('Owner product images accept HTTPS and local assets while rejecting unsafe schemes and paths', () => {
  assert.equal(isSafeProductImageUrl('https://cdn.example.com/catalog/product.webp'), true);
  assert.equal(isSafeProductImageUrl('/assets/products/mlbb.webp'), true);
  assert.equal(isSafeProductImageUrl('http://cdn.example.com/product.webp'), false);
  assert.equal(isSafeProductImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeProductImageUrl('/assets/../secrets.env'), false);
  assert.equal(isSafeProductImageUrl('//external.example/image.png'), false);
  assert.equal(isSafeProductImageUrl(''), true);
});

test('Owner product text values are trimmed and length-limited', () => {
  assert.equal(normalizeProductText('  Paket Gold  '), 'Paket Gold');
  assert.equal(normalizeProductText('x'.repeat(10), 5), 'xxxxx');
  assert.equal(normalizeProductText(null), '');
});

test('marketplace category guide accepts bounded Owner-authored steps', () => {
  const result = validateMarketplaceCategory({
    slug:'joki',name:'Joki',description:'Layanan pengerjaan game',
    icon:'🎮',purchaseGuide:[{title:'Pilih layanan',content:'Periksa detail dan cakupan layanan.'}],
    sortOrder:20,isActive:true
  });
  assert.equal(result.ok,true);
  assert.equal(result.value.purchaseGuide.length,1);
  assert.equal(validateMarketplaceCategory({...result.value,slug:'Invalid slug'}).ok,false);
  assert.equal(validateMarketplaceCategory({...result.value,purchaseGuide:Array(13).fill({title:'Step',content:'Text'})}).ok,false);
});

test('product image gallery accepts only safe HTTPS or local asset images', () => {
  assert.deepEqual(normalizeImageGallery(['https://cdn.example/a.webp','/assets/b.webp']).value,
    ['https://cdn.example/a.webp','/assets/b.webp']);
  assert.equal(normalizeImageGallery(['javascript:alert(1)']).ok,false);
  assert.equal(normalizeImageGallery(Array(9).fill('/assets/a.webp')).ok,false);
});

test('Owner product attributes are normalized and bounded for marketplace filters', () => {
  const normalized = normalizeProductAttributes({ Server:' Asia ', Rank:' Mythic ', Level:75 });
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.value, { Level:'75', Rank:'Mythic', Server:'Asia' });
  assert.equal(normalizeProductAttributes(['Rank','Mythic']).ok, false);
  assert.equal(normalizeProductAttributes({ Rank:'Mythic', rank:'Epic' }).ok, false);
  assert.equal(normalizeProductAttributes(Object.fromEntries([['constructor','unsafe']])).ok, false);
  assert.equal(normalizeProductAttributes({ Detail:'x'.repeat(161) }).ok, false);
  assert.equal(normalizeProductAttributes(Object.fromEntries(Array.from({length:25},(_,i)=>['Key'+i,'Value']))).ok, false);
});

test('Owner product attribute editor parses and formats one Key|Value pair per line', () => {
  const parsed = parseProductAttributesText('Rank|Mythic\nServer|Asia\nLevel|75');
  assert.equal(parsed.ok, true);
  assert.deepEqual({...parsed.value}, { Rank:'Mythic', Server:'Asia', Level:'75' });
  assert.equal(parseProductAttributesText('Rank Mythic').ok, false);
  assert.equal(parseProductAttributesText('Rank|Mythic\nrank|Epic').ok, false);
  assert.equal(formatProductAttributesText({ Rank:'Mythic', Server:'Asia' }), 'Rank|Mythic\nServer|Asia');
});

test('cart normalization preserves legacy checkout and merges valid product lines', () => {
  assert.deepEqual(normalizeCartItems({productId:4,quantity:2}).value.items,[{productId:4,quantity:2}]);
  assert.deepEqual(normalizeCartItems({items:[{productId:8,quantity:1},{productId:3,quantity:2},{productId:8,quantity:2}]}).value.items,
    [{productId:3,quantity:2},{productId:8,quantity:3}]);
  assert.equal(normalizeCartItems({items:[{productId:2,quantity:6}]}).ok,false);
  assert.equal(normalizeCartItems({items:Array.from({length:11},(_,i)=>({productId:i+1,quantity:1}))}).ok,false);
  assert.equal(normalizeCartItems({items:[{productId:2,quantity:2},{productId:3,quantity:2}]},{testMode:true}).ok,false);
});
