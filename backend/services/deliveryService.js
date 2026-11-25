import { pool } from '../db/pool.js';
import { decryptPayload } from '../utils/encryption.js';
import { decryptSecretPayload } from '../utils/secretVault.js';
import { telegramCall } from './telegramApi.js';

const MANUAL_FULFILLMENT_SOURCE_PREFIX = 'VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:';

export function isOwnerManualFulfillmentSource(sourceReference) {
  return String(sourceReference ?? '').startsWith(MANUAL_FULFILLMENT_SOURCE_PREFIX);
}

export function canReconcileDelivery(orderStatus) {
  return orderStatus === 'PAID' || orderStatus === 'FULFILLING';
}

export async function deliverPaidOrder(orderNumber) {
  const { rows: orderRows } = await pool.query(
    `SELECT o.id, o.order_number, c.telegram_user_id
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.order_number = $1 AND o.status IN ('PAID','FULFILLING')`,
    [orderNumber]
  );
  const order = orderRows[0];
  if (!order) return { delivered: 0, skipped: true };

  const { rows: existingReview } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM deliveries
     WHERE order_id=$1 AND status='REVIEW_REQUIRED'`,
    [order.id]
  );
  if (existingReview[0].count > 0) {
    return { delivered: 0, reviewRequired: true };
  }

  // A stale READY state is ambiguous: Telegram may have accepted the message
  // before the Worker/database failed. Never resend it automatically.
  const stale = await pool.query(
    `UPDATE deliveries SET status='REVIEW_REQUIRED',
       last_error='Delivery attempt timed out after claim; verify Telegram delivery before retry.'
     WHERE order_id=$1 AND status='READY'
       AND COALESCE(last_attempt_at,created_at) < NOW() - INTERVAL '5 minutes'
     RETURNING id`,
    [order.id]
  );
  if (stale.rowCount > 0) return { delivered: 0, reviewRequired: true };
  const { rows: activeReady } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM deliveries
     WHERE order_id=$1 AND status='READY'
       AND COALESCE(last_attempt_at,created_at) >= NOW() - INTERVAL '5 minutes'`,
    [order.id]
  );
  if (activeReady[0].count > 0) {
    return { delivered: 0, inProgress: true };
  }

  const { rows: expectedRows } = await pool.query(
    `SELECT COALESCE(SUM(quantity),0)::int AS expected_count,
            (SELECT COUNT(*)::int FROM deliveries WHERE order_id=$1 AND status='DELIVERED') AS delivered_count
     FROM order_items WHERE order_id=$1`,
    [order.id]
  );
  const expectedCount = Number(expectedRows[0]?.expected_count ?? 0);
  const deliveredCount = Number(expectedRows[0]?.delivered_count ?? 0);
  const expectedRemaining = Math.max(0, expectedCount - deliveredCount);
  if (expectedRemaining === 0) {
    await pool.query(`UPDATE orders SET status='FULFILLED', fulfilled_at=COALESCE(fulfilled_at,NOW()) WHERE id=$1`, [order.id]);
    return { delivered: 0, alreadyFulfilled: true };
  }

  const { rows: eligible } = await pool.query(
    `SELECT d.id AS delivery_id,d.inventory_item_id,p.id AS product_id,p.name AS product_name,
            i.payload_ciphertext,i.payload_nonce,i.payload_tag,i.source_reference,
            s.id AS vault_secret_id,s.payload_ciphertext AS secret_payload_ciphertext,
            s.payload_nonce AS secret_payload_nonce,s.payload_auth_tag AS secret_payload_auth_tag,
            s.wrapped_data_key,s.key_wrap_nonce,s.key_wrap_auth_tag,s.encryption_key_version
     FROM deliveries d
     JOIN inventory_items i ON i.id=d.inventory_item_id
     JOIN products p ON p.id=i.product_id
     LEFT JOIN vault_core_secret_payloads s
       ON s.inventory_item_id=i.id AND s.secret_scope='PRODUCT_ACCOUNT' AND s.secret_status='ACTIVE'
     LEFT JOIN product_rights_reviews rr
       ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
     WHERE d.order_id=$1 AND d.status IN ('PENDING','FAILED')
       AND i.status='RESERVED' AND i.reserved_order_id=$1
       AND (
         COALESCE(p.is_test,FALSE)=TRUE
         OR (
           p.status='ACTIVE'
           AND p.fulfillment_type IS NOT NULL
           AND i.rights_review_id=p.current_rights_review_id
           AND i.source_reference IS NOT NULL
           AND rr.review_status='APPROVED'
           AND rr.owner_attested=TRUE
           AND rr.valid_until>NOW()
         )
       )
     ORDER BY d.id`,
    [order.id]
  );
  if (eligible.length !== expectedRemaining) {
    await pool.query(
      `UPDATE deliveries d
       SET status = CASE
         WHEN EXISTS (
           SELECT 1 FROM inventory_items i
           WHERE i.id=d.inventory_item_id AND i.status='RESERVED' AND i.reserved_order_id=$1
         ) THEN 'REVIEW_REQUIRED'
         ELSE 'REVOKED'
       END,
       last_error='Paid order no longer owns every required inventory item; owner review or refund is required.'
       WHERE d.order_id=$1 AND d.status IN ('PENDING','FAILED')`,
      [order.id]
    );
    await pool.query(`UPDATE orders SET status='REFUND_PENDING' WHERE id=$1`, [order.id]);
    return { delivered: 0, refundRequired: true, reviewRequired: true };
  }

  await pool.query(`UPDATE orders SET status='FULFILLING' WHERE id=$1 AND status='PAID'`, [order.id]);

  let delivered = 0;
  let failed = 0;
  let reviewRequired = 0;
  for (const item of eligible) {
    const claim = await pool.query(
      `UPDATE deliveries d
       SET status='READY', last_attempt_at=NOW(), attempt_count=attempt_count+1, last_error=NULL
       WHERE d.id=$1 AND d.status IN ('PENDING','FAILED')
         AND EXISTS (
           SELECT 1 FROM inventory_items i
           WHERE i.id=d.inventory_item_id
             AND i.status='RESERVED' AND i.reserved_order_id=$2
         )
       RETURNING d.id`,
      [item.delivery_id, order.id]
    );
    if (!claim.rowCount) continue;

    if (isOwnerManualFulfillmentSource(item.source_reference)) {
      try {
        await telegramCall('sendMessage', {
          chat_id: order.telegram_user_id,
          text: `✅ <b>Pembayaran terverifikasi</b>\n\nPesanan: <code>${escapeHtml(order.order_number)}</code>\nProduk: ${escapeHtml(item.product_name)}\n\nPesanan diteruskan ke Owner untuk pemenuhan manual melalui metode yang tercantum di katalog. Status pengiriman akan diperbarui setelah produk benar-benar diserahkan.`,
          parse_mode: 'HTML',
          protect_content: true
        });
        await pool.query(
          `UPDATE deliveries
           SET status='REVIEW_REQUIRED',
               last_error='OWNER_MANUAL_FULFILLMENT_REQUIRED: Payment acknowledgement sent; Owner must deliver the actual product using the listed fulfillment method, then reconcile DELIVERED.'
           WHERE id=$1 AND status='READY'`,
          [item.delivery_id]
        );
        reviewRequired++;
      } catch (error) {
        const nextStatus = error.telegramRejected ? 'FAILED' : 'REVIEW_REQUIRED';
        await pool.query(
          `UPDATE deliveries SET status=$2, last_error=$3 WHERE id=$1 AND status='READY'`,
          [item.delivery_id, nextStatus, String(error.message || 'Manual fulfillment acknowledgement failed').slice(0, 500)]
        );
        if (nextStatus === 'FAILED') failed++;
        else reviewRequired++;
      }
      continue;
    }

    try {
      const payload = decryptPayload(item);
      const text = `✅ <b>Pembayaran berhasil</b>\n\nProduk: ${escapeHtml(item.product_name)}\n\n<code>${escapeHtml(payload)}</code>\n\nSimpan kode atau detail ini dengan aman. Hubungi pengelola VAULT CORE jika mengalami kendala.`;
      const result = await telegramCall('sendMessage', {
        chat_id: order.telegram_user_id,
        text,
        parse_mode: 'HTML',
        protect_content: true
      });

      const completion = await pool.connect();
      try {
        await completion.query('BEGIN');
        const inventory = await completion.query(
          `UPDATE inventory_items
           SET status='SOLD', sold_at=NOW(), reserved_order_id=NULL, reserved_until=NULL
           WHERE id=$1 AND status='RESERVED' AND reserved_order_id=$2
           RETURNING id`,
          [item.inventory_item_id, order.id]
        );
        if (!inventory.rowCount) {
          const error = new Error('Inventory ownership changed after Telegram accepted the delivery.');
          error.deliveryOutcomeUnknown = true;
          throw error;
        }
        await completion.query(
          `UPDATE deliveries SET status='DELIVERED', telegram_message_id=$2,
             delivered_at=NOW(), last_error=NULL WHERE id=$1 AND status='READY'`,
          [item.delivery_id, result.message_id]
        );
        if (item.vault_secret_id) {
          await completion.query(
            `UPDATE vault_core_secret_payloads SET last_accessed_at=NOW(),updated_at=NOW() WHERE id=$1`,
            [item.vault_secret_id]
          );
          await completion.query(
            `INSERT INTO vault_core_secret_access_logs(secret_payload_id,actor_telegram_user_id,action,reason,request_reference)
             VALUES($1,0,'DELIVER','Automated delivery after Telegram Stars payment confirmation',$2)`,
            [item.vault_secret_id,`${order.order_number}:${item.inventory_item_id}`]
          );
        }
        await completion.query('COMMIT');
      } catch (error) {
        await completion.query('ROLLBACK');
        throw error;
      } finally {
        completion.release();
      }
      delivered++;
    } catch (error) {
      const nextStatus = error.telegramRejected ? 'FAILED' : 'REVIEW_REQUIRED';
      await pool.query(
        `UPDATE deliveries SET status=$2, last_error=$3 WHERE id=$1`,
        [item.delivery_id, nextStatus, String(error.message || 'Delivery failed').slice(0, 500)]
      );
      if (nextStatus === 'FAILED') failed++;
      else reviewRequired++;
    }
  }

  const { rows: remaining } = await pool.query(
    `SELECT COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE status='REVIEW_REQUIRED')::int AS review_count
     FROM deliveries WHERE order_id=$1 AND status <> 'DELIVERED'`,
    [order.id]
  );
  if (remaining[0].review_count > 0) reviewRequired = remaining[0].review_count;
  if (remaining[0].count === 0) {
    await pool.query(`UPDATE orders SET status='FULFILLED', fulfilled_at=NOW() WHERE id=$1`, [order.id]);
  }
  return { delivered, failed, reviewRequired };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
