import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { pool } from '../db/pool.js';
import { requireTelegramUser } from '../middleware/telegramAuth.js';
import { createCustomerSession, customerCookieHeader } from '../middleware/customerSession.js';
import { ownerRateLimit } from '../middleware/rateLimit.js';
import { createTelegramOidcTransaction, validateTelegramOidcIdToken } from '../utils/telegramOidc.js';

const router = Router();
const REDIRECT_URI = process.env.TELEGRAM_CUSTOMER_OIDC_REDIRECT_URI || 'https://api.vaultcore.biz.id/api/customer-auth/oidc/callback';
const FRONTEND_ACCOUNT_URL = 'https://vaultcore.biz.id/account';
const OIDC_COOKIE_NAMES = ['vault_customer_oidc_state', 'vault_customer_oidc_nonce', 'vault_customer_oidc_verifier'];

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function oidcCookie(name, value, maxAge = 600) {
  const parts = [name + '=' + encodeURIComponent(value), 'Path=/api/customer-auth', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAge];
  if (process.env.NODE_ENV === 'production') parts.push('Secure', 'Domain=.vaultcore.biz.id');
  return parts.join('; ');
}

function clearOidcCookies() {
  return OIDC_COOKIE_NAMES.map((name) => oidcCookie(name, '', 0));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''));
  const b = Buffer.from(String(right ?? ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function finishWithError(res, error) {
  console.error('[customer-oidc]', error?.message ?? 'CUSTOMER_LOGIN_FAILED');
  res.setHeader('Set-Cookie', clearOidcCookies());
  return res.redirect(302, FRONTEND_ACCOUNT_URL + '?login_error=telegram_login_failed');
}

async function syncCustomer(user) {
  const { rows } = await pool.query(
    `INSERT INTO customers (telegram_user_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_user_id) DO UPDATE
       SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
     RETURNING id, telegram_user_id, username, first_name`,
    [String(user.id), user.username ?? null, user.first_name ?? '']
  );
  if (!rows[0]) throw new Error('CUSTOMER_PROFILE_SYNC_FAILED');
  return rows[0];
}

router.get('/config', (_req, res) => {
  const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID;
  if (!clientId || !process.env.TELEGRAM_OIDC_CLIENT_SECRET) {
    return res.status(503).json({ error: 'TELEGRAM_OIDC_UNAVAILABLE' });
  }
  return res.json({ loginMode: 'oidc', clientId });
});

router.get('/session', requireTelegramUser, async (req, res) => {
  const customer = req.customer;
  return res.json({
    authenticated: true,
    user: {
      id: String(customer.telegram_user_id),
      username: customer.username ?? null,
      first_name: customer.first_name ?? '',
      isOwner: Boolean(await (async () => {
        const { rows } = await pool.query(
          'SELECT 1 FROM owner_accounts WHERE telegram_user_id=$1 AND is_active=TRUE LIMIT 1',
          [String(customer.telegram_user_id)]
        );
        return rows.length;
      })())
    }
  });
});

router.get('/oidc/start', ownerRateLimit, (_req, res) => {
  const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID;
  const clientSecret = process.env.TELEGRAM_OIDC_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(503).json({ error: 'TELEGRAM_OIDC_UNAVAILABLE' });
  const transaction = createTelegramOidcTransaction();
  const authorization = new URL('https://oauth.telegram.org/auth');
  authorization.searchParams.set('client_id', clientId);
  authorization.searchParams.set('redirect_uri', REDIRECT_URI);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('scope', 'openid profile');
  authorization.searchParams.set('state', transaction.state);
  authorization.searchParams.set('nonce', transaction.nonce);
  authorization.searchParams.set('code_challenge', transaction.challenge);
  authorization.searchParams.set('code_challenge_method', 'S256');
  res.setHeader('Set-Cookie', [
    oidcCookie(OIDC_COOKIE_NAMES[0], transaction.state),
    oidcCookie(OIDC_COOKIE_NAMES[1], transaction.nonce),
    oidcCookie(OIDC_COOKIE_NAMES[2], transaction.verifier)
  ]);
  return res.redirect(302, authorization.toString());
});

router.get('/oidc/callback', ownerRateLimit, async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const queryState = String(req.query.state ?? '');
    const cookieState = decodeURIComponent(cookies.vault_customer_oidc_state ?? '');
    const nonce = decodeURIComponent(cookies.vault_customer_oidc_nonce ?? '');
    const verifier = decodeURIComponent(cookies.vault_customer_oidc_verifier ?? '');
    if (!queryState || !cookieState || !safeEqual(queryState, cookieState) || !nonce || !verifier) {
      return finishWithError(res, new Error('TELEGRAM_OIDC_STATE_INVALID'));
    }
    if (req.query.error || typeof req.query.code !== 'string') {
      return finishWithError(res, new Error('TELEGRAM_OIDC_AUTHORIZATION_DENIED'));
    }
    const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID;
    const clientSecret = process.env.TELEGRAM_OIDC_CLIENT_SECRET;
    if (!clientId || !clientSecret) return finishWithError(res, new Error('TELEGRAM_OIDC_UNAVAILABLE'));

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier
    });
    const tokenResponse = await fetch('https://oauth.telegram.org/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body
    });
    const responseText = await tokenResponse.text();
    let tokenData = {};
    try {
      tokenData = responseText ? JSON.parse(responseText) : {};
    } catch {
      console.error('[customer-oidc-token-exchange]', JSON.stringify({
        status: tokenResponse.status,
        contentType: tokenResponse.headers.get('content-type') ?? '',
        responseFormat: 'non-json'
      }));
      return finishWithError(res, new Error('TELEGRAM_OIDC_TOKEN_RESPONSE_INVALID'));
    }
    if (!tokenResponse.ok || !tokenData || typeof tokenData !== 'object' || typeof tokenData.id_token !== 'string') {
      console.error('[customer-oidc-token-exchange]', JSON.stringify({
        status: tokenResponse.status,
        error: typeof tokenData.error === 'string' ? tokenData.error.slice(0, 80) : 'id_token_missing',
        responseFields: Object.keys(tokenData ?? {}).filter((key) => !/token|secret|code/i.test(key))
      }));
      return finishWithError(res, new Error('TELEGRAM_OIDC_TOKEN_EXCHANGE_FAILED'));
    }

    const user = await validateTelegramOidcIdToken(tokenData.id_token, { clientId, nonce });
    await syncCustomer(user);
    const session = createCustomerSession(user);
    res.setHeader('Set-Cookie', [customerCookieHeader(session), ...clearOidcCookies()]);
    return res.redirect(302, FRONTEND_ACCOUNT_URL + '?login=success');
  } catch (error) {
    return finishWithError(res, error);
  }
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', customerCookieHeader('', 0));
  return res.json({ authenticated: false });
});

export default router;
