import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { createOwnerSession, ownerCookieHeader } from '../middleware/ownerSession.js';
import { isOwnerTelegramUser } from '../middleware/adminAuth.js';
import { ownerRateLimit } from '../middleware/rateLimit.js';
import { createTelegramOidcTransaction, validateTelegramOidcIdToken } from '../utils/telegramOidc.js';

const router = Router();
const REDIRECT_URI = process.env.TELEGRAM_OIDC_REDIRECT_URI || 'https://api.vaultcore.biz.id/api/owner-auth/oidc/callback';
const FRONTEND_ADMIN_URL = 'https://vaultcore.biz.id/admin';
const OIDC_COOKIE_NAMES = ['vault_oidc_state', 'vault_oidc_nonce', 'vault_oidc_verifier'];

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function oidcCookie(name, value, maxAge = 600) {
  const parts = [name + '=' + encodeURIComponent(value), 'Path=/api/owner-auth', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAge];
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
  console.error('[owner-oidc]', error?.message ?? 'OIDC_LOGIN_FAILED');
  res.setHeader('Set-Cookie', clearOidcCookies());
  return res.redirect(302, FRONTEND_ADMIN_URL + '?owner_login_error=' + encodeURIComponent('telegram_login_failed'));
}

router.get('/config', (_req, res) => {
  const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: 'TELEGRAM_OIDC_UNAVAILABLE' });
  return res.json({ loginMode: 'oidc', clientId });
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
    oidcCookie('vault_oidc_state', transaction.state),
    oidcCookie('vault_oidc_nonce', transaction.nonce),
    oidcCookie('vault_oidc_verifier', transaction.verifier)
  ]);
  return res.redirect(302, authorization.toString());
});

router.get('/oidc/callback', ownerRateLimit, async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const queryState = String(req.query.state ?? '');
    const cookieState = decodeURIComponent(cookies.vault_oidc_state ?? '');
    const nonce = decodeURIComponent(cookies.vault_oidc_nonce ?? '');
    const verifier = decodeURIComponent(cookies.vault_oidc_verifier ?? '');
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
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.id_token !== 'string') {
      return finishWithError(res, new Error('TELEGRAM_OIDC_TOKEN_EXCHANGE_FAILED'));
    }
    const user = await validateTelegramOidcIdToken(tokenData.id_token, { clientId, nonce });
    if (!await isOwnerTelegramUser(user.id)) {
      res.setHeader('Set-Cookie', clearOidcCookies());
      return res.redirect(302, FRONTEND_ADMIN_URL + '?owner_login_error=owner_access_required');
    }
    const session = createOwnerSession(user);
    res.setHeader('Set-Cookie', [ownerCookieHeader(session), ...clearOidcCookies()]);
    return res.redirect(302, FRONTEND_ADMIN_URL + '?owner_login=success');
  } catch (error) {
    return finishWithError(res, error);
  }
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', ownerCookieHeader('', 0));
  return res.json({ authenticated: false });
});

export default router;
