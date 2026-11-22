'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData } from '../../../../lib/telegram';
import { splitInventoryPayloads } from '../../../../lib/inventory';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const CATEGORIES = [
  ['MLBB','Mobile Legends','MLBB'],['ROBLOX','Roblox','RBLX'],
  ['FREE_FIRE','Free Fire','FFIR'],['GENSHIN','Genshin Impact','GNSH'],['OTHER','Lainnya','OTHR']
];
const TIERS = [['SILVER','Silver','SLV'],['GOLD','Gold','GLD'],['PLATINUM','Platinum','PLT'],['SERVICE','Layanan','SRV']];
const FULFILLMENT = [
  ['REDEEM_CODE','Kode redeem'],['VOUCHER_CODE','Kode voucher'],['LICENSE_KEY','Kunci lisensi'],
  ['GIFT_CODE','Kode hadiah'],['DIGITAL_FILE','Berkas digital'],['SERVICE_INSTRUCTIONS','Petunjuk layanan']
];
const apiMessage = (data) => ({
  TELEGRAM_AUTH_REQUIRED:'Sesi Telegram tidak ditemukan. Masuk kembali melalui Telegram.',
  ADMIN_ACCESS_REQUIRED:'Akun Telegram ini tidak memiliki izin Owner.',
  INVALID_PRODUCT_INPUT:'Periksa kategori, nama, metode pemenuhan, dan harga produk.',
  INVALID_ASSET_PAYLOAD:'Ada baris stok yang tidak sesuai format kode digital yang didukung.',
  INVALID_INVENTORY_INPUT:'Masukkan 1 sampai 100 unit stok, satu kode pada setiap baris.'
}[data?.error] || data?.message || 'Permintaan tidak dapat diproses.');

function nextSku(category, tier, products) {
  const prefix = (CATEGORIES.find((item) => item[0] === category)?.[2] || 'ITEM') + '-' + (TIERS.find((item) => item[0] === tier)?.[2] || 'STD') + '-';
  const used = new Set(products.map((item) => String(item.sku || '').toUpperCase()));
  let number = 1;
  while (used.has(prefix + String(number).padStart(3, '0'))) number += 1;
  return prefix + String(number).padStart(3, '0');
}

export default function NewProductPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ sku:'', gameCategory:'MLBB', tier:'GOLD', name:'', description:'', fulfillmentType:'REDEEM_CODE', salePriceXtr:'', costPriceXtr:'0', rightsReviewReference:'' });
  const [stock, setStock] = useState('');
  const [stockSourceReference, setStockSourceReference] = useState('');
  const [rightsForm, setRightsForm] = useState({ rightsBasis:'', publisherPlatform:'', officialTermsUrl:'', authorizationEvidenceReference:'', chainOfTitle:'', transferMethod:'', region:'', validUntil:'', reviewStatus:'PENDING', reviewNotes:'', ownerAttested:false });
  const [manualSku, setManualSku] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const headers = useMemo(() => ({ 'content-type':'application/json', 'x-telegram-init-data':getInitData() }), []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [session, response] = await Promise.all([
          fetch(API + '/api/owner-auth/session', { headers:{ 'x-telegram-init-data':getInitData() }, credentials:'include', cache:'no-store' }),
          fetch(API + '/api/admin/products', { headers:{ 'x-telegram-init-data':getInitData() }, credentials:'include', cache:'no-store' })
        ]);
        if (!session.ok || !response.ok) { window.location.replace('/admin'); return; }
        const data = await response.json();
        if (!active) return;
        setProducts(data.products || []);
        setReady(true);
      } catch {
        if (active) setError('Koneksi ke panel Owner gagal. Muat ulang halaman.');
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (manualSku) return;
    setForm((current) => ({ ...current, sku:nextSku(current.gameCategory,current.tier,products) }));
  }, [products, form.gameCategory, form.tier, manualSku]);

  function change(key, value) {
    setForm((current) => ({ ...current, [key]:value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    let productId = null;
    try {
      const response = await fetch(API + '/api/admin/products', {
        method:'POST', headers, credentials:'include',
        body:JSON.stringify({ ...form, salePriceXtr:Number(form.salePriceXtr), costPriceXtr:Number(form.costPriceXtr) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(apiMessage(data));
      productId = data.product.id;

      const reviewReady = Boolean(
        rightsForm.rightsBasis && rightsForm.publisherPlatform.trim()
        && rightsForm.chainOfTitle.trim() && rightsForm.transferMethod.trim()
        && rightsForm.region.trim() && rightsForm.validUntil
      );
      let approved = false;
      if (reviewReady) {
        const reviewResponse = await fetch(API + '/api/admin/products/' + productId + '/rights-review', {
          method:'POST', headers, credentials:'include', body:JSON.stringify(rightsForm)
        });
        const reviewData = await reviewResponse.json();
        if (!reviewResponse.ok) throw new Error(apiMessage(reviewData));
        approved = reviewData.review?.review_status === 'APPROVED';
        setNotice('Produk ' + data.product.sku + ' tersimpan. Pemeriksaan Owner: ' + reviewData.review.review_status + '.');
      } else {
        setNotice('Produk ' + data.product.sku + ' tersimpan sebagai Draf. Lengkapi pemeriksaan CR-05 sebelum menambah stok atau mengaktifkan produk.');
      }

      const lines = splitInventoryPayloads(stock);
      if (lines.length && approved && stockSourceReference.trim()) {
        const inventory = await fetch(API + '/api/admin/products/' + productId + '/inventory', {
          method:'POST', headers, credentials:'include',
          body:JSON.stringify({ payloads:lines, sourceReference:stockSourceReference })
        });
        const inventoryData = await inventory.json();
        if (!inventory.ok) {
          setNotice('Produk dan pemeriksaan Owner tersimpan, tetapi stok belum masuk: ' + apiMessage(inventoryData));
        } else {
          setNotice('Produk, pemeriksaan Owner, dan ' + inventoryData.inserted + ' unit stok terenkripsi berhasil disimpan.');
        }
      } else if (lines.length) {
        setNotice('Produk tersimpan. Stok belum ditambahkan karena pemeriksaan belum APPROVED atau referensi sumber belum lengkap. Tambahkan stok setelah syarat terpenuhi.');
      }

      setProducts((current) => [...current, data.product]);
      setManualSku(false);
      setStock('');
      setStockSourceReference('');
      setForm({ sku:'', gameCategory:form.gameCategory, tier:form.tier, name:'', description:'', fulfillmentType:form.fulfillmentType, salePriceXtr:'', costPriceXtr:'0', rightsReviewReference:'' });
      setRightsForm({ rightsBasis:'', publisherPlatform:'', officialTermsUrl:'', authorizationEvidenceReference:'', chainOfTitle:'', transferMethod:'', region:'', validUntil:'', reviewStatus:'PENDING', reviewNotes:'', ownerAttested:false });
    } catch (e) {
      if (productId) setNotice('Produk sudah tersimpan sebagai Draf, tetapi tahap pemeriksaan/stok belum selesai: ' + e.message);
      else setError(e.message || 'Produk tidak dapat dibuat.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="admin-shell"><div className="admin-notice">{error || 'Memverifikasi akses Owner…'}</div></main>;

  return <main className="admin-shell">
    <header className="admin-head">
      <a className="brand" href="/"><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a>
      <div className="admin-head-actions"><span className="admin-pill">PANEL PEMILIK</span><a className="admin-logout" href="/admin">Dashboard</a></div>
    </header>
    <section className="admin-title">
      <span className="eyebrow muted">KATALOG / PRODUK BARU</span>
      <h1>Input produk</h1>
      <p>Isi informasi produk, tentukan harga, lalu tambahkan stok digital dalam satu proses.</p>
    </section>
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {error && <div className="owner-login-message" role="alert">{error}</div>}
    <section className="admin-panel">
      <div className="admin-section-head"><div><span className="eyebrow muted">LANGKAH 1</span><h2>Informasi produk</h2></div></div>
      <form className="admin-form" onSubmit={submit}>
        <label>SKU <small className="field-hint">Otomatis, bisa diedit</small><input required value={form.sku} onChange={(e)=>{setManualSku(true);change('sku',e.target.value.toUpperCase());}} /></label>
        <label>Kategori<select value={form.gameCategory} onChange={(e)=>change('gameCategory',e.target.value)}>{CATEGORIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Tingkat produk<select value={form.tier} onChange={(e)=>change('tier',e.target.value)}>{TIERS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Nama produk<input required maxLength="160" value={form.name} onChange={(e)=>change('name',e.target.value)} placeholder="Nama yang tampil di katalog" /></label>
        <label className="span-2">Deskripsi produk<textarea rows="4" value={form.description} onChange={(e)=>change('description',e.target.value)} placeholder="Jelaskan isi produk, manfaat, ketentuan, dan cara pemenuhan." /></label>
        <label>Metode pemenuhan<select value={form.fulfillmentType} onChange={(e)=>change('fulfillmentType',e.target.value)}>{FULFILLMENT.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Harga jual (XTR)<input required type="number" min="1" step="1" value={form.salePriceXtr} onChange={(e)=>change('salePriceXtr',e.target.value)} /></label>
        <label>Modal (XTR)<input required type="number" min="0" step="1" value={form.costPriceXtr} onChange={(e)=>change('costPriceXtr',e.target.value)} /></label>
        <label className="span-2">Referensi hak lama (opsional) <small className="field-hint">Catatan bebas ini bukan pengganti pemeriksaan CR-05</small><input value={form.rightsReviewReference} onChange={(e)=>change('rightsReviewReference',e.target.value)} placeholder="URL atau nomor referensi terdahulu" /></label>
        <div className="admin-section-head span-2"><div><span className="eyebrow muted">LANGKAH 2 · CR-05</span><h2>Pemeriksaan internal Owner</h2></div></div>
        <label>Dasar hak<select value={rightsForm.rightsBasis} onChange={e=>setRightsForm({...rightsForm,rightsBasis:e.target.value})}><option value="">Pilih dasar hak</option><option value="OWNER_CREATED">Dibuat internal Owner</option><option value="OWNER_OWNED">Dimiliki Owner</option><option value="AUTHORIZED_VENDOR">Vendor berotorisasi</option><option value="OFFICIAL_DISTRIBUTION">Distribusi resmi</option><option value="LICENSED_CONTENT">Konten berlisensi</option><option value="SERVICE">Layanan internal</option><option value="OTHER">Lainnya</option></select></label>
        <label>Penerbit / platform<input value={rightsForm.publisherPlatform} onChange={e=>setRightsForm({...rightsForm,publisherPlatform:e.target.value})} placeholder="INTERNAL_OWNER untuk produk internal" /></label>
        <label className="span-2">Official terms URL<input type="url" value={rightsForm.officialTermsUrl} onChange={e=>setRightsForm({...rightsForm,officialTermsUrl:e.target.value})} placeholder="https://... bila platform eksternal" /></label>
        <label className="span-2">Referensi bukti otorisasi<input value={rightsForm.authorizationEvidenceReference} onChange={e=>setRightsForm({...rightsForm,authorizationEvidenceReference:e.target.value})} placeholder="URL, nomor surat, kontrak, atau ID dokumen" /></label>
        <label className="span-2">Chain of title / asal produk<textarea rows="3" value={rightsForm.chainOfTitle} onChange={e=>setRightsForm({...rightsForm,chainOfTitle:e.target.value})} placeholder="Asal produk, pemilik sebelumnya, vendor, dan dasar kewenangan." /></label>
        <label className="span-2">Metode transfer / pemenuhan<textarea rows="3" value={rightsForm.transferMethod} onChange={e=>setRightsForm({...rightsForm,transferMethod:e.target.value})} placeholder="Jelaskan prosedur pemenuhan aktual." /></label>
        <label>Wilayah / region<input value={rightsForm.region} onChange={e=>setRightsForm({...rightsForm,region:e.target.value})} placeholder="Indonesia / Global" /></label>
        <label>Berlaku sampai<input type="date" value={rightsForm.validUntil} onChange={e=>setRightsForm({...rightsForm,validUntil:e.target.value})} /></label>
        <label>Status review<select value={rightsForm.reviewStatus} onChange={e=>setRightsForm({...rightsForm,reviewStatus:e.target.value})}><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select></label>
        <label className="span-2">Catatan review<textarea rows="3" value={rightsForm.reviewNotes} onChange={e=>setRightsForm({...rightsForm,reviewNotes:e.target.value})} placeholder="Catatan keputusan internal Owner." /></label>
        <label className="span-2 field-check"><input type="checkbox" checked={rightsForm.ownerAttested} onChange={e=>setRightsForm({...rightsForm,ownerAttested:e.target.checked})} /> Saya menyatakan data yang dimasukkan benar dan bertanggung jawab atas keputusan internal Owner.</label>
        <div className="span-2 admin-form-hint">APPROVED merupakan persetujuan internal Owner. Hak pihak ketiga dan aturan penerbit tetap berlaku.</div>
        <div className="admin-section-head span-2"><div><span className="eyebrow muted">LANGKAH 3</span><h2>Stok awal</h2></div></div>
        <label className="span-2">Referensi sumber/vendor atau asal internal Owner<input value={stockSourceReference} onChange={e=>setStockSourceReference(e.target.value)} placeholder="Nomor dokumen / ID asal stok" /></label>
        <label className="span-2">Kode digital, satu unit per baris <small className="field-hint">Stok hanya disimpan jika pemeriksaan internal Owner berstatus APPROVED.</small><textarea rows="6" value={stock} onChange={(e)=>setStock(e.target.value)} placeholder={"KODE-REDEEM-001\nKODE-REDEEM-002"} /></label>
        <div className="span-2 admin-form-hint">{splitInventoryPayloads(stock).length} unit stok siap disimpan.</div>
        <button className="admin-primary" disabled={busy}>{busy ? 'Menyimpan…' : stock.trim() ? 'Simpan produk + stok awal' : 'Simpan produk sebagai Draf'}</button>
      </form>
    </section>
  </main>;
}
