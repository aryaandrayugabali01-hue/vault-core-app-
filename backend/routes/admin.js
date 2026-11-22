import { Router } from 'express';
import { pool } from '../db/pool.js';
import { encryptPayload, assertAllowedDigitalPayload } from '../utils/encryption.js';
import { validateRightsReviewInput, isRightsReviewUsable, canAddProductInventory } from '../services/rightsReviewService.js';
import { isSafeProductImageUrl, normalizeProductText } from '../services/productDetailsService.js';
import { refundStarPayment } from '../services/telegramApi.js';
import { deliverPaidOrder, canReconcileDelivery } from '../services/deliveryService.js';
const router = Router();

router.get('/dashboard', async (_req, res) => {
  const [sales, inventory, orders, expenses] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS paid_orders, COALESCE(SUM(total_xtr),0)::bigint AS gross_xtr,
      COALESCE(SUM(total_cost_xtr),0)::bigint AS cost_xtr
      FROM orders WHERE status IN ('PAID','FULFILLING','FULFILLED','REFUND_PENDING')`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='AVAILABLE')::int AS available,
      COUNT(*) FILTER (WHERE status='RESERVED')::int AS reserved,
      COUNT(*) FILTER (WHERE status='SOLD')::int AS sold FROM inventory_items`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='PENDING_PAYMENT')::int AS pending,
      COUNT(*) FILTER (WHERE status='FULFILLED')::int AS fulfilled,
      COUNT(*) FILTER (WHERE status='REFUND_PENDING')::int AS refund_pending FROM orders`),
    pool.query(`SELECT COALESCE(SUM(amount_xtr),0)::bigint AS expenses_xtr FROM operating_expenses`)
  ]);
  const expensesXtr = Number(expenses.rows[0].expenses_xtr);
  const grossXtr = Number(sales.rows[0].gross_xtr);
  const costXtr = Number(sales.rows[0].cost_xtr);
  res.json({ sales: sales.rows[0], inventory: inventory.rows[0], orders: orders.rows[0], expensesXtr,
    netProfitXtr: grossXtr - costXtr - expensesXtr, grossProfitXtr: grossXtr - costXtr });
});

router.get('/products', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, rr.review_status AS rights_review_status,
            rr.valid_until AS rights_valid_until, rr.reviewed_at AS rights_reviewed_at,
            rr.rights_basis, rr.publisher_platform,
            COUNT(i.id) FILTER (WHERE i.status='AVAILABLE'
              AND i.rights_review_id=p.current_rights_review_id
              AND i.source_reference IS NOT NULL
              AND rr.review_status='APPROVED' AND rr.owner_attested=TRUE
              AND rr.valid_until>NOW())::int AS actual_stock
     FROM products p
     LEFT JOIN product_rights_reviews rr
       ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
     LEFT JOIN inventory_items i ON i.product_id=p.id
     GROUP BY p.id,rr.id ORDER BY p.created_at DESC`
  );
  const products = rows.map((product) => ({
    ...product,
    rights_review_usable: product.rights_review_status === 'APPROVED'
      && product.rights_valid_until && new Date(product.rights_valid_until) > new Date()
  }));
  res.json({ products });
});

router.post('/products', async (req, res) => {
  const { sku, gameCategory, tier, name, description = '', fulfillmentType,
    salePriceXtr, costPriceXtr = 0, rightsReviewReference = null,
    imageUrl = null, customerTerms = '', fulfillmentEta = '' } = req.body ?? {};
  const normalizedSku = String(sku ?? '').trim().toUpperCase();
  const normalizedImageUrl = imageUrl == null || String(imageUrl).trim() === '' ? null : String(imageUrl).trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(normalizedSku)
      || !['MLBB','ROBLOX','FREE_FIRE','GENSHIN','OTHER'].includes(gameCategory)
      || !['SILVER','GOLD','PLATINUM','SERVICE'].includes(tier)
      || String(name ?? '').trim().length < 2 || String(name).trim().length > 160
      || !['REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','GIFT_CODE','DIGITAL_FILE','SERVICE_INSTRUCTIONS','GAME_ACCOUNT_TRANSFER'].includes(fulfillmentType)
      || !Number.isSafeInteger(Number(salePriceXtr)) || Number(salePriceXtr) <= 0
      || !Number.isSafeInteger(Number(costPriceXtr)) || Number(costPriceXtr) < 0
      || String(description ?? '').length > 5000
      || String(customerTerms ?? '').length > 5000
      || String(fulfillmentEta ?? '').length > 160
      || !isSafeProductImageUrl(normalizedImageUrl)) {
    return res.status(400).json({ error: 'INVALID_PRODUCT_INPUT' });
  }
  const { rows } = await pool.query(
    `INSERT INTO products (sku, game_category, tier, name, description, fulfillment_type,
      sale_price_xtr, cost_price_xtr, rights_review_reference, image_url, customer_terms, fulfillment_eta, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'DRAFT') RETURNING *`,
    [normalizedSku, gameCategory, tier, String(name).trim(), normalizeProductText(description, 5000),
      fulfillmentType, Number(salePriceXtr), Number(costPriceXtr), rightsReviewReference,
      normalizedImageUrl, normalizeProductText(customerTerms, 5000), normalizeProductText(fulfillmentEta, 160)]
  );
  await audit(req, 'PRODUCT_CREATED', 'PRODUCT', rows[0].id, { sku:normalizedSku });
  res.status(201).json({ product: rows[0] });
});

router.patch('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['sku','game_category','tier','name','description','fulfillment_type',
    'sale_price_xtr','cost_price_xtr','low_stock_threshold','display_stock_mode',
    'display_stock_override','status','rights_review_reference','image_url','customer_terms','fulfillment_eta'];
  const mapping = {
    sku:'sku', gameCategory:'game_category', tier:'tier', name:'name', description:'description',
    fulfillmentType:'fulfillment_type', salePriceXtr:'sale_price_xtr', costPriceXtr:'cost_price_xtr',
    lowStockThreshold:'low_stock_threshold', displayStockMode:'display_stock_mode',
    displayStockOverride:'display_stock_override', status:'status', rightsReviewReference:'rights_review_reference',
    imageUrl:'image_url', customerTerms:'customer_terms', fulfillmentEta:'fulfillment_eta'
  };
  const pairs = Object.entries(mapping).filter(([key]) => Object.hasOwn(req.body ?? {}, key));
  if (!Number.isSafeInteger(id) || id <= 0 || !pairs.length) return res.status(400).json({ error: 'INVALID_PRODUCT_UPDATE' });
  const values = [];
  const columns = [];
  for (const [key, column] of pairs) {
    let value = req.body[key];
    if (!allowed.includes(column)) return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    if (key === 'sku') {
      value = String(value ?? '').trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(value)) return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'gameCategory' && !['MLBB','ROBLOX','FREE_FIRE','GENSHIN','OTHER'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'tier' && !['SILVER','GOLD','PLATINUM','SERVICE'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'fulfillmentType' && !['REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','GIFT_CODE','DIGITAL_FILE','SERVICE_INSTRUCTIONS','GAME_ACCOUNT_TRANSFER'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'name') {
      value = String(value ?? '').trim();
      if (value.length < 2 || value.length > 160) return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'description' || key === 'customerTerms') {
      value = normalizeProductText(value, 5000);
    } else if (key === 'fulfillmentEta') {
      value = normalizeProductText(value, 160);
    } else if (key === 'imageUrl') {
      value = value == null || String(value).trim() === '' ? null : String(value).trim();
      if (!isSafeProductImageUrl(value)) return res.status(400).json({ error:'INVALID_PRODUCT_IMAGE_URL' });
    } else if (key === 'salePriceXtr' || key === 'costPriceXtr' || key === 'lowStockThreshold' || key === 'displayStockOverride') {
      if (value === null && key === 'displayStockOverride') {
        // NULL restores live stock display.
      } else {
        value = Number(value);
        if (!Number.isSafeInteger(value)
            || (key === 'salePriceXtr' && value <= 0)
            || (key !== 'salePriceXtr' && value < 0)) return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
      }
    } else if (key === 'displayStockMode' && !['EXACT_COUNT','IN_STOCK_ONLY','HIDE_COUNT'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'status' && !['DRAFT','PENDING_REVIEW','ACTIVE','PAUSED','ARCHIVED'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    }
    columns.push(column);
    values.push(value);
  }

  if (req.body.status === 'ACTIVE') {
    const { rows } = await pool.query(
      `SELECT p.id,p.is_test,p.fulfillment_type,p.current_rights_review_id,
              rr.id AS review_id,rr.review_status,rr.valid_until,rr.owner_attested,
              rr.rights_basis,rr.publisher_platform,rr.official_terms_url,
              rr.authorization_evidence_reference,rr.chain_of_title,rr.transfer_method,rr.region
       FROM products p LEFT JOIN product_rights_reviews rr
         ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
       WHERE p.id=$1`,
      [id]
    );
    const product = rows[0];
    if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
    if (product.is_test === true) {
      return res.status(409).json({
        error: 'TEST_FIXTURE_ACTIVATION_REQUIRED',
        message: 'Aktifkan produk contoh melalui jalur khusus ruang uji Owner.'
      });
    }
    if (!product.fulfillment_type || !isRightsReviewUsable({
      id: product.review_id, review_status: product.review_status,
      valid_until: product.valid_until, owner_attested: product.owner_attested
    })) {
      return res.status(409).json({
        error: 'PRODUCT_RIGHTS_REVIEW_REQUIRED',
        message: 'Aktivasi memerlukan pemeriksaan internal Owner berstatus APPROVED yang lengkap dan masih berlaku.'
      });
    }
    if ((product.rights_basis && !['OWNER_CREATED','OWNER_OWNED','SERVICE'].includes(product.rights_basis)
         || String(product.publisher_platform || '').toUpperCase() !== 'INTERNAL_OWNER')
        && !product.authorization_evidence_reference) {
      return res.status(409).json({ error: 'AUTHORIZATION_EVIDENCE_REFERENCE_REQUIRED' });
    }
    if (String(product.publisher_platform || '').toUpperCase() !== 'INTERNAL_OWNER'
        && !product.official_terms_url) {
      return res.status(409).json({ error: 'OFFICIAL_TERMS_URL_REQUIRED' });
    }
  }

  const client = await pool.connect();
  let updated;
  let fulfillmentChanged = false;
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT id,fulfillment_type,is_test FROM products WHERE id=$1 FOR UPDATE',[id]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error:'PRODUCT_NOT_FOUND' });
    }
    fulfillmentChanged = pairs.some(([key]) => key === 'fulfillmentType')
      && req.body.fulfillmentType !== current.rows[0].fulfillment_type;
    if (fulfillmentChanged && req.body.status === 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error:'PRODUCT_REVIEW_REQUIRED_AFTER_FULFILLMENT_CHANGE',
        message:'Perubahan metode pemenuhan memerlukan pemeriksaan CR-05 baru sebelum SKU dapat diaktifkan.'
      });
    }
    const assignments = columns.map((column, index) => `${column}=$${index + 1}`);
    if (fulfillmentChanged && current.rows[0].is_test !== true) {
      assignments.push("current_rights_review_id=NULL");
      assignments.push("status='PAUSED'");
      await client.query("UPDATE inventory_items SET status='UNAVAILABLE' WHERE product_id=$1 AND status='AVAILABLE'",[id]);
    }
    values.push(id);
    const result = await client.query(
      `UPDATE products SET ${assignments.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values
    );
    updated = result.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error:'PRODUCT_SKU_ALREADY_EXISTS', message:'SKU sudah digunakan produk lain.' });
    throw error;
  } finally {
    client.release();
  }
  if (!updated) return res.status(404).json({ error:'PRODUCT_NOT_FOUND' });
  await audit(req, 'PRODUCT_UPDATED', 'PRODUCT', id, { ...Object.fromEntries(pairs), fulfillmentReviewReset:fulfillmentChanged });
  res.json({ product:updated, fulfillmentReviewReset:fulfillmentChanged });
});

router.get('/products/:id/rights-review', async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ error: 'INVALID_PRODUCT_ID' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: productRows } = await client.query(
      'SELECT id,sku,is_test,status,current_rights_review_id FROM products WHERE id=$1 FOR UPDATE',
      [productId]
    );
    const product = productRows[0];
    if (!product) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' }); }

    if (product.current_rights_review_id) {
      const { rows: expired } = await client.query(
        `UPDATE product_rights_reviews
         SET review_status='EXPIRED'
         WHERE id=$1 AND product_id=$2 AND review_status='APPROVED' AND valid_until <= NOW()
         RETURNING id,review_status`,
        [product.current_rights_review_id, productId]
      );
      if (expired.length) {
        await client.query(
          `INSERT INTO product_rights_review_events
           (product_id,rights_review_id,event_type,previous_status,new_status,actor_telegram_user_id,metadata)
           VALUES ($1,$2,'REVIEW_EXPIRED','APPROVED','EXPIRED',$3,$4)`,
          [productId, expired[0].id, String(req.telegramUser.id), JSON.stringify({ reason:'VALID_UNTIL_REACHED' })]
        );
        await client.query("UPDATE products SET status='PAUSED',updated_at=NOW() WHERE id=$1 AND status='ACTIVE'", [productId]);
        await client.query("UPDATE inventory_items SET status='UNAVAILABLE' WHERE product_id=$1 AND status='AVAILABLE'", [productId]);
        await audit(req, 'PRODUCT_RIGHTS_REVIEW_EXPIRED', 'PRODUCT', productId, { reviewId: expired[0].id });
      }
    }
    await client.query('COMMIT');
    const [{ rows: history }, { rows: events }] = await Promise.all([
      pool.query('SELECT * FROM product_rights_reviews WHERE product_id=$1 ORDER BY reviewed_at DESC,id DESC LIMIT 50',[productId]),
      pool.query('SELECT * FROM product_rights_review_events WHERE product_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[productId])
    ]);
    res.json({ product, history, events });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[rights-review-history]', error.message);
    res.status(500).json({ error:'RIGHTS_REVIEW_HISTORY_FAILED' });
  } finally { client.release(); }
});

router.post('/products/:id/rights-review', async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ error:'INVALID_PRODUCT_ID' });
  const validation = validateRightsReviewInput(req.body ?? {});
  if (!validation.ok) return res.status(400).json({ error:'INVALID_RIGHTS_REVIEW_INPUT', details:validation.errors });
  const review = validation.value;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: productRows } = await client.query(
      'SELECT id,sku,is_test,status,current_rights_review_id FROM products WHERE id=$1 FOR UPDATE',
      [productId]
    );
    const product = productRows[0];
    if (!product) { await client.query('ROLLBACK'); return res.status(404).json({ error:'PRODUCT_NOT_FOUND' }); }
    if (product.is_test === true) { await client.query('ROLLBACK'); return res.status(409).json({ error:'TEST_FIXTURE_RIGHTS_REVIEW_NOT_REQUIRED' }); }

    const previous = product.current_rights_review_id
      ? await client.query('SELECT review_status FROM product_rights_reviews WHERE id=$1 AND product_id=$2',[product.current_rights_review_id,productId])
      : { rows:[] };
    const previousStatus = previous.rows[0]?.review_status ?? null;
    const { rows } = await client.query(
      `INSERT INTO product_rights_reviews (
         product_id,rights_basis,publisher_platform,official_terms_url,authorization_evidence_reference,
         chain_of_title,transfer_method,region,reviewer_telegram_user_id,valid_until,
         review_status,review_notes,owner_attested
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [productId,review.rightsBasis,review.publisherPlatform,review.officialTermsUrl,
       review.authorizationEvidenceReference,review.chainOfTitle,review.transferMethod,
       review.region,String(req.telegramUser.id),review.validUntil,review.reviewStatus,
       review.reviewNotes,review.ownerAttested]
    );
    const created = rows[0];
    await client.query(
      'UPDATE products SET current_rights_review_id=$2,updated_at=NOW(),status=CASE WHEN $3 <> \'APPROVED\' AND status=\'ACTIVE\' THEN \'PAUSED\' ELSE status END WHERE id=$1',
      [productId,created.id,created.review_status]
    );
    if (created.review_status !== 'APPROVED') {
      await client.query("UPDATE inventory_items SET status='UNAVAILABLE' WHERE product_id=$1 AND status='AVAILABLE'",[productId]);
    }
    await client.query(
      `INSERT INTO product_rights_review_events
       (product_id,rights_review_id,event_type,previous_status,new_status,actor_telegram_user_id,metadata)
       VALUES ($1,$2,'OWNER_REVIEW_RECORDED',$3,$4,$5,$6)`,
      [productId,created.id,previousStatus,created.review_status,String(req.telegramUser.id),
       JSON.stringify({ rightsBasis:created.rights_basis, publisherPlatform:created.publisher_platform, validUntil:created.valid_until })]
    );
    await client.query('COMMIT');
    await audit(req,'PRODUCT_RIGHTS_REVIEW_RECORDED','PRODUCT',productId,{ reviewId:created.id,status:created.review_status });
    res.status(201).json({ review:created, message:'Pemeriksaan internal Owner tersimpan. Produk tidak diaktifkan otomatis.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[rights-review-save]', error.message);
    res.status(500).json({ error:'RIGHTS_REVIEW_SAVE_FAILED', message:'Pemeriksaan hak tidak dapat disimpan saat ini.' });
  } finally { client.release(); }
});

router.get('/test-fixtures', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id,p.sku,p.game_category,p.tier,p.name,p.description,p.fulfillment_type,
            p.sale_price_xtr,p.status,p.is_test,
            COUNT(i.id) FILTER (WHERE i.status='AVAILABLE')::int AS sellable_stock
     FROM products p LEFT JOIN inventory_items i ON i.product_id=p.id
     WHERE p.is_test=TRUE
     GROUP BY p.id ORDER BY p.game_category,p.tier,p.name`
  );
  const products = rows.map((product) => {
    const stock = Number(product.sellable_stock);
    return { ...product, sellable_stock: stock, display_stock: stock,
      is_available: product.status === 'ACTIVE' && stock > 0 };
  });
  res.json({ products });
});

router.post('/test-fixtures', async (req, res) => {
  const fixtures = [
    { sku:'TEST-MLBB-001', gameCategory:'MLBB', tier:'SILVER', name:'TEST ONLY - MLBB Delivery Sample', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-MLBB-001' },
    { sku:'TEST-ROBLOX-001', gameCategory:'ROBLOX', tier:'GOLD', name:'TEST ONLY - Roblox Delivery Sample', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-ROBLOX-001' },
    { sku:'TEST-FREEFIRE-001', gameCategory:'FREE_FIRE', tier:'PLATINUM', name:'TEST ONLY - Free Fire Delivery Sample', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-FREEFIRE-001' },
    { sku:'TEST-GENSHIN-001', gameCategory:'GENSHIN', tier:'SILVER', name:'TEST ONLY - Genshin Delivery Sample', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-GENSHIN-001' }
  ];
  const result = [];
  let client = null;
  let changed = false;
  let stage = 'route-entered';
  const query = (...args) => process.env.DATABASE_CONNECTION_MODE === 'request'
    ? pool.query(...args)
    : client.query(...args);
  console.info('[test-fixture-route-entered]');
  try {
    stage = 'database-connect';
    if (process.env.DATABASE_CONNECTION_MODE !== 'request') client = await pool.connect();
    stage = 'transaction-begin';
    await query('BEGIN');
    for (const fixture of fixtures) {
      const existing = await query('SELECT id,is_test,status FROM products WHERE sku=$1 FOR UPDATE', [fixture.sku]);
      let product = existing.rows[0];
      if (product && product.is_test !== true) throw new Error('TEST_FIXTURE_SKU_CONFLICT:' + fixture.sku);
      if (!product) {
        const inserted = await query(
          `INSERT INTO products (sku,game_category,tier,name,description,fulfillment_type,sale_price_xtr,cost_price_xtr,rights_review_reference,is_test,status)
           VALUES ($1,$2,$3,$4,$5,'SERVICE_INSTRUCTIONS',1,0,'INTERNAL_TEST_FIXTURE_ONLY',TRUE,'DRAFT') RETURNING id,status`,
          [fixture.sku,fixture.gameCategory,fixture.tier,fixture.name,
           'PRODUK CONTOH UJI INTERNAL. Bukan produk komersial. Kode dummy ini tidak dapat ditukarkan. Harga 1 XTR hanya untuk menguji alur invoice dan transaksi.']
        );
        product = inserted.rows[0];
        changed = true;
      }
      const stock = await query("SELECT id FROM inventory_items WHERE product_id=$1 AND status IN ('AVAILABLE','RESERVED') LIMIT 1", [product.id]);
      if (!stock.rowCount) {
        stage = 'inventory-encrypt';
        const encrypted = encryptPayload(assertAllowedDigitalPayload(fixture.payload));
        stage = 'inventory-insert';
        await query(
          'INSERT INTO inventory_items (product_id,payload_ciphertext,payload_nonce,payload_tag) VALUES ($1,$2,$3,$4)',
          [product.id,encrypted.payload_ciphertext,encrypted.payload_nonce,encrypted.payload_tag]
        );
        changed = true;
      }
      result.push({ sku:fixture.sku, productId:product.id, status:product.status || 'DRAFT', isTest:true });
    }
    if (changed) {
    await query(
      `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES ($1,'TEST_FIXTURES_CREATED','PRODUCT','BATCH',$2)`,
      [String(req.telegramUser.id), JSON.stringify({ skus:fixtures.map((item) => item.sku), count:fixtures.length })]
    );
    }
    stage = 'transaction-commit';
    await query('COMMIT');
    res.status(201).json({ createdOrVerified:result.length, fixtures:result, message:'Empat produk uji dan stok dummy terenkripsi siap. Produk baru berstatus DRAFT dan harus diaktifkan satu per satu oleh Owner sebelum checkout uji.' });
  } catch (error) {
    try { await query('ROLLBACK'); } catch {}
    console.error('[test-fixture-seed-error]', stage, error.name, error.message, error.stack);
    res.status(500).json({ error:'TEST_FIXTURE_SEED_FAILED', stage, message:'Persiapan produk uji gagal pada tahap ' + stage + '. Detail telah dicatat di log server.' });
  } finally { client?.release(); }
});
router.post('/test-fixtures/:id/activate', async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'INVALID_TEST_PRODUCT_ID' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the complete fixture set in a stable order so concurrent Owner
    // activations cannot leave more than one fixture ACTIVE.
    await client.query(
      'SELECT id FROM products WHERE is_test=TRUE ORDER BY id FOR UPDATE'
    );
    const { rows } = await client.query(
      'SELECT id,sku,status,is_test FROM products WHERE id=$1 FOR UPDATE', [productId]
    );
    const product = rows[0];
    if (!product || product.is_test !== true) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'TEST_PRODUCT_NOT_FOUND' });
    }
    const stock = await client.query(
      "SELECT COUNT(*)::int AS available FROM inventory_items WHERE product_id=$1 AND status='AVAILABLE' AND reserved_order_id IS NULL AND reserved_until IS NULL",
      [productId]
    );
    if (Number(stock.rows[0]?.available || 0) < 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'TEST_PRODUCT_STOCK_REQUIRED', message: 'Produk uji memerlukan minimal satu stok dummy tersedia.' });
    }
    if (product.status !== 'ACTIVE') {
      if (product.status !== 'DRAFT') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'TEST_PRODUCT_NOT_DRAFT', message: 'Hanya produk uji berstatus DRAFT yang dapat diaktifkan.' });
      }
      const { rows: deactivated } = await client.query(
        `UPDATE products SET status='DRAFT',updated_at=NOW()
         WHERE is_test=TRUE AND status='ACTIVE' AND id<>$1
         RETURNING id,sku`,
        [productId]
      );
      if (deactivated.length) {
        await client.query(
          `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
           VALUES ($1,'TEST_FIXTURE_DEACTIVATED','PRODUCT','BATCH',$2)`,
          [String(req.telegramUser.id), JSON.stringify({
            skus: deactivated.map((item) => item.sku),
            activatedSku: product.sku,
            reason: 'SINGLE_ACTIVE_TEST_FIXTURE'
          })]
        );
      }
      await client.query("UPDATE products SET status='ACTIVE',updated_at=NOW() WHERE id=$1 AND is_test=TRUE", [productId]);
      await client.query(
        `INSERT INTO admin_audit_logs (actor_telegram_user_id,action,entity_type,entity_id,metadata)
         VALUES ($1,'TEST_FIXTURE_ACTIVATED','PRODUCT',$2,$3)`,
        [String(req.telegramUser.id), String(productId), JSON.stringify({ sku: product.sku })]
      );
    }
    await client.query('COMMIT');
    return res.json({ product: { id: productId, sku: product.sku, status: 'ACTIVE', is_test: true } });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[test-fixture-activate-error]', error.name, error.message);
    return res.status(500).json({ error: 'TEST_PRODUCT_ACTIVATION_FAILED', message: 'Produk uji tidak dapat diaktifkan saat ini.' });
  } finally {
    client.release();
  }
});

router.post('/expenses', async (req, res) => {
  const { category, description, amountXtr, occurredAt } = req.body ?? {};
  if (!category || !description || !Number.isSafeInteger(Number(amountXtr)) || Number(amountXtr) <= 0) {
    return res.status(400).json({ error: 'INVALID_EXPENSE_INPUT' });
  }
  const { rows } = await pool.query(
    `INSERT INTO operating_expenses (category,description,amount_xtr,occurred_at,created_by_telegram_user_id)
     VALUES ($1,$2,$3,COALESCE($4::timestamptz,NOW()),$5) RETURNING *`,
    [category, description, Number(amountXtr), occurredAt ?? null, String(req.telegramUser.id)]
  );
  await audit(req, 'EXPENSE_CREATED', 'EXPENSE', rows[0].id, { category, amountXtr: Number(amountXtr) });
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
  const sourceReference = String(req.body?.sourceReference ?? '').trim().slice(0,2000);
  let payloads;
  try {
    payloads = (Array.isArray(req.body?.payloads) ? req.body.payloads : [req.body?.payload]).map(assertAllowedDigitalPayload);
  } catch (error) {
    return res.status(400).json({ error: 'INVALID_ASSET_PAYLOAD', message: error.message });
  }
  if (!Number.isSafeInteger(productId) || payloads.length < 1 || payloads.length > 100) {
    return res.status(400).json({ error: 'INVALID_INVENTORY_INPUT' });
  }
  if (sourceReference.length < 3) {
    return res.status(400).json({ error:'INVENTORY_SOURCE_REFERENCE_REQUIRED', message:'Isi referensi sumber/vendor atau asal internal Owner untuk batch stok ini.' });
  }

  const { rows: productRows } = await pool.query(
    `SELECT p.id,p.status,p.is_test,p.current_rights_review_id,
            rr.id AS review_id,rr.review_status,rr.valid_until,rr.owner_attested
     FROM products p LEFT JOIN product_rights_reviews rr
       ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
     WHERE p.id=$1`, [productId]
  );
  const product = productRows[0];
  if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
  if (!canAddProductInventory(product, {
    id:product.review_id,review_status:product.review_status,
    valid_until:product.valid_until,owner_attested:product.owner_attested
  })) {
    return res.status(409).json({
      error: 'PRODUCT_RIGHTS_REVIEW_REQUIRED',
      message: 'Stok komersial hanya dapat ditambahkan setelah pemeriksaan internal Owner APPROVED dan masih berlaku.'
    });
  }

  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query('BEGIN');
    for (const payload of payloads) {
      const encrypted = encryptPayload(payload);
      const { rows } = await client.query(
        `INSERT INTO inventory_items
          (product_id,payload_ciphertext,payload_nonce,payload_tag,rights_review_id,source_reference)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,status,created_at,rights_review_id,source_reference`,
        [productId,encrypted.payload_ciphertext,encrypted.payload_nonce,encrypted.payload_tag,
         product.current_rights_review_id,sourceReference]
      );
      inserted.push(rows[0]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  await audit(req,'INVENTORY_ADDED','PRODUCT',productId,{ count:inserted.length, sourceReference, rightsReviewId:product.current_rights_review_id });
  res.status(201).json({ inserted:inserted.length, items:inserted });
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
    `SELECT o.order_number,o.status,o.total_xtr,o.total_cost_xtr,o.created_at,o.paid_at,o.fulfilled_at,
      c.telegram_user_id,c.username,
      COALESCE((SELECT json_agg(json_build_object('name',oi.product_name_snapshot,'quantity',oi.quantity,
       'unit_cost_xtr',oi.unit_cost_xtr,'unit_sale_xtr',oi.unit_sale_xtr,'is_test',p.is_test))
       FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id),'[]') AS items,
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
      `SELECT d.id,d.order_id,d.inventory_item_id,d.status,o.order_number,o.status AS order_status,i.status AS inventory_status,i.reserved_order_id
       FROM deliveries d JOIN orders o ON o.id=d.order_id
       JOIN inventory_items i ON i.id=d.inventory_item_id WHERE d.id=$1 FOR UPDATE OF d,o,i`,
      [deliveryId]
    );
    const delivery = rows[0];
    if (!delivery) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'DELIVERY_NOT_FOUND' }); }
    if (!canReconcileDelivery(delivery.order_status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ORDER_NOT_ELIGIBLE_FOR_DELIVERY_RECONCILIATION' });
    }
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
      `UPDATE orders SET status='FULFILLED',fulfilled_at=NOW() WHERE id=$1 AND status IN ('PAID','FULFILLING')`,
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
