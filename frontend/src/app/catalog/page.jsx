'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData, getTelegramWebApp, openInvoice } from '../../lib/telegram';
import { getCustomerVisibleProductAttributes } from '../../lib/product-attributes';
import { GAME_ORDER, GAME_LABELS, GAME_ART, GAME_BACKGROUNDS } from '../../lib/marketplace.js';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const TRUST_ITEMS = [
  { icon: '/assets/06-icons/icon-wallet.svg', title: 'Transaksi via Telegram Mini App', detail: 'Checkout dan invoice resmi Telegram Stars · XTR' },
  { icon: '/assets/06-icons/icon-shield.svg', title: 'Payload terenkripsi', detail: 'Inventaris digital disimpan terenkripsi' },
  { icon: '/assets/06-icons/icon-orders.svg', title: 'Status pesanan', detail: 'Riwayat dan status dapat dipantau' }
];

const FULFILLMENT_LABELS = Object.freeze({ GAME_ACCOUNT_TRANSFER: 'Transfer akun' });
const ACCOUNT_FILTERS = Object.freeze([
  { id:'win_rate', label:'Win Rate', aliases:['win rate','win_rate','winrate'] },
  { id:'total_skins', label:'Jumlah Skin', aliases:['jumlah skin','total_skins','skins'] },
  { id:'total_heroes', label:'Jumlah Hero', aliases:['jumlah hero','total_heroes','heroes'] },
  { id:'rank_current', label:'Rank Saat Ini', aliases:['rank saat ini','rank_current','rank'] },
  { id:'linked_account', label:'Akun Terhubung Pada', aliases:['akun terhubung pada','linked_account','linked_accounts','linked_platforms','linked_platform','linked platform','platform akun'] }
]);
const MLBB_RANKS = Object.freeze([
  'Warrior 1','Warrior 2','Warrior 3','Elite 1','Elite 2','Elite 3',
  'Master 1','Master 2','Master 3','Master 4',
  'Grandmaster 1','Grandmaster 2','Grandmaster 3','Grandmaster 4','Grandmaster 5',
  'Epic 1','Epic 2','Epic 3','Epic 4','Epic 5',
  'Legend 1','Legend 2','Legend 3','Legend 4','Legend 5',
  'Mythic','Mythical Honor','Mythical Glory','Mythical Immortal'
]);
const MLBB_LINKED_PROVIDERS = Object.freeze([
  'Moonton','Google','Apple','Facebook','Twitter','VK','TikTok','Telegram','WhatsApp'
]);
const MLBB_FILTER_GROUPS = Object.freeze([
  {id:'win_rate',label:'Winrate',kind:'range',suffix:'%'},
  {id:'total_skins',label:'Jumlah Skin',kind:'range'},
  {id:'total_heroes',label:'Jumlah Hero',kind:'range'},
  {id:'rank_current',label:'Rank Saat Ini',kind:'single'},
  {id:'linked_account',label:'Akun Terhubung Pada',kind:'multiple'}
]);
const EMPTY_MLBB_FILTERS = Object.freeze({
  win_rate_min:'',win_rate_max:'',
  total_skins_min:'',total_skins_max:'',
  total_heroes_min:'',total_heroes_max:'',
  rank_current:'',linked_account:[]
});
function readAccountAttribute(product, filter) {
  const attrs = getCustomerVisibleProductAttributes(product?.attributes);
  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const accepted = new Set(filter.aliases.map(normalize));
  const entries = attrs.filter(([key]) => accepted.has(normalize(key)));
  if (filter.id === 'linked_account') {
    const seen = new Set();
    const values = [];
    for (const [, rawValue] of entries) {
      for (const value of String(rawValue ?? '').split(/[;,|]/).map((item) => item.trim()).filter(Boolean)) {
        const key = normalize(value);
        if (key && !seen.has(key)) {
          seen.add(key);
          values.push(value);
        }
      }
    }
    return values.join(', ');
  }
  return entries.length ? String(entries[0][1] ?? '').trim() : '';
}
function accountSpecEntries(product) {
  return ACCOUNT_FILTERS.map((filter) => [filter.label, readAccountAttribute(product, filter)]).filter(([,value]) => value);
}
function numericAttribute(value) {
  const raw=String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(/,/g,'').replace(/[^0-9.+-]/g,''));
  return Number.isFinite(parsed) ? parsed : null;
}
function matchesAccountFilters(product, filters = {}) {
  for (const id of ['win_rate','total_skins','total_heroes']) {
    const minimum = String(filters[id+'_min'] ?? '').trim();
    const maximum = String(filters[id+'_max'] ?? '').trim();
    if (!minimum && !maximum) continue;
    const actual = numericAttribute(readAccountAttribute(product, ACCOUNT_FILTERS.find((item)=>item.id===id)));
    if (actual === null) return false;
    if (minimum && actual < Number(minimum)) return false;
    if (maximum && actual > Number(maximum)) return false;
  }
  const rank = String(filters.rank_current ?? '').trim();
  if (rank && readAccountAttribute(product, ACCOUNT_FILTERS.find((item)=>item.id==='rank_current')).toLowerCase() !== rank.toLowerCase()) return false;
  const selectedProviders = Array.isArray(filters.linked_account) ? filters.linked_account : [];
  if (selectedProviders.length) {
    const linked = readAccountAttribute(product, ACCOUNT_FILTERS.find((item)=>item.id==='linked_account')).toLowerCase().replace(/[^a-z0-9]/g,'');
    if (!selectedProviders.some((provider)=>linked.includes(String(provider).toLowerCase().replace(/[^a-z0-9]/g,'')))) return false;
  }
  return true;
}
function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('id-ID');
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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeFilterSection, setActiveFilterSection] = useState('win_rate');
  const [filterDraft, setFilterDraft] = useState({...EMPTY_MLBB_FILTERS,linked_account:[]});
  const [linkedProviderSearch, setLinkedProviderSearch] = useState('');
  const [rankOptionsExpanded, setRankOptionsExpanded] = useState(true);
  const [providerOptionsExpanded, setProviderOptionsExpanded] = useState(true);
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
  const gameTabs = useMemo(() => GAME_ORDER.map((id) => ({
    id,
    label: GAME_LABELS[id] || id.replaceAll('_', ' '),
    short: id === 'FREE_FIRE' ? 'FREE FIRE' : id,
    icon: GAME_ART[id] || GAME_ART.MLBB
  })), []);
  const activeFilterLabel = category !== 'ALL' ? (GAME_LABELS[category] || category) : 'Semua game';
  const selectedGame = gameTabs.find((item) => item.id === category) || null;
  const expectedCategorySlug = ({MLBB:'mlbb-akun',FREE_FIRE:'free-fire-akun',ROBLOX:'roblox-akun',GENSHIN:'genshin-akun'})[category];
  const gameMarketplaceCategories = useMemo(() => category === 'ALL' ? [] : marketplaceCategories.filter((item) => item.slug === expectedCategorySlug), [marketplaceCategories, category, expectedCategorySlug]);
  const accountFilterOptions = useMemo(() => ACCOUNT_FILTERS.map((filter) => ({
    ...filter,
    values:[...new Set(sourceProducts
      .filter((product) => (category === 'ALL' || product.game_category === category)
        && (marketplaceCategoryId === 'ALL' || String(product.marketplace_category_id || '') === marketplaceCategoryId))
      .map((product) => readAccountAttribute(product, filter)).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'id'))
  })), [sourceProducts, category, marketplaceCategoryId]);
  const activeAccountFilterCount = useMemo(() => {
    const numericKeys=['win_rate_min','win_rate_max','total_skins_min','total_skins_max','total_heroes_min','total_heroes_max'];
    return numericKeys.filter((key)=>String(attributeFilters[key]??'').trim()!=='').length
      + (attributeFilters.rank_current ? 1 : 0)
      + (Array.isArray(attributeFilters.linked_account) && attributeFilters.linked_account.length ? 1 : 0);
  }, [attributeFilters]);
  const activeAccountFilter = (id) => {
    if (id === 'rank_current') return Boolean(attributeFilters.rank_current);
    if (id === 'linked_account') return Boolean(attributeFilters.linked_account?.length);
    return Boolean(String(attributeFilters[id+'_min']??'').trim() || String(attributeFilters[id+'_max']??'').trim());
  };
  const activeRankOptions = category === 'MLBB'
    ? MLBB_RANKS
    : (accountFilterOptions.find((item)=>item.id==='rank_current')?.values || []);
  const activeProviderOptions = category === 'MLBB'
    ? MLBB_LINKED_PROVIDERS
    : (accountFilterOptions.find((item)=>item.id==='linked_account')?.values || []);
  const filtered = useMemo(() => {
    const list = sourceProducts.filter((p) =>
      ['MLBB','FREE_FIRE','ROBLOX','GENSHIN'].includes(p.game_category)
      && p.fulfillment_type === 'GAME_ACCOUNT_TRANSFER'
      && (category === 'ALL' || p.game_category === category)
      && (marketplaceCategoryId === 'ALL' || String(p.marketplace_category_id || '') === marketplaceCategoryId)
      && (category !== 'ALL' ? matchesAccountFilters(p, attributeFilters) : true)
      && (String(p.name || '') + ' ' + String(p.sku || '') + ' ' + String(p.description || '') + ' ' + String(p.marketplace_category_name || '') + ' ' + accountSpecEntries(p).map(([,value])=>value).join(' ')).toLowerCase().includes(query.toLowerCase())
    );
    if (sortBy === 'PRICE_ASC') return list.sort((a,b)=>Number(a.sale_price_xtr)-Number(b.sale_price_xtr));
    if (sortBy === 'PRICE_DESC') return list.sort((a,b)=>Number(b.sale_price_xtr)-Number(a.sale_price_xtr));
    return list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'id'));
  }, [sourceProducts, category, marketplaceCategoryId, attributeFilters, query, sortBy, isTestMode]);

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
    if (!initData) { setNotice('Transaksi hanya tersedia di VAULT CORE Telegram Mini App. Buka aplikasi melalui bot Telegram untuk checkout dan pembayaran XTR.'); return; }
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
      setNotice('Transaksi hanya tersedia di VAULT CORE Telegram Mini App. Buka aplikasi melalui bot Telegram untuk checkout dan pembayaran XTR.');
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
      setCategory('ALL'); setQuery('');
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

  function openMlbbFilter(id) {
    setFilterDraft({...EMPTY_MLBB_FILTERS,...attributeFilters,linked_account:Array.isArray(attributeFilters.linked_account)?[...attributeFilters.linked_account]:[]});
    setActiveFilterSection(id);
    setLinkedProviderSearch('');
    setRankOptionsExpanded(true);
    setProviderOptionsExpanded(true);
    setFilterSheetOpen(true);
  }

  function setMlbbRange(id, bound, value) {
    setFilterDraft((current)=>({...current,[id+'_'+bound]:value}));
  }

  function toggleLinkedProvider(provider) {
    setFilterDraft((current)=>{
      const selected=Array.isArray(current.linked_account)?current.linked_account:[];
      return {...current,linked_account:selected.includes(provider)?selected.filter((item)=>item!==provider):[...selected,provider]};
    });
  }

  function applyMlbbFilters() {
    for (const [id,label,maximum] of [['win_rate','Winrate',100],['total_skins','Jumlah Skin',null],['total_heroes','Jumlah Hero',null]]) {
      const minimum=String(filterDraft[id+'_min']??'').trim();
      const maximumValue=String(filterDraft[id+'_max']??'').trim();
      const isIntegerRange=id!=='win_rate';
      if (minimum && (!Number.isFinite(Number(minimum)) || Number(minimum)<0 || (isIntegerRange && !Number.isInteger(Number(minimum))) || (maximum!==null && Number(minimum)>maximum))) {
        setNotice('Nilai minimum '+label+' tidak valid.');
        return;
      }
      if (maximumValue && (!Number.isFinite(Number(maximumValue)) || Number(maximumValue)<0 || (isIntegerRange && !Number.isInteger(Number(maximumValue))) || (maximum!==null && Number(maximumValue)>maximum))) {
        setNotice('Nilai maksimum '+label+' tidak valid.');
        return;
      }
      if (minimum && maximumValue && Number(minimum)>Number(maximumValue)) {
        setNotice('Minimum '+label+' tidak boleh melebihi maksimum.');
        return;
      }
    }
    setAttributeFilters({...filterDraft,linked_account:[...(filterDraft.linked_account||[])]});
    setFilterSheetOpen(false);
  }

  function clearMlbbFilters() {
    const cleared={...EMPTY_MLBB_FILTERS,linked_account:[]};
    setFilterDraft(cleared);
    setAttributeFilters(cleared);
    setFilterSheetOpen(false);
  }

  function selectMarketplaceCategory(id) {
    setMarketplaceCategoryId(String(id));
    setAttributeFilters({});
    setFilterDraft({...EMPTY_MLBB_FILTERS,linked_account:[]});
    setFilterSheetOpen(false);
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari game, nama akun, atau SKU…" aria-label="Cari game, nama akun, atau SKU" />
          {query && <button className="clear-search" type="button" onClick={() => setQuery('')} aria-label="Hapus pencarian">×</button>}
        </label>
        {telegramContext && <><button className="top-cart-button" type="button" onClick={()=>setCartOpen(true)} aria-label={'Buka keranjang, '+cartCount+' item'}><AppIcon name="orders" /><span>Keranjang</span><b>{cartCount}</b></button>
        <button className="top-profile-button" type="button" onClick={openProfile} aria-label="Buka profil"><AppIcon name="profile" /><span>Profil</span></button></>}
      </header>

      {telegramContext === false && <aside className="browser-access-notice" role="status">
        <strong>Transaksi hanya melalui Telegram Mini App</strong>
        <span>Website ini hanya untuk melihat katalog dan detail produk. Untuk membuat pesanan, membayar dengan invoice resmi Telegram Stars (XTR), dan memantau pesanan, buka VAULT CORE melalui bot Telegram.</span>
      </aside>}

      <section className="marketplace-game-nav" id="home" style={{ "--marketplace-background": `url("${category === "ALL" ? "/assets/02-hero/hero-vaultcore-loop.webp" : (GAME_BACKGROUNDS[category] || GAME_BACKGROUNDS.MLBB)}")` }}>
        <div className="marketplace-game-heading">
          <span className="eyebrow muted">VAULT CORE · DIGITAL GAME STORE</span>
          <h1>{selectedGame?.label || 'Semua game'}</h1>
          <p>Jelajahi produk di katalog. Seluruh checkout, pembayaran XTR, dan pemantauan pesanan dilakukan hanya melalui VAULT CORE Telegram Mini App.</p>
        </div>
        <nav className="marketplace-game-tabs" aria-label="Pilih game">
          <button type="button" className={category === 'ALL' ? 'active' : ''} aria-pressed={category === 'ALL'} onClick={() => { setCategory('ALL'); setMarketplaceCategoryId('ALL'); setAttributeFilters({}); setQuery(''); }}>Semua game</button>
          {gameTabs.map((game) => <button key={game.id} type="button" className={category === game.id ? 'active' : ''} aria-pressed={category === game.id} onClick={() => {
            const slug = ({MLBB:'mlbb-akun',FREE_FIRE:'free-fire-akun',ROBLOX:'roblox-akun',GENSHIN:'genshin-akun'})[game.id];
            const accountCategory = marketplaceCategories.find((item) => item.slug === slug);
            setCategory(game.id); setMarketplaceCategoryId(accountCategory ? String(accountCategory.id) : 'ALL'); setAttributeFilters({}); setQuery('');
          }}>
            <img className="game-tab-icon" src={game.icon} alt="" loading="lazy" />{game.short}
          </button>)}
        </nav>
        {category !== 'ALL' && <nav className="marketplace-category-nav" id="categories" aria-label="Subkategori produk">
          {gameMarketplaceCategories.map((item) => <button key={item.id} type="button" className="active" aria-current="true" onClick={() => selectMarketplaceCategory(String(item.id))}><span>{item.icon || '◇'}</span>Akun</button>)}
          {!gameMarketplaceCategories.length && !loading && <span className="marketplace-no-categories">Subkategori Akun belum tersedia.</span>}
        </nav>}
      </section>

      <section className="section product-section" id="products">
        <div className="section-heading">
          <div><span className="eyebrow muted">PILIHAN UNTUK ANDA</span><h2>Katalog digital <span className="active-filter-badge">{activeFilterLabel}</span></h2></div>
          <span className="section-count">{loading ? '—' : String(filtered.length).padStart(2, '0') + ' PRODUK'}</span>
        </div>
        <div className="catalog-controls catalog-controls-v2" data-catalog-mode={category === 'ALL' ? 'all-games' : 'single-game'}>
          {category !== 'ALL' && <>
            <button type="button" className="mlbb-filter-main" onClick={()=>openMlbbFilter('win_rate')} aria-label={'Buka filter akun '+(selectedGame?.label || '')}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16l-6.2 7v5.1l-3.6 1.9V12z"/></svg>
              {activeAccountFilterCount>0&&<b>{activeAccountFilterCount}</b>}
            </button>
            <div className="mlbb-filter-strip" role="group" aria-label="Filter spesifikasi akun">
              {MLBB_FILTER_GROUPS.map((filter) => <button
                key={filter.id}
                type="button"
                className={'mlbb-filter-chip' + (activeAccountFilter(filter.id) ? ' is-active' : '')}
                aria-pressed={activeAccountFilter(filter.id)}
                onClick={() => openMlbbFilter(filter.id)}
              >
                <span>{filter.label}</span><span className="mlbb-filter-chip-chevron" aria-hidden="true">⌄</span>
              </button>)}
            </div>
          </>}
          <label className="mlbb-sort-control"><span>Urutkan</span><select value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
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
          <p>Coba kata kunci lain atau sesuaikan filter spesifikasi akun.</p>
          <button className="reset-filters" type="button" onClick={() => { setQuery(''); setCategory('ALL');  setMarketplaceCategoryId('ALL'); setAttributeFilters({}); }}>Reset filter</button>
        </div> : <div className="product-grid">
          {filtered.map((product) => {
            const game = product.game_category || 'MLBB';
            const isDraftTest = isTestMode && product.is_test === true && product.status !== 'ACTIVE';
            return <article className="product-card" key={product.id}>
              <div className="product-card-head">
                <div className={'product-art ' + (product.image_url ? 'product-art-photo' : 'product-art-brand') + ' art-' + game.toLowerCase()} style={{ "--game-background": `url("${GAME_BACKGROUNDS[game] || GAME_BACKGROUNDS.MLBB}")` }}>
                  <img className={product.image_url ? "product-photo-image" : "game-category-logo"} src={product.image_url || GAME_ART[game] || GAME_ART.MLBB} alt={product.image_url ? product.name : (GAME_LABELS[game] || "Game") + " logo"} loading="lazy" />
                </div>
                <div className="product-card-meta">
                  <span className="account-product-badge">Akun Game</span>
                  <span className={'stock-label ' + (product.is_available && (product.is_test || product.is_purchaseable) ? 'in-stock' : 'out-of-stock')}>{product.is_available && (product.is_test || product.is_purchaseable) ? 'Stok tersedia' : 'Stok habis'}</span>
                </div>
                {product.is_test && <span className="product-test-badge">CONTOH UJI</span>}
              </div>
              <div className="product-content">
                <div className="product-category">{GAME_LABELS[game] || game.replaceAll('_', ' ')} · Akun</div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-bottom">
                  <div className="product-price"><small>HARGA JUAL</small><strong>{Number(product.sale_price_xtr).toLocaleString('en-US')} XTR</strong></div>
                  <button className="buy-button" type="button" disabled={buyingId === product.id || activatingId === product.id}
                    onClick={() => { if (isDraftTest) activateTestProduct(product.id); else { setDetailQuantity(1); setSelectedProduct(product); } }}>
                    {activatingId === product.id ? 'Mengaktifkan…' : isDraftTest ? 'Aktifkan' : product.is_available && product.is_purchaseable ? 'Detail & Beli' : 'Lihat detail'}
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
      <footer className="footer"><a className="brand" href="/" aria-label="VAULT CORE" onClick={() => { setActiveTab('home'); setOrdersOpen(false); setProfileOpen(false); }}><img className="brand-logo footer-brand-logo" src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE" /></a><small>© {new Date().getFullYear()} VAULT CORE. Marketplace akun game.</small></footer>

      {telegramContext && <nav className="bottom-nav" aria-label="Navigasi utama">
        <button type="button" className="nav-item" onClick={() => window.location.assign('/')}><AppIcon name="home" /><span>Dashboard</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'categories' ? 'active' : '')} aria-current={activeTab === 'categories' ? 'page' : undefined} onClick={() => navigate('categories')}><AppIcon name="categories" /><span>Katalog</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'orders' ? 'active' : '')} aria-current={activeTab === 'orders' ? 'page' : undefined} onClick={() => navigate('orders')}><AppIcon name="orders" /><span>Pesanan</span></button>
        <button type="button" className={'nav-item ' + (activeTab === 'profile' ? 'active' : '')} aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><AppIcon name="profile" /><span>Profil</span></button>
      </nav>}

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup">×</button></div>}

      {filterSheetOpen && category !== 'ALL' && <div className="modal-backdrop mlbb-filter-backdrop" onClick={()=>setFilterSheetOpen(false)}>
        <section className="mlbb-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="mlbb-filter-title" onClick={(e)=>e.stopPropagation()}>
          <div className="mlbb-filter-grip" />
          <header className="mlbb-filter-header"><h2 id="mlbb-filter-title">Filter</h2><button type="button" onClick={()=>setFilterSheetOpen(false)} aria-label="Tutup filter">×</button></header>
          <div className="mlbb-filter-content">
            {activeFilterSection === 'win_rate' && <section className="mlbb-filter-section">
              <h3>Winrate</h3>
              <div className="mlbb-range-grid">
                <label><span>Minimum</span><div><input type="number" min="0" max="100" step="0.1" inputMode="decimal" placeholder="0" value={filterDraft.win_rate_min||''} onChange={(e)=>setMlbbRange('win_rate','min',e.target.value)} /><b>%</b></div></label>
                <label><span>Maksimum</span><div><input type="number" min="0" max="100" step="0.1" inputMode="decimal" placeholder="0" value={filterDraft.win_rate_max||''} onChange={(e)=>setMlbbRange('win_rate','max',e.target.value)} /><b>%</b></div></label>
              </div>
            </section>}
            {activeFilterSection === 'total_skins' && <section className="mlbb-filter-section">
              <h3>Jumlah Skin</h3>
              <div className="mlbb-range-grid">
                <label><span>Minimum</span><input type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={filterDraft.total_skins_min||''} onChange={(e)=>setMlbbRange('total_skins','min',e.target.value)} /></label>
                <label><span>Maksimum</span><input type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={filterDraft.total_skins_max||''} onChange={(e)=>setMlbbRange('total_skins','max',e.target.value)} /></label>
              </div>
            </section>}
            {activeFilterSection === 'total_heroes' && <section className="mlbb-filter-section">
              <h3>Jumlah Hero</h3>
              <div className="mlbb-range-grid">
                <label><span>Minimum</span><input type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={filterDraft.total_heroes_min||''} onChange={(e)=>setMlbbRange('total_heroes','min',e.target.value)} /></label>
                <label><span>Maksimum</span><input type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={filterDraft.total_heroes_max||''} onChange={(e)=>setMlbbRange('total_heroes','max',e.target.value)} /></label>
              </div>
            </section>}
            {activeFilterSection === 'rank_current' && <section className="mlbb-filter-section">
              <h3>Rank Saat Ini</h3>
              <div className="mlbb-choice-grid">{activeRankOptions.length ? activeRankOptions.slice(0,rankOptionsExpanded ? Number.MAX_SAFE_INTEGER : 10).map((rank)=><label key={rank} className="mlbb-choice-row">
                <input type="radio" name="account-rank-current" value={rank} checked={filterDraft.rank_current===rank} onChange={()=>setFilterDraft((current)=>({...current,rank_current:rank}))} />
                <span>{rank}</span>
              </label>) : <p className="mlbb-filter-empty">Pilihan rank belum tersedia untuk game ini.</p>}</div>
              {activeRankOptions.length > 10 && <button type="button" className="mlbb-choice-toggle" aria-expanded={rankOptionsExpanded} onClick={()=>setRankOptionsExpanded((current)=>!current)}>{rankOptionsExpanded ? 'Sembunyikan' : 'Tampilkan semua'}</button>}
            </section>}
            {activeFilterSection === 'linked_account' && <section className="mlbb-filter-section">
              <h3>Akun Terhubung Pada</h3>
              <label className="mlbb-provider-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Cari" value={linkedProviderSearch} onChange={(e)=>setLinkedProviderSearch(e.target.value)} /></label>
              <div className="mlbb-choice-grid">{activeProviderOptions
                .filter((provider)=>String(provider).toLowerCase().includes(linkedProviderSearch.toLowerCase()))
                .slice(0,providerOptionsExpanded ? Number.MAX_SAFE_INTEGER : 6)
                .map((provider)=><label key={provider} className="mlbb-choice-row">
                <input type="checkbox" checked={(filterDraft.linked_account||[]).includes(provider)} onChange={()=>toggleLinkedProvider(provider)} />
                <span>{provider}</span>
              </label>)}</div>
              {activeProviderOptions.length > 6 && <button type="button" className="mlbb-choice-toggle" aria-expanded={providerOptionsExpanded} onClick={()=>setProviderOptionsExpanded((current)=>!current)}>{providerOptionsExpanded ? 'Sembunyikan' : 'Tampilkan semua'}</button>}
            </section>}
          </div>
          <footer className="mlbb-filter-footer"><button type="button" onClick={clearMlbbFilters}>Hapus Filter</button><button type="button" onClick={applyMlbbFilters}>Terapkan</button></footer>
        </section>
      </div>}

{selectedProduct && <div className="modal-backdrop marketplace-detail-backdrop" onClick={() => setSelectedProduct(null)}>
        <section className="product-detail-modal marketplace-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" onClick={(e) => e.stopPropagation()}>
          <div className="marketplace-sheet-grip" />
          <div className="modal-head marketplace-detail-head"><div><span className="eyebrow muted">DETAIL PRODUK · {GAME_LABELS[selectedProduct.game_category]||selectedProduct.game_category}</span><h2 id="product-detail-title">{selectedProduct.name}</h2></div><button className="icon-button" type="button" onClick={() => setSelectedProduct(null)} aria-label="Tutup detail produk">×</button></div>
          <div className="marketplace-detail-gallery">
            {(Array.isArray(selectedProduct.image_gallery)&&selectedProduct.image_gallery.length?selectedProduct.image_gallery:[selectedProduct.image_url||GAME_ART[selectedProduct.game_category]||GAME_ART.MLBB]).map((src,index)=><img key={src+index} src={src} alt={selectedProduct.name+' '+(index+1)} loading={index?'lazy':'eager'} />)}
          </div>
          <div className="marketplace-detail-body">
            <div className="marketplace-detail-title-row"><div><span className="detail-category">{GAME_LABELS[selectedProduct.game_category] || selectedProduct.game_category} · Akun</span><h3>{selectedProduct.name}</h3></div><strong className="marketplace-detail-price">{Number(selectedProduct.sale_price_xtr || 0).toLocaleString('en-US')} XTR</strong></div>
            <div className="marketplace-detail-stats">
              <div><span>Status stok</span><strong>{selectedProduct.is_available && selectedProduct.is_purchaseable ? 'Tersedia' : 'Stok habis'}</strong></div>
              <div><span>Pemenuhan</span><strong>{FULFILLMENT_LABELS[selectedProduct.fulfillment_type] || 'Transfer akun'}</strong></div>
              <div><span>Estimasi</span><strong>{selectedProduct.fulfillment_eta || 'Belum ditetapkan Owner'}</strong></div>
            </div>
            {accountSpecEntries(selectedProduct).length > 0 && <section className="marketplace-detail-section"><h3>Spesifikasi Akun</h3><dl className="marketplace-attributes">{accountSpecEntries(selectedProduct).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></section>}
            <section className="marketplace-detail-section"><h3>Deskripsi Produk</h3><p>{selectedProduct.description || 'Deskripsi produk belum tersedia.'}</p></section>
            <section className="marketplace-detail-section"><h3>Ketentuan Produk</h3><p>{selectedProduct.customer_terms || 'Ketentuan khusus produk belum ditetapkan oleh Owner.'}</p></section>
            <section className="marketplace-detail-section marketplace-guide-link"><button className="guide-open-button" type="button" onClick={()=>{setGuideCategory({name:selectedProduct.marketplace_category_name||'Panduan pembelian',purchase_guide:selectedProduct.purchase_guide||[]});setSelectedProduct(null);setGuideOpen(true);}}>Cara Beli &amp; Tips <span>›</span></button></section>
            <div className="marketplace-detail-policy"><strong>Transaksi resmi Telegram Stars</strong><p>Produk ini dapat dipesan melalui VAULT CORE Telegram Mini App. Harga dan stok diperiksa ulang oleh server sebelum invoice resmi Telegram Stars (XTR) dibuat. Pesanan diproses setelah Telegram mengonfirmasi pembayaran.</p></div>
            {selectedProduct.is_purchaseable || selectedProduct.is_test ? <div className="detail-buy-row marketplace-quantity-row">
              <label>Jumlah pembelian<div className="marketplace-quantity-control"><button type="button" disabled={detailQuantity<=1} onClick={()=>setDetailQuantity(Math.max(1,detailQuantity-1))}>−</button><strong>{detailQuantity}</strong><button type="button" disabled={detailQuantity>=5} onClick={()=>setDetailQuantity(Math.min(5,detailQuantity+1))}>+</button></div></label>
              <div><small>Subtotal indikatif</small><strong>{(Number(selectedProduct.sale_price_xtr||0)*detailQuantity).toLocaleString('en-US')} XTR</strong></div>
            </div> : null}
            <div className="marketplace-detail-actions">
              {telegramContext && <button className="detail-secondary-button" type="button" disabled={!selectedProduct.is_available||selectedProduct.is_test||!selectedProduct.is_purchaseable} onClick={()=>addToCart(selectedProduct,detailQuantity)}>+ Keranjang</button>}
              <button className="buy-button" type="button" disabled={!selectedProduct.is_available || buyingId === selectedProduct.id || selectedProduct.is_test || !selectedProduct.is_purchaseable} onClick={() => { const product = selectedProduct; const quantity=detailQuantity; setSelectedProduct(null); buy(product,quantity); }}>
                {buyingId === selectedProduct.id ? 'Menyiapkan…' : !telegramContext ? 'Lanjutkan di Telegram' : selectedProduct.is_available ? 'Beli sekarang' : 'Stok habis'}
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
              <img className={line.product.image_url ? "cart-product-photo" : "cart-game-logo"} src={line.product.image_url||GAME_ART[line.product.game_category]||GAME_ART.MLBB} alt="" />
              <div className="cart-line-copy"><strong>{line.product.name}</strong><small>{line.product.marketplace_category_name||GAME_LABELS[line.product.game_category]||line.product.game_category}</small>
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
