import crypto from 'node:crypto';

function getKey() {
  const value = process.env.APP_ENCRYPTION_KEY;
  if (!value) throw new Error('APP_ENCRYPTION_KEY is required.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptPayload(plainText) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  return {
    payload_ciphertext: ciphertext.toString('base64'),
    payload_nonce: nonce.toString('base64'),
    payload_tag: cipher.getAuthTag().toString('base64')
  };
}

export function decryptPayload(record) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', getKey(), Buffer.from(record.payload_nonce, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.payload_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.payload_ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function assertAllowedDigitalPayload(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 3_500) throw new Error('Payload must contain 1–3500 characters.');
  const blockedPatterns = [
    /(?:email|e-mail)\s*[:=]\s*[^\s]+\s*[,;|:]\s*(?:password|pass|kata\s*sandi)\s*[:=]/i,
    /(?:session\s*cookie|auth(?:entication)?\s*token|refresh\s*token|recovery\s*code|otp\s*seed)/i,
    /(?:username|email)\s*[:=][\s\S]{0,120}(?:password|pass)\s*[:=]/i,
    /(?:^|\s)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}:[^\s]{6,}(?:$|\s)/i
  ];
  if (blockedPatterns.some((pattern) => pattern.test(text))) {
    throw new Error('This fulfillment payload type is not supported.');
  }
  return text;
}
