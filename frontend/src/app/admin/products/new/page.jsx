'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData } from '../../../../lib/telegram';

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
      const lines = stock.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      if (lines.length) {
        const inventory = await fetch(API + '/api/admin/products/' + productId + '/inventory', {
          method:'POST', headers, credentials:'include', body:JSON.stringify({ payloads:lines })
        });
        const inventoryData = await inventory.json();
        if (!inventory.ok) {
          setNotice('Produk tersimpan sebagai Draf. Stok awal belum tersimpan: ' + apiMessage(inventoryData));
          return;
        }
        setNotice('Produk ' + data.product.sku + ' tersimpan sebagai Draf. ' + inventoryData.inserted + ' unit stok berhasil dienkripsi.');
      } else {
        setNotice('Produk ' + data.product.sku + ' tersimpan sebagai Draf.');
      }
      setProducts((current) => [...current, data.product]);
      setManualSku(false);
      setStock('');
      setForm({ sku:'', gameCategory:form.gameCategory, tier:form.tier, name:'', description:'', fulfillmentType:form.fulfillmentType, salePriceXtr:'', costPriceXtr:'0', rightsReviewReference:'' });
    } catch (e) {
      if (productId) setNotice('Produk sudah tersimpan sebagai Draf, tetapi stok belum berhasil disimpan. ' + e.message);
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
        <label className="span-2">Referensi hak penjualan <small className="field-hint">Diperlukan sebelum produk komersial diaktifkan</small><input value={form.rightsReviewReference} onChange={(e)=>change('rightsReviewReference',e.target.value)} placeholder="URL atau nomor bukti otorisasi" /></label>
        <div className="span-2 admin-form-hint">Produk baru disimpan sebagai Draf. Produk tampil di katalog setelah pemeriksaan hak penjualan dan aktivasi Owner.</div>
        <div className="admin-section-head span-2"><div><span className="eyebrow muted">LANGKAH 2</span><h2>Stok awal</h2></div></div>
        <label className="span-2">Kode digital, satu unit per baris <small className="field-hint">Stok akan dienkripsi saat disimpan. Boleh dikosongkan dan ditambahkan nanti.</small><textarea rows="6" value={stock} onChange={(e)=>setStock(e.target.value)} placeholder={'KODE-REDEEM-001\\nKODE-REDEEM-002'} /></label>
        <div className="span-2 admin-form-hint">{stock.split(/\\r?\\n/).filter((line)=>line.trim()).length} unit stok siap disimpan.</div>
        <button className="admin-primary" disabled={busy}>{busy ? 'Menyimpan…' : stock.trim() ? 'Simpan produk + stok awal' : 'Simpan produk sebagai Draf'}</button>
      </form>
    </section>
  </main>;
}
