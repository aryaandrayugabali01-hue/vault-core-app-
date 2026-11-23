'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData, getTelegramWebApp, openInvoice } from '../../lib/telegram';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const GAME_ORDER = ['MLBB','ROBLOX','FREE_FIRE','GENSHIN','OTHER'];
const GAME_MARKS = { MLBB:'⚔', ROBLOX:'R', FREE_FIRE:'◎', GENSHIN:'✧', OTHER:'◇' };
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
  GIFT_CODE: 'Gift code', DIGITAL_FILE: 'File digital', SERVICE_INSTRUCTIONS: 'Instruksi layanan', GAME_ACCOUNT_TRANSFER: 'Transfer akun melalui prosedur resmi'
};
function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('id-ID');
}
function formatStock(product) {
  if (product.status === 'PENDING_REVIEW') return 'Menunggu pemeriksaan';
  if (product.display_stock === null) return product.is_available ? 'Tersedia' : 'Stok habis';
  if (typeof product.display_stock === 'number') return product.display_stock > 0 ? 'Tersedia · ' + product.display_stock + ' unit' : 'Stok habis';
  return product.display_stock === 'OUT_OF_STOCK' ? 'Stok habis' : 'Tersedia';
}
function formatIdrRange(attributes = {}) {
  const min = Number(attributes.price_min_idr || 0);
  const max = Number(attributes.price_max_idr || 0);
  if (!min || !max) return '';
  const format = (value) => 'Rp ' + value.toLocaleString('id-ID');
  return min === max ? format(min) : format(min) + ' – ' + format(max);
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
  const [marketplaceCategories, setMarketplaceCategories] = useState([]);
  const [marketplaceCategoryId, setMarketplaceCategoryId] = useState('ALL');
  const [attributeFilters, setAttributeFilters] = useState({});
  const [sortBy, setSortBy] = useState('NAME');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideCategory, setGuideCategory] = useState(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
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
      setMarketplaceCategories(data.categories || []);
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
  const gameTabs = useMemo(() => {
    const present = new Set(sourceProducts.map((product) => product.game_category).filter(Boolean));
    return GAME_ORDER.filter((id) => present.has(id)).map((id) => ({
      id,
      label: GAME_LABELS[id] || id.replaceAll('_', ' '),
      short: id === 'FREE_FIRE' ? 'FREE FIRE' : (id === 'OTHER' ? 'LAINNYA' : id),
      mark: GAME_MARKS[id] || '◇',
      icon: GAME_ART[id] || GAME_ART.OTHER
    }));
  }, [sourceProducts]);
  const activeFilterLabel = category !== 'ALL' ? (GAME_LABELS[category] || category) : 'Semua game';
  const selectedGame = gameTabs.find((item) => item.id === category) || null;
  const gameMarketplaceCategories = useMemo(() => marketplaceCategories.filter((item) => {
    if (category === 'ALL') return true;
    const prefix = category.toLowerCase().replaceAll('_','-') + '-';
    return String(item.slug || '').startsWith(prefix);
  }), [marketplaceCategories, category]);
  const availableTiers = useMemo(() => {
    const present = new Set(sourceProducts
      .filter((product) => (category === 'ALL' || product.game_category === category)
        && (marketplaceCategoryId === 'ALL' || String(product.marketplace_category_id || '') === marketplaceCategoryId))
      .map((product) => product.tier));
    return Object.entries(TIER_LABELS).filter(([value]) => present.has(value));
  }, [sourceProducts, category, marketplaceCategoryId]);
  const attributeFacets = useMemo(() => {
    const productsForFacets = sourceProducts.filter((product) =>
      (category === 'ALL' || product.game_category === category)
      && (marketplaceCategoryId === 'ALL' || String(product.marketplace_category_id || '') === marketplaceCategoryId)
    );
    const valuesByKey = new Map();
    for (const product of productsForFacets) {
      const attributes = product.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes) ? product.attributes : {};
      for (const [key, rawValue] of Object.entries(attributes)) {
        const value = String(rawValue ?? '').trim();
        if (!value) continue;
        if (!valuesByKey.has(key)) valuesByKey.set(key, new Set());
        valuesByKey.get(key).add(value);
      }
    }
    return [...valuesByKey.entries()].sort(([a],[b]) => a.localeCompare(b, 'id'))
      .map(([key, values]) => ({ key, values:[...values].sort((a,b)=>a.localeCompare(b,'id')) }));
  }, [sourceProducts, category, marketplaceCategoryId]);
  const filtered = useMemo(() => {
    const list = sourceProducts.filter((p) =>
      (category === 'ALL' || p.game_category === category)
      && (tier === 'ALL' || p.tier === tier)
      && (marketplaceCategoryId === 'ALL' || String(p.marketplace_category_id || '') === marketplaceCategoryId)
      && Object.entries(attributeFilters).every(([key, value]) => !value || String(p.attributes?.[key] ?? '') === value)
      && (String(p.name || '') + ' ' + String(p.description || '') + ' ' + String(p.sku || '') + ' ' + String(p.marketplace_category_name || '')).toLowerCase().includes(query.toLowerCase())
    );
    if (sortBy === 'PRICE_ASC') return list.sort((a,b)=>Number(a.sale_price_xtr)-Number(b.sale_price_xtr));
    if (sortBy === 'PRICE_DESC') return list.sort((a,b)=>Number(b.sale_price_xtr)-Number(a.sale_price_xtr));
    return list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'id'));
  }, [sourceProducts, category, tier, marketplaceCategoryId, attributeFilters, query, sortBy, isTestMode]);

  const cartLines = useMemo(() => cart.map((line) => {
    const product = products.find((item) => Number(item.id) === Number(line.productId));
    return product ? { ...line, product, subtotal:Number(product.sale_price_xtr) * line.quantity } : null;
  }).filter(Boolean), [cart, products]);
  const cartCount = cart.reduce((sum,line)=>sum+line.quantity,0);
  const cartSubtotal = cartLines.reduce((sum,line)=>sum+line.subtotal,0);

  function addToCart(product, quantity = 1) {
    if (!product || product.is_test || !product.is_available) return;
    const amount = Math.max(1,Math.min(5,Number(quantity)||1));
    setCart((current) => {
      const next=current.map((item)=>({...item}));
      const existing=next.find((item)=>Number(item.productId)===Number(product.id));
      if (existing) existing.quantity=Math.min(5,existing.quantity+amount);
      else next.push({productId:Number(product.id),quantity:amount});
      return next.reduce((sum,item)=>sum+item.quantity,0)<=20 ? next : current;
    });
    setSelectedProduct(null);
    setNotice('Produk ditambahkan ke keranjang. Harga dan stok akan diperiksa ulang saat checkout.');
  }

  function updateCartQuantity(productId, quantity) {
    const value=Number(quantity);
    setCart((current)=>current.map((item)=>Number(item.productId)===Number(productId)
      ? {...item,quantity:Math.max(1,Math.min(5,value))}:item));
  }

  function removeCartItem(productId) {
    setCart((current)=>current.filter((item)=>Number(item.productId)!==Number(productId)));
  }

  async function checkoutCart() {
    const initData=getInitData();
    if (!initData) { setNotice('Buka VAULT CORE melalui bot Telegram untuk melanjutkan pembayaran.'); return; }
    if (!cart.length || buyingId) return;
    setBuyingId('cart');
    setNotice('Memeriksa harga dan stok keranjang di server…');
    try {
      const response=await fetch(API+'/api/orders',{
        method:'POST',headers:{'content-type':'application/json','x-telegram-init-data':initData},
        body:JSON.stringify({items:cart.map(({productId,quantity})=>({productId,quantity}))})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.message||'Checkout keranjang gagal dibuat.');
      setCart([]);setCartOpen(false);
      setNotice('Invoice Telegram Stars untuk '+data.orderNumber+' siap dibuka. Total: '+Number(data.totalXtr).toLocaleString('en-US')+' XTR.');
      openInvoice(data.invoiceUrl,data.orderNumber);
    } catch(error) { setNotice(error.message||'Checkout keranjang gagal.'); }
    finally { setBuyingId(null); }
  }

  async function buy(product, quantity = 1) {
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
        body: JSON.stringify({ productId: product.id, quantity })
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

  function selectMarketplaceCategory(id) {
    setMarketplaceCategoryId(String(id));
    setTier('ALL');
    setAttributeFilters({});
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('products')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
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
        <a className="brand" href="/" aria-label="Dashboard VAULT CORE" onClick={() => { setActiveTab('home'); setOrdersOpen(false); setProfileOpen(false); }}>
          <img className="brand-logo" src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE" />
        </a>
        <label className="top-searchbox" aria-label="Cari katalog">
          <AppIcon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari game, SKU, atau produk…" aria-label="Cari game, SKU, atau produk" />
          {query && <button className="clear-search" type="button" onClick={() => setQuery('')} aria-label="Hapus pencarian">×</button>}
        </label>
        <button className="top-cart-button" type="button" onClick={()=>setCartOpen(true)} aria-label={'Buka keranjang, '+cartCount+' item'}><AppIcon name="orders" /><span>Keranjang</span><b>{cartCount}</b></button>
        <button className="top-profile-button" type="button" onClick={openProfile} aria-label="Buka profil"><AppIcon name="profile" /><span>Profil</span></button>
      </header>

      {telegramContext === false && <aside className="browser-access-notice" role="status">
        <strong>Akses akun melalui Telegram</strong>
        <span>Halaman ini menampilkan katalog publik. Login akun, riwayat pesanan, checkout XTR, dan Dashboard Owner tersedia setelah VAULT CORE dibuka melalui Telegram Mini App.</span>
      </aside>}

      <section className="marketplace-game-nav" id="home">
        <div className="marketplace-game-heading">
          <span className="eyebrow muted">VAULT CORE · DIGITAL GAME STORE</span>
          <h1>{selectedGame?.label || 'Semua game'}</h1>
          <p>Pilih jenis produk, buka detail penawaran, lalu lanjutkan ke pembayaran Telegram Stars.</p>
        </div>
        <nav className="marketplace-game-tabs" aria-label="Pilih game">
          <button type="button" className={category === 'ALL' ? 'active' : ''} aria-pressed={category === 'ALL'} onClick={() => { setCategory('ALL'); setTier('ALL'); setMarketplaceCategoryId('ALL'); setAttributeFilters({}); setQuery(''); }}>Semua game</button>
          {gameTabs.map((game) => <button key={game.id} type="button" className={category === game.id ? 'active' : ''} aria-pressed={category === game.id} onClick={() => { setCategory(game.id); setTier('ALL'); setMarketplaceCategoryId('ALL'); setAttributeFilters({}); setQuery(''); }}>
            <img className="game-tab-icon" src={game.icon} alt="" loading="lazy" />{game.short}
          </button>)}
          {!gameTabs.length && !loading && <span className="marketplace-no-categories">Game akan tampil setelah tersedia produk aktif.</span>}
        </nav>
        <nav className={'marketplace-category-nav' + (category === 'MLBB' ? ' mlbb-subcategory-nav' : '')} id="categories" aria-label="Kategori produk">
          <button type="button" className={marketplaceCategoryId === 'ALL' ? 'active' : ''} onClick={() => selectMarketplaceCategory('ALL')}>Semua</button>
          {gameMarketplaceCategories.map((item) => <button key={item.id} type="button" className={marketplaceCategoryId === String(item.id) ? 'active' : ''} onClick={() => selectMarketplaceCategory(String(item.id))}><span>{item.icon || '◇'}</span>{item.name}</button>)}
          {!gameMarketplaceCategories.length && !loading && <span className="marketplace-no-categories">Kategori akan tampil setelah Owner menghubungkan produk aktif.</span>}
        </nav>
      </section>

      <section className="section product-section" id="products">
        <div className="section-heading">
          <div><span className="eyebrow muted">PILIHAN UNTUK ANDA</span><h2>Katalog digital <span className="active-filter-badge">{activeFilterLabel}</span></h2></div>
          <span className="section-count">{loading ? '—' : String(filtered.length).padStart(2, '0') + ' PRODUK'}</span>
        </div>
        <div className="catalog-toolbar marketplace-toolbar">
          <label><span>Tipe produk</span><select value={tier} onChange={(e)=>setTier(e.target.value)}>
            <option value="ALL">Semua tipe</option>{availableTiers.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select></label>
          {attributeFacets.map((facet) => <label key={facet.key}><span>{facet.key}</span><select value={attributeFilters[facet.key] || ''} onChange={(e)=>setAttributeFilters((current)=>({...current,[facet.key]:e.target.value}))}><option value="">Semua {facet.key.toLowerCase()}</option>{facet.values.map((value)=><option value={value} key={value}>{value}</option>)}</select></label>)}
          <label><span>Urutkan</span><select value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
            <option value="NAME">Nama produk</option><option value="PRICE_ASC">Harga terendah</option><option value="PRICE_DESC">Harga tertinggi</option>
          </select></label>
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
          <button className="reset-filters" type="button" onClick={() => { setQuery(''); setCategory('ALL'); setTier('ALL'); setMarketplaceCategoryId('ALL'); setAttributeFilters({}); }}>Reset filter</button>
        </div> : <div className="product-grid">
          {filtered.map((product) => {
            const game = product.game_category || 'OTHER';
            const isDraftTest = isTestMode && product.is_test === true && product.status !== 'ACTIVE';
            const stockText = formatStock(product);
            return <article className="product-card" key={product.id}>
              <div className="product-card-head">
                <div className={'product-art art-' + game.toLowerCase()}>
                  <img src={product.image_url || GAME_ART[game] || GAME_ART.OTHER} alt="" loading="lazy" />
                </div>
                <div className="product-card-meta">
                  <span className={'tier-label ' + String(product.tier || '').toLowerCase()}>{product.tier === 'SERVICE' ? 'Katalog' : (TIER_LABELS[product.tier] || product.tier) + ' Tier'}</span>
                  <span className="product-sku">{product.sku}</span>
                  <span className="stock-label"><span className="stock-dot" />{product.catalog_status_label || stockText}</span>
                </div>
                {product.is_test && <span className="product-test-badge">CONTOH UJI</span>}
              </div>
              <div className="product-content">
                <div className="product-category">{product.marketplace_category_name || GAME_LABELS[game] || game.replaceAll('_', ' ')}</div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-bottom">
                  <div className="product-price"><small>{formatIdrRange(product.attributes) ? 'RENTANG HARGA' : 'HARGA'}</small><strong>{formatIdrRange(product.attributes) || (Number(product.sale_price_xtr).toLocaleString('en-US') + ' XTR')}</strong></div>
                  <button className="buy-button" type="button" disabled={buyingId === product.id || activatingId === product.id || (!product.is_purchaseable && !isDraftTest)}
                    onClick={() => { if (isDraftTest) activateTestProduct(product.id); else { setDetailQuantity(1); setSelectedProduct(product); } }}>
                    {activatingId === product.id ? 'Mengaktifkan…' : isDraftTest ? 'Aktifkan' : product.is_purchaseable ? 'Detail & Beli' : 'Lihat Detail'}
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
      <footer className="footer"><a className="brand" href="/" onClick={() => { setActiveTab('home'); setOrdersOpen(false); setProfileOpen(false); }}><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a><small>© {new Date().getFullYear()} VAULT CORE. Katalog produk digital dan layanan gaming.</small></footer>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        <button type="button" className="nav-item" onClick={() => window.location.assign('/')}><AppIcon name="home" /><span>Dashboard</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'categories' ? 'active' : '')} aria-current={activeTab === 'categories' ? 'page' : undefined} onClick={() => navigate('categories')}><AppIcon name="categories" /><span>Katalog</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'orders' ? 'active' : '')} aria-current={activeTab === 'orders' ? 'page' : undefined} onClick={() => navigate('orders')}><AppIcon name="orders" /><span>Pesanan</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'profile' ? 'active' : '')} aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><AppIcon name="profile" /><span>Profil</span></button>
      </nav>

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup">×</button></div>}

{selectedProduct && <div className="modal-backdrop marketplace-detail-backdrop" onClick={() => setSelectedProduct(null)}>
        <section className="product-detail-modal marketplace-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" onClick={(e) => e.stopPropagation()}>
          <div className="marketplace-sheet-grip" />
          <div className="modal-head marketplace-detail-head"><div><span className="eyebrow muted">DETAIL PRODUK · {GAME_LABELS[selectedProduct.game_category]||selectedProduct.game_category}</span><h2 id="product-detail-title">{selectedProduct.name}</h2></div><button className="icon-button" type="button" onClick={() => setSelectedProduct(null)} aria-label="Tutup detail produk">×</button></div>
          <div className="marketplace-detail-gallery">
            {(Array.isArray(selectedProduct.image_gallery)&&selectedProduct.image_gallery.length?selectedProduct.image_gallery:[selectedProduct.image_url||GAME_ART[selectedProduct.game_category]||GAME_ART.OTHER]).map((src,index)=><img key={src+index} src={src} alt={selectedProduct.name+' '+(index+1)} loading={index?'lazy':'eager'} />)}
          </div>
          <div className="marketplace-detail-body">
            <div className="marketplace-detail-title-row"><div><span className="detail-category">{selectedProduct.marketplace_category_name || GAME_LABELS[selectedProduct.game_category] || selectedProduct.game_category} · {TIER_LABELS[selectedProduct.tier] || selectedProduct.tier}</span><h3>{selectedProduct.name}</h3></div><strong className="marketplace-detail-price">{formatIdrRange(selectedProduct.attributes) || (Number(selectedProduct.sale_price_xtr || 0).toLocaleString('en-US') + ' XTR')}</strong></div>
            <div className="marketplace-store-trust"><div><strong>VAULT CORE Store</strong><small>Produk dikelola oleh Owner VAULT CORE</small></div></div>
            <div className="marketplace-detail-stats">
              <div><span>Stok</span><strong>{formatStock(selectedProduct)}</strong></div>
              <div><span>Minimum beli</span><strong>1 unit</strong></div>
              <div><span>Pemenuhan</span><strong>{FULFILLMENT_LABELS[selectedProduct.fulfillment_type] || selectedProduct.fulfillment_type || 'Belum ditentukan'}</strong></div>
              <div><span>Estimasi</span><strong>{selectedProduct.fulfillment_eta || 'Belum ditetapkan Owner'}</strong></div>
            </div>
            {selectedProduct.attributes && typeof selectedProduct.attributes === 'object' && !Array.isArray(selectedProduct.attributes) && Object.keys(selectedProduct.attributes).length > 0 && <section className="marketplace-detail-section"><h3>Spesifikasi Produk</h3><dl className="marketplace-attributes">{Object.entries(selectedProduct.attributes).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></section>}
            <section className="marketplace-detail-section"><h3>Deskripsi Produk</h3><p>{selectedProduct.description || 'Deskripsi produk belum tersedia.'}</p></section>
            <section className="marketplace-detail-section"><h3>Ketentuan Produk</h3><p>{selectedProduct.customer_terms || 'Ketentuan khusus produk belum ditetapkan oleh Owner.'}</p></section>
            <section className="marketplace-detail-section marketplace-guide-link"><button className="guide-open-button" type="button" onClick={()=>{setGuideCategory({name:selectedProduct.marketplace_category_name||'Panduan pembelian',purchase_guide:selectedProduct.purchase_guide||[]});setSelectedProduct(null);setGuideOpen(true);}}>Cara Beli &amp; Tips <span>›</span></button></section>
            <div className="marketplace-detail-policy"><strong>{selectedProduct.is_purchaseable ? 'Perlindungan transaksi' : 'Status katalog'}</strong><p>{selectedProduct.is_purchaseable ? 'Pembayaran menggunakan invoice Telegram Stars (XTR). Harga dan stok diperiksa ulang oleh server saat checkout. Pemenuhan dimulai setelah Telegram mengonfirmasi pembayaran.' : 'Produk sudah tercatat di katalog VAULT CORE. Penawaran komersial menunggu pemeriksaan Owner, penetapan harga transaksi XTR, dan ketersediaan inventaris. Produk ini belum dapat dibeli.'}</p></div>
            {selectedProduct.is_purchaseable || selectedProduct.is_test ? <div className="detail-buy-row marketplace-quantity-row">
              <label>Jumlah pembelian<div className="marketplace-quantity-control"><button type="button" disabled={detailQuantity<=1} onClick={()=>setDetailQuantity(Math.max(1,detailQuantity-1))}>−</button><strong>{detailQuantity}</strong><button type="button" disabled={detailQuantity>=5} onClick={()=>setDetailQuantity(Math.min(5,detailQuantity+1))}>+</button></div></label>
              <div><small>Subtotal indikatif</small><strong>{(Number(selectedProduct.sale_price_xtr||0)*detailQuantity).toLocaleString('en-US')} XTR</strong></div>
            </div> : null}
            <div className="marketplace-detail-actions">
              <button className="detail-secondary-button" type="button" disabled={!selectedProduct.is_available||selectedProduct.is_test||!selectedProduct.is_purchaseable} onClick={()=>addToCart(selectedProduct,detailQuantity)}>+ Keranjang</button>
              <button className="buy-button" type="button" disabled={!selectedProduct.is_available || buyingId === selectedProduct.id || selectedProduct.is_test || !selectedProduct.is_purchaseable} onClick={() => { const product = selectedProduct; const quantity=detailQuantity; setSelectedProduct(null); buy(product,quantity); }}>
                {buyingId === selectedProduct.id ? 'Menyiapkan…' : selectedProduct.is_purchaseable ? 'Beli sekarang' : 'Belum tersedia'}
              </button>
            </div>
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

      {cartOpen && <div className="modal-backdrop" onClick={()=>setCartOpen(false)}>
        <section className="cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={(e)=>e.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow muted">RINGKASAN PESANAN</span><h2 id="cart-title">Keranjang ({cartCount})</h2></div><button className="icon-button" type="button" onClick={()=>setCartOpen(false)} aria-label="Tutup keranjang">×</button></div>
          {cartLines.length ? <div className="cart-lines">
            {cartLines.map((line)=><article className="cart-line" key={line.productId}>
              <img src={line.product.image_url||GAME_ART[line.product.game_category]||GAME_ART.OTHER} alt="" />
              <div className="cart-line-copy"><strong>{line.product.name}</strong><small>{line.product.marketplace_category_name||GAME_LABELS[line.product.game_category]||line.product.game_category} · {formatStock(line.product)}</small>
                <div className="cart-line-controls"><button type="button" onClick={()=>updateCartQuantity(line.productId,line.quantity-1)} disabled={line.quantity<=1}>−</button><span>{line.quantity}</span><button type="button" onClick={()=>updateCartQuantity(line.productId,line.quantity+1)} disabled={line.quantity>=5}>+</button><button className="cart-remove" type="button" onClick={()=>removeCartItem(line.productId)}>Hapus</button></div>
              </div>
              <strong className="cart-line-price">{line.subtotal.toLocaleString('en-US')} XTR</strong>
            </article>)}
            <div className="cart-total"><span>Subtotal berdasarkan katalog</span><strong>{cartSubtotal.toLocaleString('en-US')} XTR</strong></div>
            <p className="cart-disclaimer">Total akhir, harga, dan ketersediaan stok dihitung ulang oleh backend saat pesanan dibuat.</p>
            <button className="cart-checkout-button" type="button" onClick={checkoutCart} disabled={buyingId==='cart'}>{buyingId==='cart'?'Memeriksa stok…':'Lanjut ke pembayaran · '+cartSubtotal.toLocaleString('en-US')+' XTR'}</button>
          </div> : <div className="empty-state"><strong>Keranjang masih kosong</strong><p>Pilih produk dari katalog untuk memulai pesanan.</p><button className="reset-filters" type="button" onClick={()=>setCartOpen(false)}>Lanjut jelajahi katalog</button></div>}
        </section>
      </div>}

      {guideOpen && <div className="modal-backdrop" onClick={()=>setGuideOpen(false)}>
        <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(e)=>e.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow muted">INFORMASI PEMBELIAN</span><h2 id="guide-title">Panduan Beli &amp; Tips</h2><small>{guideCategory?.name||'VAULT CORE'}</small></div><button className="icon-button" type="button" onClick={()=>setGuideOpen(false)} aria-label="Tutup panduan">×</button></div>
          {guideCategory?.purchase_guide?.length ? <ol className="guide-steps">{guideCategory.purchase_guide.map((step,index)=><li key={index}><span>{index+1}</span><div><strong>{step.title}</strong><p>{step.content}</p></div></li>)}</ol> : <div className="empty-state"><strong>Panduan kategori belum tersedia</strong><p>Owner belum menambahkan langkah pembelian untuk kategori ini.</p></div>}
          <div className="guide-security"><strong>Keamanan akun</strong><p>Jangan pernah membagikan kata sandi, OTP, kode pemulihan, atau kode login kepada siapa pun. Periksa kembali rincian produk dan jumlah sebelum membayar.</p></div>
          <button className="cart-checkout-button" type="button" onClick={()=>setGuideOpen(false)}>Tutup panduan</button>
        </section>
      </div>}
    </main>
  </>;
}
