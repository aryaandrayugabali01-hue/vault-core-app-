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
      FROM orders WHERE status IN ('PAID','FULFILLING','FULFILLED')`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='AVAILABLE')::int AS available,
      COUNT(*) FILTER (WHERE status='RESERVED')::int AS reserved,
      COUNT(*) FILTER (WHERE status='SOLD')::int AS sold FROM inventory_items`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='PENDING_PAYMENT')::int AS pending,
      COUNT(*) FILTER (WHERE status='FULFILLED')::int AS fulfilled FROM orders`),
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
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
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ORDER_OR_PAYMENT_NOT_FOUND' });
    }
    if (order.status === 'REFUNDED' || order.transaction_status === 'REFUNDED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ORDER_ALREADY_REFUNDED' });
    }
    if (order.status !== 'PAID' && order.status !== 'FULFILLING' && order.status !== 'FULFILLED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ORDER_NOT_REFUNDABLE' });
    }
    if (order.transaction_status !== 'PAID' || !order.telegram_payment_charge_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'PAYMENT_NOT_REFUNDABLE' });
    }

    await refundStarPayment({
      userId: order.telegram_user_id,
      telegramPaymentChargeId: order.telegram_payment_charge_id
    });
    await client.query(`UPDATE transactions SET status='REFUNDED' WHERE id=$1`, [order.transaction_id]);
    await client.query(`UPDATE orders SET status='REFUNDED' WHERE id=$1`, [order.id]);
    await client.query(
      `UPDATE deliveries SET status='REVOKED', last_error=$2
       WHERE order_id=$1 AND status IN ('PENDING','READY','FAILED')`,
      [order.id, `Refunded by owner: ${reason}`]
    );
    await client.query(
      `UPDATE inventory_items SET status='AVAILABLE', reserved_until=NULL
       WHERE id IN (SELECT inventory_item_id FROM deliveries WHERE order_id=$1 AND status='REVOKED')
         AND status='RESERVED'`, [order.id]
    );
    await client.query(
      `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES ($1,'STARS_REFUND_ISSUED','ORDER',$2,$3)`,
      [String(req.telegramUser.id), String(order.id), JSON.stringify({ orderNumber, reason })]
    );
    await client.query('COMMIT');
    return res.json({ ok: true, orderNumber, status: 'REFUNDED' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[refund-error]', error.message);
    return res.status(502).json({ error: 'REFUND_FAILED', message: 'Telegram Stars refund gagal. Status order tidak diubah.' });
  } finally {
    client.release();
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
      COALESCE(json_agg(json_build_object('name',oi.product_name_snapshot,'quantity',oi.quantity,
       'unit_cost_idr',oi.unit_cost_idr,'unit_sale_xtr',oi.unit_sale_xtr,'unit_sale_idr',oi.unit_sale_idr)) FILTER (WHERE oi.id IS NOT NULL),'[]') items
     FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN order_items oi ON oi.order_id=o.id
     GROUP BY o.id,c.id ORDER BY o.created_at DESC LIMIT 200`
  );
  res.json({ orders: rows });
});

async function audit(req, action, entityType, entityId, metadata) {
  await pool.query(
    `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
     VALUES ($1,$2,$3,$4,$5)`,
    [String(req.telegramUser.id), action, entityType, String(entityId), JSON.stringify(metadata)]
  );
}
export default router;
