import { pool } from '../db/pool.js';
import { decryptSecretPayload } from '../utils/secretVault.js';

// CR-16: Joki requests may collect only non-secret game identity and work parameters.
 // No login, password, OTP, session, recovery or other authentication secret may be
 // requested from customers or stored by the application.
export async function submitJokiCustomerAccess(_req, res) {
  return res.status(410).json({
    error:'JOKI_CUSTOMER_INPUT_NOT_AVAILABLE',
    message:'Form data Joki tanpa kredensial belum tersedia. Jangan kirim password atau kode autentikasi.'
  });
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
