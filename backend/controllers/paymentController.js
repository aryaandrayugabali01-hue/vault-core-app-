import { pool } from '../db/pool.js';
import { deliverPaidOrder } from '../services/deliveryService.js';

export async function answerPreCheckout(query) {
  const { rows } = await pool.query(
    `SELECT o.order_number, o.total_xtr, o.status, c.telegram_user_id,
       COALESCE((SELECT COUNT(*) FROM deliveries d JOIN inventory_items i ON i.id=d.inventory_item_id
         WHERE d.order_id=o.id AND i.status='RESERVED' AND i.reserved_until > NOW()),0)::int AS reserved_count,
       COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id=o.id),0)::int AS requested_count
     FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.order_number=$1`,
    [query.invoice_payload]
  );
  const order = rows[0];
  const valid = order && order.status === 'PENDING_PAYMENT'
    && order.reserved_count >= order.requested_count
    && Number(order.total_xtr) === Number(query.total_amount)
    && query.currency === 'XTR'
    && String(order.telegram_user_id) === String(query.from.id);
  return valid
    ? { ok: true }
    : { ok: false, error_message: 'Pesanan tidak valid, sudah diproses, atau nominal tidak sesuai.' };
}

export async function recordSuccessfulPayment(message) {
  const payment = message.successful_payment;
  const orderNumber = payment.invoice_payload;
  const client = await pool.connect();
  let alreadyProcessed = false;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT o.*, c.telegram_user_id FROM orders o
       JOIN customers c ON c.id=o.customer_id WHERE o.order_number=$1 FOR UPDATE`, [orderNumber]
    );
    const order = rows[0];
    if (!order || String(order.telegram_user_id) !== String(message.from.id)
        || payment.currency !== 'XTR' || Number(payment.total_amount) !== Number(order.total_xtr)) {
      throw new Error('Successful payment does not match a valid order.');
    }
    const { rows: existing } = await client.query(
      `SELECT id FROM transactions WHERE telegram_payment_charge_id=$1`, [payment.telegram_payment_charge_id]
    );
    if (existing.length) {
      alreadyProcessed = true;
    } else {
      if (order.status !== 'PENDING_PAYMENT') throw new Error('Order is not awaiting payment.');
      await client.query(
        `INSERT INTO transactions (order_id, provider, currency, amount_xtr, telegram_payment_charge_id,
          provider_payment_charge_id, status, raw_update, paid_at)
         VALUES ($1,'TELEGRAM_STARS','XTR',$2,$3,$4,'PAID',$5,NOW())`,
        [order.id, payment.total_amount, payment.telegram_payment_charge_id,
         payment.provider_payment_charge_id ?? null, JSON.stringify(message)]
      );
      await client.query(`UPDATE orders SET status='PAID', paid_at=NOW() WHERE id=$1`, [order.id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const delivery = await deliverPaidOrder(orderNumber);
  return { alreadyProcessed, delivery };
}
