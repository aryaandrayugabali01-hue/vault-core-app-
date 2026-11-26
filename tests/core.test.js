import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import postcss from 'postcss';
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
import { createCustomerSession, readCustomerSession, customerCookieHeader } from '../backend/middleware/customerSession.js';
import { createTelegramOidcTransaction, validateTelegramOidcIdToken } from '../backend/utils/telegramOidc.js';
import { splitInventoryPayloads } from '../frontend/src/lib/inventory.js';
import { isSafeProductImageUrl, normalizeProductText, normalizeProductAttributes } from '../backend/services/productDetailsService.js';
import { parseProductAttributesText, formatProductAttributesText, getCustomerVisibleProductAttributes, normalizeCustomerDisplayText } from '../frontend/src/lib/product-attributes.js';
import { validateMarketplaceCategory, normalizeImageGallery } from '../backend/services/marketplaceCategoryService.js';
import { normalizeCartItems } from '../backend/services/cartService.js';
import { releaseExpiredPendingOrders } from '../backend/services/reservationService.js';

test('Owner authorization uses Neon owner_accounts as its sole source of truth', () => {
  const ownerAuth = readFileSync(new URL('../backend/middleware/adminAuth.js', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../cloudflare/vault-core-api.js', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
  assert.match(ownerAuth, /FROM owner_accounts WHERE telegram_user_id=\$1 AND is_active=TRUE/);
  assert.doesNotMatch(ownerAuth, /ADMIN_TELEGRAM_IDS/);
  assert.doesNotMatch(worker, /ADMIN_TELEGRAM_IDS/);
  assert.doesNotMatch(workflow, /secret put [\"']ADMIN_TELEGRAM_IDS/);
});

test('Telegram OIDC transaction creates independent state, nonce and PKCE values', () => {
  const first = createTelegramOidcTransaction();
  const second = createTelegramOidcTransaction();
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.verifier, second.verifier);
  assert.equal(crypto.createHash('sha256').update(first.verifier).digest('base64url'), first.challenge);
});

test('Telegram OIDC ID token validation verifies RS256 signature, issuer, audience, expiry and nonce', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'vault-test-key', alg: 'RS256' };
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: 'vault-test-key' });
  const claims = encode({
    iss: 'https://oauth.telegram.org',
    aud: '9167522638',
    sub: '6888336983',
    id: 6888336983,
    preferred_username: 'vault_owner',
    given_name: 'Vault Owner',
    iat: now,
    exp: now + 300,
    nonce: 'expected-nonce'
  });
  const signingInput = header + '.' + claims;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  const token = signingInput + '.' + signature;
  const fetchImpl = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });
  const user = await validateTelegramOidcIdToken(token, {
    clientId: '9167522638', nonce: 'expected-nonce', fetchImpl, now
  });
  assert.equal(user.id, '6888336983');
  assert.equal(user.username, 'vault_owner');
  await assert.rejects(
    validateTelegramOidcIdToken(token, { clientId: '9167522638', nonce: 'wrong-nonce', fetchImpl, now }),
    /TELEGRAM_OIDC_NONCE_INVALID/
  );
});

test('Owner login uses Telegram OIDC and does not load the deprecated iframe widget', () => {
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/page.jsx', import.meta.url), 'utf8');
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerAuth.js', import.meta.url), 'utf8');
  assert.match(ownerPage, /\/api\/owner-auth\/oidc\/start/);
  assert.doesNotMatch(ownerPage, /telegram-widget\.js/);
  assert.match(ownerRoute, /oauth\.telegram\.org\/token/);
  assert.match(ownerRoute, /validateTelegramOidcIdToken/);
});

test('Customer browser sessions are signed, separated from Owner cookies and expire after the configured window', () => {
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'customer-session-test-token';
  try {
    const token = createCustomerSession({ id:'6888336983', username:'neuralgoldcs', first_name:'Nn' });
    const user = readCustomerSession('vault_customer_session=' + token);
    assert.equal(user.id, '6888336983');
    assert.equal(user.username, 'neuralgoldcs');
    assert.equal(user.first_name, 'Nn');
    assert.equal(readCustomerSession('vault_owner_session=' + token), null);
    assert.match(customerCookieHeader(token), /HttpOnly/);
    assert.match(customerCookieHeader(token), /SameSite=Lax/);
    assert.match(customerCookieHeader('', 0), /Max-Age=0/);
    assert.equal(readCustomerSession('vault_customer_session=invalid.signature'), null);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
});

test('Customer web OIDC and Mini App authentication resolve into the same customers table and order API', () => {
  const customerRoute = readFileSync(new URL('../backend/routes/customerAuth.js', import.meta.url), 'utf8');
  const sessionMiddleware = readFileSync(new URL('../backend/middleware/customerSession.js', import.meta.url), 'utf8');
  const telegramMiddleware = readFileSync(new URL('../backend/middleware/telegramAuth.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../backend/app.js', import.meta.url), 'utf8');
  assert.match(customerRoute, /api\/customer-auth\/oidc\/callback/);
  assert.match(customerRoute, /INSERT INTO customers \(telegram_user_id, username, first_name\)/);
  assert.match(customerRoute, /createCustomerSession/);
  assert.match(sessionMiddleware, /vault_customer_session/);
  assert.match(telegramMiddleware, /readCustomerSession/);
  assert.match(telegramMiddleware, /validateTelegramInitData/);
  assert.match(app, /app\.use\('\/api\/customer-auth', apiRateLimit, customerAuthRoutes\)/);
  assert.match(app, /app\.use\('\/api\/orders', apiRateLimit, checkoutRateLimit, requireTelegramUser, ordersRoutes\)/);
});

test('Public website serves the backend-owned customer catalog and Telegram account page', () => {
  const home = readFileSync(new URL('../frontend/src/app/page.jsx', import.meta.url), 'utf8');
  const catalogRoute = readFileSync(new URL('../frontend/src/app/catalog/page.jsx', import.meta.url), 'utf8');
  const account = readFileSync(new URL('../frontend/src/app/account/page.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  assert.match(home, /redirect\('\/catalog'\)/);
  assert.match(catalogRoute, /VaultCoreV4Catalog/);
  assert.match(account, /api\/customer-auth\/oidc\/start/);
  assert.match(catalog, /api\/customer-auth\/session/);
  assert.match(catalog, /credentials:'include'/);
  assert.match(catalog, /window\.location\.assign\('\/account\?next=%2Fcatalog'\)/);
});

function topLevelCssProperty(styles, selector, property) {
  const root = postcss.parse(styles);
  const rule = root.nodes.find((node) => node.type === 'rule' && node.selector === selector);
  if (!rule) return undefined;
  let value;
  rule.walkDecls(property, (declaration) => { value = declaration.value; });
  return value;
}



test('Owner dashboard has no stale product-form effect references', () => {
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/page.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ownerPage, /\b(?:skuManual|setForm|suggestedSku)\b/);
});

test('v5 Mini App brand artwork and existing v4 catalog/Owner assets remain available', () => {
  const catalogRoute = readFileSync(new URL('../frontend/src/app/catalog/page.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const owner = readFileSync(new URL('../frontend/src/app/admin/page.jsx', import.meta.url), 'utf8');
  const ownerV4 = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  const marketplace = readFileSync(new URL('../frontend/src/lib/marketplace.js', import.meta.url), 'utf8');
  const miniHtml = readFileSync(new URL('../frontend/public/miniapp/index.html', import.meta.url), 'utf8');
  const miniApp = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  assert.ok(catalogRoute.includes("from './VaultCoreV4Page'"));
  assert.ok(catalogRoute.includes('return <VaultCoreV4Catalog />;'));
  assert.ok(catalog.includes('/assets/01-brand/vaultcore-horizontal.svg'));
  assert.ok(catalog.includes('GAME_ART[MARKET_GAME_CODE[code]]'));
  assert.ok(catalog.includes('GAME_ART[MARKET_GAME_CODE[variant.game_code]]'));
  assert.ok(owner.includes("from '../../lib/marketplace.js'"));
  assert.ok(ownerV4.includes('OWNER V4'));
  assert.ok(marketplace.includes('export const GAME_ART'));
  const gameIcons = ['/game-icons/mlbb.webp','/game-icons/free-fire.webp','/game-icons/roblox.webp','/game-icons/genshin-impact.webp'];
  for (const asset of gameIcons) {
    assert.ok(marketplace.includes(asset));
    assert.ok(miniApp.includes(asset));
    const bytes = readFileSync(new URL('../frontend/public' + asset, import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF',asset + ' RIFF header');
    assert.equal(bytes.toString('ascii',8,12),'WEBP',asset + ' WebP signature');
  }
  assert.equal(marketplace.includes('cloudfront.net/game'),false);
  assert.ok(miniHtml.includes('/assets/01-brand/vaultcore-mark.svg'));
  assert.ok(miniApp.includes('/assets/01-brand/vaultcore-horizontal.svg'));
  assert.ok(miniApp.includes('function comingSoonCard(variant)'));
  assert.ok(miniApp.includes('Akan Tersedia'));
  const miniCss = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  assert.ok(miniCss.includes('.product-card-soon'));
  assert.ok(ownerV4.includes('/api/admin/test-fixtures'));
  assert.ok(ownerV4.includes('/api/orders/test'));
  assert.ok(ownerV4.includes('Pembayaran 1 XTR tetap merupakan potongan Stars sungguhan'));
});

test('web catalog remains backend-driven while Telegram invoice and Mini App flow stay supported', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../frontend/src/app/catalog/page.jsx', import.meta.url), 'utf8');
  assert.ok(route.includes("from './VaultCoreV4Page'"));
  assert.match(page, /api\/customer-auth\/session/);
  assert.match(page, /credentials:'include'/);
  assert.match(page, /POST/);
  assert.match(page, /invoice Telegram Stars/);
  assert.match(page, /Telegram Stars \(XTR\)/);
  assert.match(page, /let activeCustomer = customer/);
  assert.match(page, /openInvoice\(data\.invoiceUrl,data\.orderNumber\)/);
  assert.doesNotMatch(page, /Rekber|Escrow|transfer bank|direct transfer|QRIS|PayLater/i);
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
  assert.ok(statement.includes('reserved_order_id IN (SELECT id FROM expired_orders)'));
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

test('encrypted account inventory accepts one account record per line and blocks session secrets', () => {
  const payload = '{"account_id":"player-001","account_password":"secret-value","login_method":"Moonton"}';
  assert.equal(assertAllowedDigitalPayload(payload), payload);
  assert.throws(() => assertAllowedDigitalPayload('session_cookie=secret'), /not supported/i);
  assert.throws(() => assertAllowedDigitalPayload('recovery_code=123456'), /not supported/i);
});

test('display stock override caps but cannot inflate actual inventory', () => {
  assert.equal(resolveDisplayStock({ actualStock: 3, override: 99 }), 3);
  assert.equal(resolveDisplayStock({ actualStock: 20, override: 4 }), 4);
  assert.equal(resolveDisplayStock({ actualStock: 0, override: 10 }), 0);
});


test('test fixtures are never visible through the public catalog policy', () => {
  assert.equal(isPublicCatalogProduct({ status:'ACTIVE',is_test:false,sale_price_xtr:2,game_category:'MLBB',fulfillment_type:'GAME_ACCOUNT_TRANSFER',marketplace_category_slug:'mlbb-akun' }),true);
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: false, sale_price_xtr: 1 }), false);
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: false }), false);
  assert.equal(isPublicCatalogProduct({ status: 'DRAFT', is_test: false, sale_price_xtr: 2 }), false);
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: true, sale_price_xtr: 2 }), false);
});

test('public catalog endpoints share one active, priced, approved and in-stock backend source', () => {
  const legacy = readFileSync(new URL('../backend/routes/catalog.js', import.meta.url), 'utf8');
  const v4 = readFileSync(new URL('../backend/routes/catalogV4.js', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  assert.ok(legacy.includes('getPublicCatalogVariants'));
  assert.ok(v4.includes('getPublicCatalogVariants'));
  assert.match(source, /p\.status='ACTIVE'/);
  assert.match(source, /COALESCE\(p\.is_test,FALSE\)=FALSE/);
  assert.match(source, /p\.sale_price_xtr>1/);
  assert.match(source, /rr\.review_status='APPROVED'/);
  assert.match(source, /rr\.owner_attested=TRUE/);
  assert.match(source, /rr\.valid_until>NOW\(\)/);
  assert.match(source, /stock\.available_stock>0/);
  assert.match(source, /secret_scope='PRODUCT_ACCOUNT'/);
  assert.match(source, /releaseExpiredPendingOrders/);
  assert.equal((source.match(/FROM vault_core_varian_wajib v/g)||[]).length,1);
});

test('v4 MLBB route opens the Apple catalog and account details use the public product DTO', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const routePage = readFileSync(new URL('../frontend/src/app/catalog/mlbb-akun/page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.match(routePage, /initialCategory="MLBB"/);
  assert.match(routePage, /initialCategorySlug="mlbb-akun"/);
  assert.match(page, /selected\.product/);
  assert.match(page, /selected\.product\.description/);
  assert.match(page, /safeAttrs\(selected\.product\.attributes\)/);
  assert.match(page, /vc4-details/);
  assert.match(page, /vc4-product-terms/);
  assert.match(page, /vc4-security-guide/);
  assert.match(page, /Tambah ke keranjang/);
  assert.match(styles, /overflow-wrap:anywhere/);
});

test('v4 customer catalog and Owner product routes use the canonical source behind their policies', () => {
  const app = readFileSync(new URL('../backend/app.js', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../backend/routes/catalogV4.js', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  assert.match(app, /app\.use\('\/api\/catalog\/v4', apiRateLimit, catalogV4Routes\)/);
  assert.match(app, /app\.use\('\/api\/admin\/v4', apiRateLimit, ownerRateLimit, requireOwnerSession, requireOwner, ownerV4Routes\)/);
  assert.match(page, /fetch\(API \+ '\/api\/catalog\/v4\/variants'/);
  assert.match(route, /getPublicCatalogVariants/);
  assert.match(service, /FROM vault_core_varian_wajib v/);
  assert.match(service, /stock\.available_stock>0/);
  assert.ok(service.includes('Object.fromEntries'));
  assert.match(ownerRoute, /router\.get\('\/products'/);
  assert.match(ownerRoute, /router\.post\('\/products\/:[^']+\/publish'/);
});

test('v4 customer catalog displays product prices only in Telegram Stars XTR', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  assert.match(page, /sale_price_xtr\)[^\n]*XTR/);
  assert.match(page, /openInvoice\(data\.invoiceUrl,data\.orderNumber\)/);
  assert.doesNotMatch(page, /formatIdrRange|price_min_idr|price_max_idr|Referensi pasar|Rp\s?\d/i);
});

test('test products require the Owner-only test checkout lane', () => {
  const commercial = { status:'ACTIVE',is_test:false,sale_price_xtr:2,game_category:'MLBB',fulfillment_type:'GAME_ACCOUNT_TRANSFER',marketplace_category_slug:'mlbb-akun' };
  const fixture = { status:'ACTIVE',is_test:true,sale_price_xtr:1,game_category:'MLBB',fulfillment_type:'GAME_ACCOUNT_TRANSFER',marketplace_category_slug:'mlbb-akun' };
  assert.equal(isEligibleCheckoutProduct(commercial), true);
  assert.equal(isEligibleCheckoutProduct({ ...commercial, sale_price_xtr: 1 }), false);
  assert.equal(isEligibleCheckoutProduct({ ...commercial, sale_price_xtr: 0 }), false);
  assert.equal(isEligibleCheckoutProduct({ ...commercial, sale_price_xtr: undefined }), false);
  assert.equal(isEligibleCheckoutProduct(fixture), false);
  assert.equal(isEligibleCheckoutProduct(fixture, { testMode: true, ownerAuthorized: false }), false);
  assert.equal(isEligibleCheckoutProduct(fixture, { testMode: true, ownerAuthorized: true }), true);
  assert.equal(isEligibleCheckoutProduct({ ...fixture, status: 'DRAFT' }, { testMode: true, ownerAuthorized: true }), false);
  assert.equal(isEligibleCheckoutProduct({ ...fixture, sale_price_xtr: 2 }, { testMode: true, ownerAuthorized: true }), false);
  assert.equal(isEligibleCheckoutProduct(commercial, { testMode: true, ownerAuthorized: true }), false);
  assert.equal(isEligibleCheckoutProduct({ ...commercial, fulfillment_type:'SERVICE_INSTRUCTIONS' }),false);
  assert.equal(isEligibleCheckoutProduct({ ...commercial, marketplace_category_slug:'mlbb-skin' }),false);
  assert.equal(isEligibleCheckoutProduct({ ...commercial, game_category:'OTHER' }),false);
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

test('delivery does not hold an idle database connection while awaiting Telegram', () => {
  const source = readFileSync(new URL('../backend/services/deliveryService.js', import.meta.url), 'utf8');
  assert.match(source, /rows: orderRows.*pool[.]query/s);
  assert.doesNotMatch(source, /const client = await pool[.]connect/);
  assert.match(source, /const completion = await pool[.]connect/);
  assert.match(source, /completion[.]release[(][)]/);
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
  const product = { id:1, status:'DRAFT', is_test:false, current_rights_review_id:12 };
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

test('marketplace categories are restricted to the four canonical game account categories', () => {
  const result = validateMarketplaceCategory({
    slug:'mlbb-akun',name:'Akun',description:'Akun Mobile Legends',
    icon:'🎮',purchaseGuide:[{title:'Periksa akun',content:'Periksa spesifikasi dan ketentuan akun.'}],
    sortOrder:20,isActive:true
  });
  assert.equal(result.ok,true);
  assert.equal(result.value.purchaseGuide.length,1);
  assert.equal(validateMarketplaceCategory({...result.value,slug:'joki'}).ok,false);
  assert.equal(validateMarketplaceCategory({...result.value,slug:'mlbb-skin'}).ok,false);
  assert.equal(validateMarketplaceCategory({...result.value,name:'Gift'}).ok,false);
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
  assert.equal(normalizeProductAttributes({ Detail:'x'.repeat(500) }).ok, true);
  assert.equal(normalizeProductAttributes({ Detail:'x'.repeat(501) }).ok, false);
  assert.equal(normalizeProductAttributes(Object.fromEntries(Array.from({length:25},(_,i)=>['Key'+i,'Value']))).ok, false);
});

test('Customer web navigation matches the Mini App Home, Katalog, Transaksi and Profil journey', () => {
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  assert.match(navigation, /label: 'Home'.*href: '\/'/);
  assert.match(navigation, /label: 'Katalog'.*href: '\/catalog'/);
  assert.match(navigation, /label: 'Transaksi'.*href: '\/catalog#transactions'/);
  assert.match(navigation, /label: 'Profil'.*href: '\/account'/);
  assert.match(catalog, /window\.location\.hash === '#transactions'/);
  assert.match(catalog, /vault-core-web-cart/);
});

test('customer catalog hides private price, ownership and XTR conversion metadata', () => {
  const visible = getCustomerVisibleProductAttributes({
    kode_produk:'ML-001',
    subkategori:'Akun Collector',
    metode_penyerahan:'Transfer resmi',
    xtr_price:2000,
    xtr_conversion_reference_date:'2026-11-23',
    xtr_conversion_rate_idr_per_star:375,
    xtr_conversion_source:'Internal reference',
    price_note:'Internal calculation',
    cost_price_status:'OWNER_SET_ZERO',
    owner_attestation_ref:'INTERNAL-REF',
    price_min_idr:100000,
    price_max_idr:200000
  });
  assert.deepEqual(visible, [
    ['kode_produk','ML-001'],
    ['subkategori','Akun Collector'],
    ['metode_penyerahan','Transfer resmi']
  ]);
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


test('v4 product lifecycle requires Owner rights review, all questions, stock and explicit publication', () => {
  const adminRoute = readFileSync(new URL('../backend/routes/admin.js', import.meta.url), 'utf8');
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  const catalogPage = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../database/migrations/016_remove_pending_review_product_status.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(adminRoute + ownerRoute + ownerPage + catalogPage, /PENDING_REVIEW|MENUNGGU REVIEW|belum dapat dibeli/i);
  assert.match(adminRoute, /variant_id IS NULL/);
  assert.match(ownerRoute, /isRightsReviewUsable/);
  assert.match(ownerRoute, /completed_questions|response_status IN/);
  assert.match(ownerRoute, /vault_core_secret_payloads/);
  assert.match(ownerRoute, /V4_PRODUCT_PUBLICATION_REQUIREMENTS_NOT_MET/);
  assert.match(ownerPage, /Simpan pemeriksaan hak/);
  assert.match(ownerPage, /Simpan spesifikasi produk/);
  assert.match(ownerPage, /Tambahkan stok/);
  assert.match(ownerPage, /Terbitkan SKU/);
  assert.ok(migration.includes('DROP CONSTRAINT IF EXISTS products_status_check'));
  assert.ok(migration.includes("'DRAFT','ACTIVE','PAUSED','ARCHIVED'"));
  const accountOnlyMigration = readFileSync(new URL('../database/migrations/021_pause_legacy_active_products.sql', import.meta.url), 'utf8');
  assert.ok(accountOnlyMigration.includes("IS DISTINCT FROM 'GAME_ACCOUNT_TRANSFER'"));
});

test('web storefront and Owner routes retain global chrome while Mini App keeps its separate mobile shell', () => {
  const home = readFileSync(new URL('../frontend/src/app/page.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const owner = readFileSync(new URL('../frontend/src/app/admin/page.jsx', import.meta.url), 'utf8');
  const ownerV4 = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../frontend/src/app/layout.jsx', import.meta.url), 'utf8');
  const catalogStyles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(home.includes("redirect('/catalog')"));
  assert.ok(owner.includes('StoreHeader'));
  assert.ok(owner.includes('/admin/v4'));
  assert.ok(ownerV4.includes('Dashboard Owner'));
  assert.ok(layout.includes('<StoreChrome />'));
  for (const label of ['Beranda','Produk','Bantuan','Akun']) assert.ok(navigation.includes(label));
  assert.ok(catalog.includes('className="vc4-nav"'));
  assert.ok(catalog.includes('className="vc4-main"'));
  assert.ok(catalogStyles.includes('body:has(.vc4-shell) .store-bottom-nav-shell'));
  assert.ok(catalogStyles.includes('backdrop-filter:saturate(180%) blur(18px)'));
});

test('customer display text normalizes repeated escaped newline sequences', () => {
  assert.equal(normalizeCustomerDisplayText('Baris satu\\nBaris dua'), 'Baris satu\nBaris dua');
  assert.equal(normalizeCustomerDisplayText('A\\\\nB'), 'A\nB');
  assert.equal(normalizeCustomerDisplayText('A\\\\r\\\\nB'), 'A\nB');
});

test('v4 product specifications keep label/value columns readable on the dark mobile catalog', () => {
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(styles.includes('.vc4-details>div{display:flex;justify-content:space-between'));
  assert.ok(styles.includes('.vc4-details span{text-transform:capitalize'));
  assert.ok(styles.includes('.vc4-details strong{text-align:right'));
  assert.ok(styles.includes('overflow-wrap:anywhere;word-break:break-word'));
  assert.ok(styles.includes('max-width:62%'));
});

test('customer detail text converts escaped newlines into readable line breaks', async () => {
  const { normalizeCustomerDisplayText } = await import('../frontend/src/lib/product-attributes.js');
  assert.equal(normalizeCustomerDisplayText('Baris satu\\nBaris dua'), 'Baris satu\nBaris dua');
  assert.equal(normalizeCustomerDisplayText('A\\r\\nB\\rC'), 'A\nB\nC');
  assert.equal(normalizeCustomerDisplayText('Sudah\\nbaris\nbaru'), 'Sudah\nbaris\nbaru');
  assert.equal(normalizeCustomerDisplayText(null), '');
});

test('v4 product details wrap long specifications and refresh inventory from the public catalog', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(page.includes("fetch(API + '/api/catalog/v4/variants'"));
  assert.ok(page.includes('selected.product.description'));
  assert.ok(page.includes('safeAttrs(selected.product.attributes)'));
  assert.ok(page.includes('image_gallery'));
  assert.ok(page.includes('display_stock'));
  assert.ok(page.includes('loadCatalog'));
  assert.ok(styles.includes('overflow-wrap:anywhere'));
  assert.ok(styles.includes('vc4-details'));
});

test('v4 product detail keeps the approved dark Vault Core catalog palette', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(page.includes('vc4-nav'));
  assert.ok(page.includes('vc4-card-art'));
  assert.ok(page.includes('vc4-sku-list'));
  assert.ok(page.includes('vc4-dialog'));
  assert.ok(page.includes('vc4-product-terms'));
  assert.ok(page.includes('vc4-security-guide'));
  assert.match(styles, /--vc4-page:#090d14/);
  assert.match(styles, /--vc4-card:#111925/);
  assert.match(styles, /--vc4-gold:#ffc928/);
  assert.ok(styles.includes('.vc4-grid{grid-template-columns:1fr'));
});

test('MLBB account detail uses the public v4 DTO, last-stock label, and four-step security guide', () => {
  const route = readFileSync(new URL('../frontend/src/app/catalog/mlbb-akun/page.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const catalogApi = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  const guard = readFileSync(new URL('../database/migrations/026_vault_question_plaintext_guard_regex.sql', import.meta.url), 'utf8');
  assert.match(route, /initialCategory="MLBB"/);
  for (const label of ['Win Rate','Jumlah Skin','Jumlah Hero','Rank Saat Ini','Akun Terhubung Pada']) assert.ok(page.includes(label));
  assert.match(page, /game==='MLBB' && group==='Akun'/);
  assert.match(page, /STOK TERAKHIR/);
  assert.match(page, /Keamanan Akun/);
  assert.match(page, /Ganti kata sandi setelah menerima akses akun/);
  assert.match(page, /Aktifkan verifikasi dua langkah/);
  assert.match(page, /metode pemulihan/);
  assert.match(catalogApi, /display_stock:/);
  assert.ok(catalogApi.includes('Object.fromEntries'));
  assert.ok(catalogApi.includes("Object.entries(sku.attributes ?? {})"));
  assert.match(styles, /vc4-mlbb-filters/);
  assert.match(styles, /vc4-mlbb-grid/);
  assert.match(guard, /login\|password\|pass\|sandi\|otp\|session\|recovery\|token/);
});

test('v4 account catalogue shows MLBB filters only for MLBB accounts', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  for (const label of ['Win Rate','Jumlah Skin','Jumlah Hero','Rank Saat Ini','Akun Terhubung Pada']) assert.ok(page.includes(label));
  assert.match(page, /game==='MLBB' && group==='Akun'/);
  assert.match(page, /filtersOpen &&/);
  assert.match(page, /filters\.providers/);
  assert.match(page, /filters\.rank/);
  assert.match(page, /matchesMlbb\(product,filters\)/);
  assert.match(page, /filters\.winMin/);
  assert.match(page, /filters\.skinMin/);
  assert.match(page, /filters\.heroMin/);
  assert.match(styles, /vc4-mlbb-filters/);
  assert.match(styles, /vc4-mlbb-grid/);
  assert.match(styles, /vc4-check/);
  const ownerV4 = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  const ownerRoutes = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  assert.match(ownerV4, /Pilih game dan jenis produk/);
  assert.match(ownerV4, /Galeri Foto Produk/);
  assert.match(ownerV4, /Deskripsi Produk/);
  assert.match(ownerV4, /Simpan spesifikasi produk/);
  assert.match(ownerRoutes, /field_key/);
  assert.match(ownerRoutes, /validateListingFields/);
  assert.match(ownerRoutes, /imageGallery/);
  assert.match(ownerRoutes, /vault_core_pertanyaan_wajib_only/);
});

test('Apple v4 mobile product detail preserves SKU price, attributes, terms and secure purchase action', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(page.includes('vc4-card-foot'));
  assert.ok(page.includes('vc4-price-large'));
  assert.ok(page.includes('vc4-details'));
  assert.ok(page.includes('vc4-product-terms'));
  assert.ok(page.includes('vc4-security-guide'));
  assert.ok(page.includes('Tambah ke keranjang'));
  assert.ok(page.includes('Bayar dengan Telegram Stars'));
  assert.ok(styles.includes('@media(max-width:760px)'));
  assert.ok(styles.includes('grid-template-columns:1fr'));
  assert.ok(styles.includes('.vc4-dialog{padding:28px 20px}'));
});

test('v4 customer catalog footer follows XTR, account-security and Telegram payment rules', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(page.includes('Telegram Mini App'));
  assert.ok(page.includes('Telegram Stars (XTR)'));
  assert.ok(page.includes('Status pembayaran hanya ditetapkan setelah konfirmasi webhook Telegram'));
  assert.ok(page.includes('vault terenkripsi'));
  for (const unsupportedMethod of ['BCA','Mandiri','BNI','Maybank','BRI','Indomaret','Alfamart','QRIS','ShopeePay','PayLater']) assert.equal(page.includes(unsupportedMethod),false);
  assert.ok(styles.includes('.vc4-footer'));
});

test('the production website opens the React catalog while the Telegram Mini App remains available', () => {
  const page = readFileSync(new URL('../frontend/src/app/page.jsx', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../frontend/public/miniapp/index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../backend/routes/catalogV4.js', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../database/migrations/024_vault_core_v4_master_secret_vault.sql', import.meta.url), 'utf8');
  const seed = migration.match(/jsonb_array_elements\(\$\$([\s\S]*?)\$\$::jsonb\)/);
  assert.ok(seed, 'Canonical 12-variant seed must remain available');
  assert.equal(JSON.parse(seed[1]).length,12);
  assert.ok(page.includes("redirect('/catalog')"));
  assert.ok(html.includes('<nav class="nav" id="nav"'));
  assert.ok(page.includes("redirect('/catalog')"));
  assert.ok(html.includes('./app.css'));
  assert.equal(html.includes('./variants.js'),false);
  assert.ok(styles.includes('#app{position:relative;width:min(100%,430px)'));
  assert.ok(styles.includes('.games{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'));
  assert.ok(styles.includes('.nav{position:fixed'));
  assert.ok(styles.includes('.hero{'));
  assert.ok(app.includes('data-go="/catalog"'));
  assert.ok(app.includes("api('/api/catalog/v4/variants')"));
  assert.ok(route.includes('getPublicCatalogVariants'));
  assert.equal(app.includes('window.VAULT_VARIANTS'),false);
});

test('Mini App and React catalog use the same catalog, order, and XTR payment API contract', () => {
  const mini = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const react = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const orders = readFileSync(new URL('../backend/controllers/orderController.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../backend/app.js', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../frontend/public/miniapp/config.js', import.meta.url), 'utf8');
  assert.ok(mini.includes("api('/api/catalog/v4/variants')"));
  assert.ok(react.includes("'/api/catalog/v4/variants'"));
  assert.ok(mini.includes("api('/api/orders'"));
  assert.ok(react.includes("fetch(API + '/api/orders'"));
  assert.ok(mini.includes("api('/api/orders/mine')"));
  assert.ok(react.includes("'/api/orders/mine'"));
  assert.ok(mini.includes("const body = {items:[{productId:Number(product.id),quantity:1}]}"));
  assert.ok(react.includes("items:cart.map(({productId,quantity}) => ({productId,quantity}))"));
  assert.ok(mini.includes('tg.openInvoice'));
  assert.ok(react.includes('openInvoice(data.invoiceUrl,data.orderNumber)'));
  assert.ok(mini.includes("api('/api/orders/' + encodeURIComponent(target.orderNumber) + '/customer-access'"));
  assert.ok(api.includes('requireTelegramUser'));
  assert.ok(orders.includes('normalizeCartItems'));
  assert.ok(config.includes("apiBase: ''"));
  assert.equal(mini.includes("api('/api/catalog')"),false);
  assert.equal(mini.includes("paymentMethod:'XTR'"),false);
  assert.equal(mini.includes('/api/web-auth'),false);
  assert.equal(mini.includes('vc_web_session'),false);
  assert.equal(mini.includes('TELEGRAM_OIDC'),false);
});

test('all 12 master variants and every published SKU are loaded from the canonical backend response', () => {
  const migration = readFileSync(new URL('../database/migrations/024_vault_core_v4_master_secret_vault.sql', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const seed = migration.match(/jsonb_array_elements\(\$\$([\s\S]*?)\$\$::jsonb\)/);
  assert.ok(seed);
  assert.equal(JSON.parse(seed[1]).length,12);
  assert.ok(service.includes('FROM vault_core_varian_wajib v'));
  assert.ok(app.includes('state.variants = Array.isArray(variants) ? variants : []'));
  assert.ok(app.includes('state.variants.flatMap'));
  assert.ok(app.includes('function productsOf('));
  assert.ok(app.includes('Akan Tersedia'));
  assert.equal(app.includes('window.VAULT_VARIANTS'),false);
  assert.equal(app.includes('buyer-input'),false);
});

test('Mini App header and bottom navigation do not stack over the product detail CTA', () => {
  const html = readFileSync(new URL('../frontend/public/miniapp/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  assert.equal((html.match(/<nav\b/g) || []).length,1);
  assert.ok(html.includes('id="nav" aria-label="Navigasi utama" hidden'));
  assert.ok(app.includes("nav.hidden = Boolean(hideNav)"));
  assert.ok(app.includes("headerPage('Detail Produk')"));
  assert.ok(app.includes("'catalog', true"));
  assert.ok(css.includes('.nav[hidden]{display:none!important}'));
  assert.ok(css.includes('width:min(calc(100% - 24px),430px)'));
  assert.ok(css.includes('border-radius:26px'));
  assert.ok(css.includes('.nav .ic{box-sizing:border-box;display:block;width:36px;height:36px'));
  assert.ok(css.includes('linear-gradient(100deg,rgba(245,196,81,.85),rgba(139,92,246,.75)'));
  assert.equal((app.match(/function headerHome\(/g) || []).length,1);
  assert.equal((app.match(/function headerPage\(/g) || []).length,1);
  assert.ok(css.includes('.topbar{position:sticky'));
  assert.ok(css.includes('.pagebar{position:sticky'));
});

test('product detail converts escaped backend newlines into readable sections and avoids duplicate generic terms', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../frontend/public/miniapp/sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes('vault-core-miniapp-v6'));
  assert.ok(app.includes(".replace(/\\\\r\\\\n|\\\\n|\\\\r/g, '\\n')"));
  assert.ok(app.includes("renderDetailCopy(product.customer_terms)"));
  assert.ok(app.includes("details.push(renderDetailCopy(product.description))"));
  assert.equal(app.includes("details.push('<ul><li>Pembayaran Telegram Stars (XTR)</li>"),false);
  assert.ok(app.includes('<h4>') && app.includes('<br>'));
  assert.ok(css.includes('.detail-copy h4{'));
  assert.ok(css.includes('.detail-copy p{'));
});

test('checkout and transaction history require verified Telegram Mini App initData', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const webhook = readFileSync(new URL('../backend/routes/telegramWebhook.js', import.meta.url), 'utf8');
  const apiConfig = readFileSync(new URL('../wrangler.api.jsonc', import.meta.url), 'utf8');
  assert.ok(app.includes('const inTelegram = Boolean(tg && tg.initData)'));
  assert.ok(app.includes('if (!inTelegram || !tg || !tg.initData)'));
  assert.ok(webhook.includes('https://vaultcore.biz.id/miniapp/index.html'));
  assert.ok(apiConfig.includes('"TELEGRAM_MINI_APP_URL": "https://vaultcore.biz.id/miniapp/index.html"'));
});

test('obsolete dashboard cascade and internal navigation debug copy are removed', () => {
  const mobile = readFileSync(new URL('../frontend/src/app/mobile-app.css', import.meta.url), 'utf8');
  const global = readFileSync(new URL('../frontend/src/app/globals.css', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  assert.equal(mobile.includes('.dashboard-shell'),false);
  assert.equal(mobile.includes('.dashboard-hero'),false);
  assert.equal(mobile.includes('.dashboard-game-grid'),false);
  assert.equal(global.includes('.marketplace-detail-'),false);
  assert.equal(global.includes('.marketplace-info-modal'),false);
  assert.equal(global.includes('.mlbb-provider-search'),false);
  assert.equal(global.includes('.category-card'),false);
  assert.equal(global.includes('.product-card'),false);
  assert.ok(global.includes('.dashboard-bottom-nav'));
  assert.equal(navigation.includes('Bottom navigation melayang'),false);
});

test('mobile app assets are included in the static frontend and service worker never caches API responses', () => {
  const html = readFileSync(new URL('../frontend/public/miniapp/index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../frontend/public/miniapp/sw.js', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../frontend/public/miniapp/config.js', import.meta.url), 'utf8');
  const manifest = readFileSync(new URL('../frontend/public/miniapp/manifest.webmanifest', import.meta.url), 'utf8');
  assert.ok(html.includes('./app.js'));
  assert.equal(html.includes('./variants.js'),false);
  assert.ok(config.includes("apiBase: ''"));
  assert.ok(manifest.includes('"scope":"/miniapp/"'));
  assert.ok(sw.includes("url.pathname.startsWith('/api/')"));
  for (const asset of ['/game-icons/mlbb.webp','/game-icons/free-fire.webp','/game-icons/roblox.webp','/game-icons/genshin-impact.webp']) assert.ok(sw.includes(asset));
  assert.ok(sw.includes("const CACHE_NAME = 'vault-core-miniapp-v6'"));
});

test('active CSS rules do not contain repeated declarations that can reintroduce same-rule conflicts', () => {
  const files = [
    '../frontend/src/app/globals.css',
    '../frontend/src/app/mobile-app.css',
    '../frontend/src/app/catalog/page.css',
    '../frontend/src/app/admin/v4/page.css',
    '../frontend/public/miniapp/app.css'
  ];
  for (const file of files) {
    const root = postcss.parse(readFileSync(new URL(file, import.meta.url), 'utf8'), { from:file });
    const conflicts = [];
    root.walkRules((rule) => {
      const seen = new Set();
      rule.walkDecls((decl) => {
        const property = decl.prop.startsWith('--') ? decl.prop : decl.prop.toLowerCase();
        if (seen.has(property)) conflicts.push({selector:rule.selector,property});
        seen.add(property);
      });
    });
    assert.deepEqual(conflicts, [], file + ' contains repeated declarations inside one selector block');
  }
});

test('public account catalog and checkout require a live per-item encrypted vault record', () => {
  const catalog = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  const orders = readFileSync(new URL('../backend/controllers/orderController.js', import.meta.url), 'utf8');
  assert.match(catalog, /v\.kategori_produk<>'Akun'[\s\S]*OR EXISTS/);
  assert.match(catalog, /s\.secret_scope='PRODUCT_ACCOUNT'/);
  assert.match(catalog, /s\.secret_status='ACTIVE'/);
  assert.match(orders, /secureVaultOnly = !testMode/);
  assert.match(orders, /s\.secret_scope='PRODUCT_ACCOUNT'/);
  assert.match(orders, /s\.secret_status='ACTIVE'/);
  assert.match(orders, /FOR UPDATE SKIP LOCKED/);
});


test('legacy SKU mapping is explicit, canonical-category-bound and keeps products in draft', () => {
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  assert.match(ownerRoute, /router\.put\('\/products\/:[^']+\/variant'/);
  for (const slug of ['mlbb-akun','free-fire-akun','roblox-akun','genshin-akun','roblox-blox-fruits','roblox-adopt-me','roblox-murder-mystery-2']) assert.ok(ownerRoute.includes("'" + slug + "'"));
  assert.match(ownerRoute, /LEGACY_CATEGORY_HAS_NO_V4_VARIANT/);
  assert.match(ownerRoute, /VARIANT_MAPPING_DOES_NOT_MATCH_LEGACY_PRODUCT/);
  assert.match(ownerRoute, /PRODUCT_VARIANT_ALREADY_ASSIGNED/);
  assert.match(ownerRoute, /status=CASE WHEN status='ACTIVE' THEN 'DRAFT' ELSE status END/);
  assert.match(ownerRoute, /V4_LEGACY_PRODUCT_VARIANT_MAPPED/);
  assert.match(ownerPage, /LEGACY_VARIANT_BY_SLUG/);
  assert.match(ownerPage, /pindahkan ke DRAFT/i);
});

test('legacy unvaulted account stock is retired only after explicit Owner confirmation and encrypted replacement', () => {
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  assert.match(ownerRoute, /replaceLegacyStock !== true/);
  assert.match(ownerRoute, /LEGACY_STOCK_REPLACEMENT_ACK_REQUIRED/);
  assert.match(ownerRoute, /SET status='UNAVAILABLE'/);
  assert.match(ownerRoute, /NOT EXISTS \([\s\S]*secret_scope='PRODUCT_ACCOUNT'[\s\S]*secret_status='ACTIVE'/);
  assert.match(ownerPage, /replaceLegacyStock/);
  assert.match(ownerPage, /unit stok lama yang tidak memiliki record vault v4 aktif akan dinonaktifkan/);
  assert.match(ownerPage, /data\.replacedLegacyStockCount/);
});


test('active stylesheets have unique selectors within each cascade context', () => {
  const files = [
    '../frontend/src/app/globals.css',
    '../frontend/src/app/mobile-app.css',
    '../frontend/src/app/catalog/page.css',
    '../frontend/src/app/admin/v4/page.css',
    '../frontend/public/miniapp/app.css'
  ];
  const normalizeContext = (name, params) => {
    const value = String(params || '').trim();
    if (['media','supports','container','document'].includes(name)) {
      return '@' + name + ' ' + value.replace(/\s+/g, ' ').replace(/\s*([():,])\s*/g, '$1').toLowerCase();
    }
    return '@' + name + ' ' + value.replace(/\s+/g, ' ');
  };
  for (const file of files) {
    const css = readFileSync(new URL(file, import.meta.url), 'utf8');
    const root = postcss.parse(css, { from: file });
    const seen = new Set();
    const duplicates = [];
    const visit = (container, context = 'GLOBAL') => {
      container.each((node) => {
        if (node.type === 'atrule') {
          visit(node, context + ' ' + normalizeContext(node.name.toLowerCase(), node.params));
          return;
        }
        if (node.type !== 'rule') return;
        for (const selector of postcss.list.comma(node.selector).map((value) => value.trim())) {
          const key = context + '\\u0000' + selector;
          if (seen.has(key)) duplicates.push({ context, selector });
          seen.add(key);
        }
      });
    };
    visit(root);
    assert.deepEqual(duplicates, [], file + ' still contains repeated selectors in one cascade context');
  }
  const miniAppStyles = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  assert.ok(miniAppStyles.includes('.nav button.on{background:rgba(255,201,40,.14);color:var(--gold)'));
  assert.ok(miniAppStyles.includes('.filters button.on{border-color:rgba(255,201,40,.65)'));
});


test('clean /miniapp route and Telegram bot still open the canonical static Mini App entry', () => {
  const entry = readFileSync(new URL('../frontend/src/app/miniapp/page.jsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../frontend/src/app/page.jsx', import.meta.url), 'utf8');
  const webhook = readFileSync(new URL('../backend/routes/telegramWebhook.js', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../wrangler.api.jsonc', import.meta.url), 'utf8');
  assert.ok(entry.includes("redirect('/miniapp/index.html')"));
  assert.ok(home.includes("redirect('/catalog')"));
  assert.ok(webhook.includes("https://vaultcore.biz.id/miniapp/index.html"));
  assert.ok(config.includes('"TELEGRAM_MINI_APP_URL": "https://vaultcore.biz.id/miniapp/index.html"'));
});

test('Owner shared header has responsive styling and does not render customer footer links', () => {
  const styles = readFileSync(new URL('../frontend/src/app/globals.css', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  for (const selector of ['.dashboard-topbar{','.dashboard-brand{','.dashboard-header-label{','.dashboard-header-actions{','.dashboard-search{']) {
    assert.ok(styles.includes(selector), 'Missing shared header style: ' + selector);
  }
  assert.ok(styles.includes('@media(max-width:380px){'));
  assert.ok(navigation.includes("{!isOwnerPage && <StoreFooter/>}"));
});

test('mobile shell reserves fixed navigation space once instead of stacking oversized page padding', () => {
  const mobile = readFileSync(new URL('../frontend/src/app/mobile-app.css', import.meta.url), 'utf8');
  const owner = readFileSync(new URL('../frontend/src/app/admin/v4/page.css', import.meta.url), 'utf8');
  const global = readFileSync(new URL('../frontend/src/app/globals.css', import.meta.url), 'utf8');
  assert.ok(mobile.includes('padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))'));
  assert.ok(mobile.includes('.vc4-main{padding:35px 16px 28px}'));
  assert.equal(mobile.includes('.vc-mobile-app .vco-shell{padding-bottom:'), false);
  assert.ok(owner.includes('min-height:100vh;padding:0 0 28px;'));
  assert.ok(global.includes('padding-bottom:calc(28px + env(safe-area-inset-bottom,0px))'));
});

test('Mini App Joki customer access is submitted only through the authenticated encrypted API route', () => {
  const mini = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const controller = readFileSync(new URL('../backend/controllers/secretController.js', import.meta.url), 'utf8');
  assert.ok(mini.includes("item.category === 'Jasa Joki'"));
  assert.ok(mini.includes("'/customer-access'"));
  assert.ok(mini.includes("data-action=\"submit-joki-access\""));
  assert.ok(controller.includes("scope:'JOKI_CUSTOMER_ACCESS'"));
  assert.ok(controller.includes('encryptSecretPayload({ login, password }, context)'));
});
