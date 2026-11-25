import crypto from 'node:crypto';

const SCOPES = new Set(['PRODUCT_ACCOUNT','JOKI_CUSTOMER_ACCESS']);

function getKeyVersion() {
  const version = Number(process.env.APP_ENCRYPTION_KEY_VERSION ?? 1);
  if (!Number.isSafeInteger(version) || version < 1 || version > 32767) {
    throw new Error('APP_ENCRYPTION_KEY_VERSION_INVALID');
  }
  return version;
}

function getKey() {
  const encoded = process.env.APP_ENCRYPTION_KEY;
  if (!encoded) throw new Error('APP_ENCRYPTION_KEY is required.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

function positiveId(value, name, optional = false) {
  if (optional && (value === null || value === undefined)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('VAULT_CONTEXT_INVALID_' + name);
  return number;
}

function normalizeContext(input = {}) {
  const scope = String(input.scope ?? '');
  if (!SCOPES.has(scope)) throw new Error('VAULT_SCOPE_INVALID');
  const context = {
    scope,
    productId: positiveId(input.productId, 'PRODUCT_ID'),
    inventoryItemId: positiveId(input.inventoryItemId, 'INVENTORY_ITEM_ID', true),
    orderId: positiveId(input.orderId, 'ORDER_ID', true),
    orderItemId: positiveId(input.orderItemId, 'ORDER_ITEM_ID', true),
    customerId: positiveId(input.customerId, 'CUSTOMER_ID', true)
  };
  if (scope === 'PRODUCT_ACCOUNT' && context.inventoryItemId === null) {
    throw new Error('VAULT_INVENTORY_ITEM_REQUIRED');
  }
  if (scope === 'JOKI_CUSTOMER_ACCESS'
      && (context.inventoryItemId !== null || context.orderId === null
        || context.orderItemId === null || context.customerId === null)) {
    throw new Error('VAULT_JOKI_ORDER_CONTEXT_REQUIRED');
  }
  return context;
}

function aadFor(context, keyVersion) {
  return Buffer.from([
    'VAULT_CORE_SECRET_V1',
    String(keyVersion),
    context.scope,
    String(context.productId),
    context.inventoryItemId === null ? '' : String(context.inventoryItemId),
    context.orderId === null ? '' : String(context.orderId),
    context.orderItemId === null ? '' : String(context.orderItemId),
    context.customerId === null ? '' : String(context.customerId)
  ].join('|'), 'utf8');
}

function bytes(value, name) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && value) return Buffer.from(value, 'base64');
  throw new Error('VAULT_RECORD_INVALID_' + name);
}

export function encryptSecretPayload(payload, rawContext) {
  const context = normalizeContext(rawContext);
  const serialized = JSON.stringify(payload);
  if (typeof serialized !== 'string' || serialized.length < 2
      || Buffer.byteLength(serialized, 'utf8') > 16_384) {
    throw new Error('VAULT_PAYLOAD_SIZE_INVALID');
  }

  const keyVersion = getKeyVersion();
  const kek = getKey();
  const dek = crypto.randomBytes(32);
  const payloadNonce = crypto.randomBytes(12);
  const payloadAad = aadFor(context, keyVersion);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, payloadNonce);
  cipher.setAAD(payloadAad);
  const payloadCiphertext = Buffer.concat([
    cipher.update(serialized, 'utf8'),
    cipher.final()
  ]);
  const payloadAuthTag = cipher.getAuthTag();

  const keyWrapNonce = crypto.randomBytes(12);
  const wrapAad = Buffer.concat([Buffer.from('VAULT_CORE_DEK_WRAP_V1|'), payloadAad]);
  const keyCipher = crypto.createCipheriv('aes-256-gcm', kek, keyWrapNonce);
  keyCipher.setAAD(wrapAad);
  const wrappedDataKey = Buffer.concat([keyCipher.update(dek), keyCipher.final()]);
  const keyWrapAuthTag = keyCipher.getAuthTag();

  return {
    payload_ciphertext: payloadCiphertext,
    payload_nonce: payloadNonce,
    payload_auth_tag: payloadAuthTag,
    wrapped_data_key: wrappedDataKey,
    key_wrap_nonce: keyWrapNonce,
    key_wrap_auth_tag: keyWrapAuthTag,
    encryption_key_version: keyVersion
  };
}

export function decryptSecretPayload(record, rawContext) {
  const context = normalizeContext(rawContext);
  const keyVersion = Number(record?.encryption_key_version);
  if (!Number.isSafeInteger(keyVersion) || keyVersion !== getKeyVersion()) {
    throw new Error('VAULT_KEY_VERSION_UNAVAILABLE');
  }
  const kek = getKey();
  const payloadAad = aadFor(context, keyVersion);
  const wrapAad = Buffer.concat([Buffer.from('VAULT_CORE_DEK_WRAP_V1|'), payloadAad]);

  const keyUnwrap = crypto.createDecipheriv('aes-256-gcm', kek, bytes(record.key_wrap_nonce, 'KEY_WRAP_NONCE'));
  keyUnwrap.setAAD(wrapAad);
  keyUnwrap.setAuthTag(bytes(record.key_wrap_auth_tag, 'KEY_WRAP_AUTH_TAG'));
  const dek = Buffer.concat([
    keyUnwrap.update(bytes(record.wrapped_data_key, 'WRAPPED_DATA_KEY')),
    keyUnwrap.final()
  ]);
  if (dek.length !== 32) throw new Error('VAULT_DATA_KEY_INVALID');

  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, bytes(record.payload_nonce, 'PAYLOAD_NONCE'));
  decipher.setAAD(payloadAad);
  decipher.setAuthTag(bytes(record.payload_auth_tag, 'PAYLOAD_AUTH_TAG'));
  const plaintext = Buffer.concat([
    decipher.update(bytes(record.payload_ciphertext, 'PAYLOAD_CIPHERTEXT')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
}
