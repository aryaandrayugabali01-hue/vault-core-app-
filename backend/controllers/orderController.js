import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { sendStarsInvoice } from '../services/telegramApi.js';

export async function createOrder(req, res) {
  const productId = Number(req.body?.productId);
  const quantity = Number(req.body?.quantity ?? 1);
  if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
    return res.status(400).json({ error: 'INVALID_ORDER_INPUT' });
  }

  const client = await pool.connect();
  let order;
  try {
    await client.query('BEGIN');
    const { rows: expiredOrders } = await client.query(
      `UPDATE orders SET status='CANCELLED'
       WHERE status='PENDING_PAYMENT' AND created_at < NOW() - INTERVAL '15 minutes'
       RETURNING id`
    );
    const expiredIds = expiredOrders.map((item) => item.id);
    if (expiredIds.length) {
      await client.query(
        `UPDATE deliveries
         SET status='REVOKED', last_error='Payment window expired; reservation released.'
         WHERE order_id = ANY($1::bigint[]) AND status IN ('PENDING','READY','FAILED','REVIEW_REQUIRED')`,
        [expiredIds]
      );
      await client.query(
        `UPDATE inventory_items
         SET status='AVAILABLE', reserved_order_id=NULL, reserved_until=NULL
         WHERE status='RESERVED' AND reserved_order_id = ANY($1::bigint[])`,
        [expiredIds]
      );
    }

    const { rows: products } = await client.query(
      `SELECT * FROM products WHERE id=$1 AND status='ACTIVE' FOR UPDATE`, [productId]
    );
    const product = products[0];
    if (!product) throw Object.assign(new Error('Produk tidak tersedia.'), { status: 404 });
    if (product.sale_price_idr == null || Number(product.sale_price_idr) <= 0) {
      throw Object.assign(new Error('Harga rupiah produk belum dikonfigurasi.'), { status: 409 });
    }

    const { rows: stockRows } = await client.query(
      `SELECT id FROM inventory_items
       WHERE product_id=$1 AND status='AVAILABLE'
         AND reserved_order_id IS NULL AND reserved_until IS NULL
       ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [productId, quantity]
    );
    if (stockRows.length < quantity) throw Object.assign(new Error('Stok tidak mencukupi.'), { status: 409 });

    const orderNumber = `VC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const totalXtr = Number(product.sale_price_xtr) * quantity;
    const totalCostIdr = Number(product.cost_price_idr) * quantity;
    const totalSaleIdr = Number(product.sale_price_idr) * quantity;
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, customer_id, total_xtr, total_sale_idr, total_cost_idr)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [orderNumber, req.customer.id, totalXtr, totalSaleIdr, totalCostIdr]
    );
    order = orderRows[0];
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_sale_xtr, unit_sale_idr, unit_cost_idr, product_name_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [order.id, product.id, quantity, product.sale_price_xtr, product.sale_price_idr, product.cost_price_idr, product.name]
    );
    for (const stock of stockRows) {
      const reservation = await client.query(
        `UPDATE inventory_items
         SET status='RESERVED', reserved_order_id=$2, reserved_until=NOW() + INTERVAL '15 minutes'
         WHERE id=$1 AND status='AVAILABLE' AND reserved_order_id IS NULL
         RETURNING id`,
        [stock.id, order.id]
      );
      if (!reservation.rowCount) throw new Error('INVENTORY_RESERVATION_CONFLICT');
      await client.query(
        `INSERT INTO deliveries (order_id, inventory_item_id, idempotency_key)
         VALUES ($1,$2,$3)`,
        [order.id, stock.id, `${orderNumber}:${stock.id}`]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.status ?? 500).json({
      error: error.status ? 'ORDER_REJECTED' : 'ORDER_CREATE_FAILED',
      message: error.status ? error.message : 'Pesanan tidak dapat dibuat saat ini.'
    });
  } finally {
    client.release();
  }

  try {
    const invoiceUrl = await sendStarsInvoice({
      orderNumber: order.order_number,
      title: `VAULT CORE ${order.order_number}`,
      description: 'Pembayaran pesanan produk digital VAULT CORE.',
      amount: Number(order.total_xtr)
    });
    res.status(201).json({ orderNumber: order.order_number, totalXtr: Number(order.total_xtr), invoiceUrl });
  } catch {
    const cleanup = await pool.connect();
    try {
      await cleanup.query('BEGIN');
      await cleanup.query(
        `UPDATE orders SET status='FAILED' WHERE id=$1 AND status='PENDING_PAYMENT'`,
        [order.id]
      );
      await cleanup.query(
        `UPDATE deliveries SET status='REVOKED', last_error='Invoice creation failed; reservation released.'
         WHERE order_id=$1 AND status IN ('PENDING','READY','FAILED','REVIEW_REQUIRED')`,
        [order.id]
      );
      await cleanup.query(
        `UPDATE inventory_items
         SET status='AVAILABLE', reserved_order_id=NULL, reserved_until=NULL
         WHERE status='RESERVED' AND reserved_order_id=$1`,
        [order.id]
      );
      await cleanup.query('COMMIT');
    } catch {
      await cleanup.query('ROLLBACK');
    } finally {
      cleanup.release();
    }
    res.status(502).json({
      error: 'INVOICE_CREATE_FAILED',
      message: 'Invoice Telegram tidak dapat dibuat. Silakan coba kembali.'
    });
  }
}

export async function getMyOrders(req, res) {
  const { rows } = await pool.query(
    `SELECT o.order_number, o.status, o.total_xtr, o.created_at, o.paid_at, o.fulfilled_at,
            COALESCE(json_agg(json_build_object('name', oi.product_name_snapshot, 'quantity', oi.quantity))
              FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
     WHERE o.customer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50`,
    [req.customer.id]
  );
  res.json({ orders: rows });
}
