import { pool } from '../db/pool.js';
import { encryptSecretPayload, decryptSecretPayload } from '../utils/secretVault.js';

export async function submitJokiCustomerAccess(req, res) {
  const orderNumber = String(req.params.orderNumber ?? '').trim();
  const orderItemId = Number(req.body?.orderItemId);
  const login = typeof req.body?.login === 'string' ? req.body.login : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^VC-[A-Z0-9-]{6,80}$/.test(orderNumber)
      || !Number.isSafeInteger(orderItemId) || orderItemId <= 0
      || login.trim().length < 2 || login.length > 240
      || password.trim().length < 6 || password.length > 1200) {
    return res.status(400).json({ error: 'INVALID_JOKI_ACCESS_INPUT' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT o.id AS order_id,o.order_number,o.status,o.customer_id,
              oi.id AS order_item_id,oi.product_id,p.variant_id,v.kategori_produk
       FROM orders o
       JOIN order_items oi ON oi.order_id=o.id
       JOIN products p ON p.id=oi.product_id
       JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id
       WHERE o.order_number=$1 AND o.customer_id=$2 AND oi.id=$3
       FOR UPDATE OF o,oi`,
      [orderNumber,req.customer.id,orderItemId]
    );
    const item = rows[0];
    if (!item || item.kategori_produk !== 'Jasa Joki') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'JOKI_ORDER_ITEM_NOT_FOUND' });
    }
    if (!['PAID','FULFILLING'].includes(item.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ORDER_NOT_READY_FOR_JOKI_ACCESS' });
    }

    const context = {
      scope:'JOKI_CUSTOMER_ACCESS',
      productId:Number(item.product_id),
      inventoryItemId:null,
      orderId:Number(item.order_id),
      orderItemId:Number(item.order_item_id),
      customerId:Number(item.customer_id)
    };
    const previous = await client.query(
      `SELECT id FROM vault_core_secret_payloads
       WHERE secret_scope='JOKI_CUSTOMER_ACCESS' AND order_item_id=$1 AND secret_status='ACTIVE'
       FOR UPDATE`,
      [orderItemId]
    );
    for (const old of previous.rows) {
      await client.query(
        `UPDATE vault_core_secret_payloads SET secret_status='REVOKED',updated_at=NOW()
         WHERE id=$1 AND secret_status='ACTIVE'`,
        [old.id]
      );
      await client.query(
        `INSERT INTO vault_core_secret_access_logs(secret_payload_id,actor_telegram_user_id,action,reason,request_reference)
         VALUES($1,$2,'REVOKE','Customer replaced Joki access credentials',$3)`,
        [old.id,String(req.telegramUser.id),orderNumber]
      );
    }

    const encrypted = encryptSecretPayload({ login, password }, context);
    const { rows: inserted } = await client.query(
      `INSERT INTO vault_core_secret_payloads
        (secret_scope,product_id,order_id,order_item_id,customer_id,
         payload_ciphertext,payload_nonce,payload_auth_tag,wrapped_data_key,key_wrap_nonce,key_wrap_auth_tag,
         encryption_key_version,created_by_telegram_id)
       VALUES('JOKI_CUSTOMER_ACCESS',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [item.product_id,item.order_id,item.order_item_id,item.customer_id,
       encrypted.payload_ciphertext,encrypted.payload_nonce,encrypted.payload_auth_tag,
       encrypted.wrapped_data_key,encrypted.key_wrap_nonce,encrypted.key_wrap_auth_tag,
       encrypted.encryption_key_version,String(req.telegramUser.id)]
    );
    await client.query(
      `INSERT INTO vault_core_secret_access_logs(secret_payload_id,actor_telegram_user_id,action,reason,request_reference)
       VALUES($1,$2,'CREATE','Customer submitted access credentials for paid Joki order',$3)`,
      [inserted[0].id,String(req.telegramUser.id),orderNumber]
    );
    await client.query('COMMIT');
    return res.status(201).json({ ok:true, orderNumber, orderItemId, status:'SECURELY_STORED' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[joki-access-submit]', error.message);
    return res.status(500).json({ error:'JOKI_ACCESS_SAVE_FAILED' });
  } finally {
    client.release();
  }
}

export async function readJokiCustomerAccess(req, res) {
  const orderNumber = String(req.params.orderNumber ?? '').trim();
  const orderItemId = Number(req.params.orderItemId);
  const reason = String(req.body?.reason ?? '').trim();
  if (!/^VC-[A-Z0-9-]{6,80}$/.test(orderNumber)
      || !Number.isSafeInteger(orderItemId) || orderItemId <= 0
      || reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ error:'INVALID_SECRET_ACCESS_REQUEST' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT s.id,s.product_id,s.order_id,s.order_item_id,s.customer_id,
              s.payload_ciphertext,s.payload_nonce,s.payload_auth_tag,
              s.wrapped_data_key,s.key_wrap_nonce,s.key_wrap_auth_tag,s.encryption_key_version
       FROM vault_core_secret_payloads s
       JOIN orders o ON o.id=s.order_id
       WHERE o.order_number=$1 AND s.order_item_id=$2
         AND s.secret_scope='JOKI_CUSTOMER_ACCESS' AND s.secret_status='ACTIVE'
         AND o.status IN ('PAID','FULFILLING')
       ORDER BY s.id DESC LIMIT 1
       FOR UPDATE OF s`,
      [orderNumber,orderItemId]
    );
    const secret = rows[0];
    if (!secret) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error:'ACTIVE_JOKI_SECRET_NOT_FOUND' });
    }
    const context = {
      scope:'JOKI_CUSTOMER_ACCESS',
      productId:Number(secret.product_id),
      inventoryItemId:null,
      orderId:Number(secret.order_id),
      orderItemId:Number(secret.order_item_id),
      customerId:Number(secret.customer_id)
    };
    const payload = decryptSecretPayload(secret,context);
    await client.query(
      `UPDATE vault_core_secret_payloads SET last_accessed_at=NOW(),updated_at=NOW() WHERE id=$1`,
      [secret.id]
    );
    await client.query(
      `INSERT INTO vault_core_secret_access_logs(secret_payload_id,actor_telegram_user_id,action,reason,request_reference)
       VALUES($1,$2,'READ',$3,$4)`,
      [secret.id,String(req.telegramUser.id),reason,orderNumber]
    );
    await client.query('COMMIT');
    return res.json({ orderNumber, orderItemId, credentials:payload });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[joki-access-read]', error.message);
    return res.status(500).json({ error:'JOKI_ACCESS_READ_FAILED' });
  } finally {
    client.release();
  }
}
