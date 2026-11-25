import { Router } from 'express';
import { pool } from '../db/pool.js';
import { isSafeProductImageUrl, normalizeProductText, normalizeProductAttributes } from '../services/productDetailsService.js';
import { normalizeImageGallery } from '../services/marketplaceCategoryService.js';
import { readJokiCustomerAccess } from '../controllers/secretController.js';
import { encryptPayload } from '../utils/encryption.js';
import { encryptSecretPayload } from '../utils/secretVault.js';
import { isRightsReviewUsable } from '../services/rightsReviewService.js';

const router = Router();
const GAME_CATEGORY = Object.freeze({
  MLBB: 'MLBB',
  FF: 'FREE_FIRE',
  ROBLOX: 'ROBLOX',
  GI: 'GENSHIN'
});
const FULFILLMENT_BY_GROUP = Object.freeze({
  'Akun': new Set(['GAME_ACCOUNT_TRANSFER']),
  'Jasa Joki': new Set(['SERVICE_INSTRUCTIONS']),
  'Item In-Game': new Set(['SERVICE_INSTRUCTIONS'])
});
const SENSITIVE_QUESTION = /(login|password|\bpass\b|kata\s*sandi|otp|session|recovery|token)/i;

router.post('/orders/:orderNumber/customer-access/:orderItemId/read', readJokiCustomerAccess);

router.get('/variants', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT v.variant_id,v.game_code,v.nama_game,v.kategori_produk,v.jenis_varian,
            v.status_audit,v.temuan_audit,
            COALESCE(jsonb_agg(jsonb_build_object(
              'question_id',q.pertanyaan_id,
              'order',q.urutan_pertanyaan,
              'question',q.pertanyaan_wajib,
              'required',TRUE
            ) ORDER BY q.urutan_pertanyaan) FILTER (WHERE q.pertanyaan_id IS NOT NULL),'[]'::jsonb) AS questions
     FROM vault_core_varian_wajib v
     LEFT JOIN vault_core_pertanyaan_wajib_only q ON q.variant_id=v.variant_id
     GROUP BY v.variant_id
     ORDER BY v.variant_id`
  );
  return res.json({ variants: rows, counts: {
    variants: rows.length,
    questions: rows.reduce((n, v) => n + (Array.isArray(v.questions) ? v.questions.length : 0), 0)
  } });
});

router.post('/products', async (req, res) => {
  const variantId = Number(req.body?.variantId);
  const sku = String(req.body?.sku ?? '').trim().toUpperCase();
  const name = normalizeProductText(req.body?.name, 160);
  const description = normalizeProductText(req.body?.description, 4000);
  const customerTerms = normalizeProductText(req.body?.customerTerms, 4000);
  const fulfillmentEta = normalizeProductText(req.body?.fulfillmentEta, 160);
  const salePriceXtr = Number(req.body?.salePriceXtr);
  const costPriceXtr = Number(req.body?.costPriceXtr ?? 0);
  const fulfillmentType = String(req.body?.fulfillmentType ?? '').trim().toUpperCase();
  const imageUrl = req.body?.imageUrl == null ? null : String(req.body.imageUrl).trim();
  const imageGallery = normalizeImageGallery(req.body?.imageGallery ?? [], imageUrl);
  const attributes = normalizeProductAttributes(req.body?.attributes ?? {});
  const variantResult = await pool.query(
    'SELECT variant_id,game_code,kategori_produk,jenis_varian FROM vault_core_varian_wajib WHERE variant_id=$1',
    [variantId]
  );
  const variant = variantResult.rows[0];

  if (!Number.isSafeInteger(variantId) || !variant) {
    return res.status(400).json({ error: 'VARIANT_NOT_FOUND' });
  }
  if (!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(sku) || name.length < 3) {
    return res.status(400).json({ error: 'INVALID_PRODUCT_IDENTITY' });
  }
  if (!Number.isSafeInteger(salePriceXtr) || salePriceXtr < 2 || salePriceXtr > 2147483647
      || !Number.isSafeInteger(costPriceXtr) || costPriceXtr < 0) {
    return res.status(400).json({ error: 'INVALID_XTR_PRICE' });
  }
  if (!GAME_CATEGORY[variant.game_code]
      || !FULFILLMENT_BY_GROUP[variant.kategori_produk]?.has(fulfillmentType)) {
    return res.status(400).json({ error: 'FULFILLMENT_TYPE_NOT_ALLOWED_FOR_VARIANT' });
  }
  if (imageUrl && !isSafeProductImageUrl(imageUrl)) {
    return res.status(400).json({ error: 'INVALID_PRODUCT_IMAGE_URL' });
  }
  const sensitiveAttribute = attributes.ok && Object.entries(attributes.value).some(([key, value]) =>
    /(login|password|\bpass\b|sandi|otp|session|recovery|token|credential|email|username)/i.test(key)
    || /(?:password|kata\s*sandi|otp|session|recovery|token)\s*[:=]/i.test(String(value))
  );
  if (sensitiveAttribute) return res.status(400).json({ error: 'CREDENTIALS_MUST_USE_ENCRYPTED_VAULT' });
  if (!imageGallery.ok || !attributes.ok) {
    return res.status(400).json({ error: imageGallery.error ?? attributes.error ?? 'INVALID_PRODUCT_DETAILS' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO products
        (sku,game_category,tier,name,description,fulfillment_type,sale_price_xtr,cost_price_xtr,
         status,is_test,variant_id,variant_subtype,image_url,image_gallery,attributes,
         customer_terms,fulfillment_eta)
       VALUES ($1,$2,'SERVICE',$3,$4,$5,$6,$7,'DRAFT',FALSE,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)
       RETURNING id,sku,game_category,name,fulfillment_type,sale_price_xtr,status,variant_id,created_at`,
      [
        sku,GAME_CATEGORY[variant.game_code],name,description,fulfillmentType,salePriceXtr,costPriceXtr,
        variantId,normalizeProductText(req.body?.variantSubtype,120) || null,imageUrl,
        JSON.stringify(imageGallery.value),JSON.stringify(attributes.value),customerTerms,fulfillmentEta
      ]
    );
    const product = rows[0];
    await pool.query(
      `INSERT INTO admin_audit_logs(actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES($1,'V4_PRODUCT_DRAFT_CREATED','PRODUCT',$2,$3::jsonb)`,
      [String(req.telegramUser.id),String(product.id),JSON.stringify({ variantId,sku })]
    );
    return res.status(201).json({ product, publication: 'DRAFT_REQUIRES_OWNER_REVIEW' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'SKU_ALREADY_EXISTS' });
    console.error('[v4-product-draft]', error.message);
    return res.status(500).json({ error: 'V4_PRODUCT_CREATE_FAILED' });
  }
});

router.put('/products/:productId/questions', async (req, res) => {
  const productId = Number(req.params.productId);
  const answers = req.body?.answers;
  if (!Number.isSafeInteger(productId) || productId <= 0 || !Array.isArray(answers) || answers.length > 47) {
    return res.status(400).json({ error: 'INVALID_QUESTION_RESPONSES' });
  }
  const { rows: products } = await pool.query(
    'SELECT p.id,p.variant_id,v.kategori_produk AS variant_group FROM products p JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id WHERE p.id=$1 AND COALESCE(p.is_test,FALSE)=FALSE',
    [productId]
  );
  const product = products[0];
  if (!product || !product.variant_id) return res.status(404).json({ error: 'V4_PRODUCT_NOT_FOUND' });
  const { rows: questions } = await pool.query(
    `SELECT pertanyaan_id,pertanyaan_wajib
     FROM vault_core_pertanyaan_wajib_only WHERE variant_id=$1`,
    [product.variant_id]
  );
  const questionById = new Map(questions.map((q) => [Number(q.pertanyaan_id), q]));
  const actor = String(req.telegramUser.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const answer of answers) {
      const questionId = Number(answer?.questionId);
      const question = questionById.get(questionId);
      if (!question) throw Object.assign(new Error('QUESTION_NOT_IN_PRODUCT_VARIANT'),{status:400});
      const responseText = normalizeProductText(answer?.responseText, 4000);
      const proofUrls = answer?.proofUrls ?? [];
      if (!Array.isArray(proofUrls) || proofUrls.length > 8
          || proofUrls.some((url) => {
            const value = String(url ?? '').trim();
            if (!value || value.length > 2048) return true;
            try { return new URL(value).protocol !== 'https:'; } catch { return !/^\/assets\/[A-Za-z0-9_./-]+$/.test(value); }
          })) {
        throw Object.assign(new Error('INVALID_QUESTION_PROOF_URLS'),{status:400});
      }
      const sensitive = SENSITIVE_QUESTION.test(question.pertanyaan_wajib);
      if (sensitive && responseText) {
        throw Object.assign(new Error('SECRET_MUST_BE_SUBMITTED_TO_ENCRYPTED_VAULT'),{status:400});
      }
      const jokiAccessWorkflowConfirmed = productVariantGroup(product.variant_group, question.pertanyaan_wajib)
        && answer?.confirmPostPaymentVault === true;
      const responseStatus = sensitive
        ? (jokiAccessWorkflowConfirmed ? 'OWNER_VERIFIED' : 'PENDING')
        : (responseText || proofUrls.length ? 'ANSWERED' : 'PENDING');
      await client.query(
        `INSERT INTO vault_core_product_question_responses
          (product_id,question_id,response_text,proof_urls,response_status,created_by_telegram_id)
         VALUES($1,$2,$3,$4::jsonb,$5,$6)
         ON CONFLICT(product_id,question_id) DO UPDATE SET
          response_text=EXCLUDED.response_text,proof_urls=EXCLUDED.proof_urls,
          response_status=EXCLUDED.response_status,updated_at=NOW()`,
        [productId,questionId,sensitive ? '' : responseText,JSON.stringify(proofUrls),responseStatus,actor]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.status ?? 500).json({ error: error.status ? error.message : 'QUESTION_RESPONSE_SAVE_FAILED' });
  } finally {
    client.release();
  }
  const { rows: progress } = await pool.query(
    `SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE r.response_status IN ('ANSWERED','OWNER_VERIFIED','SECRET_IN_VAULT'))::int AS completed
     FROM vault_core_pertanyaan_wajib_only q
     LEFT JOIN vault_core_product_question_responses r ON r.question_id=q.pertanyaan_id AND r.product_id=$1
     WHERE q.variant_id=$2`,
    [productId,product.variant_id]
  );
  return res.json({ ok: true, productId, ...progress[0], publication: 'DRAFT_REQUIRES_OWNER_REVIEW' });
});

router.get('/products/:productId/questions', async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ error:'INVALID_PRODUCT_ID' });
  const { rows } = await pool.query(
    `SELECT q.pertanyaan_id AS question_id,q.urutan_pertanyaan AS question_order,
            q.pertanyaan_wajib AS question,q.sifat_item AS item_type,
            COALESCE(r.response_text,'') AS response_text,
            COALESCE(r.proof_urls,'[]'::jsonb) AS proof_urls,
            COALESCE(r.response_status,'PENDING') AS response_status
     FROM products p
     JOIN vault_core_pertanyaan_wajib_only q ON q.variant_id=p.variant_id
     LEFT JOIN vault_core_product_question_responses r
       ON r.product_id=p.id AND r.question_id=q.pertanyaan_id
     WHERE p.id=$1 ORDER BY q.urutan_pertanyaan`,
    [productId]
  );
  if (!rows.length) {
    const exists = await pool.query('SELECT 1 FROM products WHERE id=$1 AND variant_id IS NOT NULL',[productId]);
    if (!exists.rowCount) return res.status(404).json({ error:'V4_PRODUCT_NOT_FOUND' });
  }
  return res.json({ questions: rows });
});


router.post('/products/:productId/inventory', async (req, res) => {
  const productId = Number(req.params.productId);
  const sourceReference = String(req.body?.sourceReference ?? '').trim();
  if (!Number.isSafeInteger(productId) || productId <= 0 || sourceReference.length < 3 || sourceReference.length > 200) {
    return res.status(400).json({ error:'INVALID_V4_INVENTORY_REQUEST' });
  }

  const { rows } = await pool.query(
    `SELECT p.id,p.sku,p.status,p.is_test,p.game_category,p.fulfillment_type,p.current_rights_review_id,
            v.variant_id,v.kategori_produk,
            rr.id AS review_id,rr.review_status,rr.valid_until,rr.owner_attested
     FROM products p
     JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id
     LEFT JOIN product_rights_reviews rr ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
     WHERE p.id=$1`,
    [productId]
  );
  const product = rows[0];
  if (!product || product.is_test === true) return res.status(404).json({ error:'V4_PRODUCT_NOT_FOUND' });
  if (!['DRAFT','ACTIVE'].includes(product.status) || !isRightsReviewUsable({
    id:product.review_id,review_status:product.review_status,
    valid_until:product.valid_until,owner_attested:product.owner_attested
  })) {
    return res.status(409).json({ error:'PRODUCT_RIGHTS_REVIEW_REQUIRED' });
  }

  const isAccount = product.kategori_produk === 'Akun' && product.fulfillment_type === 'GAME_ACCOUNT_TRANSFER';
  const isManual = ['Jasa Joki','Item In-Game'].includes(product.kategori_produk)
    && product.fulfillment_type === 'SERVICE_INSTRUCTIONS';
  let payloads = [];
  let quantity = 0;
  if (isAccount) {
    payloads = req.body?.payloads;
    if (!Array.isArray(payloads) || payloads.length < 1 || payloads.length > 100
        || !/^VAULTCORE_OWNER_ACCOUNT_STOCK_V1:[A-Za-z0-9._:/-]{1,160}$/.test(sourceReference)) {
      return res.status(400).json({ error:'ACCOUNT_VAULT_INVENTORY_REQUIRED' });
    }
    for (const payload of payloads) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || typeof payload.login !== 'string' || payload.login.trim().length < 2 || payload.login.length > 240
          || typeof payload.password !== 'string' || payload.password.trim().length < 6 || payload.password.length > 1200
          || Object.keys(payload).some((key) => !['login','password','email','emailPassword','bindProvider','bindAccount','bindStatus','retrievalDetails','notes','gameId','server','region'].includes(key))
          || Buffer.byteLength(JSON.stringify(payload),'utf8') > 10000) {
        return res.status(400).json({ error:'INVALID_ACCOUNT_VAULT_PAYLOAD' });
      }
    }
    quantity = payloads.length;
  } else if (isManual) {
    quantity = Number(req.body?.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100
        || !sourceReference.startsWith(MANUAL_SOURCE_PREFIX)
        || req.body?.payloads !== undefined) {
      return res.status(400).json({ error:'MANUAL_SERVICE_INVENTORY_REQUIRED' });
    }
  } else {
    return res.status(400).json({ error:'V4_FULFILLMENT_NOT_SUPPORTED' });
  }

  const marker = encryptPayload('VAULT_CORE_V4_SECRET_MANAGED');
  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query('BEGIN');
    for (let index=0; index<quantity; index++) {
      const { rows: stock } = await client.query(
        `INSERT INTO inventory_items
          (product_id,payload_ciphertext,payload_nonce,payload_tag,rights_review_id,source_reference)
         VALUES($1,$2,$3,$4,$5,$6)
         RETURNING id,status,created_at`,
        [product.id,marker.payload_ciphertext,marker.payload_nonce,marker.payload_tag,
         product.current_rights_review_id,sourceReference]
      );
      const inventoryItem = stock[0];
      if (isAccount) {
        const context = {
          scope:'PRODUCT_ACCOUNT',productId:Number(product.id),inventoryItemId:Number(inventoryItem.id),
          orderId:null,orderItemId:null,customerId:null
        };
        const encrypted = encryptSecretPayload(payloads[index],context);
        const { rows: secretRows } = await client.query(
          `INSERT INTO vault_core_secret_payloads
            (secret_scope,product_id,inventory_item_id,payload_ciphertext,payload_nonce,payload_auth_tag,
             wrapped_data_key,key_wrap_nonce,key_wrap_auth_tag,encryption_key_version,created_by_telegram_id)
           VALUES('PRODUCT_ACCOUNT',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id`,
          [product.id,inventoryItem.id,encrypted.payload_ciphertext,encrypted.payload_nonce,
           encrypted.payload_auth_tag,encrypted.wrapped_data_key,encrypted.key_wrap_nonce,
           encrypted.key_wrap_auth_tag,encrypted.encryption_key_version,String(req.telegramUser.id)]
        );
        await client.query(
          `INSERT INTO vault_core_secret_access_logs
            (secret_payload_id,actor_telegram_user_id,action,reason,request_reference)
           VALUES($1,$2,'CREATE','Owner added encrypted account inventory',$3)`,
          [secretRows[0].id,String(req.telegramUser.id),String(product.sku)]
        );
      }
      inserted.push({ id:inventoryItem.id,status:inventoryItem.status });
    }

    if (isAccount) {
      const { rows: counts } = await client.query(
        `SELECT COUNT(*) FILTER (WHERE i.status='AVAILABLE')::int AS available,
                COUNT(*) FILTER (WHERE i.status='AVAILABLE' AND s.id IS NOT NULL)::int AS encrypted
         FROM inventory_items i
         LEFT JOIN vault_core_secret_payloads s
           ON s.inventory_item_id=i.id AND s.secret_scope='PRODUCT_ACCOUNT' AND s.secret_status='ACTIVE'
         WHERE i.product_id=$1 AND i.rights_review_id=$2`,
        [product.id,product.current_rights_review_id]
      );
      if (counts[0].available > 0 && counts[0].encrypted === counts[0].available) {
        await client.query(
          `INSERT INTO vault_core_product_question_responses
            (product_id,question_id,response_text,proof_urls,response_status,created_by_telegram_id)
           SELECT $1,q.pertanyaan_id,'','[]'::jsonb,'SECRET_IN_VAULT',$2
           FROM vault_core_pertanyaan_wajib_only q
           WHERE q.variant_id=$3 AND q.pertanyaan_wajib ~* '(login|password|pass|sandi|otp|session|recovery|token)'
           ON CONFLICT(product_id,question_id) DO UPDATE SET
             response_text='',response_status='SECRET_IN_VAULT',updated_at=NOW()`,
          [product.id,String(req.telegramUser.id),product.variant_id]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[v4-inventory-add]',error.message);
    return res.status(500).json({ error:'V4_INVENTORY_ADD_FAILED' });
  } finally {
    client.release();
  }

  await pool.query(
    `INSERT INTO admin_audit_logs(actor_telegram_user_id,action,entity_type,entity_id,metadata)
     VALUES($1,'V4_INVENTORY_ADDED','PRODUCT',$2,$3::jsonb)`,
    [String(req.telegramUser.id),String(product.id),JSON.stringify({ count:inserted.length,variantId:product.variant_id,encrypted:isAccount })]
  );
  return res.status(201).json({ productId:product.id,inserted:inserted.length,items:inserted });
});

router.post('/products/:productId/publish', async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ error:'INVALID_PRODUCT_ID' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT p.id,p.status,p.is_test,p.sale_price_xtr,p.fulfillment_type,p.current_rights_review_id,
              p.variant_id,v.kategori_produk,rr.review_status,rr.valid_until,rr.owner_attested
       FROM products p
       JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id
       LEFT JOIN product_rights_reviews rr ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
       WHERE p.id=$1 FOR UPDATE OF p`,
      [productId]
    );
    const product = rows[0];
    if (!product || product.is_test === true) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error:'V4_PRODUCT_NOT_FOUND' });
    }
    if (!['DRAFT','PAUSED'].includes(product.status)
        || !Number.isSafeInteger(Number(product.sale_price_xtr)) || Number(product.sale_price_xtr) <= 1
        || !isRightsReviewUsable({id:product.current_rights_review_id,review_status:product.review_status,valid_until:product.valid_until,owner_attested:product.owner_attested})) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error:'V4_PRODUCT_PUBLICATION_REQUIREMENTS_NOT_MET' });
    }
    const manual = ['Jasa Joki','Item In-Game'].includes(product.kategori_produk)
      && product.fulfillment_type === 'SERVICE_INSTRUCTIONS';
    const account = product.kategori_produk === 'Akun' && product.fulfillment_type === 'GAME_ACCOUNT_TRANSFER';
    if (!manual && !account) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error:'V4_FULFILLMENT_NOT_SUPPORTED' });
    }
    const { rows: stock } = await client.query(
      `SELECT COUNT(*)::int AS available,
              COUNT(*) FILTER (WHERE s.id IS NOT NULL)::int AS protected
       FROM inventory_items i
       LEFT JOIN vault_core_secret_payloads s
         ON s.inventory_item_id=i.id AND s.secret_scope='PRODUCT_ACCOUNT' AND s.secret_status='ACTIVE'
       WHERE i.product_id=$1 AND i.status='AVAILABLE'
         AND i.rights_review_id=$2 AND NULLIF(BTRIM(i.source_reference),'') IS NOT NULL
`,
      [product.id,product.current_rights_review_id]
    );
    if (stock[0].available < 1 || (account && stock[0].protected !== stock[0].available)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error:'V4_PRODUCT_STOCK_OR_VAULT_REQUIRED' });
    }
    const { rows: progress } = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE r.response_status IN ('ANSWERED','OWNER_VERIFIED','SECRET_IN_VAULT'))::int AS completed
       FROM vault_core_pertanyaan_wajib_only q
       LEFT JOIN vault_core_product_question_responses r
         ON r.product_id=$1 AND r.question_id=q.pertanyaan_id
       WHERE q.variant_id=$2`,
      [product.id,product.variant_id]
    );
    if (progress[0].total < 1 || progress[0].completed !== progress[0].total) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error:'V4_REQUIRED_QUESTIONS_INCOMPLETE',progress:progress[0] });
    }
    const { rows: updated } = await client.query(
      `UPDATE products SET status='ACTIVE',updated_at=NOW()
       WHERE id=$1 AND status IN ('DRAFT','PAUSED') RETURNING id,sku,status,variant_id,sale_price_xtr`,
      [product.id]
    );
    await client.query(
      `INSERT INTO admin_audit_logs(actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES($1,'V4_PRODUCT_PUBLISHED','PRODUCT',$2,$3::jsonb)`,
      [String(req.telegramUser.id),String(product.id),JSON.stringify({ variantId:product.variant_id,stock:stock[0].available,questions:progress[0].completed })]
    );
    await client.query('COMMIT');
    return res.json({ product:updated[0], publication:'ACTIVE' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[v4-product-publish]',error.message);
    return res.status(500).json({ error:'V4_PRODUCT_PUBLISH_FAILED' });
  } finally {
    client.release();
  }
});

export default router;
