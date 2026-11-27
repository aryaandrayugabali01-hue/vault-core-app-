import { Router } from 'express';
import { pool } from '../db/pool.js';
import { normalizeProductText, normalizeProductAttributes } from '../services/productDetailsService.js';
import { normalizeImageGallery } from '../services/marketplaceCategoryService.js';
import { encryptPayload } from '../utils/encryption.js';
import { isRightsReviewUsable, validateRightsReviewInput } from '../services/rightsReviewService.js';

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

function validateListingFields(fields, source) {
  if (!Array.isArray(fields) || fields.length < 1) return { ok:false, error:'VARIANT_LISTING_FIELDS_NOT_CONFIGURED' };
  const allowed = new Set(fields.map((field) => field.field_key));
  for (const key of Object.keys(source || {})) if (!allowed.has(key)) return { ok:false, error:'UNKNOWN_LISTING_FIELD' };
  const value = {};
  for (const field of fields) {
    const text = String(source?.[field.field_key] ?? '').trim();
    if (field.sifat_item === 'WAJIB' && !text) return { ok:false, error:'REQUIRED_LISTING_FIELD_MISSING', field:field.field_key };
    if (text.length > Number(field.field_max_length || 160)) return { ok:false, error:'LISTING_FIELD_TOO_LONG', field:field.field_key };
    if (field.input_type === 'number' && text && !/^\d{1,16}$/.test(text)) return { ok:false, error:'LISTING_FIELD_MUST_BE_NON_NEGATIVE_NUMBER', field:field.field_key };
    if (field.input_type === 'select' && text && (!Array.isArray(field.field_options) || !field.field_options.includes(text))) return { ok:false, error:'LISTING_FIELD_OPTION_INVALID', field:field.field_key };
    value[field.field_key] = text;
  }
  return { ok:true, value };
}
async function getVariantListingFields(db, variantId) {
  const { rows } = await db.query(
    `SELECT pertanyaan_id,variant_id,urutan_pertanyaan,pertanyaan_wajib,sifat_item,field_key,input_type,
            field_options,field_placeholder,field_group,field_max_length,is_public
     FROM vault_core_pertanyaan_wajib_only WHERE variant_id=$1 AND is_public=TRUE AND pertanyaan_wajib !~* '(login|password|sandi|otp|session|recovery|backup|token|credential|email|username|cookie|retrieval|moderasi|kapasitas tenaga|harga dagangan|stok)' ORDER BY urutan_pertanyaan`,
    [variantId]
  );
  return rows;
}

router.get('/products',async(_req,res)=>{
 const {rows}=await pool.query(
  `SELECT p.id,p.sku,p.name,p.description,p.status,p.game_category,p.tier,p.fulfillment_type,
   p.variant_id,p.variant_subtype,p.sale_price_xtr,p.cost_price_xtr,p.image_url,p.image_gallery,p.attributes,
   p.customer_terms,p.fulfillment_eta,p.availability_mode,p.indent_deadline_days,p.stock_quantity_declared,
   COALESCE(
    p.stock_source_reference,
    CASE
     WHEN COUNT(DISTINCT NULLIF(BTRIM(i.source_reference),'')) FILTER(
       WHERE i.status='AVAILABLE' AND i.rights_review_id=p.current_rights_review_id
     )=1
     THEN MIN(NULLIF(BTRIM(i.source_reference),'')) FILTER(
       WHERE i.status='AVAILABLE' AND i.rights_review_id=p.current_rights_review_id
     )
     ELSE NULL
    END
   ) AS stock_source_reference,
   p.customer_input_fields,p.current_rights_review_id,p.created_at,p.updated_at,
   mc.slug AS legacy_category_slug,
   CASE mc.slug
    WHEN 'mlbb-akun' THEN 1
    WHEN 'free-fire-akun' THEN 4
    WHEN 'roblox-akun' THEN 8
    WHEN 'genshin-akun' THEN 10
    WHEN 'roblox-blox-fruits' THEN 6
    WHEN 'roblox-adopt-me' THEN 7
    WHEN 'roblox-murder-mystery-2' THEN 7
    ELSE NULL
   END AS legacy_variant_id,
   v.kategori_produk AS variant_category,v.jenis_varian AS variant_name,v.nama_game AS game_name,
   rr.review_status,rr.valid_until,rr.owner_attested,rr.rights_basis,rr.publisher_platform,rr.official_terms_url,
   rr.authorization_evidence_reference,rr.chain_of_title,rr.transfer_method,rr.region,rr.review_notes,
   COUNT(DISTINCT q.pertanyaan_id)::int AS required_questions,
   COUNT(DISTINCT q.pertanyaan_id) FILTER(WHERE r.response_status='ANSWERED')::int AS completed_questions,
   COUNT(DISTINCT i.id) FILTER(WHERE i.status='AVAILABLE' AND i.rights_review_id=p.current_rights_review_id)::int AS available_stock
   FROM products p LEFT JOIN vault_core_varian_wajib v ON v.variant_id=p.variant_id
   LEFT JOIN marketplace_categories mc ON mc.id=p.marketplace_category_id
   LEFT JOIN product_rights_reviews rr ON rr.id=p.current_rights_review_id AND rr.product_id=p.id
   LEFT JOIN vault_core_pertanyaan_wajib_only q ON q.variant_id=p.variant_id AND q.is_public=TRUE
    AND q.pertanyaan_wajib !~* '(login|password|sandi|otp|session|recovery|backup|token|credential|email|username|cookie|retrieval|moderasi|kapasitas tenaga|harga dagangan|stok)'
   LEFT JOIN vault_core_product_question_responses r ON r.product_id=p.id AND r.question_id=q.pertanyaan_id
   LEFT JOIN inventory_items i ON i.product_id=p.id
   WHERE COALESCE(p.is_test,FALSE)=FALSE GROUP BY p.id,v.variant_id,rr.id,mc.slug ORDER BY p.updated_at DESC LIMIT 250`
 );
 return res.json({products:rows.map(r=>({...r,id:Number(r.id),sale_price_xtr:Number(r.sale_price_xtr),cost_price_xtr:Number(r.cost_price_xtr),available_stock:Number(r.available_stock),stock_quantity_declared:Number(r.stock_quantity_declared||0),legacy_variant_id:r.legacy_variant_id==null?null:Number(r.legacy_variant_id),customer_input_fields:Array.isArray(r.customer_input_fields)?r.customer_input_fields:[]}))});
});
router.put('/products/:productId/variant', async (req,res) => {
  const productId=Number(req.params.productId);
  const variantId=Number(req.body?.variantId);
  const subtype=normalizeProductText(req.body?.variantSubtype,120)||null;
  if(!Number.isSafeInteger(productId)||productId<=0||!Number.isSafeInteger(variantId)||variantId<=0){
    return res.status(400).json({error:'INVALID_PRODUCT_VARIANT_MAPPING'});
  }

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows:products}=await client.query(
      `SELECT p.id,p.sku,p.game_category,p.fulfillment_type,p.variant_id,
              mc.slug AS legacy_category_slug
       FROM products p
       LEFT JOIN marketplace_categories mc ON mc.id=p.marketplace_category_id
       WHERE p.id=$1 AND COALESCE(p.is_test,FALSE)=FALSE
       FOR UPDATE OF p`,
      [productId]
    );
    const product=products[0];
    if(!product){await client.query('ROLLBACK');return res.status(404).json({error:'V4_PRODUCT_NOT_FOUND'});}
    if(product.variant_id!==null){await client.query('ROLLBACK');return res.status(409).json({error:'PRODUCT_VARIANT_ALREADY_ASSIGNED'});}

    const legacyMap={
      'mlbb-akun':{game_category:'MLBB',game_code:'MLBB',variant_id:1,group:'Akun',fulfillment:'GAME_ACCOUNT_TRANSFER'},
      'free-fire-akun':{game_category:'FREE_FIRE',game_code:'FF',variant_id:4,group:'Akun',fulfillment:'GAME_ACCOUNT_TRANSFER'},
      'roblox-akun':{game_category:'ROBLOX',game_code:'ROBLOX',variant_id:8,group:'Akun',fulfillment:'GAME_ACCOUNT_TRANSFER'},
      'genshin-akun':{game_category:'GENSHIN',game_code:'GI',variant_id:10,group:'Akun',fulfillment:'GAME_ACCOUNT_TRANSFER'},
      'roblox-blox-fruits':{game_category:'ROBLOX',game_code:'ROBLOX',variant_id:6,group:'Item In-Game',fulfillment:'SERVICE_INSTRUCTIONS'},
      'roblox-adopt-me':{game_category:'ROBLOX',game_code:'ROBLOX',variant_id:7,group:'Item In-Game',fulfillment:'SERVICE_INSTRUCTIONS'},
      'roblox-murder-mystery-2':{game_category:'ROBLOX',game_code:'ROBLOX',variant_id:7,group:'Item In-Game',fulfillment:'SERVICE_INSTRUCTIONS'}
    };
    const allowed=legacyMap[product.legacy_category_slug];
    if(!allowed){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'LEGACY_CATEGORY_HAS_NO_V4_VARIANT',legacyCategory:product.legacy_category_slug||null});
    }
    if(product.game_category!==allowed.game_category||product.fulfillment_type!==allowed.fulfillment||variantId!==allowed.variant_id){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'VARIANT_MAPPING_DOES_NOT_MATCH_LEGACY_PRODUCT',expectedVariantId:allowed.variant_id});
    }
    const {rows:variantRows}=await client.query(
      'SELECT variant_id,game_code,kategori_produk,jenis_varian FROM vault_core_varian_wajib WHERE variant_id=$1',
      [variantId]
    );
    const variant=variantRows[0];
    if(!variant||variant.game_code!==allowed.game_code||variant.kategori_produk!==allowed.group){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'MASTER_VARIANT_MISMATCH'});
    }
    const {rows:updated}=await client.query(
      `UPDATE products SET variant_id=$2,variant_subtype=COALESCE($3,variant_subtype),status=CASE WHEN status='ACTIVE' THEN 'PAUSED' ELSE status END,updated_at=NOW()
       WHERE id=$1 AND variant_id IS NULL
       RETURNING id,sku,game_category,fulfillment_type,variant_id,variant_subtype,status`,
      [productId,variantId,subtype]
    );
    await client.query(
      `INSERT INTO admin_audit_logs(actor_telegram_user_id,action,entity_type,entity_id,metadata)
       VALUES($1,'V4_LEGACY_PRODUCT_VARIANT_MAPPED','PRODUCT',$2,$3::jsonb)`,
      [String(req.telegramUser.id),String(productId),JSON.stringify({sku:product.sku,legacyCategory:product.legacy_category_slug,variantId,variantName:variant.jenis_varian})]
    );
    await client.query('COMMIT');
    return res.json({product:updated[0],publication:'OWNER_REVIEW_AND_VAULT_REQUIRED'});
  }catch(error){
    try{await client.query('ROLLBACK');}catch{}
    console.error('[v4-legacy-variant-map]',error.message);
    return res.status(500).json({error:'V4_VARIANT_MAPPING_FAILED'});
  }finally{client.release();}
});

router.get('/variants',async(_req,res)=>{
 const {rows}=await pool.query(
  `SELECT v.variant_id,v.game_code,v.nama_game,v.kategori_produk,v.jenis_varian,v.status_audit,
   COALESCE(jsonb_agg(jsonb_build_object('question_id',q.pertanyaan_id,'order',q.urutan_pertanyaan,'question',q.pertanyaan_wajib,'key',q.field_key,'input_type',q.input_type,'options',q.field_options,'placeholder',q.field_placeholder,'max_length',q.field_max_length,'group',q.field_group,'required',q.sifat_item='WAJIB') ORDER BY q.urutan_pertanyaan) FILTER(WHERE q.pertanyaan_id IS NOT NULL),'[]'::jsonb) AS questions
   FROM vault_core_varian_wajib v LEFT JOIN vault_core_pertanyaan_wajib_only q ON q.variant_id=v.variant_id AND q.is_public=TRUE
   AND q.pertanyaan_wajib !~* '(login|password|sandi|otp|session|recovery|backup|token|credential|email|username|cookie|retrieval|moderasi|kapasitas tenaga|harga dagangan|stok)'
   GROUP BY v.variant_id ORDER BY v.variant_id`
 );
 return res.json({variants:rows,counts:{variants:rows.length,questions:rows.reduce((n,v)=>n+(Array.isArray(v.questions)?v.questions.length:0),0)}});
});
router.post('/products',async(req,res)=>{
 const b=req.body||{},productId=b.productId?Number(b.productId):null,variantId=Number(b.variantId);
 const sku=String(b.sku||'').trim().toUpperCase(),name=normalizeProductText(b.name,160),description=normalizeProductText(b.description,4000);
 const sale=Number(b.salePriceXtr),cost=Number(b.costPriceXtr??0),qty=Number(b.stockQuantity),mode=String(b.availabilityMode||'READY').toUpperCase();
 const indent=mode==='INDENT'?Number(b.indentDeadlineDays):null;
 const gallery=normalizeImageGallery(Array.isArray(b.imageGallery)?b.imageGallery:(b.imageUrl?[b.imageUrl]:[]),null);
 if(productId!==null&&(!Number.isSafeInteger(productId)||productId<1))return res.status(400).json({error:'INVALID_PRODUCT_ID'});
 if(!Number.isSafeInteger(variantId)||!Number.isSafeInteger(sale)||sale<2||!Number.isSafeInteger(cost)||cost<0||!Number.isSafeInteger(qty)||qty<0||qty>100)return res.status(400).json({error:'INVALID_PRODUCT_NUMBERS'});
 if(!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(sku)||name.length<3||!gallery.ok||gallery.value.length<1)return res.status(400).json({error:'INVALID_PRODUCT_IDENTITY_OR_IMAGES'});
 const {rows:vrows}=await pool.query('SELECT * FROM vault_core_varian_wajib WHERE variant_id=$1',[variantId]),v=vrows[0];
 if(!v)return res.status(400).json({error:'VARIANT_NOT_FOUND'});
 const account=v.kategori_produk==='Akun',joki=v.kategori_produk==='Jasa Joki',item=v.kategori_produk==='Item In-Game';
 if(!account&&!joki&&!item)return res.status(400).json({error:'UNSUPPORTED_PRODUCT_CATEGORY'});
 if((account&&!['READY','INDENT'].includes(mode))||(!account&&mode!=='READY'))return res.status(400).json({error:'INVALID_AVAILABILITY_FOR_CATEGORY'});
 if(account&&mode==='INDENT'&&(!Number.isSafeInteger(indent)||indent<1||indent>365))return res.status(400).json({error:'INDENT_DEADLINE_REQUIRED'});
 if(account&&mode==='READY'&&!['Instan','15 menit','30 menit','Maksimal 1 jam'].includes(b.fulfillmentEta))return res.status(400).json({error:'READY_SLA_MAX_ONE_HOUR'});
 if(qty>0&&String(b.stockSourceReference||'').trim().length<3)return res.status(400).json({error:'STOCK_SOURCE_REFERENCE_REQUIRED'});
 const fields=await getVariantListingFields(pool,variantId),checked=validateListingFields(fields,b.attributes||{});
 if(!checked.ok)return res.status(400).json({error:checked.error,field:checked.field||null});
 const attrs=normalizeProductAttributes(checked.value);if(!attrs.ok)return res.status(400).json({error:attrs.error});
 const bad=/login|password|sandi|otp|session|recovery|backup|token|credential|email|username|cookie/i;
 if(Object.entries(attrs.value).some(([k,x])=>bad.test(k)||bad.test(String(x))))return res.status(400).json({error:'AUTHENTICATION_DATA_PROHIBITED'});
 const customer=Array.isArray(b.customerInputFields)?b.customerInputFields:[];
 if(customer.length>12||customer.some(f=>!normalizeProductText(f?.label,80)||bad.test(String(f?.label||''))))return res.status(400).json({error:'INVALID_CUSTOMER_INPUT_FIELDS'});
 if(account&&customer.length)return res.status(400).json({error:'ACCOUNT_HANDOVER_IS_MANUAL_NO_CUSTOMER_CREDENTIAL_FORM'});
 if(joki&&!customer.length)return res.status(400).json({error:'JOKI_CUSTOMER_FIELDS_REQUIRED'});
 const validated=validateRightsReviewInput(b.rightsReview||{});if(!validated.ok)return res.status(400).json({error:'INVALID_RIGHTS_REVIEW',details:validated.errors});
 const rights=validated.value,usable=isRightsReviewUsable({review_status:rights.reviewStatus,valid_until:rights.validUntil,owner_attested:rights.ownerAttested});
 const eta=account?(mode==='INDENT'?'Maksimal '+indent+' hari kalender':b.fulfillmentEta):normalizeProductText(b.fulfillmentEta,160);
 const source='VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:'+String(b.stockSourceReference||'').trim();
 const client=await pool.connect();
 try{
  await client.query('BEGIN');let p;
  if(productId){
   const {rows}=await client.query('SELECT id,sku,variant_id FROM products WHERE id=$1 AND COALESCE(is_test,FALSE)=FALSE FOR UPDATE',[productId]);p=rows[0];
   if(!p){await client.query('ROLLBACK');return res.status(404).json({error:'PRODUCT_NOT_FOUND'});}
   if(p.sku!==sku||Number(p.variant_id)!==variantId){await client.query('ROLLBACK');return res.status(409).json({error:'SKU_VARIANT_IMMUTABLE'});}
   const {rows:reserved}=await client.query("SELECT COUNT(*)::int AS n FROM inventory_items WHERE product_id=$1 AND status='RESERVED'",[productId]);
   if(reserved[0].n){await client.query('ROLLBACK');return res.status(409).json({error:'SKU_HAS_RESERVED_ORDERS'});}
   await client.query(`UPDATE products SET name=$2,description=$3,sale_price_xtr=$4,cost_price_xtr=$5,variant_subtype=$6,image_url=$7,image_gallery=$8::jsonb,attributes=$9::jsonb,customer_terms=$10,fulfillment_eta=$11,availability_mode=$12,indent_deadline_days=$13,stock_quantity_declared=$14,stock_source_reference=$15,customer_input_fields=$16::jsonb,status='PAUSED',updated_at=NOW() WHERE id=$1`,
    [productId,name,description,sale,cost,normalizeProductText(b.variantSubtype,120)||null,gallery.value[0],JSON.stringify(gallery.value),JSON.stringify(attrs.value),normalizeProductText(b.customerTerms,4000),eta,account?mode:'READY',indent,qty,source,JSON.stringify(customer)]);
  }else{
   const {rows:dups}=await client.query('SELECT id FROM products WHERE sku=$1 AND COALESCE(is_test,FALSE)=FALSE',[sku]);
   if(dups.length){await client.query('ROLLBACK');return res.status(409).json({error:'SKU_ALREADY_EXISTS',productId:Number(dups[0].id)});}
   const {rows}=await client.query(`INSERT INTO products(sku,game_category,tier,name,description,fulfillment_type,sale_price_xtr,cost_price_xtr,status,is_test,variant_id,variant_subtype,image_url,image_gallery,attributes,customer_terms,fulfillment_eta,availability_mode,indent_deadline_days,stock_quantity_declared,stock_source_reference,customer_input_fields)
    VALUES($1,$2,'SERVICE',$3,$4,$5,$6,$7,'PAUSED',FALSE,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19::jsonb) RETURNING id,sku`,
    [sku,GAME_CATEGORY[v.game_code],name,description,account?'GAME_ACCOUNT_TRANSFER':'SERVICE_INSTRUCTIONS',sale,cost,variantId,normalizeProductText(b.variantSubtype,120)||null,gallery.value[0],JSON.stringify(gallery.value),JSON.stringify(attrs.value),normalizeProductText(b.customerTerms,4000),eta,account?mode:'READY',indent,qty,source,JSON.stringify(customer)]);
   p=rows[0];
  }
  for(const f of fields)await client.query(`INSERT INTO vault_core_product_question_responses(product_id,question_id,response_text,proof_urls,response_status,created_by_telegram_id) VALUES($1,$2,$3,'[]'::jsonb,'ANSWERED',$4) ON CONFLICT(product_id,question_id) DO UPDATE SET response_text=EXCLUDED.response_text,response_status='ANSWERED',updated_at=NOW()`,[p.id,f.pertanyaan_id,attrs.value[f.field_key]||'',String(req.telegramUser.id)]);
  const {rows:rr}=await client.query(`INSERT INTO product_rights_reviews(product_id,rights_basis,publisher_platform,official_terms_url,authorization_evidence_reference,chain_of_title,transfer_method,region,reviewer_telegram_user_id,valid_until,review_status,review_notes,owner_attested) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
   [p.id,rights.rightsBasis,rights.publisherPlatform,rights.officialTermsUrl,rights.authorizationEvidenceReference,rights.chainOfTitle,rights.transferMethod,rights.region,String(req.telegramUser.id),rights.validUntil,rights.reviewStatus,rights.reviewNotes,rights.ownerAttested]);
  await client.query('UPDATE products SET current_rights_review_id=$2 WHERE id=$1',[p.id,rr[0].id]);
  await client.query("UPDATE inventory_items SET status='UNAVAILABLE' WHERE product_id=$1 AND status='AVAILABLE' AND reserved_order_id IS NULL",[p.id]);
  let added=0;if(usable&&qty>0){const marker=encryptPayload('VAULTCORE_MANUAL_FULFILLMENT_SLOT_V1');for(let n=0;n<qty;n++){await client.query(`INSERT INTO inventory_items(product_id,payload_ciphertext,payload_nonce,payload_tag,rights_review_id,source_reference) VALUES($1,$2,$3,$4,$5,$6)`,[p.id,marker.payload_ciphertext,marker.payload_nonce,marker.payload_tag,rr[0].id,source]);added++;}}
  const status=usable&&added>0?'ACTIVE':'PAUSED';
  const {rows:result}=await client.query("UPDATE products SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id,sku,name,status,variant_id,availability_mode,indent_deadline_days,stock_quantity_declared",[p.id,status]);
  await client.query(`INSERT INTO admin_audit_logs(actor_telegram_user_id,action,entity_type,entity_id,metadata) VALUES($1,'OWNER_PRODUCT_SINGLE_FORM_SAVED','PRODUCT',$2,$3::jsonb)`,[String(req.telegramUser.id),String(p.id),JSON.stringify({sku,variantId,category:v.kategori_produk,status,qty,mode:account?mode:null,indentDays:indent})]);
  await client.query('COMMIT');
  return res.status(productId?200:201).json({ok:true,product:result[0],publication:status,stockAvailable:added,message:status==='ACTIVE'?'Produk tersimpan dan tampil pada katalog.':'Produk tersimpan tetapi ditahan sampai review hak disetujui dan stok aktual tersedia.'});
 }catch(e){try{await client.query('ROLLBACK');}catch{}if(e.code==='23505')return res.status(409).json({error:'SKU_ALREADY_EXISTS'});console.error('[owner-product-save]',e.message);return res.status(500).json({error:'OWNER_PRODUCT_SAVE_FAILED'});}finally{client.release();}
});
router.put('/products/:productId/questions',(_req,res)=>res.status(410).json({error:'USE_SINGLE_PRODUCT_FORM'}));
router.get('/products/:productId/questions',(_req,res)=>res.status(410).json({error:'USE_SINGLE_PRODUCT_FORM'}));
router.post('/products/:productId/inventory',(_req,res)=>res.status(410).json({error:'USE_SINGLE_PRODUCT_FORM'}));
router.post('/products/:productId/publish',(_req,res)=>res.status(410).json({error:'USE_SINGLE_PRODUCT_FORM'}));

export default router;
