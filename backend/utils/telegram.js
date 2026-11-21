import crypto from 'node:crypto';

export function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86_400) {
  if (!initData || !botToken) throw new Error('Telegram authentication is not configured.');
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) throw new Error('Invalid Telegram initData hash.');

  const authDate = Number(params.get('auth_date'));
  if (!Number.isInteger(authDate)) throw new Error('Invalid Telegram auth_date.');
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < -60 || age > maxAgeSeconds) throw new Error('Telegram initData has expired.');

  // Bot-token HMAC validation excludes only hash; keep Telegram's modern signature field
  // in the data-check string. Third-party Ed25519 validation uses a different exclusion rule.
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const a = Buffer.from(calculatedHash, 'hex');
  const b = Buffer.from(receivedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Telegram initData signature mismatch.');

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('Telegram user data is missing.');
  const user = JSON.parse(rawUser);
  if (!Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) throw new Error('Invalid Telegram user ID.');
  return user;
}

export function safeTelegramUser(user) {
  return {
    id: String(user.id),
    username: user.username ?? null,
    firstName: user.first_name ?? '',
    lastName: user.last_name ?? ''
  };
}
