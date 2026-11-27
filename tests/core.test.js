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
import { createTelegramOidcTransaction, validateTelegramOidcIdToken, safeCustomerReturnPath } from '../backend/utils/telegramOidc.js';
import { splitInventoryPayloads } from '../frontend/src/lib/inventory.js';
import { submitJokiCustomerAccess } from '../backend/controllers/secretController.js';
import { isSafeProductImageUrl, normalizeProductText, normalizeProductAttributes } from '../backend/services/productDetailsService.js';
import { parseProductAttributesText, formatProductAttributesText, getCustomerVisibleProductAttributes, normalizeCustomerDisplayText } from '../frontend/src/lib/product-attributes.js';
import { validateMarketplaceCategory, normalizeImageGallery } from '../backend/services/marketplaceCategoryService.js';
import { normalizeCartItems } from '../backend/services/cartService.js';
import { releaseExpiredPendingOrders } from '../backend/services/reservationService.js';
import { sanitizeCustomerProductAttributes, sanitizeCustomerProductCopy, toPublicCatalogProduct, toLegacyCatalogResponse } from '../backend/services/publicCatalogService.js';

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

test('Customer OIDC return path is restricted to local account and catalog pages', () => {
  assert.equal(safeCustomerReturnPath('/catalog'), '/catalog');
  assert.equal(safeCustomerReturnPath('/catalog/mlbb-akun?sort=price#products'), '/catalog/mlbb-akun?sort=price#products');
  assert.equal(safeCustomerReturnPath('/account?next=%2Fcatalog'), '/account?next=%2Fcatalog');
  for (const value of ['https://evil.example','//evil.example','/\\evil.example','/admin','/api/customer-auth/oidc/start','']) {
    assert.equal(safeCustomerReturnPath(value), '/account', 'Rejected unsafe return path: ' + value);
  }
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
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const productionCookie = customerCookieHeader(token);
      assert.match(productionCookie, /HttpOnly/);
      assert.match(productionCookie, /Secure/);
      assert.match(productionCookie, /Domain=\.vaultcore\.biz\.id/);
      assert.match(productionCookie, /Path=\//);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
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
  assert.match(customerRoute, /vault_customer_oidc_return/);
  assert.match(customerRoute, /safeCustomerReturnPath/);
  assert.match(customerRoute, /Path=\/api\/customer-auth/);
  assert.match(customerRoute, /Domain=\.vaultcore\.biz\.id/);
  assert.match(customerRoute, /target.searchParams.set\('next', safePath\)/);
  assert.match(customerRoute, /new URL\(returnPath, FRONTEND_ACCOUNT_URL\)/);
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
  assert.match(home, /VaultCoreHomePage/);
  assert.match(catalogRoute, /VaultCoreV4Catalog/);
  assert.match(account, /api\/customer-auth\/oidc\/start/);
  assert.match(account, /function safeAccountReturnPath/);
  assert.match(account, /setNextPath\(safeAccountReturnPath\(next\)\)/);
  assert.match(account, /response\.status === 401/);
  assert.match(account, /throw new Error\(data\.message/);
  assert.match(account, /nextPath \? '\?next=' \+ encodeURIComponent\(nextPath\)/);
  assert.match(account, /href=\{destination\}/);
  assert.match(account, /href="\/catalog#transactions">Lihat Riwayat Pesanan<\/a>/);
  assert.match(account, /Profil dan riwayat pesanan terhubung ke sistem VAULT CORE yang sama/);
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




test('public catalog copy removes stale buyer-doubt text and keeps core SKU facts', () => {
  const source = 'Akun MLBB dengan 79 hero dan 130 skin. Email Moonton dan tautan platform sosial disebut dapat dilepas setelah 30 hari. Rank dapat turun saat reset season baru.';
  const cleaned = sanitizeCustomerProductCopy(source);
  assert.match(cleaned, /79 hero dan 130 skin/);
  assert.doesNotMatch(cleaned, /dapat dilepas setelah 30 hari|rank dapat turun saat reset season/i);
  assert.doesNotMatch(sanitizeCustomerProductCopy('Keterangan “100% No Minus” merupakan klaim pada materi penawaran; pembeli tetap perlu memeriksa ID dan nickname.'), /100%\s*No\s*Minus/i);
  assert.doesNotMatch(sanitizeCustomerProductCopy('Vault 450+ Item, Off Banned 100%.'), /Off Banned/i);
  const publicProduct = toPublicCatalogProduct({
    id:5, sale_price_xtr:25, actual_stock:1,
    description:source,
    customer_terms:'Pemenuhan manual oleh Owner setelah pembayaran XTR terverifikasi. Produk diserahkan melalui metode yang tercantum untuk SKU ini.',
    fulfillment_eta:'Penyerahan manual oleh VAULT CORE setelah pembayaran Telegram Stars terverifikasi.',
    attributes:{unbind_terms:'Dapat dilepas setelah 30 hari',season_note:'Rank turun saat reset season',linked_platforms:'Google Play, Facebook, TikTok'}
  });
  assert.doesNotMatch(publicProduct.description, /30 hari|reset season/i);
  assert.equal(publicProduct.customer_terms, '');
  assert.equal(publicProduct.fulfillment_eta, '');
  assert.deepEqual(publicProduct.attributes, {linked_platforms:'Google Play, Facebook, TikTok'});
});

test('storefront click targets and Mini App actions resolve to working routes or handlers', () => {
  const home = readFileSync(new URL('../frontend/src/app/VaultCoreHomePage.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  const miniApp = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const premiumCss = readFileSync(new URL('../frontend/public/vault-core-premium.css', import.meta.url), 'utf8');
  assert.match(home, /<a href="\/catalog#transactions" className="vc-home-notification"/);
  assert.match(home, /<a className="vc-home-activity" href="\/catalog#transactions"/);
  assert.match(catalog, /id="catalog-footer-buy-guide"/);
  assert.match(navigation, /https:\/\/t\.me\/vaultcore_support/);
  assert.match(navigation, /\/miniapp\/index\.html#\/terms/);
  assert.match(navigation, /\/miniapp\/index\.html#\/refund/);
  assert.match(miniApp, /class="home-activity" data-go="\/orders"/);
  assert.match(miniApp, /<form class="search home-search" id="home-search-form">/);
  assert.match(miniApp, /document\.addEventListener\('submit',handleSubmit\)/);
  const homeSearchInput = miniApp.match(/if \(event\.target && event\.target\.id === 'home-search'\) \{([\s\S]*?)\n  \}/);
  assert.ok(homeSearchInput, 'Home search input handler is present');
  assert.doesNotMatch(homeSearchInput[1], /go\('\/catalog'\)/, 'Typing must not navigate before search submission');
  assert.match(miniApp, /form\.id !== 'home-search-form'[\s\S]*?go\('\/catalog'\)/);
  assert.match(miniApp, /case 'about': case 'terms': case 'privacy': case 'refund': renderInfo\(name\)/);
  const renderedActions = new Set([...miniApp.matchAll(/data-action=["']([^"']+)["']/g)].map((match) => match[1]));
  const handledActions = new Set([...miniApp.matchAll(/action === '([^']+)'/g)].map((match) => match[1]));
  for (const action of renderedActions) assert.ok(handledActions.has(action), 'Missing Mini App click handler: ' + action);
  assert.match(miniApp, /document\.execCommand\('copy'\)/);
  assert.match(premiumCss, /\.home-activity\{[^}]*cursor:pointer/);
  assert.match(premiumCss, /\.vc-home-activity\{[^}]*cursor:pointer/);
});

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
  assert.ok(catalog.includes('GAME_ART[MARKET_GAME_CODE[product.game_code]]'));
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
  assert.equal(isPublicCatalogProduct({ status:'ACTIVE',is_test:false,sale_price_xtr:2,variant_category:'Produk Lainnya',fulfillment_type:'GIFT_CODE' }),true);
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: false, sale_price_xtr: 1 }), false);
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: false }), false);
  assert.equal(isPublicCatalogProduct({ status: 'DRAFT', is_test: false, sale_price_xtr: 2 }), false);
  assert.equal(isPublicCatalogProduct({ status: 'ACTIVE', is_test: true, sale_price_xtr: 2 }), false);
});

test('public catalog endpoints share one active, priced, Owner-selected and in-stock backend source', () => {
  const legacy = readFileSync(new URL('../backend/routes/catalog.js', import.meta.url), 'utf8');
  const v4 = readFileSync(new URL('../backend/routes/catalogV4.js', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  assert.ok(legacy.includes('getPublicCatalogVariants'));
  assert.ok(v4.includes('getPublicCatalogVariants'));
  assert.match(source, /p\.status='ACTIVE'/);
  assert.match(source, /COALESCE\(p\.is_test,FALSE\)=FALSE/);
  assert.match(source, /p\.sale_price_xtr>1/);
  assert.doesNotMatch(source, /JOIN product_rights_reviews/);
  assert.match(source, /STANDALONE_PRODUCTS_SQL/);
  assert.match(source, /variant_id:-Number\(product\.id\)/);
  assert.match(source, /stock\.available_stock>0/);
  assert.doesNotMatch(source, /vault_core_secret_payloads/);
  assert.match(source, /availability_mode/);
  assert.match(source, /indent_deadline_days/);
  assert.match(source, /customer_input_fields/);
  assert.match(source, /releaseExpiredPendingOrders/);
  assert.equal((source.match(/FROM vault_core_varian_wajib v/g)||[]).length,1);
});test('v4 MLBB route opens the Apple catalog and account details use the public product DTO', () => {
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

test('external account product approval does not require publisher terms or authorization references', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const base = {
    rightsBasis:'AUTHORIZED_VENDOR',
    publisherPlatform:'Example Publisher',
    chainOfTitle:'Vendor source and seller authority are recorded by the store owner.',
    transferMethod:'Manual account handover to the customer after confirmed payment.',
    region:'Indonesia',
    validUntil:'2026-12-31',
    reviewStatus:'APPROVED',
    ownerAttested:true
  };
  const approvedWithoutPublisherDocuments = validateRightsReviewInput(base, now);
  assert.equal(approvedWithoutPublisherDocuments.ok, true);
  assert.equal(approvedWithoutPublisherDocuments.value.officialTermsUrl, null);
  assert.equal(approvedWithoutPublisherDocuments.value.authorizationEvidenceReference, null);

  const noPublisherLabel = validateRightsReviewInput({
    ...base,
    publisherPlatform:''
  }, now);
  assert.equal(noPublisherLabel.ok, true);
  assert.equal(noPublisherLabel.value.publisherPlatform, null);
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

test('account activation has no publisher terms or publisher evidence gate', () => {
  const rights = readFileSync(new URL('../backend/services/rightsReviewService.js', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../backend/routes/admin.js', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../database/migrations/029_remove_publisher_sales_gate.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(rights, /AUTHORIZATION_EVIDENCE_REFERENCE_REQUIRED|OFFICIAL_TERMS_URL_REQUIRED/);
  assert.doesNotMatch(admin, /AUTHORIZATION_EVIDENCE_REFERENCE_REQUIRED|OFFICIAL_TERMS_URL_REQUIRED/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS product_rights_review_evidence_required/);
  assert.doesNotMatch(migration, /PRODUCT_RIGHTS_AUTHORIZATION_REFERENCE_REQUIRED|PRODUCT_OFFICIAL_TERMS_URL_REQUIRED/);
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
  assert.match(navigation, /label: 'Store'.*href: '\/catalog'/);
  assert.match(navigation, /label: 'My Orders'.*href: '\/catalog#transactions'/);
  assert.match(navigation, /label: 'Profile'.*href: '\/account'/);
  assert.match(catalog, /window\.location\.hash === '#transactions'/);
  assert.match(catalog, /vault-core-web-cart/);
});

test('store footer avoids unverified safety, warranty and founding-year claims', () => {
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  assert.match(navigation, /Info Produk/);
  assert.match(navigation, /Status Pesanan/);
  assert.match(navigation, /Bantuan Telegram/);
  assert.match(navigation, /Single Vendor/);
  assert.doesNotMatch(navigation, /Anti-Hackback|Akun Dicek Manual|Garansi Refund|Terverifikasi|Sejak 2024|EST 2024/);
});

test('customer catalog exposes buyer specs and hides internal product, price, delivery and Owner metadata', () => {
  const attributes = {
    Rank:'Mythic',
    Server:'Asia',
    kode_produk:'FF-001',
    subkategori:'Akun Evo Gun',
    metode_penyerahan:'Handover Google / FB Account',
    price_note:'Internal conversion note',
    price_min_idr:560000,
    price_max_idr:560000,
    price_currency:'IDR',
    cost_price_note:'Owner cost note',
    cost_price_status:'OWNER_SET_ZERO',
    cost_price_xtr:0,
    fulfillment_mode:'OWNER_MANUAL',
    owner_attestation_ref:'VC-OWNER-ATTESTATION-20261123-01',
    authorization_evidence_status:'OWNER_HELD_NOT_UPLOADED',
    authorization_evidence_reference:'INTERNAL-REF',
    xtr_conversion_note:'Reference pricing only',
    xtr_conversion_source:'Internal source',
    xtr_conversion_formula:'CEILING(IDR / 375)',
    xtr_conversion_source_url:'https://example.invalid/internal',
    xtr_conversion_rate_idr_per_star:375
  };
  assert.deepEqual(getCustomerVisibleProductAttributes(attributes),[['Rank','Mythic'],['Server','Asia']]);
  assert.deepEqual(sanitizeCustomerProductAttributes(attributes),{Rank:'Mythic',Server:'Asia'});
});

test('public catalog DTO is an allowlist and never exposes SKU, cost, handover internals or stock counts', () => {
  const product = toPublicCatalogProduct({
    id:42,sku:'FF-001',name:'Akun Evo Gun',description:'Deskripsi pembeli',
    sale_price_xtr:1494,image_url:'/assets/example.webp',image_gallery:['/assets/example.webp'],
    attributes:{Rank:'Mythic',kode_produk:'FF-001',price_note:'internal'},
    customer_terms:'Ketentuan pembeli',fulfillment_eta:'Maksimal 1 jam',
    availability_mode:'READY',indent_deadline_days:null,
    customer_input_fields:[{label:'Player ID'}],fulfillment_type:'GAME_ACCOUNT_TRANSFER',
    actual_stock:1,display_stock_mode:'SHOW_COUNT',display_stock_override:1,
    cost_price_xtr:0,stock_source_reference:'internal',owner_attestation_ref:'INTERNAL',
    marketplace_category_slug:'free-fire-akun'
  });
  assert.deepEqual(Object.keys(product),[
    'id','name','description','tier','sale_price_xtr','image_url','image_gallery','attributes',
    'customer_terms','fulfillment_eta','availability_mode','indent_deadline_days','customer_input_fields',
    'display_stock','is_purchaseable','is_available'
  ]);
  assert.equal(product.tier,'SERVICE');
  assert.deepEqual(product.customer_input_fields,[{label:'Player ID',type:'text',required:false,maxLength:240}]);
  assert.equal(product.display_stock,1);
  assert.equal(product.is_available,true);
  assert.equal(product.is_purchaseable,true);
  assert.equal(JSON.stringify(product).includes('FF-001'),false);
  assert.equal(JSON.stringify(product).includes('internal'),false);
  const legacy = toLegacyCatalogResponse([{variant_id:4,game_code:'FF',name:'Akun Evo Gun',category:'Akun',skus:[product]}]);
  assert.equal(JSON.stringify(legacy).includes('fulfillment_type'),false);
  assert.equal(JSON.stringify(legacy).includes('FF-001'),false);
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
  assert.deepEqual(normalizeCartItems({items:[{productId:9,quantity:1,customerInput:{'Player ID':'123'}}]}).value.items[0].customerInput,{'Player ID':'123'});
  assert.equal(normalizeCartItems({items:[{productId:9,quantity:1,customerInput:{password:'secret'}}]}).ok,false);
  assert.equal(normalizeCartItems({items:[{productId:9,quantity:1,customerInput:{'Player ID':'123'}},{productId:9,quantity:1,customerInput:{'Player ID':'456'}}]}).ok,false);
  assert.equal(normalizeCartItems({items:Array.from({length:11},(_,i)=>({productId:i+1,quantity:1}))}).ok,false);
  assert.equal(normalizeCartItems({items:[{productId:2,quantity:2},{productId:3,quantity:2}]},{testMode:true}).ok,false);
});


test('web catalog cart preserves safe Joki customer inputs across reloads', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  assert.ok(page.includes('entry?.customerInput'));
  assert.ok(page.includes('product?.customer_input_fields'));
  assert.ok(page.includes('allowedLabels.has(label)'));
  assert.ok(page.includes('value.slice(0,240)'));
  assert.ok(page.includes('setCustomerInputs(Object.fromEntries(restored.map'));
  assert.ok(page.includes('JSON.stringify(cart.map(({productId,quantity,customerInput})'));
  assert.ok(page.includes('customerInput:customerInput || {}'));
  assert.equal((page.match(/updateCustomerInput\(selected\.product\.id,field\.label,event\.target\.value\)/g) || []).length, 2);
});

test('Owner SKU lifecycle saves one safe form and publishes eligible stock without a separate publish step', () => {
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  assert.match(ownerRoute, /router\.post\('\/products'/);
  assert.match(ownerRoute, /OWNER_PRODUCT_SINGLE_FORM_SAVED/);
  assert.doesNotMatch(ownerRoute, /validateRightsReviewInput|isRightsReviewUsable/);
  assert.match(ownerRoute, /AUTHENTICATION_DATA_PROHIBITED/);
  assert.match(ownerRoute, /USE_SINGLE_PRODUCT_FORM/);
  assert.doesNotMatch(ownerRoute, /vault_core_secret_payloads|encryptSecretPayload|readJokiCustomerAccess/);
  assert.match(ownerPage, /Simpan Produk/);
  assert.match(ownerPage, /Form Akun Game/);
  assert.match(ownerPage, /Form Jasa Joki/);
  assert.match(ownerPage, /READY/);
  assert.match(ownerPage, /INDENT/);
  assert.match(ownerPage, /Player\/User ID/);
  assert.match(ownerPage, /Gold · Best Value/);
  assert.match(ownerRoute, /tier=\$2/);
  assert.match(ownerPage, /Permintaan Pelanggan/);
  assert.match(catalog, /availability_mode/);
  assert.match(catalog, /customer_input_fields/);
});test('web storefront and Owner routes retain global chrome while Mini App keeps its separate mobile shell', () => {
  const home = readFileSync(new URL('../frontend/src/app/page.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const owner = readFileSync(new URL('../frontend/src/app/admin/page.jsx', import.meta.url), 'utf8');
  const ownerV4 = readFileSync(new URL('../frontend/src/app/admin/v4/page.jsx', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../frontend/src/app/layout.jsx', import.meta.url), 'utf8');
  const catalogStyles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(home.includes("VaultCoreHomePage"));
  assert.ok(home.includes("return <VaultCoreHomePage />"));
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
  assert.ok(page.includes('STOK TERAKHIR'));
  assert.ok(page.includes('loadCatalog'));
  assert.ok(styles.includes('overflow-wrap:anywhere'));
  assert.ok(styles.includes('vc4-details'));
});

test('v4 product detail keeps the approved dark Vault Core catalog palette', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(page.includes('vc4-nav'));
  assert.ok(page.includes('vc4-product-tile-art'));
  assert.ok(page.includes('vc4-product-grid'));
  assert.ok(page.includes('vc4-product-gold'));
  assert.ok(page.includes('vc4-dialog'));
  assert.ok(page.includes('vc4-product-terms'));
  assert.ok(page.includes('vc4-security-guide'));
  assert.match(styles, /--vc4-page:#090d14/);
  assert.match(styles, /--vc4-card:#111925/);
  assert.match(styles, /--vc4-gold:#ffc928/);
  assert.ok(styles.includes('.vc4-product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'));
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
  assert.ok(catalogApi.includes('sanitizeCustomerProductAttributes(sku?.attributes)'));
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
  assert.match(ownerV4, /Simpan Produk/);
  assert.match(ownerRoutes, /field_key/);
  assert.match(ownerRoutes, /validateListingFields/);
  assert.match(ownerRoutes, /imageGallery/);
  assert.match(ownerRoutes, /vault_core_pertanyaan_wajib_only/);
});

test('Apple v4 mobile product detail preserves SKU price, attributes, terms and secure purchase action', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(page.includes('vc4-detail-buybar'));
  assert.ok(page.includes('<PriceDisplay product={selected.product}/>'));
  assert.ok(page.includes('vc4-details'));
  assert.ok(page.includes('vc4-product-terms'));
  assert.ok(page.includes('vc4-security-guide'));
  assert.ok(page.includes('Tambah ke keranjang'));
  assert.ok(page.includes('Bayar dengan Telegram Stars'));
  assert.ok(styles.includes('@media(max-width:760px)'));
  assert.ok(styles.includes('grid-template-columns:1fr'));
  assert.ok(styles.includes('.vc4-detail-buybar{position:sticky'));
});

test('v4 customer catalog footer follows XTR, account-security and Telegram payment rules', () => {
  const page = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/src/app/catalog/page.css', import.meta.url), 'utf8');
  assert.ok(page.includes('Telegram Mini App'));
  assert.ok(page.includes('Telegram Stars (XTR)'));
  assert.ok(page.includes('Status pembayaran hanya ditetapkan setelah konfirmasi webhook Telegram'));
  assert.ok(page.includes('Data Joki hanya berupa identitas game dan parameter pengerjaan'));
  assert.equal(page.includes('vault terenkripsi'),false);
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
  assert.ok(page.includes("VaultCoreHomePage"));
  assert.ok(page.includes("return <VaultCoreHomePage />"));
  assert.ok(html.includes('<nav class="nav" id="nav"'));
  assert.ok(page.includes("VaultCoreHomePage"));
  assert.ok(page.includes("return <VaultCoreHomePage />"));
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
  assert.match(mini,/const body = \{items:\[\{productId:Number\(product\.id\),quantity:1,customerInput\}\]\};/);
  assert.ok(react.includes("items:cart.map(({productId,quantity,customerInput})=>({productId,quantity,customerInput:customerInput||{}}))"));
  assert.ok(mini.includes('tg.openInvoice'));
  assert.ok(react.includes('openInvoice(data.invoiceUrl,data.orderNumber)'));
  assert.doesNotMatch(mini,/customer-access/);
  assert.doesNotMatch(react,/customer-access/);
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

test('Mini App Home uses live account recommendations and a truthful 2x2 Joki category grid', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/public/vault-core-premium.css', import.meta.url), 'utf8');
  assert.ok(app.includes("available.filter((product) => product.variant_category === 'Akun').slice(0,2)"));
  assert.ok(app.includes('id="catalog-products"') === false || app.includes('function paintCatalogProducts()'));
  assert.ok(app.includes("class=\"home-featured-grid\""));
  assert.ok(app.includes("GAME_CODES.map((code) => services.find((variant) => variant.game_code === code)).filter(Boolean)"));
  assert.ok(app.includes("class=\"home-joki-grid\""));
  assert.ok(app.includes("'Belum tersedia'"));
  assert.ok(app.includes("data-store-group=\"Jasa Joki\""));
  assert.ok(app.includes("data-go=\"/orders\" aria-label=\"Status pesanan\""));
  assert.ok(!app.includes("★ ' + fmt(product.sale_price_xtr)"));
  assert.ok(styles.includes('.home-featured-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(styles.includes('.home-joki-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
});

test('Mini App Store presents purchasable backend products in a responsive two-column grid', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/public/vault-core-premium.css', import.meta.url), 'utf8');
  assert.match(app, /function paintCatalogProducts\(\)/);
  assert.ok(app.includes('state.products.filter((product) => {'));
  assert.ok(app.includes('id="catalog-products" class="store-product-grid"'));
  assert.ok(app.includes("paintCatalogProducts();"));
  assert.ok(app.includes("data-filter-game=") && app.includes("data-filter-group="));
  assert.ok(app.includes("product-availability-dot"));
  assert.ok(styles.includes('.store-product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(styles.includes('.product-availability-dot.is-ready'));
  assert.ok(styles.includes('.product-availability-dot.is-indent'));
  assert.ok(styles.includes('.tier-gold-label{position:absolute;z-index:3;top:7px;left:7px;right:auto;'));
  assert.ok(styles.includes('.store-product-grid .price{margin-top:1px;color:var(--vc-green)!important'));
});

test('Mini App exposes all backend product groups and game routes with a retryable catalog load', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/public/vault-core-premium.css', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../frontend/public/miniapp/sw.js', import.meta.url), 'utf8');
  assert.ok(app.includes("const groupOptions = [['Akun','Akun'],['Jasa Joki','Joki'],['Item In-Game','Item'],['Produk Lainnya','Lainnya']];"));
  assert.ok(app.includes("const groupTabs = [['ALL','Semua'],...groupOptions.filter(([code]) => state.products.some((product) => product.variant_category === code))];"));
  assert.ok(app.includes("['Akun','Jasa Joki','Item In-Game','Produk Lainnya'].includes(variant.category)"));
  assert.ok(app.includes('data-action="retry-catalog"'));
  assert.ok(app.includes("if (action === 'retry-catalog') { loadCatalog(true); return; }"));
  assert.ok(app.includes("async function loadCatalog(showLoading = false)"));
  assert.ok(styles.includes('.store-group-tabs{display:flex;gap:5px;overflow-x:auto;'));
  assert.ok(styles.includes('.store-group-tabs button{flex:1 0 auto;min-width:66px;'));
  assert.ok(sw.includes("vault-core-miniapp-v16"));
});

test('Mini App product detail provides working Share, persistent Favorite and two backend-related products', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/public/vault-core-premium.css', import.meta.url), 'utf8');
  assert.match(app, /function productDetailHeader\(product\)/);
  assert.ok(app.includes('data-action="share"'));
  assert.ok(app.includes('data-action="favorite"'));
  assert.ok(app.includes("localStorage.getItem('vaultcore.favoriteProducts')"));
  assert.ok(app.includes("localStorage.setItem('vaultcore.favoriteProducts'"));
  assert.ok(app.includes("tg.openTelegramLink('https://t.me/share/url?url='"));
  assert.ok(app.includes('function relatedProducts(product)'));
  assert.ok(app.includes("related.map(productCard).join('')"));
  assert.ok(app.includes('relatedProducts(product) +'));
  assert.ok(styles.includes('.product-detail-header{'));
  assert.ok(styles.includes('.detail-header-action.is-favorite'));
  assert.ok(styles.includes('.related-product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
});

test('Mini App product gallery uses approved backend image URLs and selectable thumbnails', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../frontend/public/vault-core-premium.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  assert.match(app, /function productGalleryImages\(product\)/);
  assert.ok(app.includes('product.image_gallery'));
  assert.ok(app.includes('data-detail-gallery-main'));
  assert.ok(app.includes('data-detail-gallery-index'));
  assert.ok(app.includes('mainImage.src = imageUrl'));
  assert.ok(app.includes('productDetailHeader(product) +'));
  assert.ok(app.includes('productGallery(product) +'));
  assert.ok(source.includes("image_gallery:Array.isArray(sku?.image_gallery) ? sku.image_gallery : []"));
  assert.ok(styles.includes('.detail-gallery-thumbs{display:flex;gap:7px;overflow-x:auto'));
  assert.ok(styles.includes('.detail-gallery-thumb.is-active{border-color:var(--vc-green)'));
});

test('Mini App header and bottom navigation do not stack over the product detail CTA', () => {
  const html = readFileSync(new URL('../frontend/public/miniapp/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  assert.equal((html.match(/<nav\b/g) || []).length,1);
  assert.ok(html.includes('id="nav" aria-label="Navigasi utama" hidden'));
  assert.ok(app.includes("nav.hidden = Boolean(hideNav)"));
  assert.ok(app.includes('function productDetailHeader(product)'));
  assert.ok(app.includes('productDetailHeader(product) +'));
  assert.ok(app.includes("'catalog', false"));
  assert.ok(css.includes('.nav[hidden]{display:none!important}'));
  assert.ok(css.includes('width:min(calc(100% - 24px),430px)'));
  assert.ok(css.includes('border-radius:26px'));
  assert.ok(css.includes('.nav .ic{box-sizing:border-box;display:block;width:36px;height:36px'));
  assert.ok(css.includes('linear-gradient(100deg,rgba(92,246,133,.9),rgba(163,245,43,.74) 52%,rgba(92,246,133,.68)'));
  assert.equal((app.match(/function headerHome\(/g) || []).length,1);
  assert.equal((app.match(/function headerPage\(/g) || []).length,1);
  assert.ok(css.includes('.topbar{position:sticky'));
  assert.ok(css.includes('.pagebar{position:sticky'));
});

test('Mini App Buy opens the backend-priced Telegram Stars invoice directly', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const orders = readFileSync(new URL('../backend/controllers/orderController.js', import.meta.url), 'utf8');
  const telegram = readFileSync(new URL('../backend/services/telegramApi.js', import.meta.url), 'utf8');
  const payment = readFileSync(new URL('../backend/controllers/paymentController.js', import.meta.url), 'utf8');
  assert.ok(app.includes("if (action === 'buy') { startCheckout(button.getAttribute('data-id')); return; }"));
  assert.ok(app.includes('return beginCheckout(id);'));
  assert.ok(app.includes('await createOrder(product.id);'));
  assert.ok(app.includes("api('/api/orders',{method:'POST',body})"));
  assert.ok(app.includes('lastInvoice = {number:result.orderNumber,url:result.invoiceUrl};'));
  assert.ok(app.includes('openInvoice();'));
  assert.equal(app.includes('function renderCheckout('),false);
  assert.equal(app.includes("action === 'checkout-next'"),false);
  assert.equal(app.includes("action === 'pay'"),false);
  assert.ok(orders.includes('Number(product.sale_price_xtr)*item.quantity'));
  assert.ok(orders.includes('amount:Number(order.total_xtr)'));
  assert.ok(telegram.includes("currency: 'XTR'"));
  assert.ok(telegram.includes('prices: [{ label: title.slice(0, 32), amount }]'));
  assert.ok(payment.includes('Number(order.total_xtr) === Number(query.total_amount)'));
});

test('product detail converts escaped backend newlines into readable sections and avoids duplicate generic terms', () => {
  const app = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../frontend/public/miniapp/sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes('vault-core-miniapp-v16'));
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
  assert.ok(sw.includes("const CACHE_NAME = 'vault-core-miniapp-v16'"));
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

test('Owner controls each SKU with Tersedia, Inden days, and Tidak tersedia states', () => {
  const adminRoute = readFileSync(new URL('../backend/routes/admin.js', import.meta.url), 'utf8');
  const ownerPage = readFileSync(new URL('../frontend/src/app/admin/page.jsx', import.meta.url), 'utf8');
  const orderRoute = readFileSync(new URL('../backend/controllers/orderController.js', import.meta.url), 'utf8');
  assert.match(adminRoute, /router\.patch\('\/products\/:id\/availability'/);
  assert.match(adminRoute, /\['AVAILABLE','INDENT','UNAVAILABLE'\]/);
  assert.match(adminRoute, /indentDays<1\|\|indentDays>365/);
  assert.match(ownerPage, /Tersedia/);
  assert.match(ownerPage, /Inden/);
  assert.match(ownerPage, /Tidak tersedia/);
  assert.match(ownerPage, /admin-availability-buttons/);
  assert.match(orderRoute, /product\.availability_mode === 'INDENT'/);
});

test('publisher and rights-review metadata cannot block commercial listing or fulfillment', () => {
  const migration = readFileSync(new URL('../database/migrations/030_product_availability_and_account_sales.sql', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../backend/routes/admin.js', import.meta.url), 'utf8');
  const orders = readFileSync(new URL('../backend/controllers/orderController.js', import.meta.url), 'utf8');
  const payments = readFileSync(new URL('../backend/controllers/paymentController.js', import.meta.url), 'utf8');
  const delivery = readFileSync(new URL('../backend/services/deliveryService.js', import.meta.url), 'utf8');
  assert.match(migration, /DROP TRIGGER IF EXISTS trg_products_rights_activation/);
  assert.match(migration, /DROP TRIGGER IF EXISTS trg_inventory_rights_source/);
  assert.doesNotMatch(catalog, /JOIN product_rights_reviews/);
  assert.doesNotMatch(admin, /PRODUCT_RIGHTS_REVIEW_REQUIRED|ACCOUNT_PRODUCT_ONLY|isRightsReviewUsable|canAddProductInventory/);
  assert.doesNotMatch(orders, /isRightsReviewUsable|JOIN product_rights_reviews/);
  assert.doesNotMatch(payments, /product_rights_reviews/);
  assert.doesNotMatch(delivery, /product_rights_reviews|rights_review_id=p\.current_rights_review_id/);
});

test('account catalog and checkout use manual Owner handover without storing account credentials', () => {
  const catalog = readFileSync(new URL('../backend/services/publicCatalogService.js', import.meta.url), 'utf8');
  const orders = readFileSync(new URL('../backend/controllers/orderController.js', import.meta.url), 'utf8');
  const payment = readFileSync(new URL('../backend/controllers/paymentController.js', import.meta.url), 'utf8');
  const delivery = readFileSync(new URL('../backend/services/deliveryService.js', import.meta.url), 'utf8');
  assert.doesNotMatch(catalog, /vault_core_secret_payloads/);
  assert.doesNotMatch(orders, /secureVaultOnly|vault_core_secret_payloads/);
  assert.match(orders, /availability_mode_snapshot/);
  assert.match(orders, /indent_deadline_days_snapshot/);
  assert.match(orders, /customer_input_snapshot/);
  assert.match(orders, /is_account_snapshot/);
  assert.match(orders, /customerInputSnapshot/);
  assert.match(payment, /fulfillment_deadline_at=CASE/);
  assert.match(payment, /SELECT paid_at FROM orders WHERE id=\$1/);
  assert.match(payment, /indent_deadline_days_snapshot\*INTERVAL '1 day'/);
  assert.match(payment, /INTERVAL '1 hour'/);
  assert.match(orders, /FOR UPDATE SKIP LOCKED/);
  assert.match(delivery, /fulfillment_type === 'GAME_ACCOUNT_TRANSFER'/);
  assert.match(delivery, /OWNER_MANUAL_FULFILLMENT_REQUIRED/);
});test('legacy SKU mapping remains category-bound and preserves its availability', () => {
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  assert.match(ownerRoute, /router\.put\('\/products\/:[^']+\/variant'/);
  for (const slug of ['mlbb-akun','free-fire-akun','roblox-akun','genshin-akun','roblox-blox-fruits','roblox-adopt-me','roblox-murder-mystery-2']) assert.ok(ownerRoute.includes("'" + slug + "'"));
  assert.match(ownerRoute, /LEGACY_CATEGORY_HAS_NO_V4_VARIANT/);
  assert.match(ownerRoute, /VARIANT_MAPPING_DOES_NOT_MATCH_LEGACY_PRODUCT/);
  assert.match(ownerRoute, /PRODUCT_VARIANT_ALREADY_ASSIGNED/);
  assert.doesNotMatch(ownerRoute, /status=CASE WHEN status='ACTIVE' THEN 'PAUSED' ELSE status END/);
  assert.match(ownerRoute, /V4_LEGACY_PRODUCT_VARIANT_MAPPED/);
  assert.match(ownerRoute, /COALESCE\([\s\S]*p\.stock_source_reference[\s\S]*i\.source_reference/);
});test('legacy multi-step question, inventory and publish endpoints are disabled', () => {
  const ownerRoute = readFileSync(new URL('../backend/routes/ownerV4.js', import.meta.url), 'utf8');
  assert.match(ownerRoute, /router\.get\('\/products\/:[^']+\/questions'.*USE_SINGLE_PRODUCT_FORM/);
  assert.match(ownerRoute, /router\.put\('\/products\/:[^']+\/questions'.*USE_SINGLE_PRODUCT_FORM/);
  assert.match(ownerRoute, /router\.post\('\/products\/:[^']+\/inventory'.*USE_SINGLE_PRODUCT_FORM/);
  assert.match(ownerRoute, /router\.post\('\/products\/:[^']+\/publish'.*USE_SINGLE_PRODUCT_FORM/);
  assert.doesNotMatch(ownerRoute, /encryptSecretPayload|vault_core_secret_payloads|readJokiCustomerAccess/);
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
  assert.ok(miniAppStyles.includes('--green:#a8f06a'));
  assert.ok(miniAppStyles.includes('--gold:#f2c45a'));
  assert.ok(miniAppStyles.includes('.cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;padding:12px 14px;border:1px solid rgba(211,255,122,.82)'));
  assert.ok(miniAppStyles.includes('.nav button.on{background:rgba(163,245,43,.12);color:var(--green)'));
  assert.ok(miniAppStyles.includes('.nav button.on .ic{background:linear-gradient(180deg,#d8ff8b,#a3e635)'));
  assert.ok(miniAppStyles.includes('.detail-price{margin:10px 0 13px;color:var(--green)'));
  assert.ok(miniAppStyles.includes('.filters button.on{border-color:rgba(163,245,43,.7);background:rgba(163,245,43,.13);color:var(--green)'));
});


test('clean /miniapp route and Telegram bot still open the canonical static Mini App entry', () => {
  const entry = readFileSync(new URL('../frontend/src/app/miniapp/page.jsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../frontend/src/app/page.jsx', import.meta.url), 'utf8');
  const webhook = readFileSync(new URL('../backend/routes/telegramWebhook.js', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../wrangler.api.jsonc', import.meta.url), 'utf8');
  assert.ok(entry.includes("redirect('/miniapp/index.html')"));
  assert.ok(home.includes("VaultCoreHomePage"));
  assert.ok(home.includes("return <VaultCoreHomePage />"));
  assert.ok(webhook.includes("https://vaultcore.biz.id/miniapp/index.html"));
  assert.ok(config.includes('"TELEGRAM_MINI_APP_URL": "https://vaultcore.biz.id/miniapp/index.html"'));
});

test('shared storefront chrome hides the global footer on Owner and customer account pages', () => {
  const styles = readFileSync(new URL('../frontend/src/app/globals.css', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../frontend/src/components/store-navigation.jsx', import.meta.url), 'utf8');
  for (const selector of ['.dashboard-topbar{','.dashboard-brand{','.dashboard-header-label{','.dashboard-header-actions{','.dashboard-search{']) {
    assert.ok(styles.includes(selector), 'Missing shared header style: ' + selector);
  }
  assert.ok(styles.includes('@media(max-width:380px){'));
  assert.ok(navigation.includes("const isOwnerPage = pathname.startsWith('/admin');"));
  assert.ok(navigation.includes("const isAccountPage = pathname === '/account' || pathname.startsWith('/account/');"));
  assert.ok(navigation.includes("{!isOwnerPage && !isAccountPage && <StoreFooter/>}"));
  assert.ok(navigation.includes('<StoreBottomNav active={active}/>'));
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

test('Joki order form accepts safe product-specific identity fields without requesting credentials', () => {
  const mini = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const web = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const controller = readFileSync(new URL('../backend/controllers/secretController.js', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../backend/routes/orders.js', import.meta.url), 'utf8');
  const order = readFileSync(new URL('../backend/controllers/orderController.js', import.meta.url), 'utf8');
  assert.ok(mini.includes('data-customer-input="1"'));
  assert.ok(mini.includes('customer_input_fields'));
  assert.ok(mini.includes('customerInput'));
  assert.doesNotMatch(mini,/type="password"|joki-password|joki-login|submit-joki-access|customer-access/);
  assert.ok(web.includes('vc4-customer-inputs'));
  assert.ok(web.includes('customer_input_fields'));
  assert.ok(web.includes('customerInput:customerInput||{}'));
  assert.doesNotMatch(web,/type="password"|accessForm\\.password|customer-access/);
  assert.ok(order.includes('customer_input_snapshot'));
  assert.ok(controller.includes('JOKI_CUSTOMER_INPUT_NOT_AVAILABLE'));
  assert.doesNotMatch(controller,/encryptSecretPayload/);
  assert.ok(routes.includes("router.post('/:orderNumber/customer-access', submitJokiCustomerAccess)"));
});


test('Home product cards preserve the selected SKU and display its actual listing availability', () => {
  const home = readFileSync(new URL('../frontend/src/app/VaultCoreHomePage.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  assert.match(home, /function getHomeProductAvailability\(product\)/);
  assert.match(home, /available > 0 \? ' is-ready' : ''/);
  assert.doesNotMatch(home, /\bready\s*\?/);
  assert.match(home, /availability\.startsWith\('Inden'\)/);
  assert.match(home, /&product=' \+ encodeURIComponent\(product\.id\)/);
  assert.match(home, /getHomeProductAvailability\(product\)/);
  assert.match(catalog, /params\.get\('product'\)/);
  assert.match(catalog, /setSelected\(\{variant_id:Number\(product\.variant_id\),product\}\)/);
});


test('Legacy Joki credential endpoint remains closed while safe customer fields are enabled', async () => {
  let statusCode = 0;
  let body = null;
  const response = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; }
  };
  await submitJokiCustomerAccess({body:{login:'example',password:'not-a-real-password'}},response);
  assert.equal(statusCode,410);
  assert.equal(body?.error,'JOKI_CUSTOMER_INPUT_NOT_AVAILABLE');

  const web = readFileSync(new URL('../frontend/src/app/catalog/VaultCoreV4Page.jsx', import.meta.url), 'utf8');
  const mini = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(web, /accessForm\.password|type="password".*Kata sandi|customer-access/);
  assert.doesNotMatch(mini, /joki-password|joki-login|submit-joki-access|customer-access/);
  assert.match(web, /customer_input_fields/);
  assert.match(mini, /customer_input_fields/);
  assert.match(web, /vc4-customer-inputs/);
  assert.match(mini, /data-customer-input/);
});


test('website and Mini App share a green four-game promo board', () => {
  const webHome = readFileSync(new URL('../frontend/src/app/VaultCoreHomePage.jsx', import.meta.url), 'utf8');
  const mini = readFileSync(new URL('../frontend/public/miniapp/app.js', import.meta.url), 'utf8');
  const premium = readFileSync(new URL('../frontend/public/vault-core-premium.css', import.meta.url), 'utf8');
  const miniCss = readFileSync(new URL('../frontend/public/miniapp/app.css', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../frontend/public/miniapp/sw.js', import.meta.url), 'utf8');
  assert.ok(webHome.includes('vc-home-promo-visual'));
  assert.ok(webHome.includes('PAPAN PROMO'));
  assert.ok(mini.includes('home-promo-board-grid'));
  assert.ok(mini.includes('promoBoardArt'));
  assert.ok(premium.includes('--vc-green:#a8f06a'));
  assert.ok(premium.includes('.home-promo.promo-board{'));
  assert.ok(miniCss.includes('--green:#a8f06a'));
  assert.ok(sw.includes("'/vault-core-premium.css'"));
  assert.doesNotMatch(webHome + mini, /Diskon hingga|Diskon 50%|harga coret/);
});

test('Golden Dark storefront theme keeps the animated loop visible in the hero', () => {
  const home = readFileSync(new URL('../frontend/src/app/VaultCoreHomePage.jsx', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../frontend/public/golden-theme.css', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../frontend/src/app/layout.jsx', import.meta.url), 'utf8');
  assert.match(home, /className="vc-home-promo-visual"/);
  assert.ok(home.includes('srcSet="/assets/02-hero/hero-vaultcore-loop.webp"'));
  assert.ok(home.includes('src="/assets/02-hero/hero-vaultcore.jpg"'));
  assert.ok(home.includes('prefers-reduced-motion: no-preference'));
  assert.doesNotMatch(home, /vc-home-promo-board/);
  assert.match(theme, /--vc-bg:\s*#100e08/i);
  assert.match(theme, /--vc-green:\s*#b7ff35/i);
  assert.match(theme, /--vc-gold:\s*#f5c542/i);
  assert.match(theme, /@keyframes vc-core-orbit/);
  assert.ok(layout.includes('href="/golden-theme.css"'));
});
