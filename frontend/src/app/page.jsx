'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData, getTelegramWebApp, openInvoice } from '../lib/telegram';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const STORE_FILTERS = [
  { key: 'ALL', mode: 'all', id: 'ALL', label: 'Semua produk' },
  { key: 'TIER_SILVER', mode: 'tier', id: 'SILVER', label: '🥈 Silver' },
  { key: 'TIER_GOLD', mode: 'tier', id: 'GOLD', label: '🥇 Gold' },
  { key: 'TIER_PLATINUM', mode: 'tier', id: 'PLATINUM', label: '💎 Platinum' },
  { key: 'TIER_SERVICE', mode: 'tier', id: 'SERVICE', label: 'Layanan' },
  { key: 'GAME_MLBB', mode: 'game', id: 'MLBB', label: '⚔ MLBB' },
  { key: 'GAME_ROBLOX', mode: 'game', id: 'ROBLOX', label: 'Roblox' },
  { key: 'GAME_FREE_FIRE', mode: 'game', id: 'FREE_FIRE', label: '◎ Free Fire' },
  { key: 'GAME_GENSHIN', mode: 'game', id: 'GENSHIN', label: '✧ Genshin Impact' }
];
const CATEGORY_TILES = [
  { id: 'MLBB', label: 'Mobile Legends', subtitle: 'Kategori game', mode: 'game', mark: '⚔' },
  { id: 'ROBLOX', label: 'Roblox', subtitle: 'Kategori game', mode: 'game', mark: 'R' },
  { id: 'FREE_FIRE', label: 'Free Fire', subtitle: 'Kategori game', mode: 'game', mark: '◎' },
  { id: 'GENSHIN', label: 'Genshin Impact', subtitle: 'Kategori game', mode: 'game', mark: '✧' },
  { id: 'PLATINUM', label: 'Tier Platinum', subtitle: 'Koleksi premium', mode: 'tier', mark: '💎' }
];
const GAME_ART = {
  MLBB: '/assets/03-categories/category-mlbb.png',
  ROBLOX: '/assets/03-categories/category-roblox.png',
  FREE_FIRE: '/assets/03-categories/category-free-fire.png',
  GENSHIN: '/assets/03-categories/category-genshin.png',
  OTHER: '/assets/03-categories/category-other.png'
};
const TIER_ART = {
  SILVER: '/assets/04-tiers/tier-silver.png',
  GOLD: '/assets/04-tiers/tier-gold.png',
  PLATINUM: '/assets/04-tiers/tier-platinum.png'
};
const TRUST_ITEMS = [
  { icon: '/assets/06-icons/icon-wallet.svg', title: 'Pembayaran Telegram Stars', detail: 'Invoice resmi dalam XTR' },
  { icon: '/assets/06-icons/icon-box.svg', title: 'Stok aktual', detail: 'Ketersediaan diperiksa saat checkout' },
  { icon: '/assets/06-icons/icon-shield.svg', title: 'Payload terenkripsi', detail: 'Inventaris digital disimpan terenkripsi' },
  { icon: '/assets/06-icons/icon-orders.svg', title: 'Status pesanan', detail: 'Riwayat dan status dapat dipantau' }
];

const GAME_LABELS = { MLBB: 'MLBB', ROBLOX: 'Roblox', FREE_FIRE: 'Free Fire', GENSHIN: 'Genshin Impact', OTHER: 'Lainnya' };
const TIER_LABELS = { SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum', SERVICE: 'Layanan' };
const FULFILLMENT_LABELS = {
  REDEEM_CODE: 'Kode redeem', VOUCHER_CODE: 'Kode voucher', LICENSE_KEY: 'Kunci lisensi',
  GIFT_CODE: 'Gift code', DIGITAL_FILE: 'File digital', SERVICE_INSTRUCTIONS: 'Instruksi layanan'
};
function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('id-ID');
}
function formatStock(product) {
  if (product.display_stock === null) return product.is_available ? 'Tersedia' : 'Stok habis';
  if (typeof product.display_stock === 'number') return product.display_stock > 0 ? 'Tersedia · ' + product.display_stock + ' unit' : 'Stok habis';
  return product.display_stock === 'OUT_OF_STOCK' ? 'Stok habis' : 'Tersedia';
}
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
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20c.7-3.3 3.4-5.2 7.5-5.2s6.8 1.9 7.5 5.2" /></svg>;
}

function ProductSkeleton({ index }) {
  return <article className="product-card skeleton-card" aria-hidden="true" key={index}>
    <div className="product-card-head">
      <div className="product-art skeleton-block" />
      <div className="product-card-meta"><span className="skeleton-line skeleton-short" /><span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-order-date" /></div>
    </div>
    <div className="product-content">
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
  const [testProducts, setTestProducts] = useState([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
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
  const [telegramContext, setTelegramContext] = useState(null);

  async function loadCatalog() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API + '/api/catalog', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Katalog tidak dapat dimuat.');
      setProducts(data.products || []);
    } catch (e) {
      setError(e.message || 'Katalog tidak dapat dimuat. Coba kembali.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const tg = getTelegramWebApp();
    setTelegramContext(Boolean(getInitData()));
    tg?.ready();
    tg?.expand();
    loadCatalog();
  }, []);

  const sourceProducts = isTestMode ? testProducts : products;
  const activeStoreFilter = tier !== 'ALL' ? 'TIER_' + tier : category !== 'ALL' ? 'GAME_' + category : 'ALL';
  const activeFilterLabel = tier !== 'ALL'
    ? (tier === 'SERVICE' ? 'Layanan' : (TIER_LABELS[tier] || tier) + ' Tier')
    : category !== 'ALL' ? (GAME_LABELS[category] || category) : 'Semua produk';
  const filtered = useMemo(() => sourceProducts.filter((p) =>
    (category === 'ALL' || p.game_category === category)
    && (tier === 'ALL' || p.tier === tier)
    && (String(p.name || '') + ' ' + String(p.description || '') + ' ' + String(p.sku || '')).toLowerCase().includes(query.toLowerCase())
  ), [sourceProducts, category, tier, query, isTestMode]);

  async function buy(product) {
    const initData = getInitData();
    if (!initData) {
      setNotice('Untuk melanjutkan pembayaran, buka VAULT CORE melalui bot Telegram.');
      return;
    }
    setBuyingId(product.id);
    setNotice('Menyiapkan tagihan Telegram Stars…');
    try {
      const response = await fetch(API + (product.is_test ? '/api/orders/test' : '/api/orders'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Checkout gagal dibuat.');
      setNotice('Tagihan untuk pesanan ' + data.orderNumber + ' siap dibuka.');
      openInvoice(data.invoiceUrl, data.orderNumber);
    } catch (e) {
      setNotice(e.message || 'Checkout gagal dibuat. Coba kembali.');
    } finally {
      setBuyingId(null);
    }
  }

  async function loadOrders() {
    const initData = getInitData();
    if (!initData) throw new Error('Buka VAULT CORE melalui Telegram untuk melihat riwayat pesanan.');
    const response = await fetch(API + '/api/orders/mine', {
      headers: { 'x-telegram-init-data': initData }, cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Riwayat pesanan tidak dapat dimuat. Coba kembali.');
    const list = data.orders || [];
    setOrders(list);
    setOrdersError('');
    return list;
  }

  async function showOrders() {
    setActiveTab('orders');
    setOrdersOpen(true);
    setOrdersLoading(true);
    setOrdersError('');
    try {
      await loadOrders();
    } catch (e) {
      setOrdersError(e.message || 'Riwayat pesanan tidak dapat dimuat. Coba kembali.');
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const handlePaid = (event) => {
      const orderNumber = event.detail?.orderNumber;
      setNotice('Telegram mengonfirmasi pembayaran. Memperbarui status pesanan…');
      if (!orderNumber) return;
      const sync = async () => {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          if (cancelled) return;
          try {
            const initData = getInitData();
            const response = await fetch(API + '/api/orders/mine', {
              headers: { 'x-telegram-init-data': initData }, cache: 'no-store'
            });
            const data = await response.json();
            if (response.ok) {
              const list = data.orders || [];
              setOrders(list);
              const current = list.find((item) => item.order_number === orderNumber);
              if (current && current.status !== 'PENDING_PAYMENT') {
                setNotice('Pesanan ' + orderNumber + ': ' + (ORDER_STATUS_LABELS[current.status] || current.status) + '.');
                return;
              }
            }
          } catch {}
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
        if (!cancelled) setNotice('Telegram mengonfirmasi pembayaran, tetapi status VAULT CORE masih disinkronkan. Periksa kembali menu My Orders.');
      };
      sync();
    };
    window.addEventListener('vault:payment-paid', handlePaid);
    return () => {
      cancelled = true;
      window.removeEventListener('vault:payment-paid', handlePaid);
    };
  }, []);

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

  async function loadOwnerTestProducts(initData = getInitData()) {
    const response = await fetch(API + '/api/admin/test-fixtures', {
      headers: { 'x-telegram-init-data': initData }, cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Daftar produk uji tidak dapat dimuat.');
    setTestProducts(data.products || []);
    return data.products || [];
  }

  async function prepareTestProducts() {
    const initData = getInitData();
    if (!initData || !ownerAccess || setupBusy) return;
    setSetupBusy(true);
    setNotice('Menyiapkan empat produk uji dan stok dummy terenkripsi…');
    try {
      const response = await fetch(API + '/api/admin/test-fixtures', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Persiapan produk uji gagal.');
      await loadOwnerTestProducts(initData);
      setIsTestMode(true);
      setCategory('ALL'); setTier('ALL'); setQuery('');
      setProfileOpen(false); setActiveTab('home');
      setNotice('Ruang uji Owner siap. Produk DRAFT harus diaktifkan satu per satu sebelum checkout uji.');
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('products')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      setNotice(e.message || 'Persiapan produk uji gagal.');
    } finally { setSetupBusy(false); }
  }

  async function activateTestProduct(productId) {
    const initData = getInitData();
    if (!initData || !ownerAccess || activatingId !== null) return;
    setActivatingId(productId);
    setNotice('Memeriksa stok dan mengaktifkan produk uji…');
    try {
      const response = await fetch(API + '/api/admin/test-fixtures/' + productId + '/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Produk uji tidak dapat diaktifkan.');
      await loadOwnerTestProducts(initData);
      setNotice('Produk ' + data.product.sku + ' aktif pada ruang uji Owner. Checkout akan membuat invoice 1 XTR sungguhan.');
    } catch (e) {
      setNotice(e.message || 'Produk uji tidak dapat diaktifkan.');
    } finally {
      setActivatingId(null);
    }
  }

  function selectStoreFilter(item) {
    if (item.mode === 'tier') {
      setTier(item.id);
      setCategory('ALL');
      return;
    }
    if (item.mode === 'game') {
      setCategory(item.id);
      setTier('ALL');
      return;
    }
    setCategory('ALL');
    setTier('ALL');
  }

  function selectCategoryTile(item) {
    if (item.mode === 'tier') {
      setCategory('ALL');
      setTier(item.id);
    } else {
      setCategory(item.id);
      setTier('ALL');
    }
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('products')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
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
        <a className="brand" href="#home" aria-label="Beranda VAULT CORE" onClick={() => { setActiveTab('home'); setOrdersOpen(false); setProfileOpen(false); }}>
          <img className="brand-logo" src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE" />
        </a>
        <label className="top-searchbox" aria-label="Cari katalog">
          <AppIcon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari game, SKU, atau produk…" aria-label="Cari game, SKU, atau produk" />
          {query && <button className="clear-search" type="button" onClick={() => setQuery('')} aria-label="Hapus pencarian">×</button>}
        </label>
        <button className="top-profile-button" type="button" onClick={openProfile} aria-label="Buka profil"><AppIcon name="profile" /><span>Profil</span></button>
      </header>

      {telegramContext === false && <aside className="browser-access-notice" role="status">
        <strong>Akses akun melalui Telegram</strong>
        <span>Halaman ini menampilkan katalog publik. Login akun, riwayat pesanan, checkout XTR, dan Dashboard Owner tersedia setelah VAULT CORE dibuka melalui Telegram Mini App.</span>
      </aside>}

      <nav className="store-tabs" aria-label="Filter tier dan kategori katalog">
        {STORE_FILTERS.map((item) => <button
          key={item.key}
          type="button"
          className={'store-tab ' + (activeStoreFilter === item.key ? 'active' : '')}
          aria-pressed={activeStoreFilter === item.key}
          onClick={() => selectStoreFilter(item)}
        >{item.label}</button>)}
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse" /> VAULT CORE DIGITAL STORE</div>
          <h1>Temukan pilihan digital<br /><span>gaming dalam satu tempat.</span></h1>
          <p>Jelajahi kategori dan tier, periksa stok yang tersedia, lalu selesaikan pembayaran melalui invoice Telegram Stars.</p>
          <div className="hero-actions">
            <button className="hero-cta" type="button" onClick={() => { setCategory('ALL'); setTier('PLATINUM'); const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            document.getElementById('products')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }}>Jelajahi Tier Platinum <span>↗</span></button>
            <button className="hero-secondary" type="button" onClick={() => { setCategory('ALL'); setTier('ALL'); const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            document.getElementById('products')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }}>Semua produk</button>
          </div>
          <div className="hero-stats">
            <div><strong>04</strong><small>Kategori game</small></div>
            <div><strong>04</strong><small>Tier & layanan</small></div>
            <div><strong>XTR</strong><small>Telegram Stars</small></div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-visual-glow" />
          <img src="/assets/02-hero/hero-vaultcore.webp" alt="" fetchPriority="high" />
          <span className="hero-visual-caption">DIGITAL GAMING STORE <b>· XTR</b></span>
        </div>
      </section>

      <section className="section category-section" id="catalog">
        <div className="section-heading">
          <div><span className="eyebrow muted">JELAJAHI KATALOG</span><h2 id="categories">Kategori pilihan</h2></div>
          <span className="section-count">05 PILIHAN</span>
        </div>
        <div className="category-grid" role="group" aria-label="Pilih kategori atau tier unggulan">
          {CATEGORY_TILES.map((item) => {
            const active = item.mode === 'tier' ? tier === 'PLATINUM' : category === item.id;
            const art = item.mode === 'tier' ? TIER_ART.PLATINUM : GAME_ART[item.id];
            return <button
              key={item.id}
              type="button"
              className={'category-card ' + (active ? 'selected' : '') + (item.mode === 'tier' ? ' cat-tier-platinum' : ' cat-' + item.id.toLowerCase())}
              aria-pressed={active}
              onClick={() => selectCategoryTile(item)}
            >
              <span className="cat-icon"><img src={art} alt="" loading="lazy" /></span>
              <span className="category-copy"><strong>{item.label}</strong><small>{item.subtitle}</small></span>
              <span className="cat-arrow">↗</span>
            </button>;
          })}
        </div>
      </section>

      <section className="section product-section" id="products">
        <div className="section-heading">
          <div><span className="eyebrow muted">PILIHAN UNTUK ANDA</span><h2>Katalog produk game <span className="active-filter-badge">{activeFilterLabel}</span></h2></div>
          <span className="section-count">{loading ? '—' : String(filtered.length).padStart(2, '0') + ' PRODUK'}</span>
        </div>
        {isTestMode && <div className="test-lane-notice">
          <div><strong>RUANG UJI OWNER</strong><span>Produk contoh terpisah dari katalog pelanggan. Invoice uji bernilai 1 XTR sungguhan.</span></div>
          <button type="button" onClick={() => { setIsTestMode(false); setSelectedProduct(null); setNotice('Kembali ke katalog publik. Produk uji tidak ditampilkan kepada pelanggan.'); }}>Katalog publik</button>
        </div>}
        {loading ? <div className="product-grid" aria-label="Memuat katalog" aria-busy="true">
          {[0, 1, 2, 3].map((item) => <ProductSkeleton index={item} key={item} />)}
        </div> : error ? <div className="empty-state error" role="alert"><img className="state-illustration" src="/assets/05-states/network-error.png" alt="" /><strong>Katalog belum tersedia</strong><p>{error}</p><button className="reset-filters" type="button" onClick={loadCatalog}>Coba muat ulang</button></div> : filtered.length === 0 ? <div className="empty-state">
          <img className="state-illustration" src="/assets/05-states/product-not-found.png" alt="" />
          <strong>Produk tidak ditemukan</strong>
          <p>Coba kata kunci lain atau pilih filter kategori dan tier yang berbeda.</p>
          <button className="reset-filters" type="button" onClick={() => { setQuery(''); setCategory('ALL'); setTier('ALL'); }}>Reset filter</button>
        </div> : <div className="product-grid">
          {filtered.map((product) => {
            const game = product.game_category || 'OTHER';
            const isDraftTest = isTestMode && product.is_test === true && product.status !== 'ACTIVE';
            const stockText = formatStock(product);
            return <article className="product-card" key={product.id}>
              <div className="product-card-head">
                <div className={'product-art art-' + game.toLowerCase()}>
                  <img src={GAME_ART[game] || GAME_ART.OTHER} alt="" loading="lazy" />
                </div>
                <div className="product-card-meta">
                  <span className={'tier-label ' + String(product.tier || '').toLowerCase()}>{TIER_LABELS[product.tier] || product.tier} Tier</span>
                  <span className="product-sku">{product.sku}</span>
                  <span className="stock-label"><span className="stock-dot" />{stockText}</span>
                </div>
                {product.is_test && <span className="product-test-badge">CONTOH UJI</span>}
              </div>
              <div className="product-content">
                <div className="product-category">{GAME_LABELS[game] || game.replaceAll('_', ' ')}</div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-bottom">
                  <div className="product-price"><small>HARGA</small><strong>{Number(product.sale_price_xtr).toLocaleString('en-US')} XTR</strong></div>
                  <button className="buy-button" type="button" disabled={buyingId === product.id || activatingId === product.id}
                    onClick={() => isDraftTest ? activateTestProduct(product.id) : setSelectedProduct(product)}>
                    {activatingId === product.id ? 'Mengaktifkan…' : isDraftTest ? 'Aktifkan' : 'Detail & Beli'}
                  </button>
                </div>
              </div>
            </article>;
          })}
        </div>}
      </section>

      <section className="trust-strip" aria-label="Informasi layanan VAULT CORE">
        {TRUST_ITEMS.map((item) => <div className="trust-item" key={item.title}>
          <span className="trust-icon"><img src={item.icon} alt="" loading="lazy" /></span>
          <div><strong>{item.title}</strong><small>{item.detail}</small></div>
        </div>)}
      </section>
      <footer className="footer"><a className="brand" href="#home" onClick={() => { setActiveTab('home'); setOrdersOpen(false); setProfileOpen(false); }}><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a><small>© {new Date().getFullYear()} VAULT CORE. Katalog produk digital dan layanan gaming.</small></footer>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        <button type="button" className={'nav-item ' + (activeTab === 'home' ? 'active' : '')} aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><AppIcon name="home" /><span>Utama</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'categories' ? 'active' : '')} aria-current={activeTab === 'categories' ? 'page' : undefined} onClick={() => navigate('categories')}><AppIcon name="categories" /><span>Katalog</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'orders' ? 'active' : '')} aria-current={activeTab === 'orders' ? 'page' : undefined} onClick={() => navigate('orders')}><AppIcon name="orders" /><span>Pesanan</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'profile' ? 'active' : '')} aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><AppIcon name="profile" /><span>Profil</span></button>
      </nav>

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup">×</button></div>}

{selectedProduct && <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}>
        <section className="product-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow muted">DETAIL PRODUK</span><h2 id="product-detail-title">{selectedProduct.name}</h2></div><button className="icon-button" type="button" onClick={() => setSelectedProduct(null)} aria-label="Tutup detail produk">×</button></div>
          <div className="detail-product-art"><img src={GAME_ART[selectedProduct.game_category] || GAME_ART.OTHER} alt="" /></div>
          <div className="detail-category">{GAME_LABELS[selectedProduct.game_category] || selectedProduct.game_category} · {TIER_LABELS[selectedProduct.tier] || selectedProduct.tier}</div>
          <p className="detail-description">{selectedProduct.description || 'Deskripsi produk belum tersedia.'}</p>
          <div className="detail-facts">
            <div><span>Harga</span><strong>{Number(selectedProduct.sale_price_xtr || 0).toLocaleString('en-US')} XTR</strong></div>
            <div><span>Stok</span><strong>{formatStock(selectedProduct)}</strong></div>
            <div><span>Pemenuhan</span><strong>{FULFILLMENT_LABELS[selectedProduct.fulfillment_type] || selectedProduct.fulfillment_type || 'Belum ditentukan'}</strong></div>
            <div><span>Status produk</span><strong>{selectedProduct.status === 'ACTIVE' ? 'Aktif' : 'DRAFT'}</strong></div>
          </div>
          <div className="detail-policy">
            <strong>Ketentuan pembelian</strong>
            <ul>
              <li>Pembayaran dilakukan melalui invoice Telegram Stars (XTR).</li>
              <li>Stok direservasi saat checkout selama 15 menit.</li>
              <li>Pemenuhan dimulai setelah pembayaran berhasil diverifikasi oleh Telegram.</li>
              <li>Estimasi waktu pemenuhan belum ditetapkan pada data SKU ini.</li>
            </ul>
            {selectedProduct.is_test && <p>Produk contoh uji internal. Jika invoice diselesaikan, Telegram akan menagihkan 1 XTR sungguhan dan payload dummy tidak dapat ditukarkan.</p>}
          </div>
          <div className="detail-actions">
            {selectedProduct.is_test && selectedProduct.status !== 'ACTIVE'
              ? <button className="buy-button" type="button" disabled={activatingId === selectedProduct.id} onClick={() => { const productId = selectedProduct.id; setSelectedProduct(null); activateTestProduct(productId); }}>Aktifkan produk ini</button>
              : <button className="buy-button" type="button" disabled={!selectedProduct.is_available || buyingId === selectedProduct.id} onClick={() => { const product = selectedProduct; setSelectedProduct(null); buy(product); }}>
                  {selectedProduct.is_test ? 'Buat invoice uji · 1 XTR' : 'Lanjut ke pembayaran'}
                </button>}
          </div>
        </section>
      </div>}

            {ordersOpen && <div className="modal-backdrop" onClick={closeOrders}>
        <section className="orders-modal" role="dialog" aria-modal="true" aria-labelledby="orders-title" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow muted">AKUN ANDA</span><h2 id="orders-title">My Orders</h2></div><div className="modal-actions"><button className="icon-button" type="button" onClick={showOrders} aria-label="Perbarui riwayat pesanan">↻</button><button className="icon-button" type="button" onClick={closeOrders} aria-label="Tutup riwayat pesanan">×</button></div></div>
          {ordersLoading ? <OrderSkeleton /> : ordersError ? <div className="empty-state error"><strong>Pesanan belum dapat dimuat</strong><p>{ordersError}</p><button className="reset-filters" type="button" onClick={showOrders}>Coba lagi</button></div> : orders.length ? orders.map((order) => <div className="order-row" key={order.order_number}>
            <div className="order-row-main">
              <strong>{order.order_number}</strong>
              <small>{formatDate(order.created_at)}</small>
              <div className="order-items">{(Array.isArray(order.items) ? order.items : []).map((item, index) => <span key={index}>{item.name} × {item.quantity}</span>)}</div>
              <div className="order-meta">
                <strong>{Number(order.total_xtr || 0).toLocaleString('en-US')} XTR</strong>
                {order.paid_at && <small>Dibayar: {formatDate(order.paid_at)}</small>}
                {order.fulfilled_at && <small>Dipenuhi: {formatDate(order.fulfilled_at)}</small>}
              </div>
            </div>
            <span className={'order-status ' + String(order.status).toLowerCase()}>{ORDER_STATUS_LABELS[order.status] || 'Status pesanan sedang diperbarui'}</span>
          </div>) : <div className="empty-state"><img className="state-illustration" src="/assets/05-states/empty-orders.png" alt="" /><strong>Belum ada pesanan</strong><p>Pesanan yang dibuat melalui VAULT CORE akan muncul di sini.</p></div>}
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
          {ownerAccess && <div className="owner-test-access">
            <strong>Akses Owner aktif</strong>
            <small>Dashboard Owner digunakan untuk mengelola katalog, stok, transaksi, dan laporan usaha.</small>
            <button className="profile-orders-button" type="button" onClick={() => window.location.assign('/admin')}>Buka Dashboard Owner <span>↗</span></button>
            <small>Ruang uji berisi produk contoh terpisah dari katalog pelanggan.</small>
            <button className="profile-orders-button" type="button" disabled={setupBusy} onClick={prepareTestProducts}>{setupBusy ? 'Menyiapkan produk uji…' : 'Buka ruang uji · 4 produk'} <span>↗</span></button>
          </div>}
        </section>
      </div>}
    </main>
  </>;
}
