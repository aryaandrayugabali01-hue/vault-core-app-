'use client';

import { useEffect, useState } from 'react';
import { getInitData } from '../../lib/telegram';
import { splitInventoryPayloads } from '../../lib/inventory';
import { parseProductAttributesText, formatProductAttributesText } from '../../lib/product-attributes';
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
  INVALID_PRODUCT_IMAGE_URL:'Gunakan URL gambar HTTPS atau path lokal /assets/ yang valid.',
  PRODUCT_SKU_ALREADY_EXISTS:'SKU tersebut sudah digunakan oleh produk lain.',
  PRODUCT_REVIEW_REQUIRED_AFTER_DETAIL_CHANGE:'Metode pemenuhan berubah. Simpan review CR-05 baru sebelum mengaktifkan SKU.',
  PRODUCT_HAS_OPEN_ORDERS:'Metode pemenuhan belum dapat diubah karena masih ada pesanan aktif untuk SKU ini. Selesaikan atau rekonsiliasi pesanan terlebih dahulu.',
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
export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [marketplaceCategories, setMarketplaceCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ category:'OPERATIONS', description:'', amountXtr:'' });
  const [notice, setNotice] = useState('Memverifikasi akses pemilik…');
  const [stockProduct, setStockProduct] = useState('');
  const [stockPayload, setStockPayload] = useState('');
  const [stockSourceReference, setStockSourceReference] = useState('');
  const [rightsProductId, setRightsProductId] = useState('');
  const [rightsHistory, setRightsHistory] = useState([]);
  const [rightsEvents, setRightsEvents] = useState([]);
  const [rightsForm, setRightsForm] = useState({ rightsBasis:'', publisherPlatform:'', officialTermsUrl:'', authorizationEvidenceReference:'', chainOfTitle:'', transferMethod:'', region:'', validUntil:'', reviewStatus:'PENDING', reviewNotes:'', ownerAttested:false });
  const [displayCap, setDisplayCap] = useState({});
  const [editingProductId, setEditingProductId] = useState('');
  const [editForm, setEditForm] = useState({ sku:'', gameCategory:'MLBB', tier:'SILVER', marketplaceCategoryId:'', name:'', description:'', fulfillmentType:'REDEEM_CODE', salePriceXtr:'', costPriceXtr:'0', imageUrl:'', imageGalleryText:'', attributesText:'', customerTerms:'', fulfillmentEta:'' });
  const [busy, setBusy] = useState(false);
  const [authState, setAuthState] = useState('checking');
  const [botUsername, setBotUsername] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const headers = () => ({ 'content-type':'application/json', 'x-telegram-init-data':getInitData() });

  async function refresh() {
    const [dashboard, productResponse, orderResponse, categoryResponse] = await Promise.all([
      fetch(`${API}/api/admin/dashboard`, { headers:headers(), credentials:'include', cache:'no-store' }),
      fetch(`${API}/api/admin/products`, { headers:headers(), credentials:'include', cache:'no-store' }),
      fetch(`${API}/api/admin/orders`, { headers:headers(), credentials:'include', cache:'no-store' }),
      fetch(`${API}/api/admin/marketplace-categories`, { headers:headers(), credentials:'include', cache:'no-store' })
    ]);
    const dashboardData = await dashboard.json();
    const productData = await productResponse.json();
    const orderData = await orderResponse.json();
    const categoryData = await categoryResponse.json();
    if (!dashboard.ok || !productResponse.ok || !orderResponse.ok || !categoryResponse.ok) throw new Error(apiErrorMessage(dashboardData, '') || apiErrorMessage(productData, '') || apiErrorMessage(orderData, '') || apiErrorMessage(categoryData, '') || 'Akses panel pemilik tidak dapat diverifikasi. Buka VAULT CORE melalui Telegram dengan akun pemilik.');
    const nextProducts = productData.products || [];
    setStats(dashboardData); setProducts(nextProducts); setOrders(orderData.orders || []); setMarketplaceCategories(categoryData.categories || []);
    if (!rightsProductId && nextProducts.length) setRightsProductId(String(nextProducts.find((item) => !item.is_test)?.id || nextProducts[0].id));
    setNotice('Panel pemilik berhasil terhubung.');
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

  async function addStock(e) {
    e.preventDefault(); if (!stockProduct || !stockPayload.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/products/${stockProduct}/inventory`, { method:'POST', headers:headers(), credentials:'include', body:JSON.stringify({ payloads:splitInventoryPayloads(stockPayload), sourceReference:stockSourceReference }) });
      const data = await response.json(); if (!response.ok) throw new Error(apiErrorMessage(data, 'Stok tidak dapat ditambahkan. Periksa kembali data yang dimasukkan.'));
      setNotice(`${data.inserted} unit stok berhasil dienkripsi dan dikaitkan ke pemeriksaan Owner.`); setStockPayload(''); setStockSourceReference(''); await refresh();
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  function startEditProduct(product) {
    setEditingProductId(String(product.id));
    setEditForm({
      sku:product.sku || '',
      gameCategory:product.game_category || 'OTHER',
      marketplaceCategoryId:product.marketplace_category_id ? String(product.marketplace_category_id) : '',
      tier:product.tier || 'SILVER',
      name:product.name || '',
      description:product.description || '',
      fulfillmentType:product.fulfillment_type || 'REDEEM_CODE',
      salePriceXtr:String(product.sale_price_xtr ?? ''),
      costPriceXtr:String(product.cost_price_xtr ?? '0'),
      imageUrl:product.image_url || '',
      imageGalleryText:Array.isArray(product.image_gallery)?product.image_gallery.join('\n'):'',
      attributesText:formatProductAttributesText(product.attributes),
      customerTerms:product.customer_terms || '',
      fulfillmentEta:product.fulfillment_eta || ''
    });
    document.getElementById('product-edit-panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  async function saveProductDetails(event) {
    event.preventDefault();
    if (!editingProductId || busy) return;
    setBusy(true);
    try {
      const parsedAttributes = parseProductAttributesText(editForm.attributesText);
      if (!parsedAttributes.ok) throw new Error(parsedAttributes.error);
      const response = await fetch(`${API}/api/admin/products/${editingProductId}`, {
        method:'PATCH', headers:headers(), credentials:'include',
        body:JSON.stringify({
          ...editForm,
          sku:String(editForm.sku).trim().toUpperCase(),
          marketplaceCategoryId:editForm.marketplaceCategoryId || null,
          attributes:parsedAttributes.value,
          imageGallery:String(editForm.imageGalleryText || '').split(/\r?\n/).map((value)=>value.trim()).filter(Boolean),
          salePriceXtr:Number(editForm.salePriceXtr),
          costPriceXtr:Number(editForm.costPriceXtr)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(data, 'Detail produk tidak dapat disimpan.'));
      setNotice(data.productReviewReset
        ? 'Detail penting produk berubah. SKU dijeda bila sebelumnya aktif, stok tersedia dinonaktifkan, dan review CR-05 baru wajib dibuat.'
        : 'Detail produk berhasil diperbarui.');
      setEditingProductId('');
      await refresh();
    } catch (error) {
      setNotice(error.message || 'Detail produk tidak dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function loadRightsHistory(productId) {
    if (!productId) { setRightsHistory([]); setRightsEvents([]); return; }
    try {
      const response = await fetch(`${API}/api/admin/products/${productId}/rights-review`, { headers:headers(), credentials:'include', cache:'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(data, 'Riwayat pemeriksaan Owner tidak dapat dimuat.'));
      setRightsHistory(data.history || []); setRightsEvents(data.events || []);
    } catch (error) {
      setRightsHistory([]); setRightsEvents([]);
      setNotice(error.message || 'Riwayat pemeriksaan Owner tidak dapat dimuat.');
    }
  }

  useEffect(() => {
    if (authState === 'authenticated' && rightsProductId) loadRightsHistory(rightsProductId);
  }, [authState, rightsProductId]);

  async function saveRightsReview(event) {
    event.preventDefault();
    if (!rightsProductId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/products/${rightsProductId}/rights-review`, {
        method:'POST', headers:headers(), credentials:'include', body:JSON.stringify(rightsForm)
      });
      const data = await response.json();
      if (!response.ok) {
        const details = Array.isArray(data.details) ? ' ' + data.details.join(', ') : '';
        throw new Error(apiErrorMessage(data, 'Pemeriksaan internal Owner belum lengkap.') + details);
      }
      setNotice(data.message || 'Pemeriksaan internal Owner tersimpan.');
      await refresh(); await loadRightsHistory(rightsProductId);
    } catch (error) {
      setNotice(error.message || 'Pemeriksaan Owner gagal disimpan.');
    } finally { setBusy(false); }
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
  const idrRange = (attributes = {}) => {
    const min = Number(attributes.price_min_idr || 0);
    const max = Number(attributes.price_max_idr || 0);
    if (!min || !max) return '';
    const fmt = (value) => 'Rp ' + value.toLocaleString('id-ID');
    return min === max ? fmt(min) : fmt(min) + ' – ' + fmt(max);
  };
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
      <div className="admin-entry-actions"><a className="admin-primary admin-product-entry-link" href="/admin/products/new">+ Input produk baru</a><a className="admin-secondary-link" href="/admin/categories">Kelola kategori &amp; panduan beli</a></div>
    </section>

    {editingProductId && <section className="admin-panel" id="product-edit-panel">
      <div className="admin-section-head"><div><span className="eyebrow muted">OWNER / EDIT SKU</span><h2>Edit rincian produk</h2><p>Perubahan disimpan ke SKU yang dipilih. Metode pemenuhan baru memerlukan review ulang.</p></div></div>
      <form className="admin-form" onSubmit={saveProductDetails}>
        <label>SKU<input required value={editForm.sku} onChange={e=>setEditForm({...editForm,sku:e.target.value.toUpperCase()})} /></label>
        <label>Game<select value={editForm.gameCategory} onChange={e=>setEditForm({...editForm,gameCategory:e.target.value})}>{Object.entries(GAME_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="span-2">Kategori marketplace<select value={editForm.marketplaceCategoryId} onChange={e=>setEditForm({...editForm,marketplaceCategoryId:e.target.value})}><option value="">Belum ditetapkan</option>{marketplaceCategories.filter((item)=>item.is_active).map((item)=><option key={item.id} value={String(item.id)}>{item.name}</option>)}</select><small className="field-hint">Perubahan kategori marketplace memerlukan review ulang CR-05.</small></label>
        <label>Tier<select value={editForm.tier} onChange={e=>setEditForm({...editForm,tier:e.target.value})}>{Object.entries(TIER_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Nama produk<input required maxLength="160" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></label>
        <label className="span-2">Deskripsi produk<textarea rows="3" maxLength="5000" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} /></label>
        <label className="span-2">Atribut produk <small className="field-hint">Format Key|Value, satu atribut per baris. Perubahan atribut memerlukan review ulang CR-05.</small><textarea rows="4" value={editForm.attributesText} onChange={e=>setEditForm({...editForm,attributesText:e.target.value})} placeholder={'Rank|Mythic\nServer|Asia\nLevel|75'} /></label>
        <label>Metode pemenuhan<select value={editForm.fulfillmentType} onChange={e=>setEditForm({...editForm,fulfillmentType:e.target.value})}>
          <option value="REDEEM_CODE">Kode redeem</option><option value="VOUCHER_CODE">Kode voucher</option><option value="LICENSE_KEY">Kunci lisensi</option><option value="GIFT_CODE">Kode hadiah</option><option value="DIGITAL_FILE">Berkas digital</option><option value="SERVICE_INSTRUCTIONS">Petunjuk layanan</option><option value="GAME_ACCOUNT_TRANSFER">Transfer akun melalui prosedur resmi</option>
        </select></label>
        <label>Harga jual (XTR)<input required type="number" min="1" step="1" value={editForm.salePriceXtr} onChange={e=>setEditForm({...editForm,salePriceXtr:e.target.value})} /></label>
        <label>Modal (XTR)<input required type="number" min="0" step="1" value={editForm.costPriceXtr} onChange={e=>setEditForm({...editForm,costPriceXtr:e.target.value})} /></label>
        <label className="span-2">URL gambar utama (HTTPS atau /assets/)<input type="text" value={editForm.imageUrl} onChange={e=>setEditForm({...editForm,imageUrl:e.target.value})} placeholder="https://.../produk.webp" /></label>
        <label className="span-2">Galeri gambar, satu URL per baris<textarea rows="3" value={editForm.imageGalleryText} onChange={e=>setEditForm({...editForm,imageGalleryText:e.target.value})} placeholder={'https://cdn.../gambar-1.webp\nhttps://cdn.../gambar-2.webp'} /></label>
        <label className="span-2">Ketentuan untuk pelanggan<textarea rows="3" maxLength="5000" value={editForm.customerTerms} onChange={e=>setEditForm({...editForm,customerTerms:e.target.value})} /></label>
        <label className="span-2">Estimasi waktu pemenuhan<input maxLength="160" value={editForm.fulfillmentEta} onChange={e=>setEditForm({...editForm,fulfillmentEta:e.target.value})} placeholder="Contoh: 5–15 menit setelah pembayaran" /></label>
        <div className="admin-actions"><button className="admin-primary" disabled={busy}>Simpan rincian</button><button type="button" onClick={()=>setEditingProductId('')} disabled={busy}>Batal</button></div>
      </form>
    </section>}

    <section className="admin-panel" id="inventory-panel"><div className="admin-section-head"><div><span className="eyebrow muted">LANGKAH 2 · PERSEDIAAN</span><h2>Tambah stok digital</h2></div></div>
      <form className="admin-form" onSubmit={addStock}>
        <label className="span-2">Produk<select required value={stockProduct} onChange={e=>setStockProduct(e.target.value)}><option value="">Pilih produk yang siap menerima stok</option>{products.filter(p=>['DRAFT','PENDING_REVIEW','ACTIVE'].includes(p.status) && p.rights_review_usable && !p.is_test).map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
        <label className="span-2">Referensi sumber/vendor atau asal internal Owner<input required minLength="3" maxLength="2000" value={stockSourceReference} onChange={e=>setStockSourceReference(e.target.value)} placeholder="Nomor dokumen, vendor/ref sumber, atau ID asal internal" /></label>
        <label className="span-2">Satu unit per baris<textarea required rows="5" value={stockPayload} onChange={e=>setStockPayload(e.target.value)} placeholder="Masukkan kode digital/instruksi pemenuhan satu unit per baris." /></label>
        <button className="admin-primary" disabled={busy || !stockSourceReference.trim()}>Enkripsi dan simpan stok</button>
      </form>
    </section>

    <section className="admin-panel"><div className="admin-section-head"><div><span className="eyebrow muted">PENGELOLAAN STOK</span><h2>Produk dan tampilan stok</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk</th><th>Harga jual / rentang</th><th>Modal (XTR)</th><th>Stok aktual</th><th>Batas tampilan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {products.map(p=><tr key={p.id}><td><strong>{p.name} {p.is_test ? <span className="test-product-label">CONTOH UJI</span> : p.status==='PENDING_REVIEW' ? <span className="catalog-example-label">CONTOH KATALOG</span> : null}</strong><small>{p.sku} · {GAME_LABELS[p.game_category] || p.game_category} / {TIER_LABELS[p.tier] || p.tier}</small><details className="admin-product-details"><summary>Detail lengkap</summary><div><p>{p.description || 'Deskripsi belum diisi.'}</p><small>Metode: {p.fulfillment_type || 'BELUM DIKETAHUI'} · Review internal: {p.rights_review_status || 'BELUM ADA'} · Berlaku sampai: {p.rights_valid_until ? new Date(p.rights_valid_until).toLocaleDateString('id-ID') : 'BELUM DIKETAHUI'} · Referensi lama: {p.rights_review_reference || '—'} · Stok aktual: {p.actual_stock} · Status: {displayStatus(p.status)}</small></div></details></td><td>{idrRange(p.attributes) ? <><strong>Belum ditetapkan</strong><small>{idrRange(p.attributes)}</small></> : xtr(p.sale_price_xtr)}</td><td>{xtr(p.cost_price_xtr)}</td><td>{p.actual_stock}</td><td><input className="cap-input" type="number" min="0" value={displayCap[p.id] ?? p.display_stock_override ?? ''} placeholder="Aktual" onChange={e=>setDisplayCap({...displayCap,[p.id]:e.target.value})}/></td><td><span className={`admin-status ${p.status.toLowerCase()}`}>{displayStatus(p.status)}</span></td><td><div className="admin-actions"><button onClick={()=>updateProduct(p.id,{displayStockOverride:displayCap[p.id]==='' ? null : Number(displayCap[p.id])})} disabled={busy}>Simpan batas</button>{!p.is_test && <button onClick={()=>startEditProduct(p)} disabled={busy}>Edit detail</button>}{p.is_test ? <button disabled title="Fixture hanya dapat diaktifkan melalui ruang uji Owner">Ruang uji Owner</button> : p.status==='ACTIVE' ? <button onClick={()=>updateProduct(p.id,{status:'PAUSED'})} disabled={busy}>Jeda</button> : p.rights_review_usable && p.fulfillment_type ? <button onClick={()=>updateProduct(p.id,{status:'ACTIVE'})} disabled={busy}>Aktifkan</button> : <button onClick={()=>{setRightsProductId(String(p.id));document.getElementById('rights-review-panel')?.scrollIntoView({behavior:'smooth',block:'start'});}} disabled={busy}>Periksa CR-05</button>}</div></td></tr>)}
      {!products.length && <tr><td colSpan="7" className="table-empty">Belum ada produk dibuat.</td></tr>}
      </tbody></table></div>
      <p className="admin-footnote">Batas tampilan hanya membatasi angka yang ditampilkan. Sistem tetap menghitung dan memeriksa stok tersedia aktual saat checkout.</p><p className="admin-footnote">Produk komersial menerima stok hanya setelah pemeriksaan internal Owner APPROVED dan masih berlaku. Setiap batch stok wajib memiliki referensi sumber.</p>
    </section>

    <section className="admin-panel" id="rights-review-panel">
      <div className="admin-section-head"><div><span className="eyebrow muted">CR-05 · KEPUTUSAN INTERNAL OWNER</span><h2>Pemeriksaan hak dan dasar pemenuhan</h2><p>Owner mengisi catatan sumber, dasar hak, cara pemenuhan, hasil, serta masa berlaku per SKU.</p></div></div>
      <form className="admin-form" onSubmit={saveRightsReview}>
        <label className="span-2">SKU yang diperiksa<select required value={rightsProductId} onChange={e=>setRightsProductId(e.target.value)}>{products.filter(p=>!p.is_test).map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
        <label>Dasar hak<select required value={rightsForm.rightsBasis} onChange={e=>setRightsForm({...rightsForm,rightsBasis:e.target.value})}><option value="">Pilih dasar hak</option><option value="OWNER_CREATED">Dibuat internal Owner</option><option value="OWNER_OWNED">Dimiliki Owner</option><option value="AUTHORIZED_VENDOR">Vendor berotorisasi</option><option value="OFFICIAL_DISTRIBUTION">Distribusi resmi</option><option value="LICENSED_CONTENT">Konten berlisensi</option><option value="SERVICE">Layanan internal</option><option value="OTHER">Lainnya</option></select></label>
        <label>Penerbit / platform<input required value={rightsForm.publisherPlatform} onChange={e=>setRightsForm({...rightsForm,publisherPlatform:e.target.value})} placeholder="INTERNAL_OWNER untuk produk internal" /></label>
        <label className="span-2">Official terms URL<input type="url" value={rightsForm.officialTermsUrl} onChange={e=>setRightsForm({...rightsForm,officialTermsUrl:e.target.value})} placeholder="https://... (untuk platform eksternal)" /></label>
        <label className="span-2">Referensi bukti otorisasi<input value={rightsForm.authorizationEvidenceReference} onChange={e=>setRightsForm({...rightsForm,authorizationEvidenceReference:e.target.value})} placeholder="URL, nomor surat, kontrak, atau ID dokumen yang tersedia" /></label>
        <label className="span-2">Chain of title / asal produk<textarea required rows="3" value={rightsForm.chainOfTitle} onChange={e=>setRightsForm({...rightsForm,chainOfTitle:e.target.value})} placeholder="Jelaskan asal, kepemilikan, sumber vendor, serta kewenangan yang benar-benar dimiliki." /></label>
        <label className="span-2">Metode transfer / pemenuhan<textarea required rows="3" value={rightsForm.transferMethod} onChange={e=>setRightsForm({...rightsForm,transferMethod:e.target.value})} placeholder="Jelaskan prosedur pemenuhan yang akan dijalankan Owner." /></label>
        <label>Wilayah / region<input required value={rightsForm.region} onChange={e=>setRightsForm({...rightsForm,region:e.target.value})} placeholder="Contoh: Indonesia / Global" /></label>
        <label>Berlaku sampai<input required type="date" value={rightsForm.validUntil} onChange={e=>setRightsForm({...rightsForm,validUntil:e.target.value})} /></label>
        <label>Status pemeriksaan<select value={rightsForm.reviewStatus} onChange={e=>setRightsForm({...rightsForm,reviewStatus:e.target.value})}><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED · keputusan internal Owner</option><option value="REJECTED">REJECTED</option></select></label>
        <label className="span-2">Catatan pemeriksaan<textarea rows="3" value={rightsForm.reviewNotes} onChange={e=>setRightsForm({...rightsForm,reviewNotes:e.target.value})} placeholder="Batasan, keputusan, tindak lanjut, atau alasan penolakan." /></label>
        <label className="span-2 field-check"><input type="checkbox" checked={rightsForm.ownerAttested} onChange={e=>setRightsForm({...rightsForm,ownerAttested:e.target.checked})} /> Saya sebagai Owner menyatakan data ini benar dan bertanggung jawab atas keputusan internal.</label>
        <button className="admin-primary" disabled={busy || !rightsProductId}>Simpan pemeriksaan Owner</button>
      </form>
      <p className="admin-footnote">APPROVED adalah persetujuan internal Owner, bukan sertifikasi hukum atau izin dari penerbit. Jangan masukkan referensi bukti yang tidak tersedia. Unggahan berkas belum tersedia; gunakan URL atau nomor referensi dokumen.</p>
      <div className="admin-section-head" style={{marginTop:'22px'}}><div><span className="eyebrow muted">AUDIT TRAIL</span><h2>Riwayat pemeriksaan</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Waktu</th><th>Status</th><th>Reviewer</th><th>Berlaku sampai</th><th>Dasar hak</th><th>Catatan</th></tr></thead><tbody>
        {rightsHistory.map(item=><tr key={item.id}><td>{item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('id-ID') : '—'}</td><td>{item.review_status}</td><td>{item.reviewer_telegram_user_id}</td><td>{item.valid_until ? new Date(item.valid_until).toLocaleDateString('id-ID') : '—'}</td><td>{item.rights_basis}</td><td>{item.review_notes || '—'}</td></tr>)}
        {!rightsHistory.length && <tr><td colSpan="6" className="table-empty">Belum ada pemeriksaan untuk SKU ini.</td></tr>}
      </tbody></table></div>
      <p className="admin-footnote">{rightsEvents.length} catatan perubahan status/aktivitas tercatat pada audit trail.</p>
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
