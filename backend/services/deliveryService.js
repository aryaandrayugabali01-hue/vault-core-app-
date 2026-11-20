import { pool } from '../db/pool.js';
import { decryptPayload } from '../utils/encryption.js';
import { telegramCall } from './telegramApi.js';

export async function deliverPaidOrder(orderNumber) {
  const client = await pool.connect();
  try {
    const { rows: orderRows } = await client.query(
      `SELECT o.id, o.order_number, c.telegram_user_id
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.order_number = $1 AND o.status IN ('PAID','FULFILLING')`, [orderNumber]
    );
    const order = orderRows[0];
    if (!order) return { delivered: 0, skipped: true };

    const { rows: pending } = await client.query(
      `SELECT d.id AS delivery_id, d.inventory_item_id, p.name AS product_name,
              i.payload_ciphertext, i.payload_nonce, i.payload_tag
       FROM deliveries d
       JOIN inventory_items i ON i.id = d.inventory_item_id
       JOIN order_items oi ON oi.order_id = d.order_id AND oi.product_id = i.product_id
       JOIN products p ON p.id = oi.product_id
       WHERE d.order_id = $1 AND (d.status IN ('PENDING','FAILED') OR (d.status='READY' AND COALESCE(d.last_attempt_at,d.created_at) < NOW() - INTERVAL '5 minutes'))
       ORDER BY d.id`, [order.id]
    );
    await client.query(`UPDATE orders SET status = 'FULFILLING' WHERE id = $1 AND status = 'PAID'`, [order.id]);

    let delivered = 0;
    for (const item of pending) {
      const claim = await pool.query(
        `UPDATE deliveries SET status='READY', last_attempt_at=NOW(), attempt_count=attempt_count+1, last_error=NULL
         WHERE id=$1 AND (status IN ('PENDING','FAILED') OR (status='READY' AND COALESCE(last_attempt_at,created_at) < NOW() - INTERVAL '5 minutes')) RETURNING id`,
        [item.delivery_id]
      );
      if (!claim.rowCount) continue;
      try {
        const payload = decryptPayload(item);
        const text = `✅ <b>Pembayaran diterima</b>\n\nProduk: ${escapeHtml(item.product_name)}\n\n<code>${escapeHtml(payload)}</code>\n\nSimpan detail ini dengan aman. Hubungi dukungan jika ada kendala.`;
        const result = await telegramCall('sendMessage', {
          chat_id: order.telegram_user_id,
          text,
          parse_mode: 'HTML',
          protect_content: true
        });
        await pool.query(
          `UPDATE deliveries SET status='DELIVERED', telegram_message_id=$2, delivered_at=NOW(), last_error=NULL WHERE id=$1`,
          [item.delivery_id, result.message_id]
        );
        await pool.query(`UPDATE inventory_items SET status='SOLD', sold_at=NOW() WHERE id=$1`, [item.inventory_item_id]);
        delivered++;
      } catch (error) {
        await pool.query(`UPDATE deliveries SET status='FAILED', last_error=$2 WHERE id=$1`, [item.delivery_id, String(error.message || 'Delivery failed').slice(0, 500)]);
        throw error;
      }
    }

    const { rows: remaining } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM deliveries WHERE order_id=$1 AND status <> 'DELIVERED'`, [order.id]
    );
    if (remaining[0].count === 0) {
      await pool.query(`UPDATE orders SET status='FULFILLED', fulfilled_at=NOW() WHERE id=$1`, [order.id]);
    }
    return { delivered };
  } finally {
    client.release();
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
