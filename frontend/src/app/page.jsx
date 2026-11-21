'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData, getTelegramWebApp, openInvoice } from '../lib/telegram';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const CATEGORIES = [
  { id: 'ALL', label: 'Semua game', mark: '✦' },
  { id: 'MLBB', label: 'MLBB', mark: 'ML' },
  { id: 'ROBLOX', label: 'Roblox', mark: 'R' },
  { id: 'FREE_FIRE', label: 'Free Fire', mark: 'FF' },
  { id: 'GENSHIN', label: 'Genshin Impact', mark: 'GI' }
];
const TIERS = [
  { id: 'ALL', label: 'Semua tingkat' },
  { id: 'SILVER', label: 'Silver' },
  { id: 'GOLD', label: 'Gold' },
  { id: 'PLATINUM', label: 'Platinum' },
  { id: 'SERVICE', label: 'Layanan' }
];

const GAME_LABELS = { MLBB: 'MLBB', ROBLOX: 'Roblox', FREE_FIRE: 'Free Fire', GENSHIN: 'Genshin Impact', OTHER: 'Lainnya' };
const GAME_MARKS = { MLBB: 'ML', ROBLOX: 'R', FREE_FIRE: 'FF', GENSHIN: 'GI', OTHER: 'VC' };
const TIER_LABELS = { SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum', SERVICE: 'Layanan' };
const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: 'Menunggu pembayaran',
  PAID: 'Pembayaran diterima',
  FULFILLING: 'Sedang dikirim',
  FULFILLED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  REFUND_PENDING: 'Pengembalian sedang diproses',
  REFUNDED: 'Pengembalian selesai',
  FAILED: 'Pesanan gagal'
};

function AppIcon({ name }) {
  const common = { viewBox: '0 0 24 24', width: 21, height: 21, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'home') return <svg {...common}><path d="m3.5 10 8.5-7 8.5 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></svg>;
  if (name === 'categories') return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.7" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.7" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.7" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.7" /></svg>;
  if (name === 'orders') return <svg {...common}><path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z" /><path d="M14.5 3.5V7h3.5M9 11h6M9 15h6" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20c.7-3.3 3.4-5.2 7.5-5.2s6.8 1.9 7.5 5.2" /></svg>;
}

function ProductSkeleton({ index }) {
  return <article className="product-card skeleton-card" aria-hidden="true" key={index}>
    <div className="product-art skeleton-block" />
    <div className="product-content">
      <div className="skeleton-line skeleton-short" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-description" />
      <div className="skeleton-bottom"><div className="skeleton-line skeleton-price" /><div className="skeleton-button" /></div>
    </div>
  </article>;
}

function OrderSkeleton() {
  return <div className="orders-skeleton" aria-label="Memuat pesanan">
    {[0, 1, 2].map((item) => <div className="order-skeleton-row" key={item}>
      <div><span className="skeleton-line skeleton-order-number" /><span className="skeleton-line skeleton-order-date" /></div>
      <span className="skeleton-status" />
    </div>)}
  </div>;
}

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('ALL');
  const [tier, setTier] = useState('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buyingId, setBuyingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [ownerAccess, setOwnerAccess] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownerCheck, setOwnerCheck] = useState('checking');
  const [setupBusy, setSetupBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    const tg = getTelegramWebApp();
    tg?.ready();
    tg?.expand();
    const load = async () => {
      try {
        const response = await fetch(API + '/api/catalog', { cache: 'no-store' });
        if (!response.ok) throw new Error('Katalog tidak dapat dimuat.');
        const data = await response.json();
        setProducts(data.products || []);

        // Owner-only test setup runs automatically once the Mini App is opened in Telegram.
        const initData = getInitData();
        if (initData) {
          try {
            const sessionResponse = await fetch(API + '/api/session', {
              headers: { 'x-telegram-init-data': initData }, cache: 'no-store'
            });
            if (sessionResponse.ok) {
              const session = await sessionResponse.json();
              if (session.isOwner === true) {
                const setupResponse = await fetch(API + '/api/admin/test-fixtures', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
                  body: JSON.stringify({})
                });
                const setupData = await setupResponse.json();
                if (!setupResponse.ok) throw new Error(setupData.message || 'Persiapan produk uji gagal.');
                const refreshed = await fetch(API + '/api/catalog', { cache: 'no-store' });
                const refreshedData = await refreshed.json();
                if (!refreshed.ok) throw new Error('Produk uji tersimpan, tetapi katalog belum dapat dimuat ulang.');
                setProducts(refreshedData.products || []);
                setNotice('Empat produk uji dan stok dummy siap. Katalog sudah diperbarui.');
              }
            }
          } catch (setupError) {
            setNotice(setupError.message || 'Persiapan produk uji gagal. Buka Profile untuk mencoba kembali.');
          }
        }
      } catch (e) {
        setError(e.message || 'Katalog tidak dapat dimuat. Coba kembali.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => products.filter((p) =>
    (category === 'ALL' || p.game_category === category)
    && (tier === 'ALL' || p.tier === tier)
    && (String(p.name || '') + ' ' + String(p.description || '') + ' ' + String(p.sku || '')).toLowerCase().includes(query.toLowerCase())
    && p.is_available
  ), [products, category, tier, query]);

  async function buy(product) {
    const initData = getInitData();
    if (!initData) {
      setNotice('Untuk melanjutkan pembayaran, buka VAULT CORE melalui bot Telegram.');
      return;
    }
    setBuyingId(product.id);
    setNotice('Menyiapkan tagihan Telegram Stars…');
    try {
      const response = await fetch(API + '/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Checkout gagal dibuat.');
      setNotice('Tagihan untuk pesanan ' + data.orderNumber + ' siap dibuka.');
      openInvoice(data.invoiceUrl);
    } catch (e) {
      setNotice(e.message || 'Checkout gagal dibuat. Coba kembali.');
    } finally {
      setBuyingId(null);
    }
  }

  async function showOrders() {
    setActiveTab('orders');
    setOrdersOpen(true);
    setOrdersLoading(true);
    setOrdersError('');
    const initData = getInitData();
    if (!initData) {
      setOrdersError('Buka VAULT CORE melalui Telegram untuk melihat riwayat pesanan.');
      setOrdersLoading(false);
      return;
    }
    try {
      const response = await fetch(API + '/api/orders/mine', { headers: { 'x-telegram-init-data': initData }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Riwayat pesanan tidak dapat dimuat. Coba kembali.');
      setOrders(data.orders || []);
    } catch (e) {
      setOrdersError(e.message || 'Riwayat pesanan tidak dapat dimuat. Coba kembali.');
    } finally {
      setOrdersLoading(false);
    }
  }

  function closeOrders() {
    setOrdersOpen(false);
    setActiveTab('home');
  }

  function openProfile() {
    const user = getTelegramWebApp()?.initDataUnsafe?.user || null;
    setProfileUser(user);
    setOwnerAccess(false);
    setOwnerUserId('');
    setOwnerCheck('checking');
    setProfileOpen(true);
    setActiveTab('profile');
    const initData = getInitData();
    if (!initData) { setOwnerCheck('telegram_required'); return; }
    fetch(API + '/api/session', { headers: { 'x-telegram-init-data': initData }, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'SESSION_CHECK_UNAVAILABLE');
        setOwnerUserId(String(data.userId || ''));
        setOwnerAccess(data.isOwner === true);
        setOwnerCheck(data.isOwner === true ? 'owner' : 'not_owner');
      })
      .catch(() => setOwnerCheck('error'));
  }

  async function prepareTestProducts() {
    const initData = getInitData();
    if (!initData || !ownerAccess || setupBusy) return;
    setSetupBusy(true);
    setNotice('Menyiapkan empat produk uji dan stok dummy…');
    try {
      const response = await fetch(API + '/api/admin/test-fixtures', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Persiapan produk uji gagal.');
      const catalog = await fetch(API + '/api/catalog', { cache: 'no-store' });
      const catalogData = await catalog.json();
      if (!catalog.ok) throw new Error('Produk uji tersimpan, tetapi katalog belum dapat dimuat ulang.');
      setProducts(catalogData.products || []);
      setCategory('ALL'); setTier('ALL'); setQuery('');
      setProfileOpen(false); setActiveTab('home');
      setNotice('Selesai. Empat produk uji dan stok dummy sudah tampil di katalog. Harga uji 1 XTR.');
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setNotice(e.message || 'Persiapan produk uji gagal.');
    } finally { setSetupBusy(false); }
  }

  function closeProfile() {
    setProfileOpen(false);
    setActiveTab('home');
  }

  function navigate(tab) {
    if (tab === 'orders') {
      showOrders();
      return;
    }
    if (tab === 'profile') {
      openProfile();
      return;
    }
    setOrdersOpen(false);
    setProfileOpen(false);
    setActiveTab(tab);
    const target = document.getElementById(tab === 'categories' ? 'categories' : 'home');
    if (target) {
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  const profileName = profileUser
    ? ([profileUser.first_name, profileUser.last_name].filter(Boolean).join(' ') || 'Pengguna Telegram')
    : 'Belum terhubung';
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'VC';

  return <>
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Beranda VAULT CORE" onClick={() => setActiveTab('home')}>
          <span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span>
        </a>
        <span className="topbar-status"><span className="status-dot" /> TELEGRAM STARS <strong>XTR</strong></span>
      </header>

      <section className="hero" id="home">
        <div className="hero-glow" />
        <div className="eyebrow"><span className="pulse" /> DIGITAL GAMING STORE</div>
        <h1>Semua kebutuhan<br /><span>gaming, satu tempat.</span></h1>
        <p>Jelajahi kode digital, voucher, lisensi, dan layanan gaming yang tersedia di VAULT CORE.</p>
        <a className="hero-cta" href="#catalog">Telusuri katalog <span>↗</span></a>
        <div className="hero-stats">
          <div><strong>04</strong><small>Kategori game</small></div>
          <div><strong>03</strong><small>Tingkat produk</small></div>
          <div><strong>XTR</strong><small>Pembayaran Telegram Stars</small></div>
        </div>
      </section>

      <section className="section category-section" id="catalog">
        <div className="section-heading">
          <div><span className="eyebrow muted">JELAJAHI STORE</span><h2 id="categories">Categories</h2></div>
          <span className="section-count">04 GAME</span>
        </div>
        <div className="category-grid" role="group" aria-label="Filter kategori game">
          {CATEGORIES.map((item) => <button
            key={item.id}
            type="button"
            className={'category-card ' + (category === item.id ? 'selected' : '') + ' cat-' + item.id.toLowerCase()}
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
          >
            <span className="cat-icon">{item.mark}</span>
            <span className="cat-name">{item.label}</span>
            <span className="cat-arrow">↗</span>
          </button>)}
        </div>
      </section>

      <section className="section product-section" id="products">
        <div className="section-heading">
          <div><span className="eyebrow muted">PILIH PRODUK</span><h2>Produk pilihan</h2></div>
          <span className="section-count">{loading ? '—' : String(filtered.length).padStart(2, '0') + ' PRODUK'}</span>
        </div>
        <div className="filters" aria-label="Filter tingkat produk">
          {TIERS.map((item) => <button key={item.id} type="button" className={'filter-chip ' + (tier === item.id ? 'active' : '')} aria-pressed={tier === item.id} onClick={() => setTier(item.id)}>{item.label}</button>)}
        </div>
        <label className="searchbox"><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk atau layanan…" aria-label="Cari produk atau layanan" /></label>

        {loading ? <div className="product-grid" aria-label="Memuat katalog" aria-busy="true">
          {[0, 1, 2, 3].map((item) => <ProductSkeleton index={item} key={item} />)}
        </div> : error ? <div className="empty-state error" role="alert"><span className="empty-icon">!</span><strong>Katalog belum tersedia</strong><p>{error}</p></div> : filtered.length === 0 ? <div className="empty-state">
          <span className="empty-icon">◇</span>
          <strong>Belum ada produk tersedia</strong>
          <p>Produk akan muncul setelah pemilik toko mengaktifkan produk dan menambahkan stok yang siap dijual.</p>
        </div> : <div className="product-grid">
          {filtered.map((product) => {
            const game = product.game_category || 'OTHER';
            const promoBadge = product.badge === 'BEST_SELLER' ? 'BEST SELLER' : product.badge === 'HOT' ? 'HOT' : '';
            return <article className="product-card" key={product.id}>
              <div className={'product-art art-' + game.toLowerCase()}>
                <span className="art-ring" />
                <span className="art-orbit" />
                <span className="art-monogram">{GAME_MARKS[game] || 'VC'}</span>
                <span className="art-caption">{GAME_LABELS[game] || game.replaceAll('_', ' ')}</span>
                {promoBadge && <span className="product-badge">{promoBadge}</span>}
                {product.is_test && <span className="product-badge badge-test">PRODUK UJI</span>}
              </div>
              <div className="product-content">
                <div className="product-top">
                  <span className={'tier-label ' + String(product.tier || '').toLowerCase()}>{TIER_LABELS[product.tier] || product.tier}</span>
                  <span className="stock-label">{typeof product.display_stock === 'number' ? 'Stok ' + product.display_stock : product.display_stock === 'IN_STOCK' ? 'Tersedia' : 'Tersedia'}</span>
                </div>
                <div className="product-category">{GAME_LABELS[game] || game.replaceAll('_', ' ')}</div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-bottom">
                  <div><small>HARGA</small><strong>{product.sale_price_xtr} XTR</strong></div>
                  <button className="buy-button" type="button" disabled={buyingId === product.id} onClick={() => buy(product)}>{buyingId === product.id ? 'Menyiapkan…' : 'Beli Sekarang'}</button>
                </div>
              </div>
            </article>;
          })}
        </div>}
      </section>

      <section className="trust-strip"><span>✦</span><div><strong>Pembayaran melalui Telegram Stars</strong><small>Pembayaran diproses melalui invoice resmi Telegram dalam XTR.</small></div></section>
      <footer className="footer"><a className="brand" href="#home" onClick={() => setActiveTab('home')}><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a><small>© {new Date().getFullYear()} VAULT CORE. Katalog produk digital dan layanan gaming.</small></footer>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        <button type="button" className={'nav-item ' + (activeTab === 'home' ? 'active' : '')} aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><AppIcon name="home" /><span>Home</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'categories' ? 'active' : '')} aria-current={activeTab === 'categories' ? 'page' : undefined} onClick={() => navigate('categories')}><AppIcon name="categories" /><span>Categories</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'orders' ? 'active' : '')} aria-current={activeTab === 'orders' ? 'page' : undefined} onClick={() => navigate('orders')}><AppIcon name="orders" /><span>My Orders</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'profile' ? 'active' : '')} aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><AppIcon name="profile" /><span>Profile</span></button>
      </nav>

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup">×</button></div>}

      {ordersOpen && <div className="modal-backdrop" onClick={closeOrders}>
        <section className="orders-modal" role="dialog" aria-modal="true" aria-labelledby="orders-title" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow muted">AKUN ANDA</span><h2 id="orders-title">My Orders</h2></div><button className="icon-button" type="button" onClick={closeOrders} aria-label="Tutup riwayat pesanan">×</button></div>
          {ordersLoading ? <OrderSkeleton /> : ordersError ? <div className="empty-state error"><strong>Pesanan belum dapat dimuat</strong><p>{ordersError}</p></div> : orders.length ? orders.map((order) => <div className="order-row" key={order.order_number}>
            <div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString('id-ID')}</small></div>
            <span className={'order-status ' + String(order.status).toLowerCase()}>{ORDER_STATUS_LABELS[order.status] || 'Status pesanan sedang diperbarui'}</span>
          </div>) : <div className="empty-state"><span className="empty-icon">▤</span><strong>Belum ada pesanan</strong><p>Pesanan yang dibuat melalui VAULT CORE akan muncul di sini.</p></div>}
        </section>
      </div>}

      {profileOpen && <div className="modal-backdrop" onClick={closeProfile}>
        <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow muted">PENGATURAN AKUN</span><h2 id="profile-title">Profile</h2></div><button className="icon-button" type="button" onClick={closeProfile} aria-label="Tutup profil">×</button></div>
          <div className="profile-identity">
            <div className="profile-avatar">{profileInitials}</div>
            <div><strong>{profileName}</strong><small>{profileUser?.username ? '@' + profileUser.username : (profileUser ? 'Terhubung melalui Telegram' : 'Buka Mini App melalui bot Telegram')}</small></div>
          </div>
          <div className="profile-info-row"><span>Status akun</span><strong><span className={'status-dot ' + (profileUser ? 'online' : '')} />{profileUser ? 'Terhubung' : 'Belum terhubung'}</strong></div>
          <div className="profile-info-row"><span>Metode pembayaran</span><strong>Telegram Stars · XTR</strong></div>
          <p className="profile-note">Identitas akun diverifikasi oleh Telegram saat Anda membuka VAULT CORE melalui bot.</p>
          {ownerCheck === 'checking' && <p className="profile-note">Memeriksa akses pemilik…</p>}
          {ownerCheck === 'not_owner' && <div className="profile-note"><strong>Akses pemilik belum terdaftar.</strong><br />ID Telegram terverifikasi: <strong>{ownerUserId}</strong><br />Kirim ID ini kepada pengelola untuk mengaktifkan akses pemilik.</div>}
          {ownerCheck === 'error' && <p className="profile-note">Pemeriksaan akses gagal. Tutup dan buka kembali Mini App melalui bot Telegram.</p>}
          {ownerCheck === 'telegram_required' && <p className="profile-note">Buka VAULT CORE dari tombol bot Telegram agar identitas dapat diverifikasi.</p>}
          <button className="profile-orders-button" type="button" onClick={() => { setProfileOpen(false); showOrders(); }}>Lihat riwayat pesanan <span>↗</span></button>
          {ownerAccess && <button className="profile-orders-button" type="button" disabled={setupBusy} onClick={prepareTestProducts}>{setupBusy ? 'Menyiapkan produk uji…' : 'Siapkan 4 produk uji sekarang'} <span>↗</span></button>}
        </section>
      </div>}
    </main>
  </>;
}
