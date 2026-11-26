'use client';

import { useCallback,useEffect,useMemo,useState } from 'react';
import { getInitData } from '../../../lib/telegram';
import './page.css';

const API=process.env.NEXT_PUBLIC_API_BASE_URL||'';
const GAME_CATEGORY={MLBB:'MLBB',FF:'FREE_FIRE',ROBLOX:'ROBLOX',GI:'GENSHIN'};
const FULFILLMENT={'Akun':'GAME_ACCOUNT_TRANSFER','Jasa Joki':'SERVICE_INSTRUCTIONS','Item In-Game':'SERVICE_INSTRUCTIONS'};
const STATUS={DRAFT:'Draf',ACTIVE:'Aktif',PAUSED:'Dijeda',ARCHIVED:'Arsip'};
const LEGACY_VARIANT_BY_SLUG={'mlbb-akun':1,'free-fire-akun':4,'roblox-akun':8,'genshin-akun':10,'roblox-blox-fruits':6,'roblox-adopt-me':7,'roblox-murder-mystery-2':7};
const initialDraft={variantId:'',sku:'',name:'',description:'',variantSubtype:'',salePriceXtr:'',costPriceXtr:'0',customerTerms:'',fulfillmentEta:'',imageGalleryText:'',attributes:{}};
const initialReview={rightsBasis:'',publisherPlatform:'INTERNAL_OWNER',officialTermsUrl:'',authorizationEvidenceReference:'',chainOfTitle:'',transferMethod:'',region:'Global',validUntil:'',reviewStatus:'PENDING',reviewNotes:'',ownerAttested:false};
const blankAnswer=(question)=>({questionId:Number(question.question_id),responseText:''});

function authHeaders(json=true){
  return {...(json?{'content-type':'application/json'}:{}),'x-telegram-init-data':getInitData()};
}
async function api(path,options={}){
  const response=await fetch(API+path,{credentials:'include',cache:'no-store',...options,headers:{...authHeaders(options.body!==undefined),...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||data.error||'Permintaan Owner gagal.');
  return data;
}

export default function OwnerV4Page(){
 const [authenticated,setAuthenticated]=useState(false);
 const [checking,setChecking]=useState(true);
 const [notice,setNotice]=useState('');
 const [variants,setVariants]=useState([]);
 const [products,setProducts]=useState([]);
 const [selectedId,setSelectedId]=useState('');
 const [mappingVariantId,setMappingVariantId]=useState('');
 const [draft,setDraft]=useState(initialDraft);
 const [review,setReview]=useState(initialReview);
 const [questions,setQuestions]=useState([]);
 const [answers,setAnswers]=useState({});
 const [inventory,setInventory]=useState({sourceReference:'',quantity:'1',payloads:'[\n  {"login":"","password":""}\n]'});
 const [secretRequest,setSecretRequest]=useState({orderNumber:'',orderItemId:'',reason:'Pemenuhan layanan Joki'});
 const [secretResult,setSecretResult]=useState(null);
 const [showSecretPassword,setShowSecretPassword]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 const selected=useMemo(()=>products.find(p=>String(p.id)===String(selectedId))||null,[products,selectedId]);
 const selectedVariant=useMemo(()=>variants.find(v=>Number(v.variant_id)===Number(selected?.variant_id)),[variants,selected]);
 const draftVariant=useMemo(()=>variants.find(v=>Number(v.variant_id)===Number(draft.variantId)),[variants,draft.variantId]);
 const isAccount=selectedVariant?.kategori_produk==='Akun';

 const refresh=useCallback(async()=>{
   const [variantData,productData]=await Promise.all([
     api('/api/admin/v4/variants'),
     api('/api/admin/v4/products')
   ]);
   setVariants(variantData.variants||[]);
   setProducts(productData.products||[]);
   setSelectedId((current)=>current||String(productData.products?.[0]?.id||''));
 },[]);

 useEffect(()=>{
  let alive=true;
  (async()=>{
   try{
    const session=await fetch(API+'/api/owner-auth/session',{headers:{'x-telegram-init-data':getInitData()},credentials:'include',cache:'no-store'});
    if(!session.ok)throw new Error('Sesi Owner belum aktif. Login melalui Dashboard Owner terlebih dahulu.');
    if(!alive)return;
    setAuthenticated(true);
    await refresh();
   }catch(e){if(alive)setError(e.message||'Akses Owner tidak tersedia.');}
   finally{if(alive)setChecking(false);}
  })();
  return()=>{alive=false;};
 },[refresh]);

 const loadQuestions=useCallback(async()=>{
  if(!selected)return;
  try{
   const data=await api('/api/admin/v4/products/'+selected.id+'/questions');
   setQuestions(data.questions||[]);
   setAnswers(Object.fromEntries((data.questions||[]).map(q=>[q.question_id,{
     questionId:Number(q.question_id),responseText:q.response_text||'',
     proofUrls:Array.isArray(q.proof_urls)?q.proof_urls:[],
     confirmPostPaymentVault:q.response_status==='OWNER_VERIFIED'
   }])));
  }catch(e){setQuestions([]);setNotice(e.message);}
 },[selected]);
 useEffect(()=>{loadQuestions();},[loadQuestions]);

 async function mapLegacyProduct(event){
  event.preventDefault();if(!selected)return;setBusy(true);setError('');setNotice('');
  try{
   const expected=LEGACY_VARIANT_BY_SLUG[selected.legacy_category_slug];
   if(!expected||Number(mappingVariantId)!==expected)throw new Error('Pilih varian kanonis yang sesuai kategori produk lama.');
   const data=await api('/api/admin/v4/products/'+selected.id+'/variant',{method:'PUT',body:JSON.stringify({variantId:Number(mappingVariantId)})});
   await refresh();setNotice('SKU '+data.product.sku+' dipetakan ke varian v4 dan dipindahkan ke DRAFT untuk pemeriksaan ulang.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 async function createDraft(event){
  event.preventDefault();setBusy(true);setNotice('');setError('');
  try{
   const variant=draftVariant;
   if(!variant)throw new Error('Pilih salah satu dari 12 varian resmi.');
   const imageGallery=draft.imageGalleryText.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
   if(imageGallery.length<1||imageGallery.length>8)throw new Error('Isi 1 sampai 8 URL gambar produk, satu URL per baris.');
   const data=await api('/api/admin/v4/products',{method:'POST',body:JSON.stringify({
    variantId:Number(variant.variant_id),sku:draft.sku,name:draft.name,description:draft.description,
    variantSubtype:draft.variantSubtype,salePriceXtr:Number(draft.salePriceXtr),costPriceXtr:Number(draft.costPriceXtr),
    customerTerms:draft.customerTerms,fulfillmentEta:draft.fulfillmentEta,imageUrl:imageGallery[0],
    imageGallery,attributes:draft.attributes,fulfillmentType:FULFILLMENT[variant.kategori_produk]
   })});
   setDraft(initialDraft);await refresh();setSelectedId(String(data.product.id));
   setNotice('SKU '+data.product.sku+' dibuat sebagai DRAFT. Spesifikasi produk tersimpan; lanjutkan pemeriksaan hak dan stok aktual.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 async function saveRights(event){
  event.preventDefault();if(!selected)return;setBusy(true);setError('');setNotice('');
  try{
   const data=await api('/api/admin/products/'+selected.id+'/rights-review',{method:'POST',body:JSON.stringify(review)});
   await refresh();
   setNotice(data.message||'Pemeriksaan hak tersimpan. Status publikasi tetap dikontrol Owner.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 async function saveAnswers(event){
  event.preventDefault();if(!selected)return;setBusy(true);setError('');setNotice('');
  try{
   const payload=questions.map(q=>({questionId:Number(q.question_id),responseText:answers[q.question_id]?.responseText||''}));
   const data=await api('/api/admin/v4/products/'+selected.id+'/questions',{method:'PUT',body:JSON.stringify({answers:payload})});
   await Promise.all([refresh(),loadQuestions()]);
   setNotice('Spesifikasi tersimpan: '+data.completed+'/'+data.total+' field wajib.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 async function addInventory(event){
  event.preventDefault();if(!selected)return;setBusy(true);setError('');setNotice('');
  try{
   const payload={sourceReference:inventory.sourceReference};
   if(isAccount){
    if(!inventory.replaceLegacyStock)throw new Error('Konfirmasi penggantian stok lama yang belum masuk vault.');
    let parsed;try{parsed=JSON.parse(inventory.payloads);}catch{throw new Error('Data stok akun harus berupa JSON array.');}
    if(!Array.isArray(parsed))throw new Error('Data stok akun harus berupa JSON array.');
    payload.payloads=parsed;
    payload.replaceLegacyStock=true;
   }else{
    payload.quantity=Number(inventory.quantity);
   }
   const data=await api('/api/admin/v4/products/'+selected.id+'/inventory',{method:'POST',body:JSON.stringify(payload)});
   setInventory({...inventory,payloads:'[\n  {"login":"","password":""}\n]',quantity:'1',replaceLegacyStock:false});
   await refresh();
   setNotice(data.inserted+' unit stok berhasil dicatat'+(isAccount?' dan dienkripsi per record. '+(data.replacedLegacyStockCount||0)+' unit stok legacy tanpa vault dinonaktifkan.':'.'));
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 async function readJokiAccess(event){
  event.preventDefault();setBusy(true);setError('');setNotice('');setSecretResult(null);
  try{
   if(!secretRequest.orderNumber.trim()||!Number(secretRequest.orderItemId)||secretRequest.reason.trim().length<3)throw new Error('Isi nomor pesanan, Order Item ID, dan alasan akses.');
   const data=await api('/api/admin/v4/orders/'+encodeURIComponent(secretRequest.orderNumber.trim())+'/customer-access/'+Number(secretRequest.orderItemId)+'/read',{method:'POST',body:JSON.stringify({reason:secretRequest.reason})});
   setSecretResult(data.credentials);
   setShowSecretPassword(false);
   setNotice('Data akses dibuka melalui audit Owner dan dicatat pada access log.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function publish(){
  if(!selected)return;setBusy(true);setError('');setNotice('');
  try{
   const data=await api('/api/admin/v4/products/'+selected.id+'/publish',{method:'POST',body:JSON.stringify({})});
   await refresh();setNotice('SKU '+data.product.sku+' berhasil diterbitkan ke katalog v4.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 if(checking)return <main className="vco-shell"><p>Memeriksa sesi Owner…</p></main>;
 if(!authenticated)return <main className="vco-shell"><section className="vco-card"><h1>Panel Owner v4</h1><p>{error||'Akses Owner wajib melalui sesi Telegram.'}</p><a href="/admin">Buka Dashboard Owner untuk login</a></section></main>;

 return <main className="vco-shell">
  <header className="vco-header"><a href="/admin">← Dashboard Owner</a><div className="vco-header-brand"><img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/><span>OWNER V4</span></div><button type="button" onClick={()=>refresh().catch(e=>setError(e.message))}>Muat ulang</button></header>
  <section className="vco-hero"><div><span>MASTER KATALOG · 12 VARIAN · FIELD LISTING PEMBELI</span><h1>Persiapan Produk.</h1><p>Isi foto, identitas, harga, spesifikasi yang tampil ke pembeli, pemeriksaan hak, dan stok aktual.</p></div><div className="vco-stats"><b>{variants.length}<small>Varian</small></b><b>{products.length}<small>SKU tersimpan</small></b></div></section>
  {error&&<div className="vco-alert error" role="alert">{error}</div>}
  {notice&&<div className="vco-alert" role="status">{notice}</div>}
  <section className="vco-card">
   <div className="vco-section-head"><div><span>STEP 01</span><h2>Buat SKU baru</h2></div><small>Produk baru dimulai sebagai DRAFT</small></div>
   <form onSubmit={createDraft} className="vco-grid">
    <label className="wide">Master varian<select required value={draft.variantId} onChange={e=>{
      const variant=variants.find(item=>Number(item.variant_id)===Number(e.target.value));
      const attributes=Object.fromEntries((variant?.questions||[]).map(field=>[field.key,'']));
      setDraft({...draft,variantId:e.target.value,attributes});
    }}><option value="">Pilih game dan jenis produk</option>{variants.map(v=><option key={v.variant_id} value={v.variant_id}>{v.variant_id}. {v.nama_game} · {v.kategori_produk} · {v.jenis_varian}</option>)}</select></label>
    <label>SKU internal<input required value={draft.sku} onChange={e=>setDraft({...draft,sku:e.target.value.toUpperCase()})} placeholder="ML-AKUN-001"/></label>
    <label>Nama Produk<input required maxLength="160" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Akun MLBB Mythic 120 Skin"/></label>
    <label>Harga Jual (XTR)<input required type="number" min="2" step="1" value={draft.salePriceXtr} onChange={e=>setDraft({...draft,salePriceXtr:e.target.value})}/></label>
    <label>Harga Modal Internal (XTR)<input type="number" min="0" step="1" value={draft.costPriceXtr} onChange={e=>setDraft({...draft,costPriceXtr:e.target.value})}/></label>
    <label>Subtipe Varian<input value={draft.variantSubtype} onChange={e=>setDraft({...draft,variantSubtype:e.target.value})} placeholder="Mis. Mythic / Sultan"/></label>
    <label>Estimasi Pemenuhan<input value={draft.fulfillmentEta} onChange={e=>setDraft({...draft,fulfillmentEta:e.target.value})} placeholder="Mis. Instan / 1–2 jam"/></label>
    <label className="wide">Galeri Foto Produk · 1–8 URL<textarea required rows="4" value={draft.imageGalleryText} onChange={e=>setDraft({...draft,imageGalleryText:e.target.value})} placeholder={"https://gambar-utama.jpg\nhttps://gambar-detail-1.jpg\nhttps://gambar-detail-2.jpg"}/><small>Satu URL HTTPS atau path /assets/ per baris. Upload file langsung belum tersedia pada penyimpanan produksi saat ini.</small></label>
    <label className="wide">Deskripsi Utama Produk<textarea rows="3" maxLength="4000" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Jelaskan isi produk secara ringkas dan jelas."/></label>
    {draftVariant&&<div className="wide vco-listing-fields"><div><strong>Deskripsi Produk</strong><small>Field wajib ini tampil di detail penjualan untuk pembeli.</small></div>
     {(draftVariant.questions||[]).map(field=><label key={field.question_id}>{field.question}
      {field.input_type==='select'?<select required value={draft.attributes[field.key]||''} onChange={e=>setDraft({...draft,attributes:{...draft.attributes,[field.key]:e.target.value}})}><option value="">{field.placeholder||'Pilih jawaban'}</option>{(field.options||[]).map(option=><option key={option} value={option}>{option}</option>)}</select>
      :field.input_type==='textarea'?<textarea required rows="3" maxLength={field.max_length||500} value={draft.attributes[field.key]||''} onChange={e=>setDraft({...draft,attributes:{...draft.attributes,[field.key]:e.target.value}})} placeholder={field.placeholder}/>
      :<input required type={field.input_type==='number'?'number':'text'} min={field.input_type==='number'?0:undefined} step={field.input_type==='number'?1:undefined} maxLength={field.input_type==='number'?undefined:(field.max_length||160)} value={draft.attributes[field.key]||''} onChange={e=>setDraft({...draft,attributes:{...draft.attributes,[field.key]:e.target.value}})} placeholder={field.placeholder}/>}
     </label>)}
    </div>}
    <label className="wide">Ketentuan Produk untuk Pembeli<textarea rows="3" maxLength="4000" value={draft.customerTerms} onChange={e=>setDraft({...draft,customerTerms:e.target.value})} placeholder="Ketentuan garansi dan pemenuhan produk."/></label>
    <div className="wide vco-form-actions"><button disabled={busy||!draftVariant}>{busy?'Menyimpan…':'Simpan DRAFT Produk'}</button><small>Stok diisi melalui langkah inventory setelah pemeriksaan hak.</small></div>
   </form>
  </section>

  <section className="vco-card">
   <div className="vco-section-head"><div><span>STEP 02</span><h2>Produk dan kesiapan</h2></div><small>Harga, status dan stok berada di bawah Owner</small></div>
   <div className="vco-product-layout">
    <div className="vco-product-list">{products.map(p=><button type="button" key={p.id} className={String(p.id)===selectedId?'active':''} onClick={()=>setSelectedId(String(p.id))}><strong>{p.sku}</strong><span>{p.name}</span><small>{p.variant_name||'Belum dipetakan'} · {STATUS[p.status]||p.status}</small><small>{p.completed_questions}/{p.required_questions} spesifikasi · {p.available_stock} stok</small></button>)}</div>
    {selected?<div className="vco-selected">
      <div className="vco-selected-head"><div><span>SKU {selected.sku}</span><h3>{selected.name}</h3><p>{selected.game_name} · {selected.variant_category} · {selected.variant_name}</p></div><b className={selected.status==='ACTIVE'?'good':''}>{STATUS[selected.status]||selected.status}</b></div>
      {!selected.variant_id&&<form className="vco-map-legacy" onSubmit={mapLegacyProduct}>
       <div><strong>SKU legacy belum dipetakan</strong><small>Kategori sumber: {selected.legacy_category_slug||'tidak diketahui'}. SKU hanya dapat dipetakan bila kategori sumber mempunyai padanan v4 yang eksplisit.</small></div>
       {LEGACY_VARIANT_BY_SLUG[selected.legacy_category_slug]?<>
        <label>Varian kanonis<select required value={mappingVariantId} onChange={e=>setMappingVariantId(e.target.value)}><option value="">Pilih varian yang sesuai</option>{variants.filter(v=>Number(v.variant_id)===LEGACY_VARIANT_BY_SLUG[selected.legacy_category_slug]).map(v=><option key={v.variant_id} value={v.variant_id}>{v.variant_id}. {v.nama_game} · {v.kategori_produk} · {v.jenis_varian}</option>)}</select></label>
        <button disabled={busy||!mappingVariantId}>Petakan dan pindahkan ke DRAFT</button>
       </>:<p className="vco-map-blocked">Kategori legacy ini belum mempunyai varian v4 yang cocok. Jangan dipaksakan ke kategori lain.</p>}
      </form>}
      <div className="vco-metrics"><span>Harga <b>{Number(selected.sale_price_xtr).toLocaleString('id-ID')} XTR</b></span><span>Stok <b>{selected.available_stock}</b></span><span>Vault <b>{selected.vaulted_stock}</b></span><span>Checklist <b>{selected.completed_questions}/{selected.required_questions}</b></span><span>Hak <b>{selected.rights_approved?'APPROVED':'BELUM DISETUJUI'}</b></span></div>
    </div>:<div className="vco-empty">Pilih SKU untuk melengkapi pemeriksaan Owner.</div>}
   </div>
  </section>

  {selected&&<>
   <section className="vco-card">
    <div className="vco-section-head"><div><span>STEP 03</span><h2>Pemeriksaan hak CR-05</h2></div><small>Wajib sebelum stok dan publikasi</small></div>
    <form className="vco-grid" onSubmit={saveRights}>
     <label>Dasar hak<select required value={review.rightsBasis} onChange={e=>setReview({...review,rightsBasis:e.target.value})}><option value="">Pilih dasar</option><option value="OWNER_OWNED">OWNER_OWNED</option><option value="OWNER_CREATED">OWNER_CREATED</option><option value="SERVICE">SERVICE</option><option value="AUTHORIZED_VENDOR">AUTHORIZED_VENDOR</option><option value="OFFICIAL_DISTRIBUTION">OFFICIAL_DISTRIBUTION</option><option value="LICENSED_CONTENT">LICENSED_CONTENT</option><option value="OTHER">OTHER</option></select></label>
     <label>Platform penerbit<input required value={review.publisherPlatform} onChange={e=>setReview({...review,publisherPlatform:e.target.value})} placeholder="INTERNAL_OWNER / nama penerbit"/></label>
     <label>URL ketentuan resmi<input type="url" value={review.officialTermsUrl} onChange={e=>setReview({...review,officialTermsUrl:e.target.value})}/></label>
     <label>Referensi bukti otorisasi<input value={review.authorizationEvidenceReference} onChange={e=>setReview({...review,authorizationEvidenceReference:e.target.value})}/></label>
     <label className="wide">Chain of title / bukti kepemilikan<textarea required rows="3" value={review.chainOfTitle} onChange={e=>setReview({...review,chainOfTitle:e.target.value})}/></label>
     <label>Metode transfer / fulfillment<textarea required rows="2" value={review.transferMethod} onChange={e=>setReview({...review,transferMethod:e.target.value})}/></label>
     <label>Region<input required value={review.region} onChange={e=>setReview({...review,region:e.target.value})}/></label>
     <label>Berlaku sampai<input required type="date" value={review.validUntil} onChange={e=>setReview({...review,validUntil:e.target.value})}/></label>
     <label>Status review<select value={review.reviewStatus} onChange={e=>setReview({...review,reviewStatus:e.target.value})}><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select></label>
     <label className="wide">Catatan review<textarea rows="2" value={review.reviewNotes} onChange={e=>setReview({...review,reviewNotes:e.target.value})}/></label>
     <label className="wide vco-check"><input type="checkbox" checked={review.ownerAttested} onChange={e=>setReview({...review,ownerAttested:e.target.checked})}/> Saya sebagai Owner mengonfirmasi dasar hak dan bukti yang dicatat benar.</label>
     <div className="wide vco-form-actions"><button disabled={busy}>Simpan pemeriksaan hak</button><small>Persetujuan hak tidak otomatis menerbitkan produk v4.</small></div>
    </form>
   </section>

   <section className="vco-card">
    <div className="vco-section-head"><div><span>STEP 04</span><h2>Spesifikasi Produk</h2></div><small>{questions.length} field publik untuk detail penjualan</small></div>
    <form onSubmit={saveAnswers} className="vco-questions">
     {questions.map(q=>{
      const value=answers[q.question_id]||blankAnswer(q);
      return <div className="vco-question" key={q.question_id}>
       <span>{q.question_order}. WAJIB</span><strong>{q.question}</strong>
       <label>{q.input_type==='select'?<select required value={value.responseText} onChange={e=>setAnswers({...answers,[q.question_id]:{...value,responseText:e.target.value}})}><option value="">{q.placeholder||'Pilih jawaban'}</option>{(q.options||[]).map(option=><option key={option} value={option}>{option}</option>)}</select>
       :q.input_type==='textarea'?<textarea required rows="3" maxLength={q.max_length||500} value={value.responseText} onChange={e=>setAnswers({...answers,[q.question_id]:{...value,responseText:e.target.value}})} placeholder={q.placeholder}/>
       :<input required type={q.input_type==='number'?'number':'text'} min={q.input_type==='number'?0:undefined} step={q.input_type==='number'?1:undefined} maxLength={q.input_type==='number'?undefined:(q.max_length||160)} value={value.responseText} onChange={e=>setAnswers({...answers,[q.question_id]:{...value,responseText:e.target.value}})} placeholder={q.placeholder}/>}</label>
      </div>;
     })}
     <button disabled={busy||questions.length===0}>{busy?'Menyimpan…':'Simpan spesifikasi produk'}</button>
    </form>
   </section>

   <section className="vco-card">
    <div className="vco-section-head"><div><span>STEP 05</span><h2>Stok Aktual Produk</h2></div><small>{isAccount?'Data akses akun dienkripsi per record':'Slot fulfillment manual tanpa kredensial pelanggan'}</small></div>
    <form className="vco-grid" onSubmit={addInventory}>
     <label className="wide">Referensi sumber stok<input required value={inventory.sourceReference} onChange={e=>setInventory({...inventory,sourceReference:e.target.value})} placeholder={isAccount?'VAULTCORE_OWNER_ACCOUNT_STOCK_V1:INTERNAL-OWNER':'VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:OWNER-OPS'}/></label>
     {isAccount&&<label className="wide vco-check"><input type="checkbox" checked={!!inventory.replaceLegacyStock} onChange={e=>setInventory({...inventory,replaceLegacyStock:e.target.checked})}/> Saya mengonfirmasi unit stok lama yang tidak memiliki record vault v4 aktif akan dinonaktifkan setelah kredensial pengganti berhasil dienkripsi.</label>}
     {isAccount?<label className="wide">Unit stok akun (setiap unit dienkripsi)<textarea rows="7" value={inventory.payloads} onChange={e=>setInventory({...inventory,payloads:e.target.value})}/><small>Contoh: [{'{'}"login":"...","password":"..."{'}'}]. Kredensial tidak masuk checklist atau atribut produk.</small></label>:<label>Jumlah Stok (unit)<input type="number" min="1" max="100" value={inventory.quantity} onChange={e=>setInventory({...inventory,quantity:e.target.value})}/></label>}
     <div className="wide vco-form-actions"><button disabled={busy||!selected.rights_approved}>{busy?'Menyimpan…':'Tambahkan stok'}</button><small>Hak harus APPROVED dan masih berlaku sebelum stok dapat ditambahkan.</small></div>
    </form>
   </section>

   <section className="vco-card vco-publish">
    <div><span>STEP 06</span><h2>Terbitkan ke katalog</h2><p>Publikasi hanya berhasil jika hak aktif, harga XTR, stok aktual dan seluruh spesifikasi wajib sudah lengkap.</p></div>
    <button type="button" disabled={busy||selected.status==='ACTIVE'} onClick={publish}>{busy?'Memproses…':'Terbitkan SKU'}</button>
   </section>
  </>}
  <section className="vco-card">
   <div className="vco-section-head"><div><span>OWNER SECURE ACCESS</span><h2>Buka data akses Joki</h2></div><small>Setiap pembacaan dicatat pada audit log</small></div>
   <form className="vco-grid" onSubmit={readJokiAccess}>
    <label>Nomor pesanan<input required value={secretRequest.orderNumber} onChange={e=>setSecretRequest({...secretRequest,orderNumber:e.target.value.toUpperCase()})} placeholder="VC-…"/></label>
    <label>Order Item ID<input required type="number" min="1" value={secretRequest.orderItemId} onChange={e=>setSecretRequest({...secretRequest,orderItemId:e.target.value})}/></label>
    <label className="wide">Alasan akses<input required minLength="3" maxLength="500" value={secretRequest.reason} onChange={e=>setSecretRequest({...secretRequest,reason:e.target.value})}/></label>
    <div className="wide vco-form-actions"><button disabled={busy}>{busy?'Mengambil melalui vault…':'Buka kredensial Joki'}</button><small>Hanya Owner yang telah login dapat mengakses data order berstatus PAID/FULFILLING.</small></div>
   </form>
   {secretResult&&<div className="vco-secret-result"><div><span>LOGIN / EMAIL</span><strong>{secretResult.login}</strong></div><div><span>PASSWORD</span><div className="vco-secret-password"><input readOnly type={showSecretPassword?'text':'password'} value={secretResult.password||''}/><button type="button" onClick={()=>setShowSecretPassword(v=>!v)}>{showSecretPassword?'Sembunyikan':'Tampilkan'}</button></div></div><button type="button" className="vco-clear-secret" onClick={()=>{setSecretResult(null);setShowSecretPassword(false);}}>Tutup dan bersihkan tampilan</button></div>}
  </section>
  <footer className="vco-footer">VAULT CORE · Owner authority · Telegram Stars (XTR)</footer>
 </main>;
}
