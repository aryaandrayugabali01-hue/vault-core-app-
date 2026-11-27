import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { sendStarsInvoice } from '../services/telegramApi.js';
import { isEligibleCheckoutProduct } from '../services/catalogService.js';
import { isRightsReviewUsable } from '../services/rightsReviewService.js';
import { normalizeCartItems } from '../services/cartService.js';
import { releaseExpiredPendingOrders } from '../services/reservationService.js';

export async function createOrder(req, res, { testMode = false } = {}) {
  const normalized = normalizeCartItems(req.body ?? {}, { testMode });
  if (!normalized.ok) return res.status(400).json({ error:normalized.error });
  const cartItems = normalized.value.items;

  const client = await pool.connect();
  let order;
  try {
    await client.query('BEGIN');
    await releaseExpiredPendingOrders(client);

    const ids = cartItems.map((item) => item.productId);
    const { rows: products } = await client.query(
      `SELECT p.*,mc.slug AS marketplace_category_slug,v.kategori_produk AS variant_category,rr.id AS review_id,rr.review_status,rr.valid_until,rr.owner_attested
       FROM products p
       LEFT JOIN marketplace_categories mc ON mc.id=p.marketplace_category_id
       LEFT JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id
       LEFT JOIN product_rights_reviews rr ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
       WHERE p.id=ANY($1::bigint[]) AND p.status='ACTIVE'
         AND ${testMode ? 'p.is_test=TRUE' : 'COALESCE(p.is_test,FALSE)=FALSE'}
       ORDER BY p.id FOR UPDATE OF p`,
      [ids]
    );
    if (products.length !== cartItems.length) {
      throw Object.assign(new Error('Satu atau beberapa produk tidak tersedia.'),{status:404});
    }
    const productById = new Map(products.map((product)=>[Number(product.id),product]));
    const reservedLines = [];
    let totalXtr = 0;
    let totalCostXtr = 0;

    for (const item of cartItems) {
      const product = productById.get(item.productId);
      if (!isEligibleCheckoutProduct(product,{testMode,ownerAuthorized:testMode})
          || (!testMode && !isRightsReviewUsable({
            id:product?.review_id,review_status:product?.review_status,
            valid_until:product?.valid_until,owner_attested:product?.owner_attested
          }))) {
        throw Object.assign(new Error('Produk tidak tersedia atau pemeriksaan internal Owner sudah kedaluwarsa.'),{status:404});
      }
      const customerFields=Array.isArray(product.customer_input_fields)?product.customer_input_fields:[];
      const submittedInput=item.customerInput||{};
      const allowedLabels=new Set(customerFields.map((field)=>String(field?.label||'').trim()));
      if(Object.keys(submittedInput).some((label)=>!allowedLabels.has(label)))throw Object.assign(new Error('Data pelanggan tidak sesuai dengan field produk.'),{status:400});
      const customerInputSnapshot={};
      for(const field of customerFields){
        const label=String(field?.label||'').trim(),value=String(submittedInput[label]??'').trim();
        if(field.required===true&&!value)throw Object.assign(new Error('Lengkapi data: '+label+'.'),{status:400});
        if(value.length>Math.min(240,Number(field.maxLength||240)))throw Object.assign(new Error('Data '+label+' terlalu panjang.'),{status:400});
        if(value)customerInputSnapshot[label]=value;
      }
      const sensitiveLabel=/(login|password|sandi|otp|session|recovery|backup|token|credential|email|username|cookie)/i;
      if(Object.keys(customerInputSnapshot).some((label)=>sensitiveLabel.test(label)))throw Object.assign(new Error('Field kredensial autentikasi tidak diperbolehkan.'),{status:400});
      const stockParams = testMode
        ? [item.productId,item.quantity]
        : [item.productId,item.quantity,product.current_rights_review_id];
      const {rows:stockRows}=await client.query(
        `SELECT i.id FROM inventory_items i
         WHERE i.product_id=$1 AND i.status='AVAILABLE'
           AND i.reserved_order_id IS NULL AND i.reserved_until IS NULL
           AND ${testMode ? 'TRUE' : 'i.rights_review_id=$3 AND i.source_reference IS NOT NULL'}

         ORDER BY i.id LIMIT $2 FOR UPDATE SKIP LOCKED`,
        stockParams
      );
      if(stockRows.length<item.quantity) {
        throw Object.assign(new Error('Stok tidak mencukupi untuk '+product.name+'.'),{status:409});
      }
      totalXtr += Number(product.sale_price_xtr)*item.quantity;
      totalCostXtr += Number(product.cost_price_xtr)*item.quantity;
      reservedLines.push({item,product,stockRows,customerInputSnapshot});
    }

    if (!Number.isSafeInteger(totalXtr) || totalXtr<=0 || totalXtr>2147483647
        || !Number.isSafeInteger(totalCostXtr) || totalCostXtr<0) {
      throw Object.assign(new Error('Total pesanan berada di luar batas transaksi.'),{status:400});
    }
    const orderNumber=`VC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const {rows:orderRows}=await client.query(
      `INSERT INTO orders (order_number,customer_id,total_xtr,total_cost_xtr)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [orderNumber,req.customer.id,totalXtr,totalCostXtr]
    );
    order=orderRows[0];

    for(const line of reservedLines) {
      const {item,product,stockRows,customerInputSnapshot}=line;
      const accountAvailability = product.variant_category === 'Akun'
        ? (product.availability_mode === 'INDENT' ? 'INDENT' : 'READY')
        : 'READY';
      const indentDays = accountAvailability === 'INDENT' ? Number(product.indent_deadline_days) : null;
      await client.query(
        \`INSERT INTO order_items
          (order_id,product_id,quantity,unit_sale_xtr,unit_cost_xtr,product_name_snapshot,
           availability_mode_snapshot,indent_deadline_days_snapshot,customer_input_snapshot,is_account_snapshot,fulfillment_deadline_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,NULL)\`,
        [order.id,product.id,item.quantity,product.sale_price_xtr,product.cost_price_xtr,product.name,
         accountAvailability,indentDays,JSON.stringify(customerInputSnapshot),product.variant_category === 'Akun']
      );
      for(const stock of stockRows) {
        const reservation=await client.query(
          `UPDATE inventory_items
           SET status='RESERVED',reserved_order_id=$2,reserved_until=NOW()+INTERVAL '15 minutes'
           WHERE id=$1 AND status='AVAILABLE' AND reserved_order_id IS NULL
           RETURNING id`,
          [stock.id,order.id]
        );
        if(!reservation.rowCount) throw new Error('INVENTORY_RESERVATION_CONFLICT');
        await client.query(
          `INSERT INTO deliveries (order_id,inventory_item_id,idempotency_key)
           VALUES ($1,$2,$3)`,
          [order.id,stock.id,`${orderNumber}:${stock.id}`]
        );
      }
    }
    await client.query('COMMIT');
  } catch(error) {
    await client.query('ROLLBACK');
    return res.status(error.status??500).json({
      error:error.status?'ORDER_REJECTED':'ORDER_CREATE_FAILED',
      message:error.status?error.message:'Pesanan tidak dapat dibuat saat ini.'
    });
  } finally { client.release(); }

  try {
    const invoiceUrl=await sendStarsInvoice({
      orderNumber:order.order_number,
      title:`VAULT CORE ${order.order_number}`,
      description:'Pembayaran pesanan produk digital VAULT CORE.',
      amount:Number(order.total_xtr)
    });
    res.status(201).json({orderNumber:order.order_number,totalXtr:Number(order.total_xtr),invoiceUrl});
  } catch {
    const cleanup=await pool.connect();
    try {
      await cleanup.query('BEGIN');
      await cleanup.query(`UPDATE orders SET status='FAILED' WHERE id=$1 AND status='PENDING_PAYMENT'`,[order.id]);
      await cleanup.query(
        `UPDATE deliveries SET status='REVOKED',last_error='Invoice creation failed; reservation released.'
         WHERE order_id=$1 AND status IN ('PENDING','READY','FAILED','REVIEW_REQUIRED')`,
        [order.id]
      );
      await cleanup.query(
        `UPDATE inventory_items SET status='AVAILABLE',reserved_order_id=NULL,reserved_until=NULL
         WHERE status='RESERVED' AND reserved_order_id=$1`,
        [order.id]
      );
      await cleanup.query('COMMIT');
    } catch { await cleanup.query('ROLLBACK'); }
    finally { cleanup.release(); }
    res.status(502).json({error:'INVOICE_CREATE_FAILED',message:'Tagihan Telegram Stars tidak dapat dibuat. Silakan coba kembali.'});
  }
}

export async function getMyOrders(req, res) {
  await releaseExpiredPendingOrders();
  const { rows } = await pool.query(
    `SELECT o.order_number, o.status, o.total_xtr, o.created_at, o.paid_at, o.fulfilled_at,
            COALESCE(json_agg(json_build_object(
              'orderItemId',oi.id,'name',oi.product_name_snapshot,'quantity',oi.quantity,
              'category',v.kategori_produk,
              'customerInputs',oi.customer_input_snapshot,
              'availabilityMode',oi.availability_mode_snapshot,
              'indentDeadlineDays',oi.indent_deadline_days_snapshot,
              'fulfillmentDeadlineAt',oi.fulfillment_deadline_at
            )) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id=o.id
     LEFT JOIN products p ON p.id=oi.product_id
     LEFT JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id
     WHERE o.customer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50`,
    [req.customer.id]
  );
  res.json({ orders: rows });
}
