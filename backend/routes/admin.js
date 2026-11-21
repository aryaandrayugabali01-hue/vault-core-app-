import { Router } from 'express';
import { pool } from '../db/pool.js';
import { encryptPayload, assertAllowedDigitalPayload } from '../utils/encryption.js';
import { refundStarPayment } from '../services/telegramApi.js';
import { deliverPaidOrder } from '../services/deliveryService.js';
const router = Router();

router.get('/dashboard', async (_req, res) => {
  const [sales, inventory, orders, expenses] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS paid_orders, COALESCE(SUM(total_xtr),0)::bigint AS gross_xtr,
      COALESCE(SUM(total_sale_idr),0)::bigint AS gross_idr, COALESCE(SUM(total_cost_idr),0)::bigint AS cost_idr
      FROM orders WHERE status IN ('PAID','FULFILLING','FULFILLED','REFUND_PENDING')`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='AVAILABLE')::int AS available,
      COUNT(*) FILTER (WHERE status='RESERVED')::int AS reserved,
      COUNT(*) FILTER (WHERE status='SOLD')::int AS sold FROM inventory_items`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='PENDING_PAYMENT')::int AS pending,
      COUNT(*) FILTER (WHERE status='FULFILLED')::int AS fulfilled,
      COUNT(*) FILTER (WHERE status='REFUND_PENDING')::int AS refund_pending FROM orders`),
    pool.query(`SELECT COALESCE(SUM(amount_idr),0)::bigint AS expenses_idr FROM operating_expenses`)
  ]);
  const expenseIdr = Number(expenses.rows[0].expenses_idr);
  const grossIdr = Number(sales.rows[0].gross_idr);
  const costIdr = Number(sales.rows[0].cost_idr);
  res.json({ sales: sales.rows[0], inventory: inventory.rows[0], orders: orders.rows[0], expensesIdr: expenseIdr,
    netProfitIdr: grossIdr - costIdr - expenseIdr, grossProfitIdr: grossIdr - costIdr });
});

router.get('/products', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, COUNT(i.id) FILTER (WHERE i.status='AVAILABLE')::int AS actual_stock
     FROM products p LEFT JOIN inventory_items i ON i.product_id=p.id
     GROUP BY p.id ORDER BY p.created_at DESC`
  );
  res.json({ products: rows });
});

router.post('/products', async (req, res) => {
  const { sku, gameCategory, tier, name, description = '', fulfillmentType,
    salePriceXtr, salePriceIdr = null, costPriceIdr = 0,
    rightsReviewReference = null } = req.body ?? {};
  if (!sku || !gameCategory || !tier || !name || !fulfillmentType || !Number.isInteger(Number(salePriceXtr)) || Number(salePriceXtr) <= 0 || !Number.isFinite(Number(salePriceIdr)) || Number(salePriceIdr) <= 0) {
    return res.status(400).json({ error: 'INVALID_PRODUCT_INPUT' });
  }
  const { rows } = await pool.query(
    `INSERT INTO products (sku, game_category, tier, name, description, fulfillment_type,
      sale_price_xtr, sale_price_idr, cost_price_idr, rights_review_reference, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'DRAFT') RETURNING *`,
    [sku, gameCategory, tier, name, description, fulfillmentType, Number(salePriceXtr),
      salePriceIdr == null ? null : Number(salePriceIdr), Number(costPriceIdr), rightsReviewReference]
  );
  await audit(req, 'PRODUCT_CREATED', 'PRODUCT', rows[0].id, { sku });
  res.status(201).json({ product: rows[0] });
});

router.patch('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['name','description','sale_price_xtr','sale_price_idr','cost_price_idr',
    'low_stock_threshold','display_stock_mode','display_stock_override','status','rights_review_reference'];
  const mapping = {
    name:'name', description:'description', salePriceXtr:'sale_price_xtr', salePriceIdr:'sale_price_idr',
    costPriceIdr:'cost_price_idr', lowStockThreshold:'low_stock_threshold', displayStockMode:'display_stock_mode',
    displayStockOverride:'display_stock_override', status:'status', rightsReviewReference:'rights_review_reference'
  };
  const pairs = Object.entries(mapping).filter(([key]) => Object.hasOwn(req.body ?? {}, key));
  if (!Number.isSafeInteger(id) || !pairs.length) return res.status(400).json({ error: 'INVALID_PRODUCT_UPDATE' });
  const columns = pairs.map(([key]) => mapping[key]).filter((col) => allowed.includes(col));
  const values = pairs.map(([key]) => req.body[key]);
  if (req.body.status === 'ACTIVE') {
    const { rows: review } = await pool.query(`SELECT rights_review_reference FROM products WHERE id=$1`, [id]);
    if (!review[0] || !review[0].rights_review_reference) return res.status(409).json({ error: 'PRODUCT_REVIEW_REFERENCE_REQUIRED' });
  }
  const assignments = columns.map((col, index) => `${col}=$${index + 1}`);
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE products SET ${assignments.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values
  );
  if (!rows[0]) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
  await audit(req, 'PRODUCT_UPDATED', 'PRODUCT', id, Object.fromEntries(pairs));
  res.json({ product: rows[0] });
});

router.post('/expenses', async (req, res) => {
  const { category, description, amountIdr, occurredAt } = req.body ?? {};
  if (!category || !description || !Number.isSafeInteger(Number(amountIdr)) || Number(amountIdr) <= 0) {
    return res.status(400).json({ error: 'INVALID_EXPENSE_INPUT' });
  }
  const { rows } = await pool.query(
    `INSERT INTO operating_expenses (category,description,amount_idr,occurred_at,created_by_telegram_user_id)
     VALUES ($1,$2,$3,COALESCE($4::timestamptz,NOW()),$5) RETURNING *`,
    [category, description, Number(amountIdr), occurredAt ?? null, String(req.telegramUser.id)]
  );
  await audit(req, 'EXPENSE_CREATED', 'EXPENSE', rows[0].id, { category, amountIdr: Number(amountIdr) });
  res.status(201).json({ expense: rows[0] });
});

router.get('/inventory', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id AS product_id,p.name,p.sku,
      COUNT(i.id) FILTER (WHERE i.status='AVAILABLE')::int AS available,
      COUNT(i.id) FILTER (WHERE i.status='RESERVED')::int AS reserved,
      COUNT(i.id) FILTER (WHERE i.status='SOLD')::int AS sold,
      COUNT(i.id) FILTER (WHERE i.status='UNAVAILABLE')::int AS unavailable
     FROM products p LEFT JOIN inventory_items i ON i.product_id=p.id
     GROUP BY p.id ORDER BY p.name`
  );
  res.json({ inventory: rows });
});

router.post('/products/:id/inventory', async (req, res) => {
  const productId = Number(req.params.id);
  let payloads;
  try {
    payloads = (Array.isArray(req.body?.payloads) ? req.body.payloads : [req.body?.payload]).map(assertAllowedDigitalPayload);
  } catch (error) {
    return res.status(400).json({ error: 'INVALID_ASSET_PAYLOAD', message: error.message });
  }
  if (!Number.isSafeInteger(productId) || payloads.length < 1 || payloads.length > 100) {
    return res.status(400).json({ error: 'INVALID_INVENTORY_INPUT' });
  }
  const { rows: productRows } = await pool.query(`SELECT id FROM products WHERE id=$1`, [productId]);
  if (!productRows[0]) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query('BEGIN');
    for (const payload of payloads) {
      const encrypted = encryptPayload(payload);
      const { rows } = await client.query(
        `INSERT INTO inventory_items (product_id, payload_ciphertext, payload_nonce, payload_tag)
         VALUES ($1,$2,$3,$4) RETURNING id,status,created_at`,
        [productId, encrypted.payload_ciphertext, encrypted.payload_nonce, encrypted.payload_tag]
      );
      inserted.push(rows[0]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  await audit(req, 'INVENTORY_ADDED', 'PRODUCT', productId, { count: inserted.length });
  res.status(201).json({ inserted: inserted.length, items: inserted });
});

router.post('/orders/:orderNumber/refund', async (req, res) => {
  const orderNumber = String(req.params.orderNumber || '').trim();
  const reason = String(req.body?.reason || '').trim();
  if (!orderNumber || reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ error: 'INVALID_REFUND_REQUEST' });
  }

  let refund;
  const prepare = await pool.connect();
  try {
    await prepare.query('BEGIN');
    const { rows } = await prepare.query(
      `SELECT o.id, o.order_number, o.status, c.telegram_user_id,
              t.id AS transaction_id, t.telegram_payment_charge_id, t.status AS transaction_status
       FROM orders o
       JOIN customers c ON c.id=o.customer_id
       JOIN transactions t ON t.order_id=o.id
       WHERE o.order_number=$1
       ORDER BY t.id DESC LIMIT 1 FOR UPDATE OF o,t`, [orderNumber]
    );
    const order = rows[0];
    if (!order) {
      await prepare.query('ROLLBACK');
      return res.status(404).json({ error: 'ORDER_OR_PAYMENT_NOT_FOUND' });
    }
    if (order.status === 'REFUNDED' || order.transaction_status === 'REFUNDED') {
      await prepare.query('ROLLBACK');
      return res.status(409).json({ error: 'ORDER_ALREADY_REFUNDED' });
    }
    if (!['PAID','FULFILLING','FULFILLED','REFUND_PENDING'].includes(order.status)) {
      await prepare.query('ROLLBACK');
      return res.status(409).json({ error: 'ORDER_NOT_REFUNDABLE' });
    }
    if (!['PAID','REFUND_PENDING'].includes(order.transaction_status) || !order.telegram_payment_charge_id) {
      await prepare.query('ROLLBACK');
      return res.status(409).json({ error: 'PAYMENT_NOT_REFUNDABLE' });
    }

    await prepare.query(
      `UPDATE transactions SET status='REFUND_PENDING' WHERE id=$1 AND status IN ('PAID','REFUND_PENDING')`,
      [order.transaction_id]
    );
    await prepare.query(`UPDATE orders SET status='REFUND_PENDING' WHERE id=$1`, [order.id]);
    await prepare.query(
      `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES ($1,'STARS_REFUND_REQUESTED','ORDER',$2,$3)`,
      [String(req.telegramUser.id), String(order.id), JSON.stringify({ orderNumber, reason, telegramPaymentChargeId: order.telegram_payment_charge_id })]
    );
    await prepare.query('COMMIT');
    refund = {
      id: order.id,
      orderNumber: order.order_number,
      userId: order.telegram_user_id,
      transactionId: order.transaction_id,
      telegramPaymentChargeId: order.telegram_payment_charge_id
    };
  } catch (error) {
    await prepare.query('ROLLBACK');
    console.error('[refund-prepare-error]', error.message);
    return res.status(500).json({ error: 'REFUND_PREPARATION_FAILED' });
  } finally {
    prepare.release();
  }

  try {
    const confirmed = await refundStarPayment({
      userId: refund.userId,
      telegramPaymentChargeId: refund.telegramPaymentChargeId
    });
    if (confirmed !== true) throw new Error('Telegram did not confirm the Stars refund.');
  } catch (error) {
    try {
      await audit(req, 'STARS_REFUND_ATTEMPT_FAILED', 'ORDER', refund.id, {
        orderNumber, reason, error: String(error.message || 'Refund outcome unknown').slice(0, 300)
      });
    } catch {}
    console.error('[refund-reconciliation-required]', String(error.message || 'unknown').slice(0, 300));
    return res.status(502).json({
      error: 'REFUND_RECONCILIATION_REQUIRED',
      message: 'Hasil refund belum dapat dikonfirmasi. Pesanan ditahan pada REFUND_PENDING; tindakan ini aman untuk dicoba kembali setelah pemeriksaan ledger Telegram.'
    });
  }

  const finalize = await pool.connect();
  try {
    await finalize.query('BEGIN');
    const { rows } = await finalize.query(
      `SELECT o.id,o.status,t.id AS transaction_id,t.status AS transaction_status
       FROM orders o JOIN transactions t ON t.order_id=o.id
       WHERE o.id=$1 AND t.id=$2 FOR UPDATE OF o,t`,
      [refund.id, refund.transactionId]
    );
    const current = rows[0];
    if (!current) throw new Error('REFUND_LEDGER_RECORD_NOT_FOUND');
    if (current.status === 'REFUNDED' || current.transaction_status === 'REFUNDED') {
      await finalize.query('COMMIT');
      return res.json({ ok: true, orderNumber, status: 'REFUNDED', alreadyFinalized: true });
    }
    if (current.status !== 'REFUND_PENDING' || current.transaction_status !== 'REFUND_PENDING') {
      throw new Error('REFUND_STATE_CHANGED_BEFORE_FINALIZATION');
    }
    await finalize.query(`UPDATE transactions SET status='REFUNDED' WHERE id=$1`, [refund.transactionId]);
    await finalize.query(`UPDATE orders SET status='REFUNDED' WHERE id=$1`, [refund.id]);
    await finalize.query(
      `UPDATE deliveries SET status='REVOKED', last_error=$2
       WHERE order_id=$1 AND status IN ('PENDING','READY','FAILED','REVIEW_REQUIRED')`,
      [refund.id, 'Refunded by owner: ' + reason]
    );
    await finalize.query(
      `UPDATE inventory_items SET status='AVAILABLE', reserved_order_id=NULL, reserved_until=NULL
       WHERE reserved_order_id=$1 AND status='RESERVED'`,
      [refund.id]
    );
    await finalize.query(
      `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES ($1,'STARS_REFUND_ISSUED','ORDER',$2,$3)`,
      [String(req.telegramUser.id), String(refund.id), JSON.stringify({ orderNumber, reason, telegramPaymentChargeId: refund.telegramPaymentChargeId })]
    );
    await finalize.query('COMMIT');
    return res.json({ ok: true, orderNumber, status: 'REFUNDED' });
  } catch (error) {
    await finalize.query('ROLLBACK');
    console.error('[refund-finalize-error]', error.message);
    return res.status(503).json({
      error: 'REFUND_LEDGER_RECONCILIATION_REQUIRED',
      message: 'Telegram telah mengonfirmasi refund, tetapi ledger database belum berhasil diperbarui. Jalankan ulang rekonsiliasi refund untuk menyelesaikan status.'
    });
  } finally {
    finalize.release();
  }
});

router.post('/orders/:orderNumber/retry-delivery', async (req, res) => {
  const orderNumber = String(req.params.orderNumber || '').trim();
  const { rows } = await pool.query(
    `SELECT id,status FROM orders WHERE order_number=$1`, [orderNumber]
  );
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  if (!['PAID','FULFILLING'].includes(order.status)) {
    return res.status(409).json({ error: 'ORDER_NOT_PENDING_FULFILLMENT' });
  }
  const result = await deliverPaidOrder(orderNumber);
  await audit(req, 'DELIVERY_RETRY_REQUESTED', 'ORDER', order.id, result);
  res.json({ ok: true, orderNumber, ...result });
});

router.get('/orders', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT o.order_number,o.status,o.total_xtr,o.total_sale_idr,o.total_cost_idr,o.created_at,o.paid_at,o.fulfilled_at,
      c.telegram_user_id,c.username,
      COALESCE((SELECT json_agg(json_build_object('name',oi.product_name_snapshot,'quantity',oi.quantity,
       'unit_cost_idr',oi.unit_cost_idr,'unit_sale_xtr',oi.unit_sale_xtr,'unit_sale_idr',oi.unit_sale_idr))
       FROM order_items oi WHERE oi.order_id=o.id),'[]') AS items,
      COALESCE((SELECT json_agg(json_build_object('id',d.id,'status',d.status,'last_error',d.last_error,
       'inventory_item_id',d.inventory_item_id) ORDER BY d.id) FROM deliveries d WHERE d.order_id=o.id),'[]') AS deliveries
     FROM orders o JOIN customers c ON c.id=o.customer_id
     ORDER BY o.created_at DESC LIMIT 200`
  );
  res.json({ orders: rows });
});

router.post('/deliveries/:id/reconcile', async (req, res) => {
  const deliveryId = Number(req.params.id);
  const outcome = String(req.body?.outcome || '').toUpperCase();
  const reason = String(req.body?.reason || '').trim();
  const messageId = req.body?.telegramMessageId == null ? null : Number(req.body.telegramMessageId);
  if (!Number.isSafeInteger(deliveryId) || deliveryId <= 0 || !['DELIVERED','NOT_DELIVERED'].includes(outcome)
      || reason.length < 3 || reason.length > 500
      || (messageId != null && (!Number.isSafeInteger(messageId) || messageId <= 0))) {
    return res.status(400).json({ error: 'INVALID_DELIVERY_RECONCILIATION' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT d.id,d.order_id,d.inventory_item_id,d.status,o.order_number,i.status AS inventory_status,i.reserved_order_id
       FROM deliveries d JOIN orders o ON o.id=d.order_id
       JOIN inventory_items i ON i.id=d.inventory_item_id WHERE d.id=$1 FOR UPDATE OF d,o,i`,
      [deliveryId]
    );
    const delivery = rows[0];
    if (!delivery) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'DELIVERY_NOT_FOUND' }); }
    if (delivery.status !== 'REVIEW_REQUIRED') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'DELIVERY_NOT_REQUIRES_REVIEW' }); }
    if (String(delivery.reserved_order_id) !== String(delivery.order_id) || delivery.inventory_status !== 'RESERVED') {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'INVENTORY_RESERVATION_NOT_OWNED_BY_ORDER' });
    }
    if (outcome === 'DELIVERED') {
      const stock = await client.query(
        `UPDATE inventory_items SET status='SOLD',sold_at=NOW(),reserved_order_id=NULL,reserved_until=NULL
         WHERE id=$1 AND status='RESERVED' AND reserved_order_id=$2 RETURNING id`,
        [delivery.inventory_item_id, delivery.order_id]
      );
      if (!stock.rowCount) throw new Error('INVENTORY_RESERVATION_NOT_OWNED_BY_ORDER');
      await client.query(
        `UPDATE deliveries SET status='DELIVERED',telegram_message_id=$2,delivered_at=NOW(),last_error=NULL WHERE id=$1`,
        [deliveryId,messageId]
      );
    } else {
      await client.query(`UPDATE deliveries SET status='FAILED',last_error=$2 WHERE id=$1`,
        [deliveryId, 'Owner confirmed not delivered: ' + reason]);
    }
    await client.query(
      `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,'DELIVERY',$3,$4)`,
      [String(req.telegramUser.id), outcome === 'DELIVERED' ? 'DELIVERY_RECONCILED_DELIVERED' : 'DELIVERY_RECONCILED_NOT_DELIVERED',
       String(deliveryId), JSON.stringify({ orderNumber: delivery.order_number, reason, telegramMessageId: messageId })]
    );
    const { rows: remaining } = await client.query(
      `SELECT COUNT(*)::int AS count FROM deliveries WHERE order_id=$1 AND status <> 'DELIVERED'`, [delivery.order_id]
    );
    if (remaining[0].count === 0) await client.query(
      `UPDATE orders SET status='FULFILLED',fulfilled_at=NOW() WHERE id=$1 AND status IN ('PAID','FULFILLING','REFUND_PENDING')`,
      [delivery.order_id]
    );
    await client.query('COMMIT');
    return res.json({ ok: true, deliveryId, outcome });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[delivery-reconcile-error]', error.message);
    return res.status(500).json({ error: 'DELIVERY_RECONCILIATION_FAILED' });
  } finally { client.release(); }
});
async function audit(req, action, entityType, entityId, metadata) {
  await pool.query(
    `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
     VALUES ($1,$2,$3,$4,$5)`,
    [String(req.telegramUser.id), action, entityType, String(entityId), JSON.stringify(metadata)]
  );
}
export default router;
