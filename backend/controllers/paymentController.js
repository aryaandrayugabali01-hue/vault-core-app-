import { pool } from '../db/pool.js';
import { deliverPaidOrder } from '../services/deliveryService.js';
import { sanitizeSuccessfulPaymentUpdate } from '../utils/paymentAudit.js';

export async function answerPreCheckout(query) {
  if (!query?.id || !query?.invoice_payload || !query?.from?.id) {
    return { ok: false, error_message: 'Pembayaran tidak valid. Silakan buat pesanan baru.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT o.id,o.order_number,o.total_xtr,o.status,o.pre_checkout_query_id,c.telegram_user_id,
        COALESCE((SELECT COUNT(*) FROM deliveries d JOIN inventory_items i ON i.id=d.inventory_item_id
          WHERE d.order_id=o.id AND d.status='PENDING' AND i.status='RESERVED'
            AND i.reserved_order_id=o.id AND i.reserved_until > NOW()),0)::int AS reserved_count,
        COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id=o.id),0)::int AS requested_count,
        COALESCE((SELECT COUNT(*) FROM order_items oi
          JOIN products p ON p.id=oi.product_id
          LEFT JOIN product_rights_reviews rr
            ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
          WHERE oi.order_id=o.id AND COALESCE(p.is_test,FALSE)=FALSE
            AND (p.status<>'ACTIVE' OR p.fulfillment_type IS NULL
              OR rr.id IS NULL OR rr.review_status<>'APPROVED'
              OR rr.owner_attested IS NOT TRUE OR rr.valid_until<=NOW())),0)::int AS invalid_product_review_count,
        COALESCE((SELECT COUNT(*) FROM deliveries d
          JOIN inventory_items i ON i.id=d.inventory_item_id
          JOIN products p ON p.id=i.product_id
          LEFT JOIN product_rights_reviews rr
            ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
          WHERE d.order_id=o.id AND COALESCE(p.is_test,FALSE)=FALSE
            AND (i.rights_review_id IS DISTINCT FROM p.current_rights_review_id
              OR i.source_reference IS NULL OR length(btrim(i.source_reference))<3
              OR rr.id IS NULL OR rr.review_status<>'APPROVED'
              OR rr.owner_attested IS NOT TRUE OR rr.valid_until<=NOW())),0)::int AS invalid_inventory_rights_count
       FROM orders o JOIN customers c ON c.id=o.customer_id
       WHERE o.order_number=$1 FOR UPDATE OF o`,
      [query.invoice_payload]
    );
    const order = rows[0];
    const valid = order && order.status === 'PENDING_PAYMENT'
      && order.reserved_count > 0 && order.reserved_count === order.requested_count
      && Number(order.invalid_product_review_count) === 0
      && Number(order.invalid_inventory_rights_count) === 0
      && Number(order.total_xtr) === Number(query.total_amount)
      && query.currency === 'XTR'
      && String(order.telegram_user_id) === String(query.from.id)
      && (!order.pre_checkout_query_id || order.pre_checkout_query_id === query.id);
    if (!valid) {
      await client.query('ROLLBACK');
      return { ok: false, error_message: 'Pesanan sudah diproses, pembayaran lain sedang berlangsung, stok berubah, atau jumlah Stars tidak sesuai.' };
    }

    if (!order.pre_checkout_query_id) {
      const claimed = await client.query(
        `UPDATE orders SET pre_checkout_query_id=$2
         WHERE id=$1 AND status='PENDING_PAYMENT' AND pre_checkout_query_id IS NULL
         RETURNING id`,
        [order.id, query.id]
      );
      if (!claimed.rowCount) {
        await client.query('ROLLBACK');
        return { ok: false, error_message: 'Pembayaran untuk pesanan ini sudah diajukan. Lanjutkan pembayaran yang sedang terbuka.' };
      }
    }
    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[pre-checkout-validation-error]', error.message);
    return { ok: false, error_message: 'Sistem belum dapat memverifikasi pesanan. Buat pesanan baru beberapa saat lagi.' };
  } finally {
    client.release();
  }
}

export async function recordSuccessfulPayment(message) {
  const payment = message.successful_payment;
  const orderNumber = payment.invoice_payload;
  if (!payment.telegram_payment_charge_id) throw new Error('Successful payment is missing its Telegram charge ID.');

  const client = await pool.connect();
  let alreadyProcessed = false;
  let refundRequired = false;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT o.*, c.telegram_user_id FROM orders o
       JOIN customers c ON c.id=o.customer_id WHERE o.order_number=$1 FOR UPDATE`,
      [orderNumber]
    );
    const order = rows[0];
    if (!order || String(order.telegram_user_id) !== String(message.from.id)
        || !order.pre_checkout_query_id
        || payment.currency !== 'XTR' || Number(payment.total_amount) !== Number(order.total_xtr)) {
      throw new Error('Successful payment does not match a valid order.');
    }

    const { rows: existing } = await client.query(
      `SELECT id, order_id FROM transactions WHERE telegram_payment_charge_id=$1 FOR UPDATE`,
      [payment.telegram_payment_charge_id]
    );
    if (existing.length) {
      if (String(existing[0].order_id) !== String(order.id)) {
        throw new Error('Telegram payment charge ID is already linked to another order.');
      }
      alreadyProcessed = true;
      refundRequired = order.status === 'REFUND_PENDING';
    } else {
      if (order.status === 'REFUNDED') {
        throw new Error('A new successful payment arrived for an already-refunded order.');
      }

      const { rows: requestedRows } = await client.query(
        `SELECT COALESCE(SUM(quantity),0)::int AS requested_count
         FROM order_items WHERE order_id=$1`,
        [order.id]
      );
      const requestedCount = Number(requestedRows[0]?.requested_count ?? 0);
      const { rows: reservedRows } = await client.query(
        `SELECT d.id, d.inventory_item_id
         FROM deliveries d
         JOIN inventory_items i ON i.id=d.inventory_item_id
         WHERE d.order_id=$1 AND d.status='PENDING'
           AND i.status='RESERVED' AND i.reserved_order_id=$1
         FOR UPDATE OF d,i`,
        [order.id]
      );
      const reservationComplete = requestedCount > 0 && reservedRows.length === requestedCount;

      const auditUpdate = sanitizeSuccessfulPaymentUpdate(message);
      await client.query(
        `INSERT INTO transactions (order_id, provider, currency, amount_xtr, telegram_payment_charge_id,
          provider_payment_charge_id, status, raw_update, paid_at)
         VALUES ($1,'TELEGRAM_STARS','XTR',$2,$3,$4,'PAID',$5,NOW())`,
        [order.id, payment.total_amount, payment.telegram_payment_charge_id,
         payment.provider_payment_charge_id ?? null, JSON.stringify(auditUpdate)]
      );

      if (reservationComplete) {
        await client.query(
          `UPDATE orders SET status='PAID', paid_at=NOW() WHERE id=$1`,
          [order.id]
        );
      } else {
        await client.query(
          `UPDATE deliveries d
           SET status = CASE
             WHEN EXISTS (
               SELECT 1 FROM inventory_items i
               WHERE i.id=d.inventory_item_id
                 AND i.status='RESERVED' AND i.reserved_order_id=$1
             ) THEN 'REVIEW_REQUIRED'
             ELSE 'REVOKED'
           END,
           last_error='Payment verified after the stock reservation was lost or changed; owner reconciliation or refund is required.'
           WHERE d.order_id=$1 AND d.status IN ('PENDING','READY','FAILED')`,
          [order.id]
        );
        await client.query(
          `UPDATE orders SET status='REFUND_PENDING', paid_at=NOW() WHERE id=$1`,
          [order.id]
        );
        refundRequired = true;
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const delivery = refundRequired ? { skipped: true, refundRequired: true } : await deliverPaidOrder(orderNumber);
  return { alreadyProcessed, refundRequired, delivery };
}
