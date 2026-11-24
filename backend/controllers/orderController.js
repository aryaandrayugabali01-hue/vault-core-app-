import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { sendStarsInvoice } from '../services/telegramApi.js';
import { isEligibleCheckoutProduct, isCatalogOnDemandProduct } from '../services/catalogService.js';
import { assertAllowedDigitalPayload, encryptPayload } from '../utils/encryption.js';
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
      `SELECT p.*,rr.id AS review_id,rr.review_status,rr.valid_until,rr.owner_attested
       FROM products p
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
      const onDemand = !testMode && isCatalogOnDemandProduct(product);
      let stockRows;
      if (onDemand) {
        // An active catalog listing represents on-demand fulfillment capacity.
        // A unique internal placeholder is created per paid-order unit below.
        stockRows = Array.from({ length:item.quantity }, (_, unitIndex) => ({ onDemand:true, unitIndex }));
      } else {
        const stockParams = testMode
          ? [item.productId,item.quantity]
          : [item.productId,item.quantity,product.current_rights_review_id];
        const result = await client.query(
          `SELECT id FROM inventory_items
           WHERE product_id=$1 AND status='AVAILABLE'
             AND reserved_order_id IS NULL AND reserved_until IS NULL
             AND ${testMode ? 'TRUE' : 'rights_review_id=$3 AND source_reference IS NOT NULL'}
           ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED`,
          stockParams
        );
        stockRows = result.rows;
        if(stockRows.length<item.quantity) {
          throw Object.assign(new Error('Stok tidak mencukupi untuk '+product.name+'.'),{status:409});
        }
      }
      totalXtr += Number(product.sale_price_xtr)*item.quantity;
      totalCostXtr += Number(product.cost_price_xtr)*item.quantity;
      reservedLines.push({item,product,stockRows,onDemand});
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
      const {item,product,stockRows}=line;
      await client.query(
        `INSERT INTO order_items (order_id,product_id,quantity,unit_sale_xtr,unit_cost_xtr,product_name_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id,product.id,item.quantity,product.sale_price_xtr,product.cost_price_xtr,product.name]
      );
      for(const stock of stockRows) {
        let inventoryItemId;
        if (line.onDemand) {
          const unitReference = `${orderNumber}:${product.sku}:${stock.unitIndex + 1}`;
          const encrypted = encryptPayload(assertAllowedDigitalPayload(
            'VAULT_CORE_ON_DEMAND_FULFILLMENT_PENDING|' + unitReference
          ));
          const placeholder = await client.query(
            `INSERT INTO inventory_items
             (product_id,payload_ciphertext,payload_nonce,payload_tag,status,
              reserved_order_id,reserved_until,rights_review_id,source_reference)
             VALUES ($1,$2,$3,$4,'RESERVED',$5,NOW()+INTERVAL '15 minutes',$6,$7)
             RETURNING id`,
            [
              product.id,encrypted.payload_ciphertext,encrypted.payload_nonce,encrypted.payload_tag,
              order.id,product.current_rights_review_id,
              'VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:ON_DEMAND_ORDER:' + unitReference
            ]
          );
          inventoryItemId = placeholder.rows[0].id;
        } else {
          const reservation=await client.query(
            `UPDATE inventory_items
             SET status='RESERVED',reserved_order_id=$2,reserved_until=NOW()+INTERVAL '15 minutes'
             WHERE id=$1 AND status='AVAILABLE' AND reserved_order_id IS NULL
             RETURNING id`,
            [stock.id,order.id]
          );
          if(!reservation.rowCount) throw new Error('INVENTORY_RESERVATION_CONFLICT');
          inventoryItemId = stock.id;
        }
        await client.query(
          `INSERT INTO deliveries (order_id,inventory_item_id,idempotency_key)
           VALUES ($1,$2,$3)`,
          [order.id,inventoryItemId,`${orderNumber}:${inventoryItemId}`]
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
        `UPDATE inventory_items
         SET status=CASE WHEN source_reference LIKE 'VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:ON_DEMAND_ORDER:%'
                          THEN 'UNAVAILABLE' ELSE 'AVAILABLE' END,
             reserved_order_id=NULL,reserved_until=NULL
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
            o.buyer_completed_at, o.warranty_started_at, o.warranty_expires_at,
            MAX(wc.claim_number) AS warranty_claim_number,
            MAX(wc.status) AS warranty_claim_status,
            MAX(wc.sla_due_at) AS warranty_claim_sla_due_at,
            COALESCE(json_agg(json_build_object('name', oi.product_name_snapshot, 'quantity', oi.quantity))
              FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id=o.id
     LEFT JOIN order_warranty_claims wc ON wc.order_id=o.id
     WHERE o.customer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50`,
    [req.customer.id]
  );
  res.json({ orders: rows });
}


export async function confirmOrderReceived(req, res) {
  const orderNumber = String(req.params.orderNumber || '').trim();
  if (!orderNumber) return res.status(400).json({ error:'INVALID_ORDER_NUMBER' });
  const { rows } = await pool.query(
    `UPDATE orders
     SET buyer_completed_at=COALESCE(buyer_completed_at,NOW()),
         warranty_started_at=COALESCE(warranty_started_at,NOW()),
         warranty_expires_at=COALESCE(warranty_expires_at,NOW()+INTERVAL '14 days')
     WHERE order_number=$1 AND customer_id=$2 AND status='FULFILLED'
     RETURNING order_number,buyer_completed_at,warranty_started_at,warranty_expires_at`,
    [orderNumber,req.customer.id]
  );
  if (!rows[0]) {
    const existing = await pool.query(
      'SELECT status FROM orders WHERE order_number=$1 AND customer_id=$2',
      [orderNumber,req.customer.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error:'ORDER_NOT_FOUND' });
    return res.status(409).json({ error:'ORDER_NOT_READY_FOR_CUSTOMER_CONFIRMATION', message:'Pesanan belum tercatat selesai dipenuhi oleh VAULT CORE.' });
  }
  return res.json({ ok:true, ...rows[0], warrantyDays:14 });
}

export async function createWarrantyClaim(req, res) {
  const orderNumber = String(req.params.orderNumber || '').trim();
  const description = String(req.body?.description || '').trim();
  const rawEvidence = Array.isArray(req.body?.evidenceUrls) ? req.body.evidenceUrls : [];
  const evidenceUrls = rawEvidence.map((value) => String(value || '').trim()).filter(Boolean);
  if (!orderNumber || description.length < 10 || description.length > 3000
      || evidenceUrls.length < 1 || evidenceUrls.length > 8
      || evidenceUrls.some((value) => {
        try { return new URL(value).protocol !== 'https:'; } catch { return true; }
      })) {
    return res.status(400).json({ error:'INVALID_WARRANTY_CLAIM', message:'Isi kronologi minimal 10 karakter dan lampirkan 1–8 URL bukti HTTPS.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows:orders } = await client.query(
      `SELECT id,order_number,warranty_started_at,warranty_expires_at
       FROM orders
       WHERE order_number=$1 AND customer_id=$2 AND status='FULFILLED'
         AND buyer_completed_at IS NOT NULL
         AND warranty_started_at IS NOT NULL
         AND warranty_expires_at >= NOW()
       FOR UPDATE`,
      [orderNumber,req.customer.id]
    );
    const order = orders[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error:'WARRANTY_NOT_ACTIVE', message:'Masa garansi belum dimulai atau sudah berakhir.' });
    }
    const claimNumber = `VCW-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { rows } = await client.query(
      `INSERT INTO order_warranty_claims
       (claim_number,order_id,customer_id,description,evidence_urls,sla_due_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,NOW()+INTERVAL '48 hours')
       RETURNING claim_number,status,submitted_at,sla_due_at`,
      [claimNumber,order.id,req.customer.id,description,JSON.stringify(evidenceUrls)]
    );
    await client.query('COMMIT');
    return res.status(201).json({ ok:true, ...rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error:'WARRANTY_CLAIM_ALREADY_SUBMITTED', message:'Klaim untuk pesanan ini sudah tercatat.' });
    console.error('[warranty-claim-create-error]', error.message);
    return res.status(500).json({ error:'WARRANTY_CLAIM_CREATE_FAILED' });
  } finally {
    client.release();
  }
}
