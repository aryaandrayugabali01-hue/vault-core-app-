import crypto from 'node:crypto';
import { Router } from 'express';
import {
  createCustomerSession,
  customerSessionCookieHeader,
  syncTelegramCustomer
} from '../middleware/customerAuth.js';

const router = Router();
const FLOW_COOKIE = 'vault_telegram_oidc_flow';
const FLOW_TTL_SECONDS = 10 * 60;
const ISSUER = 'https://oauth.telegram.org';
const JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';
const TOKEN_URL = 'https://oauth.telegram.org/token';
const AUTH_URL = 'https://oauth.telegram.org/auth';

function requiredConfig() {
  const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID;
  const clientSecret = process.env.TELEGRAM_OIDC_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('TELEGRAM_OIDC_NOT_CONFIGURED');
  return { clientId, clientSecret };
}

function botSigningKey() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN_MISSING');
  return crypto.createHmac('sha256', token).update('vault-core-telegram-oidc-flow-v1').digest();
}

function sign(value) {
  return crypto.createHmac('sha256', botSigningKey()).update(value).digest('base64url');
}

function encodeSignedPayload(value) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return payload + '.' + sign(payload);
}

function decodeSignedPayload(value) {
  if (!value) return null;
  const [payload, signature] = String(value).split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload), 'base64url');
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!Number.isFinite(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
  return data;
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function cookie(name, value, maxAge, path) {
  const parts = [name + '=' + value, 'Path=' + path, 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAge];
  if (process.env.NODE_ENV === 'production') parts.push('Secure', 'Domain=.vaultcore.biz.id');
  return parts.join('; ');
}

function frontendOrigin() {
  return String(process.env.FRONTEND_ORIGIN || 'https://vaultcore.biz.id').split(',')[0].trim();
}

function safeReturnPath(value) {
  const path = typeof value === 'string' ? value : '/catalog';
  if (!path.startsWith('/') || path.startsWith('//') || /[\r\n]/.test(path)) return '/catalog';
  return path;
}

function addResultFlag(path, flag) {
  return path + (path.includes('?') ? '&' : '?') + 'telegram_login=' + flag;
}

function decodeJwtPart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function validateIdToken(idToken, clientId, expectedNonce) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('OIDC_ID_TOKEN_MALFORMED');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJwtPart(headerPart);
  const claims = decodeJwtPart(payloadPart);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('OIDC_SIGNING_ALGORITHM_UNSUPPORTED');
  }

  const response = await fetch(JWKS_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('OIDC_JWKS_UNAVAILABLE');
  const jwks = await response.json();
  const jwk = (jwks.keys || []).find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use !== 'enc');
  if (!jwk) throw new Error('OIDC_SIGNING_KEY_NOT_FOUND');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signedContent = Buffer.from(headerPart + '.' + payloadPart);
  const signature = Buffer.from(signaturePart, 'base64url');
  if (!crypto.verify('RSA-SHA256', signedContent, publicKey, signature)) {
    throw new Error('OIDC_ID_TOKEN_SIGNATURE_INVALID');
  }

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== ISSUER || !audiences.includes(clientId)
      || (claims.azp && claims.azp !== clientId)
      || !Number.isFinite(claims.exp) || claims.exp <= now
      || !Number.isFinite(claims.iat) || claims.iat > now + 60
      || (claims.nbf && claims.nbf > now)
      || claims.nonce !== expectedNonce) {
    throw new Error('OIDC_ID_TOKEN_CLAIMS_INVALID');
  }

  const id = String(claims.id ?? '');
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error('OIDC_TELEGRAM_USER_ID_MISSING');
  }
  return {
    id,
    username: typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined,
    first_name: typeof claims.given_name === 'string'
      ? claims.given_name
      : (typeof claims.name === 'string' ? claims.name : '')
  };
}

router.get('/start', (req, res) => {
  try {
    const { clientId } = requiredConfig();
    const state = crypto.randomBytes(32).toString('base64url');
    const nonce = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const returnTo = safeReturnPath(req.query.return_to);
    const flow = encodeSignedPayload({
      state, nonce, verifier, returnTo,
      exp: Math.floor(Date.now() / 1000) + FLOW_TTL_SECONDS
    });
    res.append('Set-Cookie', cookie(FLOW_COOKIE, flow, FLOW_TTL_SECONDS, '/api/auth/telegram'));
    const redirectUri = process.env.TELEGRAM_OIDC_REDIRECT_URI
      || 'https://api.vaultcore.biz.id/api/auth/telegram/callback';
    const authorization = new URL(AUTH_URL);
    authorization.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    }).toString();
    return res.redirect(302, authorization.toString());
  } catch (error) {
    if (error.message !== 'TELEGRAM_OIDC_NOT_CONFIGURED') console.error('[telegram-oidc-start]', error.message);
    return res.redirect(302, frontendOrigin() + addResultFlag('/catalog', 'unavailable'));
  }
});

router.get('/callback', async (req, res) => {
  const flowCookie = parseCookies(req.headers.cookie)[FLOW_COOKIE];
  const flow = decodeSignedPayload(flowCookie);
  const clearFlow = cookie(FLOW_COOKIE, '', 0, '/api/auth/telegram');
  const returnTo = safeReturnPath(flow?.returnTo || '/catalog');
  try {
    const { clientId, clientSecret } = requiredConfig();
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!flow || !code || !state || state !== flow.state) {
      throw new Error('OIDC_STATE_VALIDATION_FAILED');
    }
    const redirectUri = process.env.TELEGRAM_OIDC_REDIRECT_URI
      || 'https://api.vaultcore.biz.id/api/auth/telegram/callback';
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: flow.verifier
      })
    });
    const tokenBody = await response.json();
    if (!response.ok || !tokenBody.id_token) throw new Error('OIDC_TOKEN_EXCHANGE_FAILED');
    const user = await validateIdToken(tokenBody.id_token, clientId, flow.nonce);
    await syncTelegramCustomer(user);
    const session = createCustomerSession(user);
    res.append('Set-Cookie', clearFlow);
    res.append('Set-Cookie', customerSessionCookieHeader(session));
    return res.redirect(302, frontendOrigin() + addResultFlag(returnTo, 'success'));
  } catch (error) {
    console.warn('[telegram-oidc-callback]', error.message);
    res.append('Set-Cookie', clearFlow);
    return res.redirect(302, frontendOrigin() + addResultFlag(returnTo, 'failed'));
  }
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', customerSessionCookieHeader('', 0));
  return res.json({ authenticated: false });
});

export default router;
