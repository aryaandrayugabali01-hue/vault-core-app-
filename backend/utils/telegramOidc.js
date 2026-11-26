import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';

const ISSUER = 'https://oauth.telegram.org';
const JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';
let jwksCache = { expiresAt: 0, keys: [] };

export function createTelegramOidcTransaction() {
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { state, nonce, verifier, challenge };
}

function decodePart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function getSigningKey(kid, fetchImpl) {
  if (Date.now() >= jwksCache.expiresAt || !jwksCache.keys.length) {
    const response = await fetchImpl(JWKS_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('TELEGRAM_OIDC_KEYS_UNAVAILABLE');
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw new Error('TELEGRAM_OIDC_KEYS_INVALID');
    jwksCache = { keys: data.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  }
  const jwk = jwksCache.keys.find((key) => key.kid === kid && key.kty === 'RSA' && key.use === 'sig');
  if (!jwk) {
    jwksCache.expiresAt = 0;
    throw new Error('TELEGRAM_OIDC_SIGNING_KEY_NOT_FOUND');
  }
  return createPublicKey({ key: jwk, format: 'jwk' });
}

export async function validateTelegramOidcIdToken(idToken, { clientId, nonce, fetchImpl = fetch, now = Math.floor(Date.now() / 1000) }) {
  if (typeof idToken !== 'string' || !clientId || !nonce) throw new Error('TELEGRAM_OIDC_TOKEN_INVALID');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('TELEGRAM_OIDC_TOKEN_INVALID');
  let header;
  let claims;
  try {
    header = decodePart(parts[0]);
    claims = decodePart(parts[1]);
  } catch {
    throw new Error('TELEGRAM_OIDC_TOKEN_INVALID');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('TELEGRAM_OIDC_ALGORITHM_INVALID');
  const key = await getSigningKey(header.kid, fetchImpl);
  const validSignature = verify(
    'RSA-SHA256',
    Buffer.from(parts[0] + '.' + parts[1]),
    key,
    Buffer.from(parts[2], 'base64url')
  );
  if (!validSignature) throw new Error('TELEGRAM_OIDC_SIGNATURE_INVALID');
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== ISSUER || !audience.includes(String(clientId))) throw new Error('TELEGRAM_OIDC_CLAIMS_INVALID');
  if (!Number.isSafeInteger(claims.exp) || claims.exp <= now) throw new Error('TELEGRAM_OIDC_TOKEN_EXPIRED');
  if (!Number.isSafeInteger(claims.iat) || claims.iat > now + 60 || now - claims.iat > 3600) throw new Error('TELEGRAM_OIDC_TOKEN_EXPIRED');
  if (claims.nonce !== nonce) throw new Error('TELEGRAM_OIDC_NONCE_INVALID');
  const id = String(claims.id ?? '');
  if (!/^\d+$/.test(id)) throw new Error('TELEGRAM_OIDC_USER_INVALID');
  return {
    id,
    username: typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined,
    first_name: typeof claims.given_name === 'string' ? claims.given_name : (typeof claims.name === 'string' ? claims.name : '')
  };
}
