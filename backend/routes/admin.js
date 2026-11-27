import { Router } from 'express';
import { pool } from '../db/pool.js';
import { encryptPayload, assertAllowedDigitalPayload } from '../utils/encryption.js';
import { validateRightsReviewInput } from '../services/rightsReviewService.js';
import { isSafeProductImageUrl, normalizeProductText, normalizeProductAttributes } from '../services/productDetailsService.js';
import { validateMarketplaceCategory, normalizeImageGallery } from '../services/marketplaceCategoryService.js';
import { refundStarPayment } from '../services/telegramApi.js';
import { deliverPaidOrder, canReconcileDelivery } from '../services/deliveryService.js';
import { releaseExpiredPendingOrders } from '../services/reservationService.js';
const router = Router();

router.get('/dashboard', async (_req, res) => {
  await releaseExpiredPendingOrders();
  const [sales, inventory, orders, expenses, catalog] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS paid_orders, COALESCE(SUM(total_xtr),0)::bigint AS gross_xtr,
      COALESCE(SUM(total_cost_xtr),0)::bigint AS cost_xtr
      FROM orders o
      WHERE o.status IN ('PAID','FULFILLING','FULFILLED','REFUND_PENDING')
        AND EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id
                    WHERE oi.order_id=o.id AND COALESCE(p.is_test,FALSE)=FALSE)`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE i.status='AVAILABLE')::int AS available,
      COUNT(*) FILTER (WHERE i.status='RESERVED')::int AS reserved,
      COUNT(*) FILTER (WHERE i.status='SOLD')::int AS sold
      FROM inventory_items i JOIN products p ON p.id=i.product_id
      WHERE COALESCE(p.is_test,FALSE)=FALSE AND p.fulfillment_type IS NOT NULL`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE o.status='PENDING_PAYMENT')::int AS pending,
      COUNT(*) FILTER (WHERE o.status='FULFILLED')::int AS fulfilled,
      COUNT(*) FILTER (WHERE o.status='REFUND_PENDING')::int AS refund_pending
      FROM orders o
      WHERE EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id
                    WHERE oi.order_id=o.id AND COALESCE(p.is_test,FALSE)=FALSE)`),
    pool.query(`SELECT COALESCE(SUM(amount_xtr),0)::bigint AS expenses_xtr FROM operating_expenses`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE COALESCE(is_test,FALSE)=FALSE)::int AS total_products,
      COUNT(*) FILTER (WHERE COALESCE(is_test,FALSE)=FALSE AND status='ACTIVE')::int AS active_products,
      COUNT(*) FILTER (WHERE COALESCE(is_test,FALSE)=FALSE AND status='ACTIVE'
        AND sale_price_xtr>1 AND fulfillment_type IS NOT NULL
        AND EXISTS (SELECT 1 FROM inventory_items i WHERE i.product_id=products.id AND i.status='AVAILABLE'
          AND i.reserved_order_id IS NULL AND i.reserved_until IS NULL
          AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL))::int AS buyable_products,
      COUNT(*) FILTER (WHERE COALESCE(is_test,FALSE)=FALSE AND status IN ('DRAFT','PAUSED'))::int AS paused_or_draft_products
      FROM products
      WHERE COALESCE(is_test,FALSE)=FALSE`)
  ]);
  const expensesXtr = Number(expenses.rows[0].expenses_xtr);
  const grossXtr = Number(sales.rows[0].gross_xtr);
  const costXtr = Number(sales.rows[0].cost_xtr);
  res.json({ sales: sales.rows[0], inventory: inventory.rows[0], orders: orders.rows[0],
    catalog: catalog.rows[0], expensesXtr,
    netProfitXtr: grossXtr - costXtr - expensesXtr, grossProfitXtr: grossXtr - costXtr });
});

router.get('/marketplace-categories', async (_req,res) => {
  const { rows } = await pool.query(
    `SELECT c.*, COUNT(p.id)::int AS product_count,
            COUNT(p.id) FILTER (WHERE p.status='ACTIVE')::int AS active_product_count
     FROM marketplace_categories c
     LEFT JOIN products p ON p.marketplace_category_id=c.id
     WHERE c.is_active=TRUE AND c.slug IN ('mlbb-akun','free-fire-akun','roblox-akun','genshin-akun')
     GROUP BY c.id ORDER BY c.sort_order,c.name`
  );
  res.json({ categories:rows });
});

router.post('/marketplace-categories', async (_req,res) => {
  return res.status(403).json({error:'ACCOUNT_CATEGORIES_LOCKED',message:'Kategori VAULT CORE ditetapkan: setiap game hanya memiliki subkategori Akun.'});
});

router.patch('/marketplace-categories/:id', async (_req,res) => {
  return res.status(403).json({error:'ACCOUNT_CATEGORIES_LOCKED',message:'Kategori VAULT CORE ditetapkan: setiap game hanya memiliki subkategori Akun.'});
});

router.get('/products', async (_req, res) => {
  await releaseExpiredPendingOrders();
  const { rows } = await pool.query(
    `SELECT p.id,p.sku,p.name,p.description,p.status,p.game_category,p.tier,
            p.variant_id,p.variant_subtype,p.sale_price_xtr,p.cost_price_xtr,
            p.image_url,p.image_gallery,p.attributes,p.availability_mode,p.indent_deadline_days,
            p.stock_quantity_declared,p.created_at,p.updated_at,
            mc.name AS marketplace_category_name,mc.slug AS marketplace_category_slug,
            COUNT(i.id) FILTER (
              WHERE i.status='AVAILABLE'
                AND i.reserved_order_id IS NULL
                AND i.reserved_until IS NULL
                                AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
            )::int AS actual_stock,
            CASE WHEN p.status<>'ACTIVE' THEN 'UNAVAILABLE'
                 WHEN p.availability_mode='INDENT' THEN 'INDENT'
                 ELSE 'AVAILABLE' END AS availability_status
     FROM products p
     LEFT JOIN marketplace_categories mc ON mc.id=p.marketplace_category_id
     LEFT JOIN inventory_items i ON i.product_id=p.id
     WHERE COALESCE(p.is_test,FALSE)=FALSE
     GROUP BY p.id,mc.id
     ORDER BY p.created_at DESC,p.id DESC`
  );
  res.json({ products:rows.map((product) => ({
    ...product,
    id:Number(product.id),
    sale_price_xtr:Number(product.sale_price_xtr),
    cost_price_xtr:Number(product.cost_price_xtr),
    actual_stock:Number(product.actual_stock || 0),
    stock_quantity_declared:Number(product.stock_quantity_declared || 0),
    image_gallery:Array.isArray(product.image_gallery) ? product.image_gallery : [],
    attributes:product.attributes && typeof product.attributes==='object' ? product.attributes : {}
  })) });
});

router.post('/products', async (req, res) => {
  const { sku, gameCategory, tier, name, description = '', fulfillmentType,
    salePriceXtr, costPriceXtr = 0, rightsReviewReference = null,
    imageUrl = null, customerTerms = '', fulfillmentEta = '', marketplaceCategoryId = null, imageGallery = [], attributes = {} } = req.body ?? {};
  const normalizedSku = String(sku ?? '').trim().toUpperCase();
  const normalizedImageUrl = imageUrl == null || String(imageUrl).trim() === '' ? null : String(imageUrl).trim();
  const normalizedCategoryId = marketplaceCategoryId == null || marketplaceCategoryId === '' ? null : Number(marketplaceCategoryId);
  const gallery = normalizeImageGallery(imageGallery, normalizedImageUrl);
  const productAttributes = normalizeProductAttributes(attributes);
  if ((normalizedCategoryId !== null && (!Number.isSafeInteger(normalizedCategoryId) || normalizedCategoryId <= 0))
      || !gallery.ok || !productAttributes.ok
      || !/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(normalizedSku)
      || !['MLBB','ROBLOX','FREE_FIRE','GENSHIN'].includes(gameCategory)
      || tier !== 'GOLD'
      || String(name ?? '').trim().length < 2 || String(name).trim().length > 160
      || fulfillmentType !== 'GAME_ACCOUNT_TRANSFER'
      || !Number.isSafeInteger(Number(salePriceXtr)) || Number(salePriceXtr) <= 1
      || !Number.isSafeInteger(Number(costPriceXtr)) || Number(costPriceXtr) < 0
      || String(description ?? '').length > 5000
      || String(customerTerms ?? '').length > 5000
      || String(fulfillmentEta ?? '').length > 160
      || !isSafeProductImageUrl(normalizedImageUrl)) {
    return res.status(400).json({ error: 'INVALID_PRODUCT_INPUT' });
  }
  const expectedCategorySlug = ({MLBB:'mlbb-akun',FREE_FIRE:'free-fire-akun',ROBLOX:'roblox-akun',GENSHIN:'genshin-akun'})[gameCategory];
  if (normalizedCategoryId === null) return res.status(400).json({error:'MARKETPLACE_CATEGORY_INVALID'});
  const category = await pool.query('SELECT id,slug FROM marketplace_categories WHERE id=$1 AND is_active=TRUE',[normalizedCategoryId]);
  if (!category.rows[0] || category.rows[0].slug !== expectedCategorySlug) {
    return res.status(400).json({error:'MARKETPLACE_CATEGORY_INVALID',message:'Setiap game wajib menggunakan subkategori Akun yang sesuai.'});
  }
  let rows;
  try {
    ({ rows } = await pool.query(
      `INSERT INTO products (sku, game_category, tier, name, description, fulfillment_type,
        sale_price_xtr, cost_price_xtr, rights_review_reference, image_url, customer_terms, fulfillment_eta, marketplace_category_id, image_gallery, attributes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,'DRAFT') RETURNING *`,
      [normalizedSku, gameCategory, tier, String(name).trim(), normalizeProductText(description, 5000),
        fulfillmentType, Number(salePriceXtr), Number(costPriceXtr), rightsReviewReference,
        normalizedImageUrl, normalizeProductText(customerTerms, 5000), normalizeProductText(fulfillmentEta, 160), normalizedCategoryId, JSON.stringify(gallery.value), JSON.stringify(productAttributes.value)]
    ));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error:'PRODUCT_SKU_ALREADY_EXISTS', message:'SKU sudah digunakan produk lain.' });
    }
    throw error;
  }
  await audit(req, 'PRODUCT_CREATED', 'PRODUCT', rows[0].id, { sku:normalizedSku });
  res.status(201).json({ product: rows[0] });
});

router.patch('/products/:id/availability', async (req,res) => {
  const id=Number(req.params.id);
  const availabilityStatus=String(req.body?.availabilityStatus||'').toUpperCase();
  const indentDays=availabilityStatus==='INDENT'?Number(req.body?.indentDays):null;
  if(!Number.isSafeInteger(id)||id<=0||!['AVAILABLE','INDENT','UNAVAILABLE'].includes(availabilityStatus)
      ||(availabilityStatus==='INDENT'&&(!Number.isSafeInteger(indentDays)||indentDays<1||indentDays>365))){
    return res.status(400).json({error:'INVALID_PRODUCT_AVAILABILITY'});
  }
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query(
      'SELECT id,sku,is_test,sale_price_xtr,fulfillment_type,status FROM products WHERE id=$1 FOR UPDATE',
      [id]
    );
    const product=rows[0];
    if(!product){await client.query('ROLLBACK');return res.status(404).json({error:'PRODUCT_NOT_FOUND'});}
    if(product.is_test===true){await client.query('ROLLBACK');return res.status(409).json({error:'TEST_FIXTURE_AVAILABILITY_LOCKED'});}
    if(availabilityStatus!=='UNAVAILABLE'&&(!Number.isSafeInteger(Number(product.sale_price_xtr))||Number(product.sale_price_xtr)<=1||!product.fulfillment_type)){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'PRODUCT_PRICE_OR_FULFILLMENT_REQUIRED',message:'Tetapkan harga jual dan metode pemenuhan sebelum produk tersedia.'});
    }
    const nextStatus=availabilityStatus==='UNAVAILABLE'?'PAUSED':'ACTIVE';
    const nextMode=availabilityStatus==='INDENT'?'INDENT':'READY';
    await client.query(
      'UPDATE products SET status=$2,availability_mode=$3,indent_deadline_days=$4,updated_at=NOW() WHERE id=$1',
      [id,nextStatus,nextMode,availabilityStatus==='INDENT'?indentDays:null]
    );
    if(availabilityStatus==='UNAVAILABLE'){
      await client.query(
        `UPDATE inventory_items SET status='UNAVAILABLE'
         WHERE product_id=$1 AND status='AVAILABLE' AND reserved_order_id IS NULL`,
        [id]
      );
    }else{
      await client.query(
        `UPDATE inventory_items SET status='AVAILABLE'
         WHERE product_id=$1 AND status='UNAVAILABLE' AND reserved_order_id IS NULL
           AND NULLIF(BTRIM(source_reference),'') IS NOT NULL`,
        [id]
      );
    }
    const {rows:stock}=await client.query(
      `SELECT COUNT(*) FILTER(WHERE status='AVAILABLE' AND reserved_order_id IS NULL AND reserved_until IS NULL)::int AS available_stock,
              COUNT(*) FILTER(WHERE status='RESERVED')::int AS reserved_stock
       FROM inventory_items WHERE product_id=$1`,
      [id]
    );
    await client.query(
      `INSERT INTO admin_audit_logs(actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES($1,'PRODUCT_AVAILABILITY_CHANGED','PRODUCT',$2,$3::jsonb)`,
      [String(req.telegramUser.id),String(id),JSON.stringify({sku:product.sku,availabilityStatus,indentDays:availabilityStatus==='INDENT'?indentDays:null})]
    );
    await client.query('COMMIT');
    return res.json({
      ok:true,productId:id,sku:product.sku,availabilityStatus,
      indentDays:availabilityStatus==='INDENT'?indentDays:null,
      status:nextStatus,availabilityMode:nextMode,
      availableStock:Number(stock[0]?.available_stock||0),
      reservedStock:Number(stock[0]?.reserved_stock||0)
    });
  }catch(error){
    try{await client.query('ROLLBACK');}catch{}
    console.error('[product-availability-update]',error.message);
    return res.status(500).json({error:'PRODUCT_AVAILABILITY_UPDATE_FAILED'});
  }finally{client.release();}
});

router.patch('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['sku','game_category','tier','name','description','fulfillment_type',
    'sale_price_xtr','cost_price_xtr','low_stock_threshold','display_stock_mode',
    'display_stock_override','status','rights_review_reference','image_url','customer_terms','fulfillment_eta','marketplace_category_id','image_gallery','attributes'];
  const mapping = {
    sku:'sku', gameCategory:'game_category', tier:'tier', name:'name', description:'description',
    fulfillmentType:'fulfillment_type', salePriceXtr:'sale_price_xtr', costPriceXtr:'cost_price_xtr',
    lowStockThreshold:'low_stock_threshold', displayStockMode:'display_stock_mode',
    displayStockOverride:'display_stock_override', status:'status', rightsReviewReference:'rights_review_reference',
    imageUrl:'image_url', customerTerms:'customer_terms', fulfillmentEta:'fulfillment_eta',
    marketplaceCategoryId:'marketplace_category_id', imageGallery:'image_gallery', attributes:'attributes'
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
    } else if (key === 'gameCategory' && !['MLBB','ROBLOX','FREE_FIRE','GENSHIN'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'tier' && value !== 'GOLD') {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'fulfillmentType' && value !== 'GAME_ACCOUNT_TRANSFER') {
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
    } else if (key === 'marketplaceCategoryId') {
      value = value == null || value === '' ? null : Number(value);
      if (value !== null) {
        if (!Number.isSafeInteger(value) || value <= 0) return res.status(400).json({error:'MARKETPLACE_CATEGORY_INVALID'});
        const category = await pool.query('SELECT id FROM marketplace_categories WHERE id=$1 AND is_active=TRUE',[value]);
        if (!category.rows[0]) return res.status(400).json({error:'MARKETPLACE_CATEGORY_INVALID'});
      }
    } else if (key === 'imageGallery') {
      const gallery = normalizeImageGallery(value, req.body?.imageUrl);
      if (!gallery.ok) return res.status(400).json({error:gallery.error});
      value = JSON.stringify(gallery.value);
    } else if (key === 'attributes') {
      const result = normalizeProductAttributes(value);
      if (!result.ok) return res.status(400).json({ error:result.error });
      value = JSON.stringify(result.value);
    } else if (key === 'salePriceXtr' || key === 'costPriceXtr' || key === 'lowStockThreshold' || key === 'displayStockOverride') {
      if (value === null && key === 'displayStockOverride') {
        // NULL restores live stock display.
      } else {
        value = Number(value);
        if (!Number.isSafeInteger(value)
            || (key === 'salePriceXtr' && value <= 1)
            || (key !== 'salePriceXtr' && value < 0)) return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
      }
    } else if (key === 'displayStockMode' && !['EXACT_COUNT','IN_STOCK_ONLY','HIDE_COUNT'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    } else if (key === 'status' && !['DRAFT','ACTIVE','PAUSED','ARCHIVED'].includes(value)) {
      return res.status(400).json({ error:'INVALID_PRODUCT_UPDATE' });
    }
    columns.push(column);
    values.push(value);
  }

  if (req.body.status === 'ACTIVE') {
    const { rows } = await pool.query(
      `SELECT p.id,p.is_test,p.fulfillment_type,p.sale_price_xtr FROM products p WHERE p.id=$1`,
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
    if (!Number.isSafeInteger(Number(product.sale_price_xtr)) || Number(product.sale_price_xtr) <= 1) {
      return res.status(409).json({
        error:'PRODUCT_XTR_PRICE_REQUIRED',
        message:'Harga checkout komersial harus ditetapkan di atas 1 XTR sebelum aktivasi.'
      });
    }
    if (!product.fulfillment_type) return res.status(409).json({error:'PRODUCT_FULFILLMENT_REQUIRED'});
  }

  const client = await pool.connect();
  let updated;
  let productReviewReset = false;
  try {
    await client.query('BEGIN');
    const current = await client.query(
      'SELECT id,sku,game_category,tier,name,description,customer_terms,fulfillment_type,marketplace_category_id,attributes,is_test FROM products WHERE id=$1 FOR UPDATE',
      [id]
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error:'PRODUCT_NOT_FOUND' });
    }
    const existing = current.rows[0];
    const reviewRelevantColumns = {
      sku:'sku', gameCategory:'game_category', tier:'tier', marketplaceCategoryId:'marketplace_category_id', name:'name',
      description:'description', customerTerms:'customer_terms', fulfillmentType:'fulfillment_type', attributes:'attributes'
    };
    productReviewReset = pairs.some(([key]) => {
      const column = reviewRelevantColumns[key];
      if (!column) return false;
      const nextValue = key === 'sku' ? String(req.body[key] ?? '').trim().toUpperCase()
        : key === 'description' || key === 'customerTerms' ? normalizeProductText(req.body[key], 5000)
        : key === 'marketplaceCategoryId' ? (req.body[key] == null || req.body[key] === '' ? null : Number(req.body[key]))
        : key === 'attributes' ? JSON.stringify(normalizeProductAttributes(req.body[key]).value)
        : req.body[key];
      const existingValue = key === 'attributes' ? JSON.stringify(normalizeProductAttributes(existing[column]).value) : existing[column];
      return String(nextValue ?? '') !== String(existingValue ?? '');
    });
        if (productReviewReset) {
      const openOrders = await client.query(
        `SELECT COUNT(DISTINCT o.id)::int AS count
         FROM order_items oi
         JOIN orders o ON o.id=oi.order_id
         WHERE oi.product_id=$1
           AND o.status IN ('PENDING_PAYMENT','PAID','FULFILLING','REFUND_PENDING')`,
        [id]
      );
      if (Number(openOrders.rows[0]?.count ?? 0) > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error:'PRODUCT_HAS_OPEN_ORDERS',
          message:'Rincian penting produk tidak dapat diubah selama masih ada pesanan aktif untuk SKU ini. Selesaikan atau rekonsiliasi pesanan terlebih dahulu.'
        });
      }
    }
    const mergedGame = pairs.some(([key])=>key==='gameCategory') ? req.body.gameCategory : existing.game_category;
    const mergedFulfillment = pairs.some(([key])=>key==='fulfillmentType') ? req.body.fulfillmentType : existing.fulfillment_type;
    const mergedCategoryId = pairs.some(([key])=>key==='marketplaceCategoryId') ? (req.body.marketplaceCategoryId==null||req.body.marketplaceCategoryId===''?null:Number(req.body.marketplaceCategoryId)) : existing.marketplace_category_id;
    const supportedFulfillment = ['GAME_ACCOUNT_TRANSFER','SERVICE_INSTRUCTIONS','GIFT_CODE','REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','DIGITAL_FILE'];
    if (!['MLBB','ROBLOX','FREE_FIRE','GENSHIN'].includes(mergedGame) || !supportedFulfillment.includes(mergedFulfillment)) {
      await client.query('ROLLBACK'); return res.status(400).json({error:'PRODUCT_FIELDS_INVALID'});
    }
    if (mergedCategoryId) {
      const linkedCategory = await client.query('SELECT id FROM marketplace_categories WHERE id=$1 AND is_active=TRUE',[mergedCategoryId]);
      if (!linkedCategory.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({error:'MARKETPLACE_CATEGORY_INVALID'}); }
    }
    const assignments = columns.map((column, index) => `${column}=${index + 1}${['image_gallery','attributes'].includes(column) ? '::jsonb' : ''}`);
    
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
  await audit(req, 'PRODUCT_UPDATED', 'PRODUCT', id, { ...Object.fromEntries(pairs), productReviewReset });
  res.json({ product:updated, productReviewReset });
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
      `UPDATE products SET current_rights_review_id=$2,updated_at=NOW() WHERE id=$1`, [productId,created.id]);
    await client.query(
      `INSERT INTO product_rights_review_events
       (product_id,rights_review_id,event_type,previous_status,new_status,actor_telegram_user_id,metadata)
       VALUES ($1,$2,'OWNER_REVIEW_RECORDED',$3,$4,$5,$6)`,
      [productId,created.id,previousStatus,created.review_status,String(req.telegramUser.id),
       JSON.stringify({ rightsBasis:created.rights_basis, publisherPlatform:created.publisher_platform, validUntil:created.valid_until })]
    );
    await client.query('COMMIT');
    await audit(req,'PRODUCT_RIGHTS_REVIEW_RECORDED','PRODUCT',productId,{ reviewId:created.id,status:created.review_status });
    res.status(201).json({ review:created, message:created.review_status === 'APPROVED'
      ? 'Metadata pemeriksaan tersimpan. Status jual diatur dari kontrol ketersediaan produk.'
      : 'Metadata pemeriksaan tersimpan. Status jual tetap diatur dari kontrol ketersediaan produk.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[rights-review-save]', error.message);
    res.status(500).json({ error:'RIGHTS_REVIEW_SAVE_FAILED', message:'Pemeriksaan hak tidak dapat disimpan saat ini.' });
  } finally { client.release(); }
});

router.get('/test-fixtures', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id,p.sku,p.game_category,p.tier,p.name,p.description,p.fulfillment_type,p.attributes,p.marketplace_category_id,
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
    { sku:'TEST-MLBB-001', gameCategory:'MLBB', categorySlug:'mlbb-akun', name:'TEST ONLY - MLBB Account Transfer', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-MLBB-001', attributes:{win_rate:'58%',total_skins:120,total_heroes:85,rank_current:'Mythic',linked_account:'Moonton, Google'} },
    { sku:'TEST-ROBLOX-001', gameCategory:'ROBLOX', categorySlug:'roblox-akun', name:'TEST ONLY - Roblox Account Transfer', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-ROBLOX-001', attributes:{rank_current:'Premium',linked_account:'Roblox'} },
    { sku:'TEST-FREEFIRE-001', gameCategory:'FREE_FIRE', categorySlug:'free-fire-akun', name:'TEST ONLY - Free Fire Account Transfer', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-FREEFIRE-001', attributes:{win_rate:'54%',total_skins:40,rank_current:'Heroic',linked_account:'Google, Facebook'} },
    { sku:'TEST-GENSHIN-001', gameCategory:'GENSHIN', categorySlug:'genshin-akun', name:'TEST ONLY - Genshin Account Transfer', payload:'VAULTCORE-TEST-ONLY-NOT-REDEEMABLE-GENSHIN-001', attributes:{rank_current:'Adventure Rank 55',linked_account:'HoYoverse'} }
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
      const category = await query('SELECT id FROM marketplace_categories WHERE slug=$1 AND is_active=TRUE',[fixture.categorySlug]);
      if (!category.rows[0]) throw new Error('ACCOUNT_CATEGORY_MISSING:' + fixture.categorySlug);
      const categoryId = Number(category.rows[0].id);
      const existing = await query('SELECT id,is_test,status FROM products WHERE sku=$1 FOR UPDATE', [fixture.sku]);
      let product = existing.rows[0];
      if (product && product.is_test !== true) throw new Error('TEST_FIXTURE_SKU_CONFLICT:' + fixture.sku);
      const description = 'PRODUK CONTOH UJI INTERNAL UNTUK ALUR TRANSFER AKUN. Bukan produk komersial. Data dummy tidak dapat digunakan untuk login. Harga 1 XTR hanya untuk menguji invoice dan transaksi.';
      if (!product) {
        const inserted = await query(
          `INSERT INTO products (sku,game_category,tier,name,description,fulfillment_type,sale_price_xtr,cost_price_xtr,rights_review_reference,is_test,status,marketplace_category_id,attributes)
           VALUES ($1,$2,'GOLD',$3,$4,'GAME_ACCOUNT_TRANSFER',1,0,'INTERNAL_TEST_FIXTURE_ONLY',TRUE,'DRAFT',$5,$6::jsonb) RETURNING id,status`,
          [fixture.sku,fixture.gameCategory,fixture.name,description,categoryId,JSON.stringify(fixture.attributes)]
        );
        product = inserted.rows[0];
        changed = true;
      } else {
        await query(
          `UPDATE products SET game_category=$2,tier='GOLD',name=$3,description=$4,fulfillment_type='GAME_ACCOUNT_TRANSFER',
             marketplace_category_id=$5,attributes=$6::jsonb,updated_at=NOW() WHERE id=$1`,
          [product.id,fixture.gameCategory,fixture.name,description,categoryId,JSON.stringify(fixture.attributes)]
        );
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
     WHERE COALESCE(p.is_test,FALSE)=FALSE
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
  if (!Number.isSafeInteger(productId) || payloads.length < 1 || payloads.length > 100) return res.status(400).json({ error: 'INVALID_INVENTORY_INPUT' });
  if (sourceReference.length < 3) return res.status(400).json({ error:'INVENTORY_SOURCE_REFERENCE_REQUIRED' });
  const { rows: productRows } = await pool.query(
    'SELECT id,is_test,current_rights_review_id,fulfillment_type FROM products WHERE id=$1',[productId]
  );
  const product = productRows[0];
  if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
  const supportedFulfillment = ['GAME_ACCOUNT_TRANSFER','SERVICE_INSTRUCTIONS','GIFT_CODE','REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','DIGITAL_FILE'];
  if (product.is_test === true || !supportedFulfillment.includes(product.fulfillment_type)) return res.status(400).json({error:'PRODUCT_FULFILLMENT_INVALID'});
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
        [productId,encrypted.payload_ciphertext,encrypted.payload_nonce,encrypted.payload_tag,product.current_rights_review_id ?? null,sourceReference]
      );
      inserted.push(rows[0]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  await audit(req,'INVENTORY_ADDED','PRODUCT',productId,{ count:inserted.length, sourceReference });
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
  await releaseExpiredPendingOrders();
  const { rows } = await pool.query(
    `SELECT o.order_number,o.status,o.total_xtr,o.total_cost_xtr,o.created_at,o.paid_at,o.fulfilled_at,
      c.telegram_user_id,c.username,
      COALESCE((SELECT json_agg(json_build_object(
       'name',oi.product_name_snapshot,'quantity',oi.quantity,
       'unit_cost_xtr',oi.unit_cost_xtr,'unit_sale_xtr',oi.unit_sale_xtr,'is_test',p.is_test,
       'category',v.kategori_produk,'customer_inputs',oi.customer_input_snapshot,
       'availability_mode',oi.availability_mode_snapshot,
       'indent_deadline_days',oi.indent_deadline_days_snapshot,
       'fulfillment_deadline_at',oi.fulfillment_deadline_at
      ) ORDER BY oi.id)
       FROM order_items oi JOIN products p ON p.id=oi.product_id
       LEFT JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id
       WHERE oi.order_id=o.id),'[]') AS items,
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
