'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData } from '../../../../lib/telegram';
import { splitInventoryPayloads } from '../../../../lib/inventory';
import { parseProductAttributesText } from '../../../../lib/product-attributes';
import { GAME_NAMES } from '../../../../lib/marketplace.js';
import { StoreHeader } from '../../../../components/store-navigation.jsx';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const CATEGORIES = [
  ['MLBB',GAME_NAMES.MLBB,'MLBB'],['FREE_FIRE',GAME_NAMES.FREE_FIRE,'FFIR'],
  ['ROBLOX',GAME_NAMES.ROBLOX,'RBLX'],['GENSHIN',GAME_NAMES.GENSHIN,'GNSH']
];
const ACCOUNT_CATEGORY_SLUGS = {MLBB:'mlbb-akun',FREE_FIRE:'free-fire-akun',ROBLOX:'roblox-akun',GENSHIN:'genshin-akun'};
const apiMessage = (data) => ({
  TELEGRAM_AUTH_REQUIRED:'Sesi Telegram tidak ditemukan. Masuk kembali melalui Telegram.',
  ADMIN_ACCESS_REQUIRED:'Akun Telegram ini tidak memiliki izin Owner.',
  INVALID_PRODUCT_INPUT:'Periksa SKU, game, subkategori Akun, spesifikasi akun, dan harga.',
  INVALID_PRODUCT_IMAGE_URL:'Gunakan URL gambar HTTPS atau path lokal /assets/ yang valid.',
  PRODUCT_SKU_ALREADY_EXISTS:'SKU tersebut sudah digunakan produk lain.',
  PRODUCT_REVIEW_REQUIRED_AFTER_DETAIL_CHANGE:'Metode pemenuhan berubah. Simpan review CR-05 baru sebelum mengaktifkan SKU.',
  PRODUCT_HAS_OPEN_ORDERS:'Metode pemenuhan belum dapat diubah karena masih ada pesanan aktif untuk SKU ini. Selesaikan atau rekonsiliasi pesanan terlebih dahulu.',
  INVALID_ASSET_PAYLOAD:'Ada baris stok yang tidak sesuai format data akun yang didukung.',
  INVALID_INVENTORY_INPUT:'Masukkan 1 sampai 100 data akun, satu akun pada setiap baris.'
}[data?.error] || data?.message || 'Permintaan tidak dapat diproses.');

function nextSku(category, products) {
  const prefix = (CATEGORIES.find((item) => item[0] === category)?.[2] || 'GAME') + '-ACC-';
  const used = new Set(products.map((item) => String(item.sku || '').toUpperCase()));
  let number = 1;
  while (used.has(prefix + String(number).padStart(3, '0'))) number += 1;
  return prefix + String(number).padStart(3, '0');
}

export default function NewProductPage() {
  const [products, setProducts] = useState([]);
  const [marketplaceCategories, setMarketplaceCategories] = useState([]);
  const [form, setForm] = useState({ sku:'', gameCategory:'MLBB', marketplaceCategoryId:'', tier:'GOLD', name:'', description:'', fulfillmentType:'GAME_ACCOUNT_TRANSFER', salePriceXtr:'', costPriceXtr:'0', rightsReviewReference:'', imageUrl:'', imageGalleryText:'', attributesText:'', customerTerms:'', fulfillmentEta:'' });
  const [stock, setStock] = useState('');
  const [stockSourceReference, setStockSourceReference] = useState('');
  const [rightsForm, setRightsForm] = useState({ rightsBasis:'', publisherPlatform:'', officialTermsUrl:'', authorizationEvidenceReference:'', chainOfTitle:'', transferMethod:'', region:'', validUntil:'', reviewStatus:'PENDING', reviewNotes:'', ownerAttested:false });
  const [manualSku, setManualSku] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [savedProductId, setSavedProductId] = useState('');
  const [savedReviewFingerprint, setSavedReviewFingerprint] = useState('');
  const [savedReviewStatus, setSavedReviewStatus] = useState('');

  const headers = useMemo(() => ({ 'content-type':'application/json', 'x-telegram-init-data':getInitData() }), []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [session, response, categoryResponse] = await Promise.all([
          fetch(API + '/api/owner-auth/session', { headers:{ 'x-telegram-init-data':getInitData() }, credentials:'include', cache:'no-store' }),
          fetch(API + '/api/admin/products', { headers:{ 'x-telegram-init-data':getInitData() }, credentials:'include', cache:'no-store' }),
          fetch(API + '/api/admin/marketplace-categories', { headers:{ 'x-telegram-init-data':getInitData() }, credentials:'include', cache:'no-store' })
        ]);
        if (!session.ok || !response.ok || !categoryResponse.ok) { window.location.replace('/admin'); return; }
        const data = await response.json();
        const categoryData = await categoryResponse.json();
        if (!active) return;
        setProducts(data.products || []);
        setMarketplaceCategories(categoryData.categories || []);
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
    setForm((current) => ({ ...current, sku:nextSku(current.gameCategory,products) }));
  }, [products, form.gameCategory, manualSku]);

  useEffect(() => {
    const slug = ACCOUNT_CATEGORY_SLUGS[form.gameCategory];
    const match = marketplaceCategories.find((item) => item.slug === slug && item.is_active);
    if (match && String(match.id) !== String(form.marketplaceCategoryId)) {
      setForm((current) => ({...current, marketplaceCategoryId:String(match.id), tier:'GOLD', fulfillmentType:'GAME_ACCOUNT_TRANSFER'}));
    }
  }, [marketplaceCategories, form.gameCategory, form.marketplaceCategoryId]);

  function change(key, value) {
    setForm((current) => ({ ...current, [key]:value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    let productId = savedProductId || '';
    let productRecord = null;
    let currentReviewStatus = savedReviewStatus;
    try {
      const parsedAttributes = parseProductAttributesText(form.attributesText);
      if (!parsedAttributes.ok) throw new Error(parsedAttributes.error);
      const productPayload = {
        ...form,
        attributes:parsedAttributes.value,
        sku:String(form.sku).trim().toUpperCase(),
        marketplaceCategoryId:form.marketplaceCategoryId || null,
        imageGallery:String(form.imageGalleryText || '').split(/\r?\n/).map((value)=>value.trim()).filter(Boolean),
        salePriceXtr:Number(form.salePriceXtr),
        costPriceXtr:Number(form.costPriceXtr)
      };
      if (productId) {
        const response = await fetch(API + '/api/admin/products/' + productId, {
          method:'PATCH', headers, credentials:'include', body:JSON.stringify(productPayload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(apiMessage(data));
        productRecord = data.product;
        if (data.productReviewReset) {
          currentReviewStatus = '';
          setSavedReviewStatus('');
          setSavedReviewFingerprint('');
        }
      } else {
        const response = await fetch(API + '/api/admin/products', {
          method:'POST', headers, credentials:'include', body:JSON.stringify(productPayload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(apiMessage(data));
        productRecord = data.product;
        productId = String(data.product.id);
        setSavedProductId(productId);
      }

      const reviewReady = Boolean(
        rightsForm.rightsBasis
        && rightsForm.chainOfTitle.trim() && rightsForm.transferMethod.trim()
        && rightsForm.region.trim() && rightsForm.validUntil
      );
      const reviewFingerprint = JSON.stringify(rightsForm);
      if (reviewReady && reviewFingerprint !== savedReviewFingerprint) {
        const reviewResponse = await fetch(API + '/api/admin/products/' + productId + '/rights-review', {
          method:'POST', headers, credentials:'include', body:JSON.stringify(rightsForm)
        });
        const reviewData = await reviewResponse.json();
        if (!reviewResponse.ok) throw new Error(apiMessage(reviewData));
        currentReviewStatus = reviewData.review?.review_status || 'PENDING';
        setSavedReviewFingerprint(reviewFingerprint);
        setSavedReviewStatus(currentReviewStatus);
      }

      const lines = splitInventoryPayloads(stock);
      if (lines.length && currentReviewStatus !== 'APPROVED') {
        setNotice('SKU ' + productRecord.sku + ' sudah tersimpan sebagai Draf. Stok tetap tersimpan di formulir. Selesaikan pemeriksaan Owner dengan status APPROVED sebelum melanjutkan.');
        return;
      }
      if (lines.length && !stockSourceReference.trim()) {
        setNotice('SKU ' + productRecord.sku + ' sudah tersimpan. Isi referensi sumber/vendor untuk melanjutkan penyimpanan ' + lines.length + ' unit stok.');
        return;
      }
      if (lines.length) {
        const inventory = await fetch(API + '/api/admin/products/' + productId + '/inventory', {
          method:'POST', headers, credentials:'include',
          body:JSON.stringify({ payloads:lines, sourceReference:stockSourceReference })
        });
        const inventoryData = await inventory.json();
        if (!inventory.ok) throw new Error(apiMessage(inventoryData));
        setNotice('Produk, pemeriksaan Owner, dan ' + inventoryData.inserted + ' unit stok terenkripsi berhasil disimpan.');
      } else {
        setNotice('SKU ' + productRecord.sku + ' tersimpan sebagai Draf. Pemeriksaan dan persediaan dapat dilanjutkan dari Dashboard Owner.');
      }

      setProducts((current) => current.some((item) => String(item.id) === String(productId))
        ? current.map((item) => String(item.id) === String(productId) ? { ...item, ...productRecord } : item)
        : [...current, productRecord]);
      setSavedProductId('');
      setSavedReviewFingerprint('');
      setSavedReviewStatus('');
      setManualSku(false);
      setStock('');
      setStockSourceReference('');
      setForm({ sku:'', gameCategory:form.gameCategory, marketplaceCategoryId:form.marketplaceCategoryId, tier:'GOLD', name:'', description:'', fulfillmentType:'GAME_ACCOUNT_TRANSFER', salePriceXtr:'', costPriceXtr:'0', rightsReviewReference:'', imageUrl:'', imageGalleryText:'', attributesText:'', customerTerms:'', fulfillmentEta:'' });
      setRightsForm({ rightsBasis:'', publisherPlatform:'', officialTermsUrl:'', authorizationEvidenceReference:'', chainOfTitle:'', transferMethod:'', region:'', validUntil:'', reviewStatus:'PENDING', reviewNotes:'', ownerAttested:false });
    } catch (e) {
      if (productId) {
        setNotice('SKU ' + productId + ' sudah tersimpan. Perbaikan/pemeriksaan belum selesai: ' + e.message + '. Formulir dipertahankan agar dapat dilanjutkan tanpa membuat SKU duplikat.');
      } else {
        setError(e.message || 'Produk tidak dapat dibuat.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="admin-shell"><StoreHeader centerLabel="PANEL PEMILIK" rightSlot={<a className="admin-logout" href="/admin">Dashboard</a>}/><div className="admin-notice">{error || 'Memverifikasi akses Owner…'}</div></main>;

  return <main className="admin-shell">
    <StoreHeader centerLabel="PANEL PEMILIK" rightSlot={<a className="admin-logout" href="/admin">Dashboard</a>}/>
    <section className="admin-title">
      <span className="eyebrow muted">KATALOG / PRODUK BARU</span>
      <h1>Input produk</h1>
      <p>Isi informasi akun game, tentukan harga, lalu simpan data akun secara terenkripsi.</p>
    </section>
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {savedProductId && <div className="admin-form-hint">Melanjutkan SKU tersimpan #{savedProductId}. Pengiriman ulang formulir memperbarui SKU yang sama, bukan membuat produk baru.</div>}
    {error && <div className="owner-login-message" role="alert">{error}</div>}
    <section className="admin-panel">
      <div className="admin-section-head"><div><span className="eyebrow muted">LANGKAH 1</span><h2>Informasi produk</h2></div></div>
      <form className="admin-form" onSubmit={submit}>
        <label>SKU <small className="field-hint">Otomatis, bisa diedit</small><input required value={form.sku} onChange={(e)=>{setManualSku(true);change('sku',e.target.value.toUpperCase());}} /></label>
        <label>Game<select value={form.gameCategory} onChange={(e)=>change('gameCategory',e.target.value)}>{CATEGORIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Subkategori<input value="Akun" readOnly /></label>
        <label>Nama produk<input required maxLength="160" value={form.name} onChange={(e)=>change('name',e.target.value)} placeholder="Nama yang tampil di katalog" /></label>
        <label className="span-2">Deskripsi produk<textarea rows="4" value={form.description} onChange={(e)=>change('description',e.target.value)} placeholder="Jelaskan isi produk, manfaat, ketentuan, dan cara pemenuhan." /></label>
        <label className="span-2">Atribut produk <small className="field-hint">Isi spesifikasi akun. Gunakan format Key|Value, satu atribut per baris.</small><textarea rows="4" value={form.attributesText} onChange={(e)=>change('attributesText',e.target.value)} placeholder={'Win Rate|58%\nJumlah Skin|120\nJumlah Hero|85\nRank Saat Ini|Mythic\nAkun Terhubung Pada|Moonton, Google'} /></label>
        <input type="hidden" value="GAME_ACCOUNT_TRANSFER" readOnly />
        <label className="span-2">URL gambar utama <small className="field-hint">HTTPS publik atau file lokal /assets/</small><input type="text" value={form.imageUrl} onChange={(e)=>change('imageUrl',e.target.value)} placeholder="https://.../produk.webp" /></label>
        <label className="span-2">Galeri gambar, satu URL per baris<textarea rows="3" value={form.imageGalleryText} onChange={(e)=>change('imageGalleryText',e.target.value)} placeholder={'https://cdn.../gambar-1.webp\nhttps://cdn.../gambar-2.webp'} /></label>
        <label className="span-2">Ketentuan produk untuk pelanggan<textarea rows="3" maxLength="5000" value={form.customerTerms} onChange={(e)=>change('customerTerms',e.target.value)} placeholder="Isi paket, syarat penggunaan, wilayah, masa berlaku, dan batasan produk." /></label>
        <label className="span-2">Estimasi waktu pemenuhan<input maxLength="160" value={form.fulfillmentEta} onChange={(e)=>change('fulfillmentEta',e.target.value)} placeholder="Contoh: 5–15 menit setelah pembayaran terverifikasi" /></label>
        <label>Harga jual (XTR)<input required type="number" min="2" step="1" value={form.salePriceXtr} onChange={(e)=>change('salePriceXtr',e.target.value)} /></label>
        <label>Modal (XTR)<input required type="number" min="0" step="1" value={form.costPriceXtr} onChange={(e)=>change('costPriceXtr',e.target.value)} /></label>
        <label className="span-2">Referensi hak lama (opsional) <small className="field-hint">Catatan bebas ini bukan pengganti pemeriksaan CR-05</small><input value={form.rightsReviewReference} onChange={(e)=>change('rightsReviewReference',e.target.value)} placeholder="URL atau nomor referensi terdahulu" /></label>
        <div className="admin-section-head span-2"><div><span className="eyebrow muted">LANGKAH 2 · CR-05</span><h2>Pemeriksaan internal Owner</h2></div></div>
        <label>Dasar hak<select value={rightsForm.rightsBasis} onChange={e=>setRightsForm({...rightsForm,rightsBasis:e.target.value})}><option value="">Pilih dasar hak</option><option value="OWNER_CREATED">Dibuat internal Owner</option><option value="OWNER_OWNED">Dimiliki Owner</option><option value="AUTHORIZED_VENDOR">Vendor berotorisasi</option><option value="OFFICIAL_DISTRIBUTION">Distribusi resmi</option><option value="LICENSED_CONTENT">Konten berlisensi</option><option value="SERVICE">Layanan internal</option><option value="OTHER">Lainnya</option></select></label>
        <label>Penerbit / platform (opsional)<input value={rightsForm.publisherPlatform} onChange={e=>setRightsForm({...rightsForm,publisherPlatform:e.target.value})} placeholder="Metadata opsional" /></label>
        <label className="span-2">Tautan referensi (opsional)<input type="url" value={rightsForm.officialTermsUrl} onChange={e=>setRightsForm({...rightsForm,officialTermsUrl:e.target.value})} placeholder="https://..." /></label>
        <label className="span-2">Referensi tambahan (opsional)<input value={rightsForm.authorizationEvidenceReference} onChange={e=>setRightsForm({...rightsForm,authorizationEvidenceReference:e.target.value})} placeholder="Catatan pendukung, bila ada" /></label>
        <label className="span-2">Chain of title / asal produk<textarea rows="3" value={rightsForm.chainOfTitle} onChange={e=>setRightsForm({...rightsForm,chainOfTitle:e.target.value})} placeholder="Asal produk, pemilik sebelumnya, vendor, dan dasar kewenangan." /></label>
        <label className="span-2">Metode transfer / pemenuhan<textarea rows="3" value={rightsForm.transferMethod} onChange={e=>setRightsForm({...rightsForm,transferMethod:e.target.value})} placeholder="Jelaskan prosedur pemenuhan aktual." /></label>
        <label>Wilayah / region<input value={rightsForm.region} onChange={e=>setRightsForm({...rightsForm,region:e.target.value})} placeholder="Indonesia / Global" /></label>
        <label>Berlaku sampai<input type="date" value={rightsForm.validUntil} onChange={e=>setRightsForm({...rightsForm,validUntil:e.target.value})} /></label>
        <label>Status review<select value={rightsForm.reviewStatus} onChange={e=>setRightsForm({...rightsForm,reviewStatus:e.target.value})}><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select></label>
        <label className="span-2">Catatan review<textarea rows="3" value={rightsForm.reviewNotes} onChange={e=>setRightsForm({...rightsForm,reviewNotes:e.target.value})} placeholder="Catatan keputusan internal Owner." /></label>
        <label className="span-2 field-check"><input type="checkbox" checked={rightsForm.ownerAttested} onChange={e=>setRightsForm({...rightsForm,ownerAttested:e.target.checked})} /> Saya menyatakan data yang dimasukkan benar dan bertanggung jawab atas keputusan internal Owner.</label>
        <div className="span-2 admin-form-hint">Penerbit dan tautan referensi hanya metadata opsional, bukan syarat aktivasi SKU di VAULT CORE.</div>
        <div className="admin-section-head span-2"><div><span className="eyebrow muted">LANGKAH 3</span><h2>Stok awal</h2></div></div>
        <label className="span-2">Referensi sumber/vendor atau asal internal Owner<input value={stockSourceReference} onChange={e=>setStockSourceReference(e.target.value)} placeholder="Nomor dokumen / ID asal stok" /></label>
        <label className="span-2">Data akun, satu JSON per baris <small className="field-hint">Data akun hanya disimpan setelah pemeriksaan internal Owner berstatus APPROVED.</small><textarea rows="6" value={stock} onChange={(e)=>setStock(e.target.value)} placeholder={'{"account_id":"...","account_password":"...","login_method":"..."}'} /></label>
        <div className="span-2 admin-form-hint">{splitInventoryPayloads(stock).length} unit stok siap disimpan.</div>
        <button className="admin-primary" disabled={busy}>{busy ? 'Menyimpan…' : savedProductId ? 'Lanjutkan penyimpanan SKU' : stock.trim() ? 'Simpan produk + stok awal' : 'Simpan produk sebagai Draf'}</button>
      </form>
    </section>
  </main>;
}
