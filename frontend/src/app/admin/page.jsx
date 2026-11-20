'use client';

import { useEffect, useState } from 'react';
import { getInitData } from '../../lib/telegram';
const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ category:'OPERATIONS', description:'', amountIdr:'' });
  const [notice, setNotice] = useState('Memverifikasi akses owner…');
  const [form, setForm] = useState({ sku:'', gameCategory:'MLBB', tier:'GOLD', name:'', description:'', fulfillmentType:'REDEEM_CODE', salePriceXtr:'', salePriceIdr:'500000', costPriceIdr:'300000', rightsReviewReference:'' });
  const [stockProduct, setStockProduct] = useState('');
  const [stockPayload, setStockPayload] = useState('');
  const [displayCap, setDisplayCap] = useState({});
  const [busy, setBusy] = useState(false);
  const headers = () => ({ 'content-type':'application/json', 'x-telegram-init-data':getInitData() });

  async function refresh() {
    const [dashboard, productResponse, orderResponse] = await Promise.all([
      fetch(`${API}/api/admin/dashboard`, { headers:headers(), cache:'no-store' }),
      fetch(`${API}/api/admin/products`, { headers:headers(), cache:'no-store' }),
      fetch(`${API}/api/admin/orders`, { headers:headers(), cache:'no-store' })
    ]);
    const dashboardData = await dashboard.json();
    const productData = await productResponse.json();
    const orderData = await orderResponse.json();
    if (!dashboard.ok || !productResponse.ok || !orderResponse.ok) throw new Error(dashboardData.message || productData.message || orderData.message || 'Akses owner ditolak. Buka halaman ini melalui Telegram dengan akun owner.');
    setStats(dashboardData); setProducts(productData.products || []); setOrders(orderData.orders || []); setNotice('Owner dashboard terhubung.');
  }
  useEffect(() => { refresh().catch((e) => setNotice(e.message)); }, []);

  async function createProduct(e) {
    e.preventDefault(); setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/products`, { method:'POST', headers:headers(), body:JSON.stringify({ ...form, salePriceXtr:Number(form.salePriceXtr), salePriceIdr:Number(form.salePriceIdr), costPriceIdr:Number(form.costPriceIdr) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || 'Gagal membuat produk.');
      setNotice(`Produk ${data.product.sku} dibuat sebagai DRAFT.`); setForm({ ...form, sku:'', name:'', description:'' }); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function addStock(e) {
    e.preventDefault(); if (!stockProduct || !stockPayload.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/products/${stockProduct}/inventory`, { method:'POST', headers:headers(), body:JSON.stringify({ payloads:stockPayload.split('\n').map(v=>v.trim()).filter(Boolean) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || 'Gagal menambah stok.');
      setNotice(`${data.inserted} unit inventaris terenkripsi berhasil ditambahkan.`); setStockPayload(''); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function updateProduct(id, patch) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/products/${id}`, { method:'PATCH', headers:headers(), body:JSON.stringify(patch) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || 'Pembaruan gagal.');
      setNotice('Pengaturan produk diperbarui.'); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }


  async function retryDelivery(orderNumber) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/orders/${encodeURIComponent(orderNumber)}/retry-delivery`, { method:'POST', headers:headers(), body:JSON.stringify({}) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || 'Pengiriman ulang gagal.');
      setNotice(`Permintaan pengiriman ulang diproses untuk ${orderNumber}.`); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function issueRefund(orderNumber) {
    const reason = window.prompt(`Alasan refund untuk ${orderNumber}:`, 'Permintaan bantuan pelanggan');
    if (reason === null) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/orders/${encodeURIComponent(orderNumber)}/refund`, { method:'POST', headers:headers(), body:JSON.stringify({ reason }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || 'Refund gagal diproses.');
      setNotice(`Refund Stars untuk ${orderNumber} berhasil diproses.`); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function addExpense(e) {
    e.preventDefault(); setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/expenses`, { method:'POST', headers:headers(), body:JSON.stringify({ ...expenseForm, amountIdr:Number(expenseForm.amountIdr) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || 'Pencatatan biaya gagal.');
      setExpenseForm({ category:'OPERATIONS', description:'', amountIdr:'' }); setNotice('Biaya operasional dicatat.'); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  const rupiah = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;
  return <main className="admin-shell">
    <header className="admin-head"><a className="brand" href="/"><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a><span className="admin-pill">OWNER CONSOLE</span></header>
    <section className="admin-title"><span className="eyebrow muted">CONTROL CENTER / ADMIN</span><h1>Owner dashboard</h1><p>Kelola katalog, inventaris, harga, dan performa keuangan toko.</p></section>
    {notice && <div className="admin-notice">{notice}</div>}
    {stats && <section className="admin-stats">
      <div><small>Paid orders</small><strong>{stats.sales.paid_orders}</strong></div>
      <div><small>Gross sales (IDR)</small><strong>{rupiah(stats.sales.gross_idr)}</strong></div>
      <div><small>Gross profit</small><strong>{rupiah(stats.grossProfitIdr)}</strong></div>
      <div><small>Net profit</small><strong className={stats.netProfitIdr >= 0 ? 'profit' : 'loss'}>{rupiah(stats.netProfitIdr)}</strong></div>
      <div><small>Available stock</small><strong>{stats.inventory.available}</strong></div>
      <div><small>Pending orders</small><strong>{stats.orders.pending}</strong></div>
    </section>}

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">CATALOG</span><h2>Buat produk</h2></div></div>
      <form className="admin-form" onSubmit={createProduct}>
        <label>SKU<input required value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="MLBB-GOLD-001" /></label>
        <label>Game<select value={form.gameCategory} onChange={e=>setForm({...form,gameCategory:e.target.value})}><option>MLBB</option><option>ROBLOX</option><option>FREE_FIRE</option><option>GENSHIN</option><option>OTHER</option></select></label>
        <label>Tier<select value={form.tier} onChange={e=>setForm({...form,tier:e.target.value})}><option>SILVER</option><option>GOLD</option><option>PLATINUM</option><option>SERVICE</option></select></label>
        <label>Nama produk<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></label>
        <label className="span-2">Deskripsi<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="2" /></label>
        <label>Fulfillment<select value={form.fulfillmentType} onChange={e=>setForm({...form,fulfillmentType:e.target.value})}><option value="REDEEM_CODE">Redeem code</option><option value="VOUCHER_CODE">Voucher code</option><option value="LICENSE_KEY">License key</option><option value="GIFT_CODE">Gift code</option><option value="DIGITAL_FILE">Digital file</option><option value="SERVICE_INSTRUCTIONS">Service instructions</option></select></label>
        <label>Harga XTR<input required type="number" min="1" step="1" value={form.salePriceXtr} onChange={e=>setForm({...form,salePriceXtr:e.target.value})} /></label>
        <label>Harga jual IDR<input required type="number" min="1" value={form.salePriceIdr} onChange={e=>setForm({...form,salePriceIdr:e.target.value})} /></label>
        <label>Harga modal IDR<input required type="number" min="0" value={form.costPriceIdr} onChange={e=>setForm({...form,costPriceIdr:e.target.value})} /></label>
        <label className="span-2">Referensi pemeriksaan SKU<input required value={form.rightsReviewReference} onChange={e=>setForm({...form,rightsReviewReference:e.target.value})} placeholder="Nomor dokumen / referensi izin produk" /></label>
        <button className="admin-primary" disabled={busy}>Simpan produk sebagai DRAFT</button>
      </form>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">INVENTORY</span><h2>Tambah stok digital</h2></div></div>
      <form className="admin-form" onSubmit={addStock}>
        <label className="span-2">Produk<select required value={stockProduct} onChange={e=>setStockProduct(e.target.value)}><option value="">Pilih produk</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
        <label className="span-2">Satu unit per baris<textarea required rows="5" value={stockPayload} onChange={e=>setStockPayload(e.target.value)} placeholder="Masukkan kode voucher / lisensi / redeem code satu per baris." /></label>
        <button className="admin-primary" disabled={busy}>Enkripsi dan simpan stok</button>
      </form>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">LIVE INVENTORY</span><h2>Produk & display stock</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk</th><th>Harga jual</th><th>Modal</th><th>Stok asli</th><th>Display cap</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {products.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.sku} · {p.game_category} / {p.tier}</small></td><td>{rupiah(p.sale_price_idr)}<small>{p.sale_price_xtr} XTR</small></td><td>{rupiah(p.cost_price_idr)}</td><td>{p.actual_stock}</td><td><input className="cap-input" type="number" min="0" value={displayCap[p.id] ?? p.display_stock_override ?? ''} placeholder="Aktual" onChange={e=>setDisplayCap({...displayCap,[p.id]:e.target.value})}/></td><td><span className={`admin-status ${p.status.toLowerCase()}`}>{p.status}</span></td><td><div className="admin-actions"><button onClick={()=>updateProduct(p.id,{displayStockOverride:displayCap[p.id]==='' ? null : Number(displayCap[p.id])})} disabled={busy}>Simpan cap</button><button onClick={()=>updateProduct(p.id,{status:p.status==='ACTIVE'?'PAUSED':'ACTIVE'})} disabled={busy || (p.status!=='ACTIVE' && !p.rights_review_reference)}>{p.status==='ACTIVE'?'Pause':'Aktifkan'}</button></div></td></tr>)}
      {!products.length && <tr><td colSpan="7" className="table-empty">Belum ada produk dibuat.</td></tr>}
      </tbody></table></div>
      <p className="admin-footnote">Display cap hanya membatasi angka yang ditampilkan. Sistem tetap menghitung dan memeriksa stok tersedia aktual saat checkout.</p>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">ORDERS & PAYMENTS</span><h2>Transaksi dan pemenuhan</h2></div><span className="section-count">{orders.length} ORDERS</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Status</th><th>Harga jual</th><th>Modal</th><th>Profit kotor</th><th>Aksi</th></tr></thead><tbody>
      {orders.map(o=>{ const gross=Number(o.total_sale_idr||0); const cost=Number(o.total_cost_idr||0); const canRefund=['PAID','FULFILLING','FULFILLED'].includes(o.status); const canRetry=['PAID','FULFILLING'].includes(o.status); return <tr key={o.order_number}><td><strong>{o.order_number}</strong><small>{new Date(o.created_at).toLocaleString('id-ID')}</small></td><td>{o.username ? `@${o.username}` : o.telegram_user_id}</td><td><span className={`admin-status ${o.status.toLowerCase()}`}>{o.status}</span></td><td>{rupiah(gross)}<small>{o.total_xtr} XTR</small></td><td>{rupiah(cost)}</td><td className={gross-cost>=0?'profit':'loss'}>{rupiah(gross-cost)}</td><td><div className="admin-actions">{canRetry && <button disabled={busy} onClick={()=>retryDelivery(o.order_number)}>Kirim ulang</button>}{canRefund && <button disabled={busy} onClick={()=>issueRefund(o.order_number)}>Refund Stars</button>}</div></td></tr>})}
      {!orders.length && <tr><td colSpan="7" className="table-empty">Belum ada transaksi.</td></tr>}
      </tbody></table></div>
      <p className="admin-footnote">Refund hanya untuk pembayaran Stars yang tercatat. Produk yang sudah terkirim tetap tercatat sebagai terjual dan tidak otomatis dikembalikan ke stok.</p>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">OPERATING COSTS</span><h2>Biaya operasional</h2></div></div>
      <form className="admin-form" onSubmit={addExpense}>
        <label>Kategori<select value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})}><option>OPERATIONS</option><option>MARKETING</option><option>PLATFORM</option><option>SUPPORT</option><option>OTHER</option></select></label>
        <label>Jumlah biaya IDR<input required type="number" min="1" value={expenseForm.amountIdr} onChange={e=>setExpenseForm({...expenseForm,amountIdr:e.target.value})}/></label>
        <label className="span-2">Keterangan<input required value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})} placeholder="Contoh: biaya promosi minggu ini"/></label>
        <button className="admin-primary" disabled={busy}>Catat biaya</button>
      </form>
      <p className="admin-footnote">Biaya operasional dicatat terpisah dan dikurangkan dalam perhitungan profit bersih keseluruhan.</p>
    </section>
  </main>;
}
