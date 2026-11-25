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
function getWarrantyTerms(product) {
  const terms = String(product?.customer_terms ?? '');
  const match = /GARANSI ANTI[\s-]?HACKBACK VAULT CORE/i.exec(terms);
  return match ? terms.slice(match.index + match[0].length).trim() : '';
}
function getWarrantySections(text) {
  const source = String(text ?? '');
  if (!source) return [];
  const patterns = [
    ['Masa berlaku', /Garansi berlaku otomatis[^.]*\./i],
    ['Perlindungan', /Apabila ada indikasi[^.]*\./i],
    ['Cara melapor', /pembeli menghubungi VAULT CORE[^.]*\./i],
    ['Pemeriksaan', /VAULT CORE memeriksa[^.]*\./i],
    ['Penyelesaian', /Klaim yang terbukti valid[^.]*\./i],
    ['Waktu penanganan', /Waktu pemrosesan[^.]*\./i],
    ['Batas pengajuan', /Klaim harus diajukan[^.]*\./i]
  ];
  return patterns.map(([label, pattern]) => {
    const match = source.match(pattern);
    return match ? {label, content:match[0]} : null;
  }).filter(Boolean);
}
function detailAttributeEntries(product) {
  const hidden = new Set(['kode_produk','sales_enabled','stock_model','subkategori','public_preview']);
  return getCustomerVisibleProductAttributes(product?.attributes)
    .filter(([key]) => !hidden.has(String(key).toLowerCase()));
}
const DETAIL_ATTRIBUTE_LABELS = Object.freeze({
  win_rate:'Win Rate', total_skins:'Jumlah Skin', total_heroes:'Jumlah Hero',
  rank_current:'Rank Saat Ini', linked_account:'Akun Terhubung Pada',
  linked_platforms:'Platform Tertaut', platform_support:'Dukungan Platform',
  main_hero:'Hero Utama', email_bundle:'Paket Gmail', emblem_status:'Status Emblem',
  unbind_terms:'Ketentuan Unbind', season_note:'Catatan Season',
  metode_penyerahan:'Metode Penyerahan'
});
function detailAttributeLabel(key) {
  return DETAIL_ATTRIBUTE_LABELS[String(key)] ||
    String(key).replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
}
function getProductStockLabel(product) {
  if (!product?.is_available || !product?.is_purchaseable) return 'STOK HABIS';
  const visibleStock = product.display_stock;
  if (typeof visibleStock === 'number' && visibleStock === 1) return 'STOK TERAKHIR';
  if (typeof visibleStock === 'number' && visibleStock > 1) return 'STOK ' + visibleStock.toLocaleString('id-ID') + ' TERSEDIA';
  return 'STOK TERSEDIA';
}
function getNonWarrantyTerms(value) {
  return String(value ?? '').replace(/GARANSI ANTI[\s-]?HACKBACK VAULT CORE[\s\S]*$/i,'').trim();
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

export default function HomePage({ initialCategory = 'ALL', initialCategorySlug = null } = {}) {
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
  const [catalogSearchOpen, setCatalogSearchOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideCategory, setGuideCategory] = useState(null);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [detailSpecsExpanded, setDetailSpecsExpanded] = useState(false);
  const [testProducts, setTestProducts] = useState([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [category, setCategory] = useState(initialCategory);
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

  useEffect(() => {
    if (!selectedProduct && !guideOpen && !warrantyOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [selectedProduct, guideOpen, warrantyOpen]);

  useEffect(() => {
    if (!selectedProduct && !guideOpen && !warrantyOpen) return;
    function handleDetailEscape(event) {
      if (event.key !== 'Escape') return;
      if (warrantyOpen) setWarrantyOpen(false);
      else if (guideOpen) setGuideOpen(false);
      else setSelectedProduct(null);
    }
    window.addEventListener('keydown', handleDetailEscape);
    return () => window.removeEventListener('keydown', handleDetailEscape);
  }, [selectedProduct, guideOpen, warrantyOpen]);

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
    if (!initialCategorySlug) return;
    const pinnedCategory = marketplaceCategories.find((item) => item.slug === initialCategorySlug);
    if (pinnedCategory) setMarketplaceCategoryId(String(pinnedCategory.id));
  }, [initialCategorySlug, marketplaceCategories]);

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
      && (String(p.name || '') + ' ' + String(p.description || '') + ' ' + String(p.marketplace_category_name || '') + ' ' + accountSpecEntries(p).map(([,value])=>value).join(' ')).toLowerCase().includes(query.toLowerCase())
    );
    return list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'id'));
  }, [sourceProducts, category, marketplaceCategoryId, attributeFilters, query, isTestMode]);

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
  const isPinnedCatalogRoute = Boolean(initialCategorySlug);

  const detailWarrantyText = selectedProduct ? getWarrantyTerms(selectedProduct) : '';
  const detailWarrantySections = getWarrantySections(detailWarrantyText);
  const detailWarrantyDuration = detailWarrantyText.match(/(\d+)\s+hari kalender/i)?.[1] || '';
  const detailReviewActive = selectedProduct?.rights_review_active === true;
  const detailGallery = selectedProduct
    ? (Array.isArray(selectedProduct.image_gallery) && selectedProduct.image_gallery.length
      ? selectedProduct.image_gallery
      : [selectedProduct.image_url || GAME_ART[selectedProduct.game_category] || GAME_ART.MLBB])
    : [];
  const detailSpecs = selectedProduct ? detailAttributeEntries(selectedProduct) : [];

  return <>
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Dashboard VAULT CORE" onClick={() => { setActiveTab('home'); setOrdersOpen(false); setProfileOpen(false); }}>
          <img className="brand-logo" src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE" />
        </a>
        <label className="top-searchbox" aria-label="Cari katalog">
          <AppIcon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari game atau nama akun…" aria-label="Cari game atau nama akun" />
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
        {isPinnedCatalogRoute && !isTestMode ? <nav className="marketplace-game-tabs marketplace-game-tabs-locked" aria-label="Kategori terkunci">
          <button type="button" className="active" aria-current="page" disabled><img className="game-tab-icon" src={GAME_ART.MLBB} alt="" loading="lazy" />MOBILE LEGENDS</button>
        </nav> : <nav className="marketplace-game-tabs" aria-label="Pilih game">
          <button type="button" className={category === 'ALL' ? 'active' : ''} aria-pressed={category === 'ALL'} onClick={() => { setCategory('ALL'); setMarketplaceCategoryId('ALL'); setAttributeFilters({}); setQuery(''); }}>Semua game</button>
          {gameTabs.map((game) => <button key={game.id} type="button" className={category === game.id ? 'active' : ''} aria-pressed={category === game.id} onClick={() => {
            const slug = ({MLBB:'mlbb-akun',FREE_FIRE:'free-fire-akun',ROBLOX:'roblox-akun',GENSHIN:'genshin-akun'})[game.id];
            const accountCategory = marketplaceCategories.find((item) => item.slug === slug);
            setCategory(game.id); setMarketplaceCategoryId(accountCategory ? String(accountCategory.id) : 'ALL'); setAttributeFilters({}); setQuery('');
          }}>
            <img className="game-tab-icon" src={game.icon} alt="" loading="lazy" />{game.short}
          </button>)}
        </nav>}
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
          {category !== 'ALL' && <div className="mlbb-filter-strip" role="group" aria-label="Filter spesifikasi akun">
            {MLBB_FILTER_GROUPS.map((filter) => <button
              key={filter.id}
              type="button"
              className={'mlbb-filter-chip' + (activeAccountFilter(filter.id) ? ' is-active' : '')}
              aria-pressed={activeAccountFilter(filter.id)}
              onClick={() => openMlbbFilter(filter.id)}
            >
              <span>{filter.label}</span><span className="mlbb-filter-chip-chevron" aria-hidden="true">⌄</span>
            </button>)}
          </div>}
          <button type="button" className="catalog-search-trigger" onClick={()=>setCatalogSearchOpen(true)} aria-label="Cari produk" title="Cari produk">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
          </button>
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
          <button className="reset-filters" type="button" onClick={() => { setQuery(''); setAttributeFilters({}); setFilterDraft({...EMPTY_MLBB_FILTERS,linked_account:[]}); if (isPinnedCatalogRoute && !isTestMode) { const pinned = marketplaceCategories.find((item) => item.slug === initialCategorySlug); setCategory(initialCategory); setMarketplaceCategoryId(pinned ? String(pinned.id) : 'ALL'); } else { setCategory('ALL'); setMarketplaceCategoryId('ALL'); } }}>Reset filter</button>
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
                    onClick={() => { if (isDraftTest) activateTestProduct(product.id); else { setActiveGalleryIndex(0); setDetailSpecsExpanded(false); setSelectedProduct(product); } }}>
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


      {catalogSearchOpen && <div className="catalog-search-backdrop" onClick={()=>setCatalogSearchOpen(false)}>
        <section className="catalog-search-panel" role="dialog" aria-modal="true" aria-labelledby="catalog-search-title" onClick={(e)=>e.stopPropagation()}>
          <div className="catalog-search-topline">
            <label className="catalog-search-input-wrap" htmlFor="catalog-search-input">
              <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
              <input id="catalog-search-input" autoFocus type="search" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari" aria-label="Cari produk katalog" />
              {query && <button type="button" className="catalog-search-clear" onClick={()=>setQuery('')} aria-label="Hapus pencarian">×</button>}
            </label>
            <button type="button" className="catalog-search-cancel" onClick={()=>setCatalogSearchOpen(false)}>Batal</button>
          </div>
          <div className="catalog-search-results">
            <p className="catalog-search-count" id="catalog-search-title">Hasil pencarian ditemukan: <strong>{filtered.length.toLocaleString('id-ID')} produk</strong></p>
            {filtered.length ? <div className="catalog-search-grid">
              {filtered.map((product) => <button type="button" className="catalog-search-result" key={product.id} onClick={()=>{setActiveGalleryIndex(0);setDetailSpecsExpanded(false);setSelectedProduct(product);setCatalogSearchOpen(false);}}>
                <img src={product.image_url || GAME_ART[product.game_category] || GAME_ART.MLBB} alt="" loading="lazy" />
                <span className="catalog-search-result-copy">
                  <small>{GAME_LABELS[product.game_category] || product.game_category} · Akun</small>
                  <strong>{product.name}</strong>
                  <b>{Number(product.sale_price_xtr || 0).toLocaleString('en-US')} XTR</b>
                </span>
              </button>)}
            </div> : <div className="catalog-search-empty">Produk tidak ditemukan. Coba kata kunci lain.</div>}
          </div>
        </section>
      </div>}

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

{selectedProduct && <div className="modal-backdrop marketplace-detail-backdrop" onClick={() => { setSelectedProduct(null); setWarrantyOpen(false); }}>
        <section className="product-detail-modal marketplace-detail-modal marketplace-detail-page" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" onClick={(e) => e.stopPropagation()}>
          <header className="marketplace-detail-header">
            <div className="marketplace-detail-brandbar"><img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE" /></div>
            <div className="marketplace-detail-toolbar">
              <button className="marketplace-detail-back" type="button" onClick={() => { setSelectedProduct(null); setWarrantyOpen(false); }} aria-label="Kembali ke katalog">‹</button>
              <div className="marketplace-detail-toolbar-title"><strong>{selectedProduct.name}</strong><small>{GAME_LABELS[selectedProduct.game_category] || selectedProduct.game_category} · Akun</small></div>
            </div>
          </header>
          <div className="marketplace-detail-scroll">
            <section className="marketplace-detail-media-section" aria-label="Galeri gambar produk">
              <div className="marketplace-detail-gallery">
                <img src={detailGallery[activeGalleryIndex] || GAME_ART[selectedProduct.game_category] || GAME_ART.MLBB} alt={selectedProduct.name + ' · gambar ' + (activeGalleryIndex + 1)} />
                <span className="marketplace-gallery-count">{detailGallery.length ? (activeGalleryIndex + 1) + ' / ' + detailGallery.length : 'Gambar produk'}</span>
              </div>
              {detailGallery.length > 1 && <div className="marketplace-detail-thumbnails" role="group" aria-label="Pilih gambar produk">
                {detailGallery.map((src,index)=><button type="button" key={src + index} className={activeGalleryIndex === index ? 'active' : ''} aria-pressed={activeGalleryIndex === index} onClick={()=>setActiveGalleryIndex(index)}><img src={src} alt={'Lihat gambar ' + (index + 1)} loading="lazy" /></button>)}
              </div>}
            </section>
            <div className="marketplace-detail-body">
              <div className="marketplace-detail-heading">
                <span className="detail-category">{selectedProduct.marketplace_category_name || (GAME_LABELS[selectedProduct.game_category] || selectedProduct.game_category) + ' · Akun'}</span>
                <h1 id="product-detail-title">{selectedProduct.name}</h1>
                <div className="marketplace-detail-stock-row">
                  <span className={'marketplace-detail-stock-pill ' + (selectedProduct.is_available && selectedProduct.is_purchaseable ? 'in-stock' : 'out-of-stock')}>{getProductStockLabel(selectedProduct)}</span>
                </div>
                <div className="marketplace-detail-rating"><span className="marketplace-rating-mark">★</span><div><strong>Rating pelanggan</strong><small>Belum tersedia · Ulasan belum tersedia</small></div></div>
              </div>
              <div className="marketplace-detail-trust-grid">
                <div className="marketplace-detail-trust-item"><span className="marketplace-detail-trust-icon">♢</span><strong>Keamanan Akun</strong></div>
                <button type="button" className="marketplace-detail-trust-item marketplace-detail-trust-button" onClick={()=>setWarrantyOpen(true)} aria-label="Lihat perlindungan Anti-Hackback"><span className="marketplace-detail-trust-icon">✓</span><strong>Anti-Hackback</strong></button>
                <div className="marketplace-detail-trust-item"><span className="marketplace-detail-trust-icon">▦</span><strong>Pilihan Lengkap</strong></div>
              </div>
              <section className="marketplace-detail-price-panel" aria-label="Harga produk">
                <div className="marketplace-detail-price-icon">▤</div>
                <strong>{Number(selectedProduct.sale_price_xtr || 0).toLocaleString('en-US')} XTR</strong>
                <span>Harga final <span aria-hidden="true">ⓘ</span></span>
              </section>
              <section className="marketplace-detail-section marketplace-detail-guide-callout">
                <div><strong>Cara Beli &amp; Tips</strong><small>Panduan transaksi, penyerahan informasi, dan keamanan akun</small></div>
                <button className="guide-open-button" type="button" onClick={()=>{setGuideCategory({name:selectedProduct.marketplace_category_name || 'Panduan pembelian',purchase_guide:selectedProduct.purchase_guide || []});setGuideOpen(true);}}>Buka panduan <span>›</span></button>
              </section>
              <section className="marketplace-detail-section"><h2>Deskripsi Produk</h2><p>{selectedProduct.description || 'Deskripsi produk belum tersedia.'}</p></section>
              {getNonWarrantyTerms(selectedProduct.customer_terms) && <section className="marketplace-detail-section"><h2>Ketentuan Produk</h2><p>{getNonWarrantyTerms(selectedProduct.customer_terms)}</p></section>}
              <section className="marketplace-detail-section">
                <h2>Spesifikasi Akun</h2>
                {detailSpecs.length ? <>
                  <dl className="marketplace-attributes marketplace-attributes-v2">{(detailSpecsExpanded ? detailSpecs : detailSpecs.slice(0,6)).map(([key,value])=><div key={key}><dt>{detailAttributeLabel(key)}</dt><dd>{String(value)}</dd></div>)}</dl>
                  {detailSpecs.length > 6 && <button className="marketplace-detail-more" type="button" aria-expanded={detailSpecsExpanded} onClick={()=>setDetailSpecsExpanded((current)=>!current)}>{detailSpecsExpanded ? 'Tampilkan lebih sedikit' : 'Tampilkan lebih banyak'} <span>{detailSpecsExpanded ? '⌃' : '⌄'}</span></button>}
                </> : <p>Spesifikasi akun belum tersedia pada data produk.</p>}
              </section>
              <div className="marketplace-detail-policy"><strong>Transaksi resmi Telegram Stars</strong><p>Produk ini dapat dipesan melalui VAULT CORE Telegram Mini App. Website publik hanya menampilkan katalog dan detail produk; pembuatan pesanan, checkout, invoice, dan pembayaran dilakukan melalui Mini App. Harga dan stok diperiksa ulang oleh server.</p></div>
            </div>
          </div>
          <footer className="marketplace-detail-stickybar">
            {telegramContext && <button className="detail-secondary-button" data-visual="marketplace-detail-cart-button" type="button" aria-label="Tambahkan ke keranjang" disabled={!selectedProduct.is_available || !selectedProduct.is_purchaseable} onClick={()=>addToCart(selectedProduct,1)}>🛒</button>}
            <button className="buy-button" type="button" disabled={!selectedProduct.is_available || buyingId === selectedProduct.id || !selectedProduct.is_purchaseable} onClick={()=>{const product=selectedProduct;setSelectedProduct(null);setWarrantyOpen(false);buy(product,1);}}>{buyingId === selectedProduct.id ? 'Menyiapkan…' : !selectedProduct.is_available ? 'Stok habis' : !selectedProduct.is_purchaseable ? 'Tidak tersedia' : 'Beli · ' + Number(selectedProduct.sale_price_xtr || 0).toLocaleString('en-US') + ' XTR'}</button>
          </footer>
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

      {warrantyOpen && selectedProduct && <div className="modal-backdrop marketplace-policy-backdrop" onClick={()=>setWarrantyOpen(false)}>
        <section className="marketplace-info-modal" role="dialog" aria-modal="true" aria-labelledby="warranty-title" onClick={(event)=>event.stopPropagation()}>
          <div className="marketplace-info-header"><div><small>PERLINDUNGAN PEMBELI</small><h2 id="warranty-title">Garansi Anti-Hackback</h2><p>{selectedProduct.name}</p></div><button className="icon-button" type="button" onClick={()=>setWarrantyOpen(false)} aria-label="Tutup garansi">×</button></div>
          {detailWarrantyText ? <>
            <div className="marketplace-warranty-intro"><span>✓</span><div><strong>Ketentuan garansi tercatat</strong><small>{detailWarrantyDuration ? 'Masa berlaku ' + detailWarrantyDuration : 'Masa berlaku mengikuti ketentuan produk'} sejak konfirmasi pesanan Selesai sesuai ketentuan produk.</small></div></div>
            <div className="marketplace-info-section"><h3>Cakupan dan proses klaim</h3><div className="marketplace-policy-points">{detailWarrantySections.map((item,index)=><article key={item.label}><span>{String(index + 1).padStart(2,'0')}</span><div><strong>{item.label}</strong><p>{item.content}</p></div></article>)}</div>{!detailWarrantySections.length && <p className="marketplace-info-copy">{detailWarrantyText}</p>}</div>
            <div className="marketplace-info-section"><h3>Ketentuan lengkap produk</h3><p className="marketplace-info-copy">{detailWarrantyText}</p></div>
            <p className="marketplace-info-disclaimer">Klaim mengikuti cakupan dan masa berlaku yang tertulis pada SKU ini. Garansi ini bukan pernyataan bahwa semua risiko akun dapat dicegah. Bukti dan kronologi diperiksa oleh VAULT CORE sebelum keputusan klaim diberikan.</p>
          </> : <div className="marketplace-info-empty"><strong>Ketentuan garansi belum tersedia</strong><p>SKU ini belum memiliki ketentuan Anti-Hackback yang tercatat pada data produk. VAULT CORE tidak menampilkan masa perlindungan, nilai refund, atau batas waktu penanganan yang belum ditetapkan.</p></div>}
          <button className="marketplace-info-close" type="button" onClick={()=>setWarrantyOpen(false)}>Tutup</button>
        </section>
      </div>}

      {guideOpen && <div className="modal-backdrop marketplace-policy-backdrop" onClick={()=>setGuideOpen(false)}>
        <section className="guide-modal marketplace-info-modal marketplace-guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(e) => e.stopPropagation()}>
          <div className="marketplace-info-header"><div><small>INFORMASI PEMBELIAN</small><h2 id="guide-title">Cara Beli &amp; Tips</h2><p>{guideCategory?.name || 'VAULT CORE'}</p></div><button className="icon-button" type="button" onClick={()=>setGuideOpen(false)} aria-label="Tutup panduan">×</button></div>
          <div className="marketplace-guide-owner"><strong>Informasi dan data akun diberikan langsung oleh VAULT CORE</strong><p>Pembeli berkomunikasi, menerima informasi produk, dan memperoleh bantuan langsung dari VAULT CORE.</p></div>
          {guideCategory?.purchase_guide?.length ? <ol className="guide-steps">{guideCategory.purchase_guide.map((step,index)=><li key={index}><span>{index+1}</span><div><strong>{step.title}</strong><p>{step.content}</p></div></li>)}</ol> : <div className="empty-state"><strong>Panduan kategori belum tersedia</strong><p>Panduan untuk subkategori ini belum tersedia pada data VAULT CORE.</p></div>}
          <div className="guide-security"><strong>Tips keamanan akun</strong><p>Ikuti tahapan login yang tercantum pada panduan produk. Setelah akses diterima, periksa identitas dan spesifikasi akun, perbarui pengaturan keamanan yang tersedia, dan jangan membagikan OTP atau kode pemulihan kepada pihak lain.</p></div>
          <button className="marketplace-info-close" type="button" onClick={()=>setGuideOpen(false)}>Tutup panduan</button>
        </section>
      </div>}
    </main>
  </>;
}
