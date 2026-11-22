'use client';

import { useEffect, useState } from 'react';
import { getInitData } from '../../lib/telegram';
const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

const GAME_LABELS = { MLBB:'MLBB', ROBLOX:'Roblox', FREE_FIRE:'Free Fire', GENSHIN:'Genshin Impact', OTHER:'Lainnya' };
const TIER_LABELS = { SILVER:'Silver', GOLD:'Gold', PLATINUM:'Platinum', SERVICE:'Layanan' };
const STATUS_LABELS = {
  DRAFT:'Draf', PENDING_REVIEW:'Menunggu pemeriksaan', ACTIVE:'Aktif', PAUSED:'Dijeda', ARCHIVED:'Diarsipkan',
  PENDING_PAYMENT:'Menunggu pembayaran', PAID:'Pembayaran diterima', FULFILLING:'Sedang dikirim',
  FULFILLED:'Selesai', CANCELLED:'Dibatalkan', REFUND_PENDING:'Pengembalian sedang diproses',
  REFUNDED:'Pengembalian selesai', FAILED:'Gagal'
};
const API_ERROR_MESSAGES = {
  TELEGRAM_AUTH_REQUIRED:'Sesi Telegram tidak dapat diverifikasi. Buka ulang VAULT CORE melalui bot Telegram.',
  ADMIN_ACCESS_REQUIRED:'Akses ditolak. Gunakan akun Telegram pemilik VAULT CORE.',
  INVALID_PRODUCT_INPUT:'Periksa kembali SKU, kategori, tingkat produk, metode pemenuhan, dan harga.',
  INVALID_PRODUCT_UPDATE:'Perubahan produk belum lengkap atau tidak valid. Periksa kembali data yang akan disimpan.',
  PRODUCT_REVIEW_REFERENCE_REQUIRED:'Tambahkan referensi verifikasi hak penjualan sebelum mengaktifkan produk.',
  PRODUCT_NOT_FOUND:'Produk tidak ditemukan. Muat ulang daftar produk lalu coba kembali.',
  INVALID_EXPENSE_INPUT:'Lengkapi kategori, keterangan, dan jumlah biaya operasional dengan benar.',
  INVALID_INVENTORY_INPUT:'Masukkan 1 hingga 100 unit stok digital, satu unit pada setiap baris.',
  INVALID_ASSET_PAYLOAD:'Stok tidak dapat disimpan. Pastikan setiap baris berisi kode atau instruksi digital yang didukung.',
  ORDER_OR_PAYMENT_NOT_FOUND:'Pesanan atau catatan pembayarannya tidak ditemukan.',
  ORDER_ALREADY_REFUNDED:'Pengembalian dana untuk pesanan ini sudah selesai.',
  ORDER_NOT_REFUNDABLE:'Status pesanan ini belum memenuhi syarat untuk pengembalian dana.',
  PAYMENT_NOT_REFUNDABLE:'Pembayaran yang tercatat belum dapat diproses untuk pengembalian dana.',
  REFUND_PREPARATION_FAILED:'Persiapan pengembalian dana gagal. Periksa status transaksi sebelum mencoba kembali.',
  REFUND_RECONCILIATION_REQUIRED:'Pengembalian dana belum dapat dikonfirmasi. Pesanan menunggu pemeriksaan catatan transaksi Telegram.',
  REFUND_LEDGER_RECONCILIATION_REQUIRED:'Telegram mengonfirmasi pengembalian dana, tetapi catatan transaksi di sistem belum selesai diperbarui. Pemeriksaan lanjutan diperlukan.',
  ORDER_NOT_FOUND:'Pesanan tidak ditemukan. Perbarui daftar transaksi lalu coba kembali.',
  ORDER_NOT_PENDING_FULFILLMENT:'Pesanan ini tidak berada dalam status yang memungkinkan pengiriman ulang.',
  INVALID_DELIVERY_RECONCILIATION:'Data pemeriksaan pengiriman tidak valid. Periksa pilihan, catatan, dan ID pesan.',
  DELIVERY_NOT_FOUND:'Data pengiriman tidak ditemukan.',
  DELIVERY_NOT_REQUIRES_REVIEW:'Pengiriman ini tidak sedang menunggu pemeriksaan.',
  INVENTORY_RESERVATION_NOT_OWNED_BY_ORDER:'Stok yang dicadangkan tidak lagi terhubung ke pesanan ini. Periksa status pesanan sebelum melanjutkan.',
  DELIVERY_RECONCILIATION_FAILED:'Pemeriksaan pengiriman gagal. Periksa kembali status pesanan dan stok.'
};
const displayStatus = (status) => STATUS_LABELS[status] || 'Status sedang diperbarui';
const apiErrorMessage = (data, fallback) => API_ERROR_MESSAGES[data?.error] || data?.message || fallback;
const SKU_PREFIX = { MLBB:'MLBB', ROBLOX:'RBLX', FREE_FIRE:'FFIR', GENSHIN:'GNSH', OTHER:'OTHR' };
const TIER_CODE = { SILVER:'SLV', GOLD:'GLD', PLATINUM:'PLT', SERVICE:'SRV' };
const GAME_NAME = { MLBB:'Mobile Legends', ROBLOX:'Roblox', FREE_FIRE:'Free Fire', GENSHIN:'Genshin Impact', OTHER:'Produk Digital' };
const TIER_NAME = { SILVER:'Silver', GOLD:'Gold', PLATINUM:'Platinum', SERVICE:'Layanan' };
function suggestedSku(category, tier, products) {
  const prefix = (SKU_PREFIX[category] || 'ITEM') + '-' + (TIER_CODE[tier] || 'STD') + '-';
  const used = new Set(products.map((product) => String(product.sku || '').toUpperCase()));
  let number = 1;
  while (used.has(prefix + String(number).padStart(3, '0'))) number += 1;
  return prefix + String(number).padStart(3, '0');
}
function suggestedName(category, tier) {
  return (GAME_NAME[category] || 'Produk Digital') + ' ' + (TIER_NAME[tier] || 'Standard');
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ category:'OPERATIONS', description:'', amountXtr:'' });
  const [notice, setNotice] = useState('Memverifikasi akses pemilik…');
  const [form, setForm] = useState({ sku:'', gameCategory:'MLBB', tier:'GOLD', name:'Mobile Legends Gold', description:'', fulfillmentType:'REDEEM_CODE', salePriceXtr:'', costPriceXtr:'0', rightsReviewReference:'' });
  const [stockProduct, setStockProduct] = useState('');
  const [stockPayload, setStockPayload] = useState('');
  const [displayCap, setDisplayCap] = useState({});
  const [busy, setBusy] = useState(false);
  const [authState, setAuthState] = useState('checking');
  const [botUsername, setBotUsername] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [skuManual, setSkuManual] = useState(false);
  const headers = () => ({ 'content-type':'application/json', 'x-telegram-init-data':getInitData() });

  async function refresh() {
    const [dashboard, productResponse, orderResponse] = await Promise.all([
      fetch(`${API}/api/admin/dashboard`, { headers:headers(), credentials:'include', cache:'no-store' }),
      fetch(`${API}/api/admin/products`, { headers:headers(), credentials:'include', cache:'no-store' }),
      fetch(`${API}/api/admin/orders`, { headers:headers(), credentials:'include', cache:'no-store' })
    ]);
    const dashboardData = await dashboard.json();
    const productData = await productResponse.json();
    const orderData = await orderResponse.json();
    if (!dashboard.ok || !productResponse.ok || !orderResponse.ok) throw new Error(apiErrorMessage(dashboardData, '') || apiErrorMessage(productData, '') || apiErrorMessage(orderData, '') || 'Akses panel pemilik tidak dapat diverifikasi. Buka VAULT CORE melalui Telegram dengan akun pemilik.');
    setStats(dashboardData); setProducts(productData.products || []); setOrders(orderData.orders || []); setNotice('Panel pemilik berhasil terhubung.');
  }
  useEffect(() => {
    let alive = true;
    async function initializeOwnerAccess() {
      try {
        const session = await fetch(`${API}/api/owner-auth/session`, {
          headers: { 'x-telegram-init-data': getInitData() }, credentials:'include', cache:'no-store'
        });
        if (session.ok) {
          if (!alive) return;
          setAuthState('authenticated');
          await refresh();
          return;
        }
        const config = await fetch(`${API}/api/owner-auth/config`, { credentials:'include', cache:'no-store' });
        const data = await config.json();
        if (!config.ok || !data.botUsername) throw new Error('Login Telegram belum dikonfigurasi pada bot VAULT CORE.');
        if (alive) { setBotUsername(data.botUsername); setAuthState('login'); setNotice(''); }
      } catch (error) {
        if (alive) { setAuthState('login'); setLoginMessage(error.message || 'Login Telegram belum dapat dimuat.'); }
      }
    }
    initializeOwnerAccess();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (authState !== 'login' || !botUsername) return;
    const mount = document.getElementById('telegram-login-widget');
    if (!mount) return;
    window.onVaultTelegramAuth = async (telegramUser) => {
      setLoginBusy(true); setLoginMessage('');
      try {
        const response = await fetch(`${API}/api/owner-auth/telegram`, {
          method:'POST', headers:{ 'content-type':'application/json' }, credentials:'include',
          body:JSON.stringify(telegramUser)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(apiErrorMessage(data, 'Login Telegram gagal. Pastikan akun ini memiliki akses Owner.'));
        setAuthState('authenticated'); setLoginMessage('');
        await refresh();
      } catch (error) { setLoginMessage(error.message || 'Login Telegram gagal.'); }
      finally { setLoginBusy(false); }
    };
    const script = document.createElement('script');
    script.async = true; script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large'); script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onVaultTelegramAuth(user)');
    mount.replaceChildren(script);
    return () => { mount.replaceChildren(); delete window.onVaultTelegramAuth; };
  }, [authState, botUsername]);

  useEffect(() => {
    if (!skuManual) setForm((current) => ({ ...current, sku: suggestedSku(current.gameCategory, current.tier, products) }));
  }, [products, skuManual]);

  async function logoutOwner() {
    await fetch(`${API}/api/owner-auth/logout`, { method:'POST', credentials:'include' });
    setAuthState('login'); setNotice('');
    setLoginMessage('Anda telah keluar dari Dashboard Owner.');
  }

  async function createProduct(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const initialPayloads = stockPayload.split('\\n').map((value) => value.trim()).filter(Boolean);
    try {
      const response = await fetch(`${API}/api/admin/products`, {
        method:'POST', headers:headers(), credentials:'include',
        body:JSON.stringify({ ...form, salePriceXtr:Number(form.salePriceXtr), costPriceXtr:Number(form.costPriceXtr) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(data, 'Produk tidak dapat disimpan. Periksa kembali data produk.'));
      const productId = String(data.product.id);
      setStockProduct(productId);
      if (initialPayloads.length) {
        const stockResponse = await fetch(`${API}/api/admin/products/${productId}/inventory`, {
          method:'POST', headers:headers(), credentials:'include',
          body:JSON.stringify({ payloads:initialPayloads })
        });
        const stockData = await stockResponse.json();
        if (!stockResponse.ok) {
          await refresh();
          setNotice(`Produk ${data.product.sku} tersimpan sebagai Draf, tetapi stok awal belum masuk: ${apiErrorMessage(stockData, 'Periksa payload lalu tambahkan stok dari panel persediaan.')} Produk tetap tersimpan dan dapat dilanjutkan.`);
          document.getElementById('inventory-panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
          return;
        }
        setNotice(`Produk ${data.product.sku} dibuat sebagai Draf dan ${stockData.inserted} unit stok awal berhasil dienkripsi.`);
        setStockPayload('');
      } else {
        setNotice(`Produk ${data.product.sku} dibuat sebagai Draf. Stok dapat ditambahkan sekarang atau nanti.`);
      }
      setSkuManual(false);
      setForm({ ...form, sku:'', name:suggestedName(form.gameCategory,form.tier), description:'', rightsReviewReference:'' });
      await refresh();
      document.getElementById('inventory-panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
    } catch(e) {
      setNotice(e.message || 'Produk tidak dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }
  async function addStock(e) {
    e.preventDefault(); if (!stockProduct || !stockPayload.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/products/${stockProduct}/inventory`, { method:'POST', headers:headers(), credentials:'include', body:JSON.stringify({ payloads:stockPayload.split('\n').map(v=>v.trim()).filter(Boolean) }) });
      const data = await response.json(); if (!response.ok) throw new Error(apiErrorMessage(data, 'Stok tidak dapat ditambahkan. Periksa kembali data yang dimasukkan.'));
      setNotice(`${data.inserted} unit stok berhasil dienkripsi dan disimpan.`); setStockPayload(''); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function updateProduct(id, patch) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/products/${id}`, { method:'PATCH', headers:headers(), credentials:'include', body:JSON.stringify(patch) });
      const data = await response.json(); if (!response.ok) throw new Error(apiErrorMessage(data, 'Pengaturan produk tidak dapat diperbarui.'));
      setNotice('Pengaturan produk berhasil diperbarui.'); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }


  async function reconcileDelivery(deliveryId) {
    const outcome = window.prompt('Periksa percakapan Telegram pelanggan. Ketik DELIVERED jika pesan sudah terkirim, atau NOT_DELIVERED jika belum terkirim.');
    if (!outcome) return;
    const normalized = outcome.trim().toUpperCase();
    if (!['DELIVERED','NOT_DELIVERED'].includes(normalized)) {
      setNotice('Pilihan tidak dikenali. Masukkan DELIVERED (sudah terkirim) atau NOT_DELIVERED (belum terkirim).');
      return;
    }
    const reason = window.prompt('Catatan pemeriksaan (wajib diisi):', normalized === 'DELIVERED' ? 'Pesan Telegram ditemukan dan diterima customer.' : 'Pesan tidak ditemukan pada chat customer.');
    if (!reason || reason.trim().length < 3) return;
    const messageValue = normalized === 'DELIVERED' ? window.prompt('ID pesan Telegram (opsional):', '') : null;
    setBusy(true);
    try {
      const response = await fetch(API + '/api/admin/deliveries/' + deliveryId + '/reconcile', {
        method:'POST', headers:headers(), credentials:'include',
        body:JSON.stringify({ outcome:normalized, reason:reason.trim(), telegramMessageId:messageValue ? Number(messageValue) : null })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Rekonsiliasi gagal.');
      setNotice('Status pengiriman #' + deliveryId + ' berhasil diperiksa: ' + normalized + '.');
      await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function retryDelivery(orderNumber) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/orders/${encodeURIComponent(orderNumber)}/retry-delivery`, { method:'POST', headers:headers(), credentials:'include', body:JSON.stringify({}) });
      const data = await response.json(); if (!response.ok) throw new Error(apiErrorMessage(data, 'Pengiriman ulang tidak dapat diproses.'));
      setNotice(`Permintaan pengiriman ulang untuk pesanan ${orderNumber} telah diproses.`); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function issueRefund(orderNumber) {
    const reason = window.prompt(`Alasan refund untuk ${orderNumber}:`, 'Permintaan bantuan pelanggan');
    if (reason === null) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/orders/${encodeURIComponent(orderNumber)}/refund`, { method:'POST', headers:headers(), credentials:'include', body:JSON.stringify({ reason }) });
      const data = await response.json(); if (!response.ok) throw new Error(apiErrorMessage(data, 'Pengembalian Telegram Stars tidak dapat diproses.'));
      setNotice(`Pengembalian Telegram Stars untuk pesanan ${orderNumber} berhasil dikonfirmasi.`); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function addExpense(e) {
    e.preventDefault(); setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/expenses`, { method:'POST', headers:headers(), credentials:'include', body:JSON.stringify({ ...expenseForm, amountXtr:Number(expenseForm.amountXtr) }) });
      const data = await response.json(); if (!response.ok) throw new Error(apiErrorMessage(data, 'Biaya operasional tidak dapat dicatat.'));
      setExpenseForm({ category:'OPERATIONS', description:'', amountXtr:'' }); setNotice('Biaya operasional berhasil dicatat.'); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  const xtr = (n) => `${Number(n || 0).toLocaleString('en-US')} XTR`;
  if (authState !== 'authenticated') return <main className="owner-login-screen">
    <section className="owner-login-card">
      <a className="brand" href="/"><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a>
      <span className="eyebrow muted">OWNER SECURE ACCESS</span>
      <h1>Masuk dengan Telegram</h1>
      <p>Gunakan akun Telegram Owner yang sudah terdaftar. Telegram memverifikasi identitas Anda, lalu VAULT CORE memeriksa izin Owner secara otomatis.</p>
      <div className="owner-login-step"><span>1</span> Pilih akun Telegram <span>2</span> Konfirmasi login <span>3</span> Dashboard terbuka</div>
      {authState === 'checking' ? <div className="owner-login-loading">Memeriksa sesi Telegram…</div> : <>
        <div id="telegram-login-widget" className="telegram-login-widget" />
        {loginBusy && <div className="owner-login-loading">Memverifikasi akun Telegram…</div>}
        {loginMessage && <div className="owner-login-message" role="alert">{loginMessage}</div>}
        <small>Login diverifikasi langsung oleh Telegram dan akses Owner diperiksa oleh server VAULT CORE. Login Widget Telegram harus diizinkan oleh BotFather. Jalankan /setdomain, pilih bot VAULT CORE, lalu isi domain persis: vaultcore.biz.id. Setelah tersimpan, muat ulang halaman ini.</small>
      </>}
      <a className="owner-login-back" href="/">Kembali ke katalog</a>
    </section>
  </main>;
  return <main className="admin-shell">
    <header className="admin-head"><a className="brand" href="/"><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a><div className="admin-head-actions"><span className="admin-pill">PANEL PEMILIK</span><button type="button" className="admin-logout" onClick={logoutOwner}>Keluar</button></div></header>
    <section className="admin-title"><span className="eyebrow muted">PANEL KONTROL / PEMILIK</span><h1>Dashboard pemilik</h1><p>Kelola katalog, stok, harga, pesanan, dan laporan usaha dalam XTR.</p></section>
    {notice && <div className="admin-notice">{notice}</div>}
    {stats && <section className="admin-stats">
      <div><small>Pesanan terbayar</small><strong>{stats.sales.paid_orders}</strong></div>
      <div><small>Penjualan kotor</small><strong>{xtr(stats.sales.gross_xtr)}</strong></div>
      <div><small>Laba kotor</small><strong>{xtr(stats.grossProfitXtr)}</strong></div>
      <div><small>Laba bersih</small><strong className={stats.netProfitXtr >= 0 ? 'profit' : 'loss'}>{xtr(stats.netProfitXtr)}</strong></div>
      <div><small>Stok tersedia</small><strong>{stats.inventory.available}</strong></div>
      <div><small>Menunggu pembayaran</small><strong>{stats.orders.pending}</strong></div>
    </section>}

    <section className="admin-panel admin-product-entry">
      <div className="admin-section-head"><div><span className="eyebrow muted">KATALOG / INPUT PRODUK</span><h2>Tambah produk baru</h2><p>Gunakan halaman khusus untuk detail produk, harga, dan stok awal.</p></div></div>
      <a className="admin-primary admin-product-entry-link" href="/admin/products/new">+ Input produk baru</a>
    </section>

    <section className="admin-panel" id="inventory-panel"><div className="admin-section-head"><div><span className="eyebrow muted">LANGKAH 2 · PERSEDIAAN</span><h2>Tambah stok digital</h2></div></div>
      <form className="admin-form" onSubmit={addStock}>
        <label className="span-2">Produk<select required value={stockProduct} onChange={e=>setStockProduct(e.target.value)}><option value="">Pilih produk</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
        <label className="span-2">Satu unit per baris<textarea required rows="5" value={stockPayload} onChange={e=>setStockPayload(e.target.value)} placeholder="Masukkan kode voucher, lisensi, atau kode penukaran satu per baris." /></label>
        <button className="admin-primary" disabled={busy}>Enkripsi dan simpan stok</button>
      </form>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">PENGELOLAAN STOK</span><h2>Produk dan tampilan stok</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk</th><th>Harga jual (XTR)</th><th>Modal (XTR)</th><th>Stok aktual</th><th>Batas tampilan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {products.map(p=><tr key={p.id}><td><strong>{p.name} {p.is_test ? <span className="test-product-label">CONTOH UJI</span> : p.status==='PENDING_REVIEW' ? <span className="catalog-example-label">CONTOH KATALOG</span> : null}</strong><small>{p.sku} · {GAME_LABELS[p.game_category] || p.game_category} / {TIER_LABELS[p.tier] || p.tier}</small><details className="admin-product-details"><summary>Detail lengkap</summary><div><p>{p.description || 'Deskripsi belum diisi.'}</p><small>Metode: {p.fulfillment_type || 'BELUM DIKETAHUI'} · Referensi hak: {p.rights_review_reference || 'BELUM DIKETAHUI'} · Stok aktual: {p.actual_stock} · Status: {displayStatus(p.status)}</small></div></details></td><td>{xtr(p.sale_price_xtr)}</td><td>{xtr(p.cost_price_xtr)}</td><td>{p.actual_stock}</td><td><input className="cap-input" type="number" min="0" value={displayCap[p.id] ?? p.display_stock_override ?? ''} placeholder="Aktual" onChange={e=>setDisplayCap({...displayCap,[p.id]:e.target.value})}/></td><td><span className={`admin-status ${p.status.toLowerCase()}`}>{displayStatus(p.status)}</span></td><td><div className="admin-actions"><button onClick={()=>updateProduct(p.id,{displayStockOverride:displayCap[p.id]==='' ? null : Number(displayCap[p.id])})} disabled={busy}>Simpan batas</button>{p.is_test ? <button disabled title="Fixture hanya dapat diaktifkan melalui ruang uji Owner">Ruang uji Owner</button> : p.status==='ACTIVE' ? <button onClick={()=>updateProduct(p.id,{status:'PAUSED'})} disabled={busy}>Jeda</button> : <button disabled title="Aktivasi komersial menunggu workflow bukti hak penjualan CR-04">Menunggu CR-04</button>}</div></td></tr>)}
      {!products.length && <tr><td colSpan="7" className="table-empty">Belum ada produk dibuat.</td></tr>}
      </tbody></table></div>
      <p className="admin-footnote">Batas tampilan hanya membatasi angka yang ditampilkan. Sistem tetap menghitung dan memeriksa stok tersedia aktual saat checkout.</p>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">PESANAN & PEMBAYARAN</span><h2>Transaksi dan pemenuhan</h2></div><span className="section-count">{orders.length} PESANAN</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Status</th><th>Harga jual</th><th>Harga modal</th><th>Laba kotor</th><th>Aksi</th></tr></thead><tbody>
      {orders.map(o=>{ const gross=Number(o.total_xtr||0); const cost=Number(o.total_cost_xtr||0); const canRefund=['PAID','FULFILLING','FULFILLED','REFUND_PENDING'].includes(o.status); const canRetry=['PAID','FULFILLING'].includes(o.status); return <tr key={o.order_number}><td><strong>{o.order_number}</strong><small>{new Date(o.created_at).toLocaleString('id-ID')}</small></td><td>{o.username ? `@${o.username}` : o.telegram_user_id}</td><td><span className={`admin-status ${o.status.toLowerCase()}`}>{displayStatus(o.status)}</span></td><td>{xtr(gross)}</td><td>{xtr(cost)}</td><td className={gross-cost>=0?'profit':'loss'}>{xtr(gross-cost)}</td><td><div className="admin-actions">{(o.deliveries||[]).filter(d=>d.status==="REVIEW_REQUIRED").map(d=><button key={d.id} disabled={busy} onClick={()=>reconcileDelivery(d.id)}>Periksa #{d.id}</button>)}{canRetry && <button disabled={busy} onClick={()=>retryDelivery(o.order_number)}>Ulangi pengiriman</button>}{canRefund && <button disabled={busy} onClick={()=>issueRefund(o.order_number)}>Kembalikan Stars</button>}</div></td></tr>})}
      {!orders.length && <tr><td colSpan="7" className="table-empty">Belum ada transaksi.</td></tr>}
      </tbody></table></div>
      <p className="admin-footnote">Pengembalian dana hanya tersedia untuk pembayaran Stars yang tercatat. Produk yang sudah terkirim tetap tercatat sebagai terjual dan tidak otomatis dikembalikan ke stok.</p>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">BIAYA OPERASIONAL</span><h2>Biaya operasional</h2></div></div>
      <form className="admin-form" onSubmit={addExpense}>
        <label>Kategori<select value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})}><option value="OPERATIONS">Operasional</option><option value="MARKETING">Pemasaran</option><option value="PLATFORM">Platform</option><option value="SUPPORT">Dukungan</option><option value="OTHER">Lainnya</option></select></label>
        <label>Jumlah biaya (XTR)<input required type="number" min="1" value={expenseForm.amountXtr} onChange={e=>setExpenseForm({...expenseForm,amountXtr:e.target.value})}/></label>
        <label className="span-2">Keterangan<input required value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})} placeholder="Contoh: biaya promosi minggu ini"/></label>
        <button className="admin-primary" disabled={busy}>Catat biaya</button>
      </form>
      <p className="admin-footnote">Biaya operasional dicatat terpisah dan diperhitungkan dalam laba bersih.</p>
    </section>
  </main>;
}
