'use client';

import { useCallback,useEffect,useMemo,useState } from 'react';
import { getInitData } from '../../../lib/telegram';
import './page.css';

const API=process.env.NEXT_PUBLIC_API_BASE_URL||'';
const GAME_CATEGORY={MLBB:'MLBB',FF:'FREE_FIRE',ROBLOX:'ROBLOX',GI:'GENSHIN'};
const FULFILLMENT={'Akun':'GAME_ACCOUNT_TRANSFER','Jasa Joki':'SERVICE_INSTRUCTIONS','Item In-Game':'SERVICE_INSTRUCTIONS'};
const STATUS={DRAFT:'Draf',ACTIVE:'Aktif',PAUSED:'Dijeda',ARCHIVED:'Arsip'};
const initialDraft={variantId:'',sku:'',name:'',description:'',variantSubtype:'',salePriceXtr:'',costPriceXtr:'0',customerTerms:'',fulfillmentEta:'',imageUrl:'',attributes:'{}'};
const initialReview={rightsBasis:'',publisherPlatform:'INTERNAL_OWNER',officialTermsUrl:'',authorizationEvidenceReference:'',chainOfTitle:'',transferMethod:'',region:'Global',validUntil:'',reviewStatus:'PENDING',reviewNotes:'',ownerAttested:false};
const blankAnswer=(question)=>({questionId:Number(question.question_id),responseText:'',proofUrls:[],confirmPostPaymentVault:false});

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
 const isAccount=selectedVariant?.kategori_produk==='Akun';
 const sensitiveQuestion=(question)=>/(login|password|pass|sandi|otp|session|recovery|token)/i.test(question.question||'');

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

 async function createDraft(event){
  event.preventDefault();setBusy(true);setNotice('');setError('');
  try{
   const variant=variants.find(v=>Number(v.variant_id)===Number(draft.variantId));
   if(!variant)throw new Error('Pilih salah satu dari 12 varian resmi.');
   let attributes={};
   try{attributes=JSON.parse(draft.attributes||'{}');}catch{throw new Error('Atribut produk harus berupa JSON object yang valid.');}
   if(!attributes||Array.isArray(attributes)||typeof attributes!=='object')throw new Error('Atribut produk harus berupa objek.');
   const data=await api('/api/admin/v4/products',{method:'POST',body:JSON.stringify({
    variantId:Number(variant.variant_id),sku:draft.sku,name:draft.name,description:draft.description,
    variantSubtype:draft.variantSubtype,salePriceXtr:Number(draft.salePriceXtr),costPriceXtr:Number(draft.costPriceXtr),
    customerTerms:draft.customerTerms,fulfillmentEta:draft.fulfillmentEta,imageUrl:draft.imageUrl||null,
    imageGallery:[],attributes,fulfillmentType:FULFILLMENT[variant.kategori_produk]
   })});
   setDraft(initialDraft);await refresh();setSelectedId(String(data.product.id));
   setNotice('SKU '+data.product.sku+' dibuat sebagai DRAFT. Lengkapi pemeriksaan hak, pertanyaan wajib, dan stok.');
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
   const payload=questions.map(q=>answers[q.question_id]||blankAnswer(q));
   const data=await api('/api/admin/v4/products/'+selected.id+'/questions',{method:'PUT',body:JSON.stringify({answers:payload})});
   await Promise.all([refresh(),loadQuestions()]);
   setNotice('Checklist tersimpan: '+data.completed+'/'+data.total+' pertanyaan siap.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 async function addInventory(event){
  event.preventDefault();if(!selected)return;setBusy(true);setError('');setNotice('');
  try{
   const payload={sourceReference:inventory.sourceReference};
   if(isAccount){
    let parsed;try{parsed=JSON.parse(inventory.payloads);}catch{throw new Error('Data stok akun harus berupa JSON array.');}
    if(!Array.isArray(parsed))throw new Error('Data stok akun harus berupa JSON array.');
    payload.payloads=parsed;
   }else{
    payload.quantity=Number(inventory.quantity);
   }
   const data=await api('/api/admin/v4/products/'+selected.id+'/inventory',{method:'POST',body:JSON.stringify(payload)});
   setInventory({...inventory,payloads:'[\n  {"login":"","password":""}\n]',quantity:'1'});
   await refresh();
   setNotice(data.inserted+' unit stok berhasil dicatat'+(isAccount?' dan dienkripsi per record.':'.'));
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
  <header className="vco-header"><a href="/admin">← Dashboard Owner</a><span>VAULT CORE / OWNER V4</span><button type="button" onClick={()=>refresh().catch(e=>setError(e.message))}>Muat ulang</button></header>
  <section className="vco-hero"><div><span>MASTER KATALOG · 12 VARIAN · 47 PERTANYAAN</span><h1>Persiapan Produk.</h1><p>Kelola SKU, hak penjualan, checklist, stok, dan publikasi dari satu alur Owner.</p></div><div className="vco-stats"><b>{variants.length}<small>Varian</small></b><b>{products.length}<small>SKU tersimpan</small></b></div></section>
  {error&&<div className="vco-alert error" role="alert">{error}</div>}
  {notice&&<div className="vco-alert" role="status">{notice}</div>}
  <section className="vco-card">
   <div className="vco-section-head"><div><span>STEP 01</span><h2>Buat SKU baru</h2></div><small>Produk baru dimulai sebagai DRAFT</small></div>
   <form onSubmit={createDraft} className="vco-grid">
    <label className="wide">Master varian<select required value={draft.variantId} onChange={e=>setDraft({...draft,variantId:e.target.value})}><option value="">Pilih 12 varian resmi</option>{variants.map(v=><option key={v.variant_id} value={v.variant_id}>{v.variant_id}. {v.nama_game} · {v.kategori_produk} · {v.jenis_varian}</option>)}</select></label>
    <label>SKU<input required value={draft.sku} onChange={e=>setDraft({...draft,sku:e.target.value.toUpperCase()})} placeholder="ML-JOKI-001"/></label>
    <label>Nama produk<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label>Harga jual (XTR)<input required type="number" min="2" step="1" value={draft.salePriceXtr} onChange={e=>setDraft({...draft,salePriceXtr:e.target.value})}/></label>
    <label>Harga modal internal (XTR)<input type="number" min="0" step="1" value={draft.costPriceXtr} onChange={e=>setDraft({...draft,costPriceXtr:e.target.value})}/></label>
    <label>Subtipe varian<input value={draft.variantSubtype} onChange={e=>setDraft({...draft,variantSubtype:e.target.value})} placeholder="Rincian spesifik SKU"/></label>
    <label>Estimasi fulfillment<input value={draft.fulfillmentEta} onChange={e=>setDraft({...draft,fulfillmentEta:e.target.value})}/></label>
    <label className="wide">Deskripsi<textarea rows="3" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    <label className="wide">Ketentuan produk<textarea rows="3" value={draft.customerTerms} onChange={e=>setDraft({...draft,customerTerms:e.target.value})}/></label>
    <label className="wide">URL gambar HTTPS atau /assets/<input value={draft.imageUrl} onChange={e=>setDraft({...draft,imageUrl:e.target.value})}/></label>
    <label className="wide">Atribut publik (JSON, tanpa kredensial)<textarea rows="4" value={draft.attributes} onChange={e=>setDraft({...draft,attributes:e.target.value})}/></label>
    <div className="wide vco-form-actions"><button disabled={busy}>{busy?'Menyimpan…':'Simpan DRAFT SKU'}</button></div>
   </form>
  </section>

  <section className="vco-card">
   <div className="vco-section-head"><div><span>STEP 02</span><h2>Produk dan kesiapan</h2></div><small>Harga, status dan stok berada di bawah Owner</small></div>
   <div className="vco-product-layout">
    <div className="vco-product-list">{products.map(p=><button type="button" key={p.id} className={String(p.id)===selectedId?'active':''} onClick={()=>setSelectedId(String(p.id))}><strong>{p.sku}</strong><span>{p.name}</span><small>{p.variant_name||'Belum dipetakan'} · {STATUS[p.status]||p.status}</small><small>{p.completed_questions}/{p.required_questions} pertanyaan · {p.available_stock} stok</small></button>)}</div>
    {selected?<div className="vco-selected">
      <div className="vco-selected-head"><div><span>SKU {selected.sku}</span><h3>{selected.name}</h3><p>{selected.game_name} · {selected.variant_category} · {selected.variant_name}</p></div><b className={selected.status==='ACTIVE'?'good':''}>{STATUS[selected.status]||selected.status}</b></div>
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
    <div className="vco-section-head"><div><span>STEP 04</span><h2>47 pertanyaan wajib</h2></div><small>{questions.length} pertanyaan sesuai varian SKU</small></div>
    <form onSubmit={saveAnswers} className="vco-questions">
     {questions.map(q=>{
      const value=answers[q.question_id]||blankAnswer(q);
      const sensitive=sensitiveQuestion(q);
      return <div className="vco-question" key={q.question_id}>
       <span>{q.question_order}. WAJIB</span><strong>{q.question}</strong>
       {sensitive?<div className="vco-secret-note">
        <p>Field sensitif tidak disimpan di checklist. {selectedVariant?.kategori_produk==='Jasa Joki'?'Pelanggan mengirim data akses setelah pembayaran dan menyimpannya di vault terenkripsi.':'Masukkan kredensial per unit melalui form stok terenkripsi.'}</p>
        {selectedVariant?.kategori_produk==='Jasa Joki'&&<label className="vco-check"><input type="checkbox" checked={value.confirmPostPaymentVault} onChange={e=>setAnswers({...answers,[q.question_id]:{...value,confirmPostPaymentVault:e.target.checked}})}/> Konfirmasi bahwa data akses pelanggan akan diserahkan setelah pembayaran melalui vault.</label>}
        {selectedVariant?.kategori_produk==='Akun'&&<small>Status otomatis menjadi SECRET_IN_VAULT setelah unit stok terenkripsi lengkap.</small>}
       </div>:<label><textarea rows="2" value={value.responseText} onChange={e=>setAnswers({...answers,[q.question_id]:{...value,responseText:e.target.value}})} placeholder="Jawaban wajib Owner"/><input value={(value.proofUrls||[]).join('\n')} onChange={e=>setAnswers({...answers,[q.question_id]:{...value,proofUrls:e.target.value.split('\n').map(s=>s.trim()).filter(Boolean)}})} placeholder="URL bukti HTTPS / satu URL per baris"/></label>}
      </div>;
     })}
     <button disabled={busy||questions.length===0}>{busy?'Menyimpan…':'Simpan semua jawaban wajib'}</button>
    </form>
   </section>

   <section className="vco-card">
    <div className="vco-section-head"><div><span>STEP 05</span><h2>Tambah stok dan data fulfillment</h2></div><small>{isAccount?'Data akses akun dienkripsi per record':'Slot fulfillment manual tanpa kredensial pelanggan'}</small></div>
    <form className="vco-grid" onSubmit={addInventory}>
     <label className="wide">Referensi sumber stok<input required value={inventory.sourceReference} onChange={e=>setInventory({...inventory,sourceReference:e.target.value})} placeholder={isAccount?'VAULTCORE_OWNER_ACCOUNT_STOCK_V1:INTERNAL-OWNER':'VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:OWNER-OPS'}/></label>
     {isAccount?<label className="wide">JSON array kredensial akun (disimpan terenkripsi)<textarea rows="7" value={inventory.payloads} onChange={e=>setInventory({...inventory,payloads:e.target.value})}/><small>Contoh: [{'{'}"login":"...","password":"..."{'}'}]. Kredensial tidak masuk checklist atau atribut produk.</small></label>:<label>Jumlah slot manual<input type="number" min="1" max="100" value={inventory.quantity} onChange={e=>setInventory({...inventory,quantity:e.target.value})}/></label>}
     <div className="wide vco-form-actions"><button disabled={busy||!selected.rights_approved}>{busy?'Menyimpan…':'Tambahkan stok'}</button><small>Hak harus APPROVED dan masih berlaku sebelum stok dapat ditambahkan.</small></div>
    </form>
   </section>

   <section className="vco-card vco-publish">
    <div><span>STEP 06</span><h2>Terbitkan ke katalog</h2><p>Publikasi hanya berhasil jika hak aktif, harga XTR, stok, dan semua pertanyaan wajib sudah terpenuhi.</p></div>
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
