'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getInitData, getTelegramWebApp, openInvoice } from '../../lib/telegram.js';
import './page.css';
import { GAME_ART } from '../../lib/marketplace.js';
import { getCustomerVisibleProductAttributes } from '../../lib/product-attributes.js';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const GROUPS = ['Akun','Jasa Joki'];
const GAME_NAMES = { MLBB:'Mobile Legends', FF:'Free Fire', ROBLOX:'Roblox', GI:'Genshin Impact' };
const MARKET_GAME_CODE = { MLBB:'MLBB', FF:'FREE_FIRE', ROBLOX:'ROBLOX', GI:'GENSHIN' };
const STATUS = {
  PENDING_PAYMENT:'Menunggu pembayaran',PAID:'Pembayaran diterima',FULFILLING:'Sedang diproses',
  FULFILLED:'Selesai',CANCELLED:'Dibatalkan',REFUND_PENDING:'Refund diproses',
  REFUNDED:'Refund selesai',FAILED:'Gagal'
};
const RANKS = [
  'Warrior 1','Warrior 2','Warrior 3','Elite 1','Elite 2','Elite 3','Master 1','Master 2','Master 3','Master 4',
  'Grandmaster 1','Grandmaster 2','Grandmaster 3','Grandmaster 4','Grandmaster 5',
  'Epic 1','Epic 2','Epic 3','Epic 4','Epic 5','Legend 1','Legend 2','Legend 3','Legend 4','Legend 5',
  'Mythic','Mythical Honor','Mythical Glory','Mythical Immortal'
];
const PROVIDERS = ['Moonton','Google','Apple','Facebook','TikTok','VK'];
const safeAttrs = (source = {}) => getCustomerVisibleProductAttributes(source);
const fmt = (value) => Number(value || 0).toLocaleString('id-ID');
const normalize = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g,'');
function getAttr(product, keys) {
  const entries = safeAttrs(product.attributes);
  const set = new Set(keys.map(normalize));
  const found = entries.find(([key]) => set.has(normalize(key)));
  return found ? String(found[1] ?? '') : '';
}
function getProductAvailability(product) {
  const mode = String(product?.availability_mode || '').toUpperCase();
  const days = Number(product?.indent_deadline_days);
  if (mode === 'INDENT') {
    return Number.isSafeInteger(days) && days > 0 ? 'INDENT · Maksimal ' + days + ' hari kalender' : 'INDENT';
  }
  if (mode === 'READY') return product?.is_available === true ? 'READY · Serah terima maksimal 1 jam' : 'READY · Stok habis';
  return product?.is_available === true ? 'Tersedia' : 'Belum tersedia';
}

function getComparePrice(product) {
  const sale = Number(product?.sale_price_xtr);
  const raw = product?.original_price_xtr ?? product?.compare_at_price_xtr;
  const compare = Number(raw);
  return Number.isSafeInteger(compare) && Number.isSafeInteger(sale) && compare > sale && sale > 0
    ? compare
    : null;
}

function PriceDisplay({ product, compact = false }) {
  const sale = Number(product?.sale_price_xtr);
  const compare = getComparePrice(product);
  const discount = compare ? Math.round(((compare - sale) / compare) * 100) : 0;
  return (
    <span className={`vc4-price-stack${compact ? ' is-compact' : ''}`}>
      {compare && <span className="vc4-price-before"><del>{fmt(compare)} XTR</del><b>-{discount}%</b></span>}
      <strong>{fmt(product.sale_price_xtr)} XTR</strong>
    </span>
  );
}
function matchesMlbb(product, filters) {
  const checks = [
    ['win_rate',['win_rate','win rate','winrate'],filters.winMin,filters.winMax],
    ['total_skins',['total_skins','jumlah skin','skins'],filters.skinMin,filters.skinMax],
    ['total_heroes',['total_heroes','jumlah hero','heroes'],filters.heroMin,filters.heroMax]
  ];
  for (const [,keys,min,max] of checks) {
    if (!min && !max) continue;
    const actual = Number(getAttr(product,keys).replace(/[^0-9.]/g,''));
    if (!Number.isFinite(actual)) return false;
    if (min && actual < Number(min)) return false;
    if (max && actual > Number(max)) return false;
  }
  if (filters.rank && getAttr(product,['rank_current','rank saat ini','rank']).toLowerCase() !== filters.rank.toLowerCase()) return false;
  if (filters.providers.length) {
    const actual = normalize(getAttr(product,['linked_account','akun terhubung pada','linked_platforms']));
    if (!filters.providers.some((item) => actual.includes(normalize(item)))) return false;
  }
  return true;
}

export default function VaultCoreV4Catalog({ initialCategory = 'ALL' } = {}) {
  const [variants,setVariants] = useState([]);
  const [customer,setCustomer] = useState(null);
  const [game,setGame] = useState(initialCategory === 'ALL' ? 'ALL' : initialCategory);
  const [group,setGroup] = useState('ALL');
  const [search,setSearch] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [filters,setFilters] = useState({winMin:'',winMax:'',skinMin:'',skinMax:'',heroMin:'',heroMax:'',rank:'',providers:[]});
  const [selected,setSelected] = useState(null);
  const [cart,setCart] = useState([]);
  const [cartRestored,setCartRestored] = useState(false);
  const [cartOpen,setCartOpen] = useState(false);
  const [buying,setBuying] = useState(false);
  const [notice,setNotice] = useState('');
  const [ordersOpen,setOrdersOpen] = useState(false);
  const [orders,setOrders] = useState([]);
  const [ordersLoading,setOrdersLoading] = useState(false);
  const [ordersError,setOrdersError] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API + '/api/catalog/v4/variants',{cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Katalog belum dapat dimuat.');
      setVariants(Array.isArray(data.variants) ? data.variants : []);
    } catch (e) {
      setError(e.message || 'Katalog belum dapat dimuat.');
    } finally {
      setLoading(false);
    }
  },[]);

  const loadCustomer = useCallback(async () => {
    const initData = getInitData();
    const response = await fetch(API + '/api/customer-auth/session',{
      headers: initData ? { 'x-telegram-init-data':initData } : {},
      credentials:'include',
      cache:'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCustomer(null);
      return null;
    }
    setCustomer(data.user || null);
    return data.user || null;
  },[]);

  const loadOrders = useCallback(async () => {
    const initData = getInitData();
    const response = await fetch(API + '/api/orders/mine',{
      headers: initData ? {'x-telegram-init-data':initData} : {},
      credentials:'include',
      cache:'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Masuk dengan Telegram untuk melihat riwayat transaksi.');
    setOrders(data.orders || []);
    return data.orders || [];
  },[]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryGame = params.get('game');
    const queryGroup = params.get('group');
    const query = params.get('q');
    if (queryGame && ['MLBB','FF','ROBLOX','GI'].includes(queryGame)) setGame(queryGame);
    if (queryGroup && ['Akun','Jasa Joki'].includes(queryGroup)) setGroup(queryGroup);
    if (query) setSearch(query);
  },[]);

  useEffect(() => {
    const tg = getTelegramWebApp();
    tg?.ready();
    tg?.expand();
    loadCatalog();
    loadCustomer().catch(() => setCustomer(null));
    const paid = () => {
      setNotice('Telegram mengonfirmasi pembayaran. Memperbarui pesanan…');
      loadOrders().catch(() => {});
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadCustomer().then((activeCustomer) => activeCustomer && loadOrders().catch(() => {})).catch(() => {});
      }
    };
    window.addEventListener('vault:payment-paid',paid);
    window.addEventListener('focus',refreshWhenVisible);
    document.addEventListener('visibilitychange',refreshWhenVisible);
    return () => {
      window.removeEventListener('vault:payment-paid',paid);
      window.removeEventListener('focus',refreshWhenVisible);
      document.removeEventListener('visibilitychange',refreshWhenVisible);
    };
  },[loadCatalog,loadOrders,loadCustomer]);

  const flatProducts = useMemo(() => variants.flatMap((variant) =>
    (variant.skus || []).map((sku) => ({
      ...sku,
      id:Number(sku.id),
      variant_id:Number(variant.variant_id),
      variant_name:variant.name,
      game_code:variant.game_code,
      game:variant.game,
      group:variant.category
    }))
  ),[variants]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const requestedProductId = Number(params.get('product'));
    if (!Number.isSafeInteger(requestedProductId) || requestedProductId <= 0) return;
    const product = flatProducts.find((item) => item.id === requestedProductId);
    if (!product) return;

    setSelected({variant_id:Number(product.variant_id),product});
    params.delete('product');
    const query = params.toString();
    const nextUrl = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
    window.history.replaceState(window.history.state,'',nextUrl);
  },[flatProducts,loading]);

  useEffect(() => {
    if (loading) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem('vault-core-web-cart') || '[]');
      const restored = Array.isArray(stored) ? stored.slice(0,10).map((entry) => {
        const product = flatProducts.find((item) => item.id === Number(entry.productId) && item.is_available && Number(item.sale_price_xtr) > 0);
        return product ? {
          productId:product.id, name:product.name,
          price:Number(product.sale_price_xtr),
          quantity:Math.max(1,Math.min(5,Number(entry.quantity) || 1))
        } : null;
      }).filter(Boolean) : [];
      setCart(restored);
    } catch {
      setCart([]);
    }
    setCartRestored(true);
  },[flatProducts,loading]);

  useEffect(() => {
    if (!cartRestored) return;
    if (cart.length) {
      sessionStorage.setItem('vault-core-web-cart',JSON.stringify(cart.map(({productId,quantity}) => ({productId,quantity}))));
    } else {
      sessionStorage.removeItem('vault-core-web-cart');
    }
  },[cart,cartRestored]);



  const featuredProduct = useMemo(() =>
    flatProducts.find((product) => product.is_available === true && Number(product.sale_price_xtr) > 1)
      || flatProducts.find((product) => Number(product.sale_price_xtr) > 1)
      || null,
  [flatProducts]);

  const visibleProducts = useMemo(() => flatProducts.filter((product) => {
    if (game !== 'ALL' && product.game_code !== game) return false;
    if (group !== 'ALL' && product.group !== group) return false;
    const haystack = [product.name,product.description,product.variant_name,product.game].join(' ').toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (product.game_code === 'MLBB' && product.group === 'Akun' && !matchesMlbb(product,filters)) return false;
    return true;
  }),[flatProducts,game,group,search,filters]);

  const visibleVariants = useMemo(() => variants.filter((variant) =>
    (game === 'ALL' || variant.game_code === game) &&
    (group === 'ALL' || variant.category === group) &&
    (!search || [variant.name,variant.game,variant.category].join(' ').toLowerCase().includes(search.toLowerCase()))
  ),[variants,game,group,search]);

  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.productId === product.id);
      if (found) return current.map((item) => item.productId === product.id ? {...item,quantity:Math.min(5,item.quantity+1)} : item);
      if (current.length >= 10) {
        setNotice('Keranjang maksimal 10 produk.');
        return current;
      }
      return [...current,{productId:product.id,name:product.name,price:Number(product.sale_price_xtr),quantity:1}];
    });
    setNotice(product.name + ' ditambahkan ke keranjang.');
    setSelected(null);
  };

  const setQuantity = (productId,quantity) => {
    setCart((current) => quantity < 1 ? current.filter((item) => item.productId !== productId) :
      current.map((item) => item.productId === productId ? {...item,quantity:Math.min(5,quantity)} : item));
  };

  const checkout = async () => {
    if (!cart.length) return;
    let activeCustomer = customer;
    if (!activeCustomer) activeCustomer = await loadCustomer().catch(() => null);
    if (!activeCustomer) {
      setNotice('Masuk dengan Telegram terlebih dahulu untuk menyimpan pesanan atas nama Anda.');
      window.location.assign('/account?next=%2Fcatalog');
      return;
    }
    setBuying(true);
    setNotice('Menyiapkan invoice Telegram Stars…');
    try {
      const initData = getInitData();
      const response = await fetch(API + '/api/orders',{
        method:'POST',
        headers:{'content-type':'application/json',...(initData ? {'x-telegram-init-data':initData} : {})},
        credentials:'include',
        body:JSON.stringify({items:cart.map(({productId,quantity}) => ({productId,quantity}))})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Checkout gagal dibuat.');
      setCart([]);
      setCartOpen(false);
      setNotice('Invoice ' + data.orderNumber + ' siap dibuka. Total ' + fmt(data.totalXtr) + ' XTR.');
      openInvoice(data.invoiceUrl,data.orderNumber);
    } catch(e) {
      setNotice(e.message || 'Checkout gagal dibuat.');
    } finally {
      setBuying(false);
    }
  };

  const showOrders = useCallback(async () => {
    const activeCustomer = await loadCustomer().catch(() => null);
    if (!activeCustomer) {
      window.location.assign('/account?next=%2Fcatalog');
      return;
    }
    setOrdersOpen(true);
    setOrdersLoading(true);
    setOrdersError('');
    try { await loadOrders(); }
    catch(e) { setOrdersError(e.message || 'Riwayat pesanan tidak dapat dimuat.'); }
    finally { setOrdersLoading(false); }
  },[loadCustomer,loadOrders]);

  useEffect(() => {
    const openOrdersFromHash = () => {
      if (window.location.hash === '#transactions') showOrders();
    };
    openOrdersFromHash();
    window.addEventListener('hashchange',openOrdersFromHash);
    return () => window.removeEventListener('hashchange',openOrdersFromHash);
  },[showOrders]);

  const totalXtr = cart.reduce((sum,item) => sum + item.price * item.quantity,0);
  const activeVariant = selected ? variants.find((item) => Number(item.variant_id) === selected.variant_id) : null;
  const noActiveSku = visibleProducts.length === 0;

  return (
    <div className="vc4-shell">
      <header className="vc4-nav">
        <a href="/" className="vc4-brand" aria-label="VAULT CORE Beranda">
          <img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/>
        </a>
        <nav className="vc4-nav-links" aria-label="Kategori game">
          <button type="button" className={game==='ALL'?'active':''} onClick={() => setGame('ALL')}>Semua</button>
          {Object.entries(GAME_NAMES).map(([code,label]) => <button type="button" key={code} className={game===code?'active':''} onClick={() => setGame(code)}>{label}</button>)}
        </nav>
        <div className="vc4-nav-actions">
          <a className="vc4-account-link" href="/account">{customer ? 'Akun' : 'Masuk'}</a>
          <button type="button" onClick={showOrders}>Pesanan</button>
          <button type="button" className="vc4-cart-button" onClick={() => setCartOpen(true)}>Keranjang <span>{cart.reduce((n,item)=>n+item.quantity,0)}</span></button>
        </div>
      </header>

      <main className="vc4-main">
        <section className="vc4-page-head">
          <h1>Katalog<span>.</span></h1>
          <div>
            <h2>Akun game premium dan layanan joki pilihan.</h2>
            <p>Pilih game, Akun atau Joki. Harga, ketersediaan, dan estimasi mengikuti listing backend.</p>
          </div>
        </section>

        <section className="vc4-featured-hero" aria-label="Sorotan katalog">
          <div className="vc4-featured-copy">
            <div className="vc4-featured-kicker"><span>VAULT CORE PICKS</span><span className="vc4-featured-live">KATALOG AKTIF</span></div>
            <h2>{featuredProduct ? featuredProduct.name : 'Temukan akun game pilihanmu.'}</h2>
            <p>{featuredProduct ? `${featuredProduct.game} · ${featuredProduct.variant_name} · Detail dan stok diperbarui dari katalog.` : 'Jelajahi akun game dengan detail produk dan status ketersediaan yang bersumber dari katalog.'}</p>
            {featuredProduct && <div className="vc4-featured-price"><small>HARGA SAAT INI</small><PriceDisplay product={featuredProduct}/></div>}
            <div className="vc4-featured-actions">
              {featuredProduct && <button type="button" onClick={() => setSelected({variant_id:featuredProduct.variant_id,product:featuredProduct})}>Lihat detail produk <span>↗</span></button>}
              <a href="#game-catalog">Jelajahi semua game <span>↓</span></a>
            </div>
          </div>
          <div className="vc4-featured-art" aria-hidden="true">
            <img src={GAME_ART[MARKET_GAME_CODE[featuredProduct?.game_code]] || GAME_ART.MLBB} alt="" loading="lazy"/>
          </div>
        </section>

        <section className="vc4-purchase-journey" aria-label="Alur pembelian">
          <div className="vc4-journey-heading"><span>MUDAH & TERARAH</span><strong>Alur pembelian</strong></div>
          <ol>
            <li><span>01</span><div><strong>Pilih game</strong><small>Tentukan kategori dan akun</small></div></li>
            <li><span>02</span><div><strong>Periksa detail</strong><small>Cek spesifikasi dan ketentuan</small></div></li>
            <li><span>03</span><div><strong>Bayar dengan XTR</strong><small>Lanjutkan invoice di Telegram</small></div></li>
          </ol>
        </section>

        <section className="vc4-game-row" id="game-catalog" aria-label="Pilih game">
          <button type="button" className={game==='ALL'?'selected':''} onClick={() => setGame('ALL')}>
            <span className="vc4-game-tile vc4-all-games">VC</span><span>Semua</span>
          </button>
          {Object.entries(GAME_NAMES).map(([code,label]) => <button type="button" key={code} className={game===code?'selected':''} onClick={() => setGame(code)}>
            <span className="vc4-game-tile"><img src={GAME_ART[MARKET_GAME_CODE[code]]} alt="" loading="lazy"/></span><span>{label}</span>
          </button>)}
        </section>

        <section className="vc4-filter-bar" aria-label="Jenis produk">
          {['ALL',...GROUPS].map((item) => <button type="button" key={item} className={group===item?'active':''} onClick={() => setGroup(item)}>
            {item==='ALL'?'Semua jenis':item}
          </button>)}
          <input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Cari produk atau varian…" aria-label="Cari produk atau varian"/>
        </section>

        {game==='MLBB' && group==='Akun' && <section className="vc4-mlbb-filters">
          <div className="vc4-mlbb-head"><strong>Filter akun MLBB</strong><button type="button" onClick={()=>setFiltersOpen((v)=>!v)}>{filtersOpen?'Tutup filter':'Tampilkan filter'}</button></div>
          {filtersOpen && <div className="vc4-mlbb-grid">
            <label>Win Rate (%)<span><input type="number" min="0" max="100" placeholder="Min" value={filters.winMin} onChange={(e)=>setFilters({...filters,winMin:e.target.value})}/><input type="number" min="0" max="100" placeholder="Maks" value={filters.winMax} onChange={(e)=>setFilters({...filters,winMax:e.target.value})}/></span></label>
            <label>Jumlah Skin<span><input type="number" min="0" placeholder="Min" value={filters.skinMin} onChange={(e)=>setFilters({...filters,skinMin:e.target.value})}/><input type="number" min="0" placeholder="Maks" value={filters.skinMax} onChange={(e)=>setFilters({...filters,skinMax:e.target.value})}/></span></label>
            <label>Jumlah Hero<span><input type="number" min="0" placeholder="Min" value={filters.heroMin} onChange={(e)=>setFilters({...filters,heroMin:e.target.value})}/><input type="number" min="0" placeholder="Maks" value={filters.heroMax} onChange={(e)=>setFilters({...filters,heroMax:e.target.value})}/></span></label>
            <label>Rank Saat Ini<select value={filters.rank} onChange={(e)=>setFilters({...filters,rank:e.target.value})}><option value="">Semua rank</option>{RANKS.map((rank)=><option key={rank}>{rank}</option>)}</select></label>
            <fieldset><legend>Akun Terhubung Pada</legend>{PROVIDERS.map((provider)=><label key={provider} className="vc4-check"><input type="checkbox" checked={filters.providers.includes(provider)} onChange={(e)=>setFilters({...filters,providers:e.target.checked?[...filters.providers,provider]:filters.providers.filter((v)=>v!==provider)})}/>{provider}</label>)}</fieldset>
            <button type="button" className="vc4-reset" onClick={()=>setFilters({winMin:'',winMax:'',skinMin:'',skinMax:'',heroMin:'',heroMax:'',rank:'',providers:[]})}>Reset filter</button>
          </div>}
        </section>}

        {notice && <div className="vc4-notice" role="status">{notice}<button type="button" onClick={()=>setNotice('')} aria-label="Tutup">×</button></div>}
        {error && <div className="vc4-error">{error}<button type="button" onClick={loadCatalog}>Coba lagi</button></div>}
        {loading ? <div className="vc4-loading"><span/><span/><span/></div> : GROUPS.filter((category)=>group==='ALL'||group===category).map((category) => {
          const list = visibleVariants.filter((variant)=>variant.category===category);
          if (!list.length) return null;
          return <section className="vc4-shelf" key={category}>
            <div className="vc4-shelf-head"><div><span>VAULT CORE · {category.toUpperCase()}</span><h2>{category}.</h2></div><p>{category==='Akun'?'Akun game dengan spesifikasi dan status ketersediaan pada listing.':'Layanan joki dengan jenis pekerjaan dan estimasi sesuai listing.'}</p></div>
            <div className="vc4-grid">
              {list.map((variant) => {
                const products = visibleProducts.filter((product)=>product.variant_id===Number(variant.variant_id));
                return <article className="vc4-card" key={variant.variant_id}>
                  <button type="button" className="vc4-card-main" onClick={()=>setSelected({variant_id:Number(variant.variant_id)})}>
                    <div className="vc4-card-art"><img src={GAME_ART[MARKET_GAME_CODE[variant.game_code]]} alt="" loading="lazy"/><small>{variant.category}</small></div>
                    <div className="vc4-card-copy"><span className="vc4-eyebrow">{variant.game}</span><h3>{variant.name}</h3><p>{products.length ? products.length + ' produk tersedia' : 'Produk belum tersedia'}</p></div>
                    <div className="vc4-card-foot"><strong>{products.length ? 'Lihat produk' : 'Detail varian'}</strong><span>↗</span></div>
                  </button>
                  {products.length>0 && <div className="vc4-sku-list">{products.map((product)=><div className="vc4-sku" key={product.id}>
                    <button type="button" className="vc4-sku-info" onClick={()=>setSelected({variant_id:Number(variant.variant_id),product})}>
                      {product.image_url ? <img src={product.image_url} alt="" loading="lazy"/> : <span className="vc4-sku-thumb">◇</span>}
                      <span><strong>{product.name}</strong><small>{product.display_stock===1?'STOK TERAKHIR':getProductAvailability(product)}</small></span>
                    </button>
                    <div className="vc4-sku-buy"><PriceDisplay product={product} compact/><button type="button" onClick={()=>addToCart(product)}>Tambah</button></div>
                  </div>)}</div>}
                </article>;
              })}
            </div>
          </section>;
        })}

        {!loading && visibleVariants.length===0 && <div className="vc4-empty"><h2>Varian belum ditemukan.</h2><p>Ubah pilihan game, jenis produk, atau kata pencarian.</p></div>}
        {!loading && flatProducts.length===0 && <p className="vc4-owner-note">Belum ada produk yang tersedia untuk dipesan saat ini.</p>}
        <footer className="vc4-footer">
          <p>VAULT CORE adalah penjual tunggal. Website dan Telegram Mini App menggunakan akun pelanggan dan backend yang sama.</p>
          <p>Telegram Mini App menggunakan invoice resmi Telegram Stars (XTR). Status pembayaran hanya ditetapkan setelah konfirmasi webhook Telegram. Data akses Joki ditangani melalui vault terenkripsi dan tidak ditampilkan pada katalog.</p>
        </footer>
      </main>

      {selected && <div className="vc4-overlay" role="presentation" onClick={()=>setSelected(null)}>
        <section className="vc4-dialog" role="dialog" aria-modal="true" aria-label="Detail produk" onClick={(e)=>e.stopPropagation()}>
          <button className="vc4-close" type="button" onClick={()=>setSelected(null)}>×</button>
          <span className="vc4-eyebrow">{activeVariant?.game} · {activeVariant?.category}</span>
          <h2>{activeVariant?.name}</h2>
          {selected.product ? <>
            <h3>{selected.product.name}</h3>
            <div className="vc4-product-status">{getProductAvailability(selected.product)}</div>
            {String(selected.product.tier || '').toUpperCase()==='GOLD' && <div className="vc4-detail-tier-gold">✦ GOLD · BEST VALUE</div>}
            {Array.isArray(selected.product.image_gallery)&&selected.product.image_gallery.length>0&&<div className="vc4-gallery">{selected.product.image_gallery.map((url,index)=><img key={url+index} src={url} alt={selected.product.name+' '+(index+1)} loading="lazy"/>)}</div>}
            <p>{selected.product.description}</p>
            {selected.product.customer_terms && <section className="vc4-product-terms"><h3>Ketentuan produk</h3><p>{selected.product.customer_terms}</p></section>}
            {selected.product.availability_mode === 'INDENT' && <p className="vc4-eta">Tenggat INDENT: maksimal {selected.product.indent_deadline_days} hari kalender setelah pembayaran.</p>}{selected.product.fulfillment_eta && <p className="vc4-eta">Estimasi pemenuhan: {selected.product.fulfillment_eta}</p>}
            {selected.product.group === 'Akun' && <section className="vc4-security-guide"><h3>Keamanan Akun</h3><ol><li>Periksa detail akun dan kesesuaian spesifikasi sebelum konfirmasi.</li><li>Ganti kata sandi setelah menerima akses akun.</li><li>Aktifkan verifikasi dua langkah pada akun yang mendukung.</li><li>Pastikan email dan metode pemulihan berada dalam kendali pembeli.</li></ol><p>Garansi mengikuti ketentuan yang ditetapkan pada detail produk.</p></section>}
            <section className="vc4-listing-specs"><h4>Spesifikasi Produk</h4><div className="vc4-details">{safeAttrs(selected.product.attributes).map(([key,value])=><div key={key}><span>{key.replaceAll('_',' ').replace(/\b[a-z]/g,letter=>letter.toUpperCase())}</span><strong>{String(value)}</strong></div>)}</div></section>
            <div className="vc4-price-large"><PriceDisplay product={selected.product}/></div>
            <button className="vc4-primary" type="button" onClick={()=>addToCart(selected.product)}>Tambah ke keranjang</button>
          </> : <p>Produk pada varian ini akan tampil setelah Owner menyelesaikan SKU, harga, stok, dan verifikasi yang diwajibkan.</p>}
        </section>
      </div>}

      {cartOpen && <div className="vc4-overlay" onClick={()=>setCartOpen(false)}>
        <section className="vc4-dialog vc4-cart" role="dialog" aria-modal="true" aria-label="Keranjang" onClick={(e)=>e.stopPropagation()}>
          <button className="vc4-close" type="button" onClick={()=>setCartOpen(false)}>×</button>
          <span className="vc4-eyebrow">VAULT CORE</span><h2>Keranjang.</h2>
          {cart.length===0 ? <p>Keranjang masih kosong.</p> : cart.map((item)=><div className="vc4-cart-row" key={item.productId}>
            <div><strong>{item.name}</strong><small>★ {fmt(item.price)} XTR</small></div>
            <div><button type="button" onClick={()=>setQuantity(item.productId,item.quantity-1)}>−</button><b>{item.quantity}</b><button type="button" onClick={()=>setQuantity(item.productId,item.quantity+1)}>+</button></div>
          </div>)}
          <div className="vc4-total"><span>Total</span><strong>★ {fmt(totalXtr)} XTR</strong></div>
          <button className="vc4-primary" type="button" disabled={!cart.length||buying} onClick={checkout}>{buying?'Menyiapkan invoice…':'Bayar dengan Telegram Stars'}</button>
        </section>
      </div>}

      {ordersOpen && <div className="vc4-overlay" onClick={()=>setOrdersOpen(false)}>
        <section className="vc4-dialog vc4-orders" role="dialog" aria-modal="true" aria-label="Pesanan" onClick={(e)=>e.stopPropagation()}>
          <button className="vc4-close" type="button" onClick={()=>setOrdersOpen(false)}>×</button>
          <span className="vc4-eyebrow">AKUN PEMBELI</span><h2>Pesanan.</h2>
          {ordersLoading ? <p>Memuat pesanan…</p> : ordersError ? <p className="vc4-error-text">{ordersError}</p> : orders.length===0 ? <p>Belum ada pesanan.</p> : orders.map((order)=><article className="vc4-order" key={order.order_number}>
            <header><strong>{order.order_number}</strong><span>{STATUS[order.status]||order.status}</span></header>
            {(order.items||[]).map((item)=><div className="vc4-order-item" key={item.orderItemId||item.name}><span>{item.name} × {item.quantity}</span>
{item.category==='Jasa Joki' && <small className="vc4-joki-input-note">Form data Joki tanpa kredensial belum tersedia. Jangan kirim password, OTP, atau kode autentikasi.</small>}
            </div>)}
            <footer>★ {fmt(order.total_xtr)} XTR · {new Date(order.created_at).toLocaleString('id-ID')}</footer>
          </article>)}
        </section>
      </div>}

    </div>
  );
}
