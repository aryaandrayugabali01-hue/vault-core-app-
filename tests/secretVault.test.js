import test from 'node:test';
import assert from 'node:assert/strict';

process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 0x5a).toString('base64');
process.env.APP_ENCRYPTION_KEY_VERSION = '1';
const { encryptSecretPayload, decryptSecretPayload } = await import('../backend/utils/secretVault.js');

const accountContext = Object.freeze({
  scope:'PRODUCT_ACCOUNT',productId:10,inventoryItemId:99,
  orderId:null,orderItemId:null,customerId:null
});

test('v4 vault encrypts and decrypts with a random per-record DEK', () => {
  const secret = { login:'owner@example.invalid', password:'not-a-real-password' };
  const first = encryptSecretPayload(secret, accountContext);
  const second = encryptSecretPayload(secret, accountContext);
  assert.notDeepEqual(first.payload_ciphertext, second.payload_ciphertext);
  assert.deepEqual(decryptSecretPayload(first, accountContext), secret);
  assert.deepEqual(decryptSecretPayload(second, accountContext), secret);
  assert.equal(first.encryption_key_version, 1);
});

test('v4 vault binds ciphertext to scope and record context', () => {
  const encrypted = encryptSecretPayload({ login:'user', password:'test' }, accountContext);
  assert.throws(
    () => decryptSecretPayload(encrypted, { ...accountContext, inventoryItemId:100 }),
    /authenticate|Unsupported state|unable to authenticate/i
  );
  assert.throws(
    () => decryptSecretPayload(encrypted, { ...accountContext, scope:'JOKI_CUSTOMER_ACCESS', orderId:1, orderItemId:2, customerId:3 }),
    /authenticate|Unsupported state|unable to authenticate/i
  );
});

test('v4 vault rejects invalid scope links and oversized payloads', () => {
  assert.throws(
    () => encryptSecretPayload({ password:'x' }, { ...accountContext, inventoryItemId:null }),
    /VAULT_INVENTORY_ITEM_REQUIRED/
  );
  assert.throws(
    () => encryptSecretPayload({ note:'x'.repeat(17_000) }, accountContext),
    /VAULT_PAYLOAD_SIZE_INVALID/
  );
});
