(() => {
'use strict';

const C = window.VAULT_CONFIG || {};
const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = Boolean(tg && tg.initData);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const money = new Intl.NumberFormat('id-ID');
const state = { variants: [], products: [], loaded: false, loadError: '', orderFilter: 'all', orderRows: [], catalogGroup:'ALL', catalogGame:'ALL', search:'', customerInputs:{} };
let creatingOrder = false;
let lastInvoice = null;
let renderId = 0;
let pollTimer = null;

const GAMES = {
  MLBB: { name:'Mobile Legends Bang Bang', short:'MLBB', art:'/game-icons/mlbb.webp' },
  FF: { name:'Free Fire', short:'Free Fire', art:'/game-icons/free-fire.webp' },
  ROBLOX: { name:'Roblox', short:'Roblox', art:'/game-icons/roblox.webp' },
  GI: { name:'Genshin Impact', short:'Genshin', art:'/game-icons/genshin-impact.webp' }
};
const GAME_CODES = Object.keys(GAMES);
const FF_ACCOUNT_PREVIEW = 'data:image/webp;base64,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';
const ICONS = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  grid:'<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  user:'<circle cx="12" cy="8" r="3.8"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  search:'<circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 4.5 4.5"/>',
  bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  back:'<path d="m15 5-7 7 7 7"/>',
  next:'<path d="m9 5 7 7-7 7"/>',
  star:'<path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" fill="currentColor"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  help:'<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.8-2.4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M9 10a3 3 0 0 1 6 0c0 1.5-3 2-3 4M12 16.8h.01"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3.3 8-8 10-4.7-2-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>',
  heart:'<path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z"/>',
  telegram:'<path d="m21 4-18 7 5 2 2 6 3-4 5 4zM8 13l9-6"/>'
};
const icon = (name) => '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg></span>';
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (value) => money.format(Number(value || 0));
const MINI_APP_ENTRY = '/miniapp/index.html';
const APP_ROUTES = Object.freeze({
  home:'/home', catalog:'/catalog', orders:'/orders', profile:'/profile',
  about:'/about', terms:'/terms', privacy:'/privacy', refund:'/refund',
  game:(code) => '/game/' + encodeURIComponent(code),
  variant:(id) => '/variant/' + encodeURIComponent(id),
  product:(id) => '/product/' + encodeURIComponent(id),
  done:(orderNumber) => '/done/' + encodeURIComponent(orderNumber)
});
const go = (path) => { location.hash = '#' + (path.startsWith('/') ? path : '/' + path); };
const routeParts = () => (location.hash || '#/home').slice(1).split('/').filter(Boolean).map((part) => decodeURIComponent(part));
const gameOf = (code) => GAMES[code] || {name:String(code || 'Game'),short:'Game',art:'/assets/03-categories/category-other.png'};
const isBuyable = (product) => product && product.is_purchaseable === true && product.is_available === true && Number(product.sale_price_xtr) > 0;
const comparePrice = (product) => {
  const compare = Number(product && (product.compare_at_price_xtr || product.original_price_xtr));
  const sale = Number(product && product.sale_price_xtr);
  return Number.isSafeInteger(compare) && Number.isSafeInteger(sale) && compare > sale && sale > 0 ? compare : 0;
};
const discountPercent = (product) => {
  const compare = comparePrice(product);
  return compare ? Math.round(((compare - Number(product.sale_price_xtr)) / compare) * 100) : 0;
};
const stockLabel = (product) => {
  if (!isBuyable(product)) return 'Stok habis';
  if (product.display_stock === 1) return 'STOK TERAKHIR';
  if (product.display_stock === null || product.display_stock === 'IN_STOCK') return 'Stok tersedia';
  return Number(product.display_stock) > 1 ? 'Stok tersedia' : 'Stok habis';
};
function accountAvailability(product) {
  const mode = String(product && product.availability_mode || '').toUpperCase();
  const days = Number(product && product.indent_deadline_days);
  if (mode === 'INDENT') return Number.isSafeInteger(days) && days > 0 ? 'INDENT · Maksimal ' + days + ' hari kalender' : 'INDENT';
  if (mode === 'READY') return product && product.is_available === true ? 'READY · Serah terima maksimal 1 jam' : 'READY · Stok habis';
  return product && product.is_available === true ? 'Tersedia' : 'Belum tersedia';
}

const categoryLabel = (product) => product && product.variant_category || 'Produk Digital';
function normalizeCatalogVariants(variants) {
  state.variants = Array.isArray(variants) ? variants : [];
  state.products = state.variants.flatMap((variant) =>
    (Array.isArray(variant.skus) ? variant.skus : []).map((sku) => ({
      ...sku,
      id:Number(sku.id),
      game_category:variant.game_code,
      variant_id:Number(variant.variant_id),
      variant_name:variant.name,
      variant_category:variant.category,
      fulfillment_type:sku.fulfillment_type || (variant.category === 'Akun' ? 'GAME_ACCOUNT_TRANSFER' : 'SERVICE_INSTRUCTIONS'),
      is_purchaseable:sku.is_purchaseable === true && Number(sku.sale_price_xtr) > 1,
      is_available:sku.is_available === true
    }))
  );
}

function getFavoriteProductIds() {
  try {
    const ids = JSON.parse(localStorage.getItem('vaultcore.favoriteProducts') || '[]');
    return Array.isArray(ids) ? ids.map(String) : [];
  } catch (_) {
    return [];
  }
}
function isProductFavorite(id) {
  return getFavoriteProductIds().includes(String(id));
}
function toggleProductFavorite(id) {
  const productId = String(id || '');
  if (!productId) return;
  const ids = getFavoriteProductIds();
  const favorite = !ids.includes(productId);
  const next = favorite ? [...ids,productId] : ids.filter((value) => value !== productId);
  try {
    localStorage.setItem('vaultcore.favoriteProducts',JSON.stringify(next));
  } catch (_) {
    return toast('Favorit belum dapat disimpan pada perangkat ini.');
  }
  const button = $('[data-action="favorite"][data-id="' + productId + '"]');
  if (button) {
    button.classList.toggle('is-favorite',favorite);
    button.setAttribute('aria-pressed',String(favorite));
    button.setAttribute('aria-label',favorite?'Hapus dari favorit':'Tambahkan ke favorit');
  }
  toast(favorite?'Produk ditambahkan ke favorit.':'Produk dihapus dari favorit.');
}
function shareProduct(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product) return;
  const url = location.origin + MINI_APP_ENTRY + '#' + APP_ROUTES.product(product.id);
  const text = product.name + ' · ' + fmt(product.sale_price_xtr) + ' XTR di VAULT CORE';
  if (inTelegram && tg.openTelegramLink) {
    tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text));
    return;
  }
  if (navigator.share) {
    navigator.share({title:'VAULT CORE',text,url}).catch((error) => {
      if (!error || error.name !== 'AbortError') toast('Produk belum dapat dibagikan.');
    });
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => toast('Tautan produk disalin.')).catch(() => toast(url));
    return;
  }
  toast(url);
}
function toast(message) {
  const old = $('.toast');
  if (old) old.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 3200);
}
function setPage(markup, active, hideNav) {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  const view = $('#view');
  view.innerHTML = markup;
  view.classList.toggle('nonav', Boolean(hideNav));
  const nav = $('#nav');
  nav.hidden = Boolean(hideNav);
  nav.innerHTML = [
    ['home','Home','home'],
    ['catalog','Store','grid'],
    ['orders','My Orders','receipt'],
    ['profile','Profile','user']
  ].map(([key,label,symbol]) => '<a href="#/' + key + '" class="' + (active === key ? 'on' : '') + '" aria-current="' + (active === key ? 'page' : 'false') + '">' + icon(symbol) + '<span>' + label + '</span></a>').join('');
  if (inTelegram && tg.BackButton) {
    if (hideNav || active === 'home' || active === 'catalog' || active === 'orders' || active === 'profile') tg.BackButton.hide();
    else tg.BackButton.show();
  }
  window.scrollTo(0,0);
}
function headerHome() {
  return '<header class="topbar"><a class="brand" href="' + APP_ROUTES.home + '" aria-label="VAULT CORE Home"><img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"></a><div class="top-actions"><button class="icon-btn" type="button" data-go="/catalog" aria-label="Cari produk">' + icon('search') + '</button><button class="icon-btn" type="button" data-go="/orders" aria-label="Status pesanan">' + icon('bell') + '</button><button class="icon-btn" type="button" data-go="/profile" aria-label="Profil">' + icon('user') + '</button></div></header>';
}
function headerPage(title) {
  return '<header class="pagebar"><button class="back-btn" type="button" data-action="back" aria-label="Kembali">' + icon('back') + '</button><h1>' + esc(title) + '</h1><span class="spacer"></span></header>';
}
function productDetailHeader(product) {
  const favorite = isProductFavorite(product.id);
  return '<header class="product-detail-header"><button class="detail-header-action" type="button" data-action="back" aria-label="Kembali">' + icon('back') + '</button><strong>VAULT CORE</strong><div class="detail-header-actions"><button class="detail-header-action" type="button" data-action="share" data-id="' + esc(product.id) + '" aria-label="Bagikan produk">' + icon('share') + '</button><button class="detail-header-action favorite-action' + (favorite?' is-favorite':'') + '" type="button" data-action="favorite" data-id="' + esc(product.id) + '" aria-label="' + (favorite?'Hapus dari favorit':'Tambahkan ke favorit') + '" aria-pressed="' + favorite + '">' + icon('heart') + '</button></div></header>';
}
function priceMarkup(product, compact) {
  const compare = comparePrice(product);
  const small = compact ? ' class="small"' : '';
  return '<div class="price"' + small + '>' +
    (compare ? '<span class="discount">-' + discountPercent(product) + '%</span><del>' + fmt(compare) + '</del> ' : '') +
    '<b>' + fmt(product.sale_price_xtr) + ' XTR</b></div>';
}
function productImage(product, cls) {
  const url = product.image_url || gameOf(product.game_category).art;
  const name = product.name || gameOf(product.game_category).name;
  return '<div class="' + (cls || 'product-art') + '"><img src="' + esc(url) + '" alt="' + esc(name) + '" loading="lazy"></div>';
}
function productGalleryImages(product) {
  const raw = [product && product.image_url,...(Array.isArray(product && product.image_gallery) ? product.image_gallery : [])];
  const urls = [...new Set(raw.map((value) => String(value || '').trim()).filter((value) =>
    /^https:\/\//i.test(value) || /^\/assets\/[A-Za-z0-9_./-]+$/.test(value)
  ))].slice(0,8);
  return urls.length ? urls : [gameOf(product && product.game_category).art];
}
function productGallery(product) {
  const images = productGalleryImages(product);
  const thumbnails = images.length > 1
    ? '<div class="detail-gallery-thumbs" role="group" aria-label="Pilih gambar produk">' + images.map((url,index) =>
        '<button type="button" class="detail-gallery-thumb' + (index===0?' is-active':'') + '" data-detail-gallery-index="' + index + '" data-image-src="' + esc(url) + '" aria-label="Gambar ' + (index+1) + '" aria-pressed="' + (index===0) + '">' +
          '<img src="' + esc(url) + '" alt="" loading="lazy"></button>'
      ).join('') + '</div>'
    : '';
  return '<section class="detail-gallery" aria-label="Galeri produk">' +
    '<div class="detail-art detail-gallery-main"><img src="' + esc(images[0]) + '" data-detail-gallery-main alt="' + esc(product.name || 'Gambar produk') + '" loading="eager">' +
      '<span class="detail-gallery-position" aria-live="polite">1 / ' + images.length + '</span></div>' +
    thumbnails +
  '</section>';
}
function productCard(product) {
  const gold = String(product.tier || '').toUpperCase() === 'GOLD';
  const mode = String(product.availability_mode || '').toUpperCase();
  const available = product.is_available === true;
  const statusClass = mode === 'INDENT' ? 'is-indent' : available ? 'is-ready' : 'is-unavailable';
  const statusLabel = mode === 'INDENT' ? 'INDEN' : available ? 'READY' : 'TIDAK TERSEDIA';
  return '<button type="button" class="product-card' + (gold ? ' tier-gold' : '') + '" data-go="/product/' + encodeURIComponent(product.id) + '">' +
    productImage(product,'product-art') +
    '<span class="product-availability-dot ' + statusClass + '"><i></i>' + statusLabel + '</span>' +
    (gold ? '<span class="tier-gold-label">GOLD · BEST VALUE</span>' : '') +
    '<div class="product-copy"><small>' + esc(gameOf(product.game_category).name) + ' · ' + esc(categoryLabel(product)) + '</small><b>' + esc(product.name) + '</b>' +
    priceMarkup(product,true) + '<small class="product-stock-caption">' + esc(stockLabel(product)) + '</small></div></button>';
}
function relatedProducts(product) {
  const related = state.products
    .filter((item) => isBuyable(item) && String(item.id) !== String(product.id))
    .map((item,index) => ({
      item,
      index,
      score:(item.game_category === product.game_category ? 2 : 0) + (item.variant_category === product.variant_category ? 1 : 0)
    }))
    .sort((a,b) => b.score-a.score || a.index-b.index)
    .slice(0,2)
    .map((entry) => entry.item);
  if (!related.length) return '';
  return '<section class="related-products"><div class="section-head"><h2>Produk Terkait</h2><small>Pilihan lain dari katalog</small></div><div class="related-product-grid">' + related.map(productCard).join('') + '</div></section>';
}
function comingSoonCard(variant) {
  const game = gameOf(variant.game_code);
  const art = Number(variant.variant_id) === 4 ? FF_ACCOUNT_PREVIEW : game.art;
  return '<article class="product-card product-card-soon" aria-label="' + esc(variant.name) + ' akan tersedia">' +
    '<div class="product-art"><img src="' + esc(art) + '" alt="" loading="lazy"></div>' +
    '<div class="product-copy"><small>' + esc(game.short) + ' · ' + esc(variant.category) + '</small>' +
    '<b>' + esc(variant.name) + '</b><span class="soon-state">Akan Tersedia</span>' +
    '<small>Kartu otomatis diganti ketika produk lolos pemeriksaan dan stok aktual tersedia.</small></div></article>';
}
function productRow(product) {
  return '<button type="button" class="list-card" data-go="/product/' + encodeURIComponent(product.id) + '">' +
    productImage(product,'list-art') +
    '<span class="list-copy"><b>' + esc(product.name) + '</b><small>' + esc(gameOf(product.game_category).name) + ' · ' + esc(categoryLabel(product)) + ' · ' + esc(stockLabel(product)) + '</small>' + priceMarkup(product,true) + '</span>' +
    '<span class="chevron">›</span></button>';
}
function productsOf(variant) {
  return state.products.filter((product) => Number(product.variant_id) === Number(variant.variant_id));
}
function home() {
  const services = state.variants.filter((variant) => variant.category === 'Jasa Joki');
  const available = state.products.filter(isBuyable);
  const recommendedAccounts = available.filter((product) => product.variant_category === 'Akun').slice(0,2);
  const jokiByGame = GAME_CODES.map((code) => services.find((variant) => variant.game_code === code)).filter(Boolean);
  const gameTiles = GAME_CODES.map((code) => {
    return '<button class="game-tile" type="button" data-store-game="' + code + '"><span class="game-art"><img src="' + gameOf(code).art + '" alt="" loading="lazy"></span><b>' + esc(gameOf(code).short) + '</b></button>';
  }).join('');
  const jokiCard = (variant) => {
    const ready = productsOf(variant).filter(isBuyable).length;
    return '<button class="home-joki-card" type="button" data-store-game="' + esc(variant.game_code) + '" data-store-group="Jasa Joki">' +
      '<span class="home-joki-art"><img src="' + gameOf(variant.game_code).art + '" alt="" loading="lazy"><small>JOKI</small></span>' +
      '<span class="home-joki-copy"><small>' + esc(gameOf(variant.game_code).short) + ' · LAYANAN</small><b>' + esc(variant.name) + '</b>' +
      '<span class="home-joki-status ' + (ready?'ready':'') + '">' + (ready?'Ready · '+ready+' layanan':'Belum tersedia') + '</span></span></button>';
  };
  const skeleton = !state.loaded
    ? '<div class="home-skeleton-grid"><i class="vc-skeleton"></i><i class="vc-skeleton"></i><i class="vc-skeleton"></i><i class="vc-skeleton"></i></div>'
    : '';
  setPage(
    headerHome() +
    '<main class="home-v3">' +
      '<form class="search home-search" id="home-search-form">' + icon('search') + '<input id="home-search" type="search" value="' + esc(state.search || '') + '" placeholder="Cari akun game atau layanan joki..." autocomplete="off"><button type="submit" aria-label="Cari produk">' + icon('next') + '</button></form>' +
      '<section class="home-promo promo-board"><div class="home-promo-copy"><small><i></i>PAPAN PROMO · VAULT CORE</small><h1>Temukan akun game <em>& layanan joki</em></h1><p>Telusuri katalog empat game pilihan.</p><div class="home-promo-tags"><span>AKUN GAME</span><span>JOKI</span><span>4 GAME</span></div><button type="button" data-go="/catalog">Jelajahi Store <b>↗</b></button></div><div class="vc-miniapp-promo-visual" aria-hidden="true"><picture><source media="(prefers-reduced-motion: no-preference)" srcset="/assets/02-hero/hero-vaultcore-loop.webp" type="image/webp"><img src="/assets/02-hero/hero-vaultcore.jpg" alt=""></picture><span>VAULT CORE · DIGITAL STORE</span></div></section>' +
      '<div class="section-head"><h2>Kategori Game</h2><button type="button" data-go="/catalog">Lihat Semua ›</button></div>' +
      '<section class="games home-games">' + gameTiles + '</section>' +
      '<div class="home-group-tabs"><button type="button" class="on" data-store-group="ALL">Semua</button><button type="button" data-store-group="Akun">Akun</button><button type="button" data-store-group="Jasa Joki">Joki</button></div>' +
      (skeleton ? skeleton :
        '<div class="section-head"><h2>Pilihan Akun</h2><button type="button" data-go="/catalog">Lihat Semua ›</button></div>' +
        (recommendedAccounts.length ? '<div class="home-featured-grid">' + recommendedAccounts.map(productCard).join('') + '</div>' : '<div class="empty">Belum ada akun yang siap dipesan pada katalog publik.</div>') +
        '<div class="section-head"><h2>Layanan Joki</h2><button type="button" data-store-group="Jasa Joki">Lihat Kategori ›</button></div>' +
        (jokiByGame.length ? '<div class="home-joki-grid">' + jokiByGame.map(jokiCard).join('') + '</div>' : '<div class="empty">Kategori layanan Joki belum dapat dimuat.</div>')
      ) +
      '<div class="section-head"><h2>Aktivitas Pesanan</h2><button type="button" data-go="/orders">My Orders ›</button></div>' +
      '<button type="button" class="home-activity" data-go="/orders"><span>' + icon('receipt') + '</span><div><b>Riwayat pesanan pribadi</b><small>Status dan detail pesanan tampil pada akun pelanggan terverifikasi.</small></div><span class="home-activity-arrow">›</span></button>' +
      '<div class="section-head"><h2>Keunggulan VAULT CORE</h2></div>' +
      '<div class="home-benefits"><div>' + icon('shield') + '<b>Transaksi Terpantau</b><small>Riwayat dan status pada akun pelanggan.</small></div><div>' + icon('help') + '<b>Pusat Bantuan</b><small>Dukungan melalui kanal resmi VAULT CORE.</small></div></div>' +
    '</main>',
    'home', false
  );
}
function paintCatalogProducts() {
  const target = $('#catalog-products');
  if (!target) return;
  const group = state.catalogGroup || 'ALL';
  const game = state.catalogGame || 'ALL';
  const query = String(state.search || '').trim().toLowerCase();
  const visible = state.products.filter((product) => {
    if (!isBuyable(product)) return false;
    if (game !== 'ALL' && product.game_category !== game) return false;
    if (group !== 'ALL' && product.variant_category !== group) return false;
    const haystack = [product.name,product.description,product.variant_name,gameOf(product.game_category).name,product.variant_category].join(' ').toLowerCase();
    return !query || haystack.includes(query);
  });
  target.innerHTML = visible.length
    ? visible.map(productCard).join('')
    : '<div class="empty store-empty">Belum ada produk aktif pada filter ini.</div>';
  const count = $('#catalog-result-count');
  if (count) count.textContent = visible.length + ' produk';
}
function catalog() {
  const gameTabs = [['ALL','Semua'],['MLBB','MLBB'],['FF','Free Fire'],['ROBLOX','Roblox'],['GI','Genshin']];
  const groupOptions = [['Akun','Akun'],['Jasa Joki','Joki'],['Item In-Game','Item'],['Produk Lainnya','Lainnya']];
  const groupTabs = [['ALL','Semua'],...groupOptions.filter(([code]) => state.products.some((product) => product.variant_category === code))];
  setPage(
    headerPage('Store') +
    '<main class="store-v3">' +
      '<label class="search store-search">' + icon('search') + '<input id="catalog-search" type="search" placeholder="Cari akun game atau layanan joki..." value="' + esc(state.search || '') + '" autocomplete="off"></label>' +
      '<div class="store-game-tabs">' + gameTabs.map(([code,label]) => '<button type="button" data-filter-game="' + code + '" class="' + ((state.catalogGame||'ALL')===code?'on':'') + '">' + label + '</button>').join('') + '</div>' +
      '<div class="store-group-tabs">' + groupTabs.map(([code,label]) => '<button type="button" data-filter-group="' + code + '" class="' + ((state.catalogGroup||'ALL')===code?'on':'') + '">' + label + '</button>').join('') + '</div>' +
      '<div class="store-tier-hint"><span>PRODUK TERSEDIA</span><small id="catalog-result-count">Mengambil data katalog...</small></div>' +
      '<div id="catalog-products" class="store-product-grid">' + (!state.loaded ? '<i class="vc-skeleton"></i><i class="vc-skeleton"></i><i class="vc-skeleton"></i><i class="vc-skeleton"></i>' : '') + '</div>' +
      (state.loadError ? '<div class="empty">' + esc(state.loadError) + '<button class="store-retry-button" type="button" data-action="retry-catalog">Coba lagi</button></div>' : '') +
      '<div class="store-source-note">Detail, harga XTR, status, dan ketersediaan mengikuti listing backend VAULT CORE.</div>' +
    '</main>',
    'catalog', false
  );
  if (state.loaded) paintCatalogProducts();
}
function gamePage(code) {
  const game = GAMES[code];
  if (!game) return go(APP_ROUTES.catalog);
  const variants = state.variants.filter((variant) => variant.game_code === code && ['Akun','Jasa Joki','Item In-Game','Produk Lainnya'].includes(variant.category));
  const activeCount = state.products.filter((product) => product.game_category === code && isBuyable(product)).length;
  setPage(
    headerPage(game.name) +
    '<main><section class="game-cover" style="--cover:url(&quot;' + game.art + '&quot;)"><b>' + esc(game.name) + '</b></section>' +
    '<p class="sub">Pilih varian produk yang tersedia. Setiap varian menampilkan produk aktif dari katalog backend.</p>' +
    variants.map((variant) => {
      const products = productsOf(variant);
      const count = products.filter(isBuyable).length;
      const canOpen = count > 0;
      return '<button class="list-card" type="button" data-go="/variant/' + variant.variant_id + '">' +
        productImage({game_category:code},'list-art') +
        '<span class="list-copy"><b>' + esc(variant.name) + '</b><small>' + esc(variant.category) + '</small><span class="badge ' + (canOpen ? '' : 'muted') + '">' + (canOpen ? count + ' Produk tersedia' : 'Segera hadir') + '</span></span><span class="chevron">›</span></button>';
    }).join('') +
    '<div class="sub">' + activeCount + ' produk aktif dan dapat dibeli pada game ini.</div></main>',
    'catalog', false
  );
}
function variantPage(id) {
  const variant = state.variants.find((item) => Number(item.variant_id) === Number(id));
  if (!variant) return go(APP_ROUTES.catalog);
  const products = productsOf(variant).filter(isBuyable);
  setPage(
    headerPage(variant.name) +
    '<main>' +
    '<p class="sub">' + esc(gameOf(variant.game_code).name) + ' · ' + esc(variant.category) + '</p>' +
    (products.length ? products.map(productRow).join('') : comingSoonCard(variant)) +
    '</main>',
    'catalog', false
  );
}
const PRIVATE_ATTRIBUTE_KEYS = new Set([
  'sku','skucode','productcode','kodeproduk',
  'subcategory','subkategori','deliverymethod','metodepenyerahan','handovermethod','transfermethod',
  'xtrprice','pricenote','priceminidr','pricemaxidr','pricecurrency',
  'costpricenote','costpricestatus','costpricextr','fulfillmentmode','fulfillmenttype',
  'ownerattestationref','authorizationevidencestatus','authorizationevidencereference',
  'rightsbasis','publisherplatform','officialtermsurl','chainoftitle','reviewstatus','reviewnotes',
  'reviewertelegramuserid','validuntil','stocksource','unbindterms','seasonnote'
]);
function safeAttributes(source) {
  return Object.entries(source || {}).filter(([key]) => {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g,'');
    return !PRIVATE_ATTRIBUTE_KEYS.has(normalized)
      && !['xtrconversion','ownerattestation','authorizationevidence','costprice','rightsreview','stocksource'].some((prefix) => normalized.startsWith(prefix))
      && !/(login|password|sandi|otp|session|recovery|token|credential|username|email)/i.test(key)
      && !/(^|[^a-z0-9])pass(?:word)?(?:$|[^a-z0-9])/i.test(key)
      && normalized !== 'variantid';
  });
}
function renderDetailCopy(value) {
  const normalized = String(value ?? '')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\n(?=(?:INFORMASI PENAWARAN|GARANSI ANTI HACKBACK VAULT CORE))/g, '\n\n')
    .replace(/((?:INFORMASI PENAWARAN|GARANSI ANTI HACKBACK VAULT CORE))\n/g, '$1\n\n')
    .trim();
  if (!normalized) return '';
  return normalized.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '';
    const heading = /^(INFORMASI PENAWARAN|GARANSI ANTI HACKBACK VAULT CORE)$/i.test(lines[0]);
    if (heading) {
      return '<section class="detail-copy"><h4>' + esc(lines[0]) + '</h4><p>' +
        lines.slice(1).map(esc).join('<br>') + '</p></section>';
    }
    return '<section class="detail-copy"><p>' + lines.map(esc).join('<br>') + '</p></section>';
  }).join('');
}

function productPage(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product && !state.loaded) {
    setPage('<main><div class="loading" role="status">Memuat detail produk…<br>Menyiapkan informasi dan ketersediaan terbaru.</div></main>', 'catalog', true);
    return;
  }
  if (!product) {
    setPage('<main><div class="empty"><b>Produk tidak ditemukan</b><br>Produk ini mungkin sudah tidak tersedia di katalog.</div><button class="cta alt" type="button" data-go="/catalog">Kembali ke katalog</button></main>', 'catalog', true);
    return;
  }
  const attrs = safeAttributes(product.attributes);
  const details = [];
  if (product.description) details.push(renderDetailCopy(product.description));
  if (attrs.length) details.push('<ul class="detail-copy">' + attrs.map(([key,value]) => '<li><b>' + esc(key.replace(/[_-]/g,' ')) + ':</b> ' + esc(value) + '</li>').join('') + '</ul>');
  if (product.customer_terms) details.push(renderDetailCopy(product.customer_terms));
  if (product.availability_mode === 'INDENT' && Number(product.indent_deadline_days)>0) details.push('<p class="detail-copy">Tenggat INDENT: maksimal ' + esc(product.indent_deadline_days) + ' hari kalender setelah pembayaran.</p>');
  const customerFields = Array.isArray(product.customer_input_fields) ? product.customer_input_fields : [];
  const savedInput = state.customerInputs[String(product.id)] || {};
  const customerForm = customerFields.length
    ? '<section class="box buyer-fields"><h3>Data untuk Pesanan</h3><p>Isi identitas game dan parameter pekerjaan sesuai produk.</p>' +
      customerFields.map((field) => {
        const label = esc(field.label);
        const value = esc(savedInput[field.label] || '');
        const id = ' data-customer-input="1" data-product-id="' + esc(product.id) + '" data-field-label="' + label + '" ';
        const required = field.required ? ' required ' : '';
        const maxLength = Math.min(240,Math.max(1,Number(field.maxLength || 240)));
        const control = field.type === 'textarea'
          ? '<textarea' + id + 'maxlength="' + maxLength + '"' + required + '>' + value + '</textarea>'
          : '<input type="' + (field.type === 'number' ? 'number' : 'text') + '"' + id + (field.type === 'number' ? '' : 'maxlength="' + maxLength + '"') + required + 'value="' + value + '">';
        return '<label class="buyer-field">' + label + (field.required ? ' <small>Wajib</small>' : '') + control + '</label>';
      }).join('') + '</section>' : '';
  setPage(
    productDetailHeader(product) +
    '<main>' + productGallery(product) +
    '<h2 class="detail-title">' + esc(product.name) + '</h2>' +
    '<div class="chips"><span class="chip">' + esc(gameOf(product.game_category).short) + '</span><span class="chip">' + esc(categoryLabel(product)) + '</span></div>' +
    (String(product.tier || '').toUpperCase() === 'GOLD' ? '<div class="detail-gold">✦ GOLD · BEST VALUE</div>' : '') +
    '<div class="detail-price">' + fmt(product.sale_price_xtr) + ' XTR</div>' +
    '<div class="detail-availability">' + esc(accountAvailability(product)) + '</div>' +
    '<div class="box"><h3>Detail & Spesifikasi</h3>' + details.join('') + '</div>' +
    (product.variant_category === 'Akun'
      ? '<div class="box info">' + icon('info') + '<span>Periksa spesifikasi akun. Jangan pernah membagikan kata sandi, OTP, session, atau kode pemulihan di luar proses penyerahan resmi.</span></div>'
      : product.variant_category === 'Jasa Joki'
        ? '<div class="box info">' + icon('info') + '<span>Isi hanya identitas game dan parameter pengerjaan. Password, OTP, serta kode autentikasi tidak diminta.</span></div>'
        : '<div class="box info">' + icon('info') + '<span>Metode pengiriman item mengikuti petunjuk dan ketentuan pada detail produk.</span></div>') +
    relatedProducts(product) +
    customerForm +
    '<div class="dock"><button class="cta" type="button" data-action="buy" data-id="' + esc(product.id) + '" ' + (isBuyable(product) ? '' : 'disabled') + '>' + (isBuyable(product) ? 'Beli Sekarang →' : 'Stok tidak tersedia') + '</button></div>' +
    '</main>',
    'catalog', false
  );
}
async function beginCheckout(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product || !isBuyable(product)) return toast('Produk tidak tersedia atau stok sudah habis.');
  if (!inTelegram || !tg || !tg.initData) return toast('Untuk membeli, buka VAULT CORE melalui Telegram Mini App.');
  if (creatingOrder) return;
  await createOrder(product.id);
}
async function createOrder(id) {
  if (creatingOrder) return;
  if (!inTelegram || !tg || !tg.initData) return toast('Buka aplikasi melalui Telegram untuk membuat pesanan.');
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product || !isBuyable(product)) return toast('Stok produk berubah. Muat ulang katalog.');

  creatingOrder = true;
  const button = $$('[data-action="buy"]').find((item) => item.getAttribute('data-id') === String(product.id));
  if (button) {
    button.disabled = true;
    button.textContent = 'Menyiapkan invoice...';
  }

  try {
    const fields = Array.isArray(product.customer_input_fields) ? product.customer_input_fields : [];
    const customerInput = state.customerInputs[String(product.id)] || {};
    const missing = fields.find((field) => field.required && !String(customerInput[field.label] || '').trim());
    if (missing) throw new Error('Lengkapi data ' + missing.label + ' terlebih dahulu.');
    const body = {items:[{productId:Number(product.id),quantity:1,customerInput}]};
    const result = await api('/api/orders',{method:'POST',body});
    if (!result.orderNumber || !result.invoiceUrl) throw new Error('Invoice Telegram belum tersedia. Silakan periksa riwayat pesanan.');
    lastInvoice = {number:result.orderNumber,url:result.invoiceUrl};
    go(APP_ROUTES.done(result.orderNumber));
    openInvoice();
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = 'Beli Sekarang →';
    }
    toast(error.message || 'Pesanan tidak dapat dibuat.');
  } finally {
    creatingOrder = false;
  }
}
function openInvoice() {
  if (!lastInvoice || !inTelegram || !tg) return;
  if (typeof tg.openInvoice === 'function') {
    tg.openInvoice(lastInvoice.url,(status) => {
      if (status === 'paid') toast('Pembayaran dikonfirmasi Telegram. Memperbarui status pesanan…');
      else if (status === 'cancelled') toast('Pembayaran dibatalkan. Reservasi stok memiliki batas waktu.');
    });
  } else {
    location.href = lastInvoice.url;
  }
}
const STATUS = {
  PENDING_PAYMENT:'Menunggu pembayaran',
  PAID:'Pembayaran diterima',
  FULFILLING:'Sedang diproses',
  FULFILLED:'Selesai',
  CANCELLED:'Dibatalkan',
  REFUND_PENDING:'Refund diproses',
  REFUNDED:'Refund selesai',
  FAILED:'Gagal'
};
function statusClass(status) {
  if (status === 'FULFILLED') return 'ok';
  if (['FAILED','CANCELLED','REFUNDED'].includes(status)) return 'bad';
  return '';
}
async function fetchOrders() {
  const result = await api('/api/orders/mine');
  return Array.isArray(result) ? result : (result.orders || []);
}
function renderDone(orderNumber, myRender) {
  setPage(
    headerPage('Pembayaran') +
    '<main><div class="stepper"><div class="step done"><i>✓</i>Data</div><div class="step done"><i>✓</i>Pembayaran</div><div class="step on"><i>3</i>Selesai</div></div>' +
    '<div id="done-status"><div class="success-mark pending">★</div><div class="center"><h2>Pesanan Dibuat</h2><p>Menunggu konfirmasi Telegram. Status akan diperbarui otomatis.</p></div></div>' +
    '<div class="order-id"><span><small>Order ID</small><b>' + esc(orderNumber) + '</b></span><button class="icon-btn" type="button" data-action="copy" data-copy="' + esc(orderNumber) + '">' + icon('copy') + '</button></div>' +
    '<button class="cta" type="button" data-action="invoice">Buka Invoice Telegram</button><button class="cta alt" type="button" data-go="/orders">Lihat Detail Pesanan</button><button class="cta alt" type="button" data-go="/home">Kembali ke Beranda</button></main>',
    'orders', true
  );
  if (!inTelegram) return;
  const poll = async () => {
    if (myRender !== renderId || !location.hash.includes('/done/')) return;
    try {
      const rows = await fetchOrders();
      const order = rows.find((row) => row.order_number === orderNumber);
      if (order && myRender === renderId) {
        const done = order.status === 'FULFILLED';
        const failed = ['FAILED','CANCELLED','REFUNDED'].includes(order.status);
        const target = $('#done-status');
        if (target) target.innerHTML =
          '<div class="success-mark ' + (done?'':'pending') + '">' + (done?'✓':failed?'!':'★') + '</div>' +
          '<div class="center"><h2>' + (done?'Pesanan Selesai':failed?'Pesanan Tidak Berhasil':order.status==='PENDING_PAYMENT'?'Menunggu Pembayaran':'Pembayaran Berhasil!') + '</h2>' +
          '<p>' + esc(STATUS[order.status] || order.status) + '. ' + (done?'Pesanan telah diselesaikan.':failed?'Silakan periksa riwayat atau hubungi bantuan.':'Pesanan sedang diproses oleh sistem.') + '</p></div>';
        if (done || failed) return;
      }
    } catch (_) {}
    pollTimer = setTimeout(poll,4000);
  };
  pollTimer = setTimeout(poll,1800);
}
async function renderOrders() {
  if (!inTelegram) {
    setPage(headerPage('Transaksi') + '<div class="empty">Riwayat transaksi hanya tersedia setelah membuka VAULT CORE melalui Telegram Mini App.</div>', 'orders', false);
    return;
  }
  setPage(headerPage('Transaksi') +
    '<div class="filters">' +
      '<button class="' + (state.orderFilter==='all'?'on':'') + '" data-filter="all">Semua</button>' +
      '<button class="' + (state.orderFilter==='proc'?'on':'') + '" data-filter="proc">Diproses</button>' +
      '<button class="' + (state.orderFilter==='done'?'on':'') + '" data-filter="done">Selesai</button>' +
    '</div><div id="order-list" class="loading">Memuat riwayat transaksi…</div>',
    'orders', false
  );
  try {
    state.orderRows = await fetchOrders();
    if (!$('#order-list')) return;
    paintOrderRows();
  } catch (error) {
    const list = $('#order-list');
    if (list) list.innerHTML = '<div class="empty">' + esc(error.message || 'Riwayat transaksi belum dapat dimuat.') + '</div>';
  }
}
function paintOrderRows() {
  const list = $('#order-list');
  if (!list) return;
  const rows = state.orderRows.filter((row) => state.orderFilter === 'all' ||
    (state.orderFilter === 'done' ? row.status === 'FULFILLED' :
      ['PENDING_PAYMENT','PAID','FULFILLING','REFUND_PENDING'].includes(row.status)));
  if (!rows.length) {
    list.innerHTML = '<div class="empty">Belum ada transaksi pada akun Telegram ini.</div>';
    return;
  }
  list.innerHTML = rows.map((row) => {
    const items = Array.isArray(row.items) ? row.items : [];
    const itemNames = items.map((item) => item.name).filter(Boolean).join(', ');
    const date = row.created_at ? new Date(row.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    const itemDetails = items.map((item) => {
      const inputs = Object.entries(item.customerInputs || {}).map(([label,value]) =>
        '<div class="order-input"><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>'
      ).join('');
      const deadline = item.fulfillmentDeadlineAt
        ? '<small class="order-deadline">Tenggat: ' + esc(new Date(item.fulfillmentDeadlineAt).toLocaleString('id-ID')) + '</small>' : '';
      return (inputs ? '<div class="order-inputs">' + inputs + '</div>' : '') + deadline;
    }).join('');
    return '<div class="order-row"><span class="list-art"><img src="/assets/01-brand/vaultcore-mark.svg" alt=""></span><span class="tx"><small>' + esc(row.order_number) + ' · ' + esc(date) + '</small><b>' + esc(itemNames || 'Pesanan VAULT CORE') + '</b><small>★ ' + fmt(row.total_xtr) + ' XTR</small></span><span class="status ' + statusClass(row.status) + '">' + esc(STATUS[row.status] || row.status) + '</span></div>' + (itemDetails ? '<div class="order-input-panel">' + itemDetails + '</div>' : '');
  }).join('');
}

function renderProfile() {
  const user = inTelegram && tg.initDataUnsafe ? tg.initDataUnsafe.user || null : null;
  const name = user ? [user.first_name,user.last_name].filter(Boolean).join(' ') || user.username || 'Pengguna Telegram' : 'Mode Web';
  const contact = String(C.supportContact || '').replace(/^@/,'');
  setPage(
    headerPage('Profil') +
    '<main>' +
      '<div class="who"><span class="avatar">' + esc(name.slice(0,1).toUpperCase()) + '</span><span><b>' + esc(name) + '</b><small style="display:block;color:var(--muted);font-size:9px;margin-top:3px">' + (user && user.id ? 'ID: ' + esc(user.id) : 'Buka Mini App melalui Telegram') + '</small></span></div>' +
      '<div class="menu">' +
        '<button type="button" data-go="/orders">' + icon('receipt') + '<span>Riwayat Transaksi</span><span>›</span></button>' +
        '<button type="button" data-action="support">' + icon('help') + '<span>Bantuan / CS</span><span>›</span></button>' +
        '<button type="button" data-go="/terms">' + icon('info') + '<span>Syarat & Ketentuan</span><span>›</span></button>' +
        '<button type="button" data-go="/privacy">' + icon('shield') + '<span>Kebijakan Privasi</span><span>›</span></button>' +
        '<button type="button" data-go="/refund">' + icon('receipt') + '<span>Kebijakan Refund</span><span>›</span></button>' +
        '<button type="button" data-go="/about">' + icon('home') + '<span>Tentang VAULT CORE</span><span>›</span></button>' +
      '</div>' +
      '<div class="box info" style="margin-top:14px">' + icon('shield') + '<span>Pembayaran diproses melalui invoice resmi Telegram Stars (XTR). Jangan kirim kata sandi atau kode OTP ke siapa pun.</span></div>' +
    '</main>',
    'profile', false
  );
}
function renderInfo(name) {
  const content = {
    about:['Tentang VAULT CORE',['Marketplace satu penjual untuk akun game dan varian terkait.','Game utama: Mobile Legends, Free Fire, Roblox, dan Genshin Impact.','Harga dan stok mengikuti data backend.']],
    terms:['Syarat & Ketentuan',['Periksa deskripsi, spesifikasi, dan ketentuan setiap produk sebelum membeli.','Pembayaran sah setelah dikonfirmasi sistem Telegram. Tangkapan layar bukan bukti pembayaran.','Pemenuhan pesanan mengikuti metode dan ketentuan pada detail produk.']],
    privacy:['Kebijakan Privasi',['Identitas Telegram digunakan untuk menghubungkan pesanan ke akun pembeli.','Jangan masukkan kata sandi, OTP, session, atau kode pemulihan ke formulir aplikasi.','Data transaksi ditampilkan pada sesi Telegram pembeli yang terverifikasi.']],
    refund:['Kebijakan Refund',['Jika tenggat pemenuhan terlewati dan pembeli tidak menyetujui satu tenggat pengganti, refund penuh diproses paling lambat 24 jam setelah status OVERDUE.','Refund Telegram Stars dinyatakan selesai setelah Telegram mengonfirmasi transaksi refund.']]
  }[name] || ['Informasi',['Informasi belum tersedia.']];
  setPage(headerPage(content[0]) + '<main><div class="box">' + content[1].map((item) => '<p>' + esc(item) + '</p>').join('') + '</div></main>', 'profile', false);
}
function render() {
  renderId += 1;
  const myRender = renderId;
  const [name,arg] = routeParts();
  switch (name || 'home') {
    case 'home': home(); break;
    case 'catalog': catalog(); break;
    case 'game': gamePage(arg); break;
    case 'variant': variantPage(arg); break;
    case 'product': productPage(arg); break;
    case 'checkout': go(APP_ROUTES.product(arg)); break;
    case 'done': renderDone(arg,myRender); break;
    case 'orders': renderOrders(); break;
    case 'profile': renderProfile(); break;
    case 'about': case 'terms': case 'privacy': case 'refund': renderInfo(name); break;
    default: home();
  }
}
async function api(path, options) {
  const opts = options || {};
  const headers = Object.assign({},opts.headers || {});
  if (inTelegram) headers['x-telegram-init-data'] = tg.initData;
  if (opts.body) headers['content-type'] = 'application/json';
  const response = await fetch(C.apiBase + path,{
    method:opts.method || 'GET',
    headers,
    body:opts.body ? JSON.stringify(opts.body) : undefined,
    cache:'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || data.error || 'Permintaan gagal.'),{status:response.status,code:data.error});
  return data;
}
function startCheckout(id) {
  return beginCheckout(id);
}
function copyText(value) {
  const fallback = () => {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    field.remove();
    return copied;
  };
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(value).then(() => true).catch(fallback);
    }
  } catch (_) {}
  return Promise.resolve(fallback());
}
function handleClick(event) {
  const storeGame = event.target.closest('[data-store-game]');
  if (storeGame) {
    state.catalogGame = storeGame.getAttribute('data-store-game') || 'ALL';
    state.catalogGroup = storeGame.getAttribute('data-store-group') || 'ALL';
    state.search = '';
    go(APP_ROUTES.catalog);
    return;
  }
  const storeGroup = event.target.closest('[data-store-group]');
  if (storeGroup) {
    state.catalogGroup = storeGroup.getAttribute('data-store-group') || 'ALL';
    state.catalogGame = 'ALL';
    state.search = '';
    go(APP_ROUTES.catalog);
    return;
  }
  const goButton = event.target.closest('[data-go]');
  if (goButton) {
    event.preventDefault();
    go(goButton.getAttribute('data-go'));
    return;
  }
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    state.orderFilter = filter.getAttribute('data-filter');
    renderOrders();
    return;
  }
  const groupFilter = event.target.closest('[data-filter-group]');
  if (groupFilter) {
    state.catalogGroup = groupFilter.getAttribute('data-filter-group');
    $('.store-group-tabs button').forEach((button) => button.classList.toggle('on',button === groupFilter));
    paintCatalogProducts();
    return;
  }
  const galleryThumb = event.target.closest('[data-detail-gallery-index]');
  if (galleryThumb) {
    const gallery = galleryThumb.closest('.detail-gallery');
    const mainImage = gallery && gallery.querySelector('[data-detail-gallery-main]');
    const position = gallery && gallery.querySelector('.detail-gallery-position');
    const thumbs = gallery ? Array.from(gallery.querySelectorAll('[data-detail-gallery-index]')) : [];
    const index = Number(galleryThumb.getAttribute('data-detail-gallery-index'));
    const imageUrl = galleryThumb.getAttribute('data-image-src');
    if (mainImage && imageUrl && Number.isInteger(index) && index >= 0 && index < thumbs.length) {
      mainImage.src = imageUrl;
      if (position) position.textContent = (index+1) + ' / ' + thumbs.length;
      thumbs.forEach((thumb,thumbIndex) => {
        const active = thumbIndex === index;
        thumb.classList.toggle('is-active',active);
        thumb.setAttribute('aria-pressed',String(active));
      });
    }
    return;
  }
  const gameFilter = event.target.closest('[data-filter-game]');
  if (gameFilter) {
    state.catalogGame = gameFilter.getAttribute('data-filter-game');
    $('.store-game-tabs button').forEach((button) => button.classList.toggle('on',button === gameFilter));
    paintCatalogProducts();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  if (action === 'retry-catalog') { loadCatalog(true); return; }
  if (action === 'back') { history.length > 1 ? history.back() : go(APP_ROUTES.home); return; }
  if (action === 'share') { shareProduct(button.getAttribute('data-id')); return; }
  if (action === 'favorite') { toggleProductFavorite(button.getAttribute('data-id')); return; }
  if (action === 'buy') { startCheckout(button.getAttribute('data-id')); return; }
  if (action === 'invoice') { openInvoice(); return; }
  if (action === 'copy') {
    const value = button.getAttribute('data-copy') || '';
    if (!value) return;
    copyText(value).then((copied) => toast(copied ? 'Order ID disalin' : value));
    return;
  }
  if (action === 'support') {
    const username = String(C.supportContact || '').replace(/^@/,'');
    if (!username) return toast('Kontak bantuan belum tersedia.');
    const url = 'https://t.me/' + username;
    if (inTelegram && tg.openTelegramLink) tg.openTelegramLink(url);
    else { const opened=window.open(url,'_blank','noopener,noreferrer'); if(!opened) location.href=url; }
  }
}
function handleInput(event) {
  const customerInput = event.target && event.target.closest('[data-customer-input]');
  if (customerInput) {
    const productId = String(customerInput.getAttribute('data-product-id') || '');
    const label = String(customerInput.getAttribute('data-field-label') || '');
    if (productId && label) {
      state.customerInputs[productId] = {...(state.customerInputs[productId] || {}),[label]:customerInput.value || ''};
    }
    return;
  }
  if (event.target && event.target.id === 'catalog-search') {
    state.search = event.target.value || '';
    paintCatalogProducts();
    return;
  }
  if (event.target && event.target.id === 'home-search') {
    state.search = event.target.value || '';
    return;
  }
}
function handleSubmit(event) {
  const form = event.target;
  if (!form || form.id !== 'home-search-form') return;
  event.preventDefault();
  const input = form.querySelector('#home-search');
  state.search = input ? input.value || '' : state.search || '';
  state.catalogGroup = 'ALL';
  state.catalogGame = 'ALL';
  go(APP_ROUTES.catalog);
}
async function loadCatalog(showLoading = false) {
  if (showLoading) {
    state.loaded = false;
    state.loadError = '';
    render();
  }
  try {
    const result = await api('/api/catalog/v4/variants');
    normalizeCatalogVariants(result.variants);
    state.loadError = '';
  } catch (error) {
    state.loadError = error.message || 'Katalog belum dapat dimuat.';
  } finally {
    state.loaded = true;
    render();
  }
}

function init() {
  if (inTelegram) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#08080f');
      tg.setBackgroundColor('#08080f');
      if (tg.BackButton) tg.BackButton.onClick(() => { history.length > 1 ? history.back() : go(APP_ROUTES.home); });
    } catch (_) {}
  }
  document.addEventListener('click',handleClick);
  document.addEventListener('input',handleInput);
  document.addEventListener('submit',handleSubmit);
  window.addEventListener('hashchange',render);
  const splash = $('#splash');
  render();
  window.setTimeout(() => {
    if (splash) splash.classList.add('out');
    window.setTimeout(() => splash && splash.remove(),380);
  },320);
  loadCatalog();
  if ('serviceWorker' in navigator && !inTelegram) navigator.serviceWorker.register('./sw.js',{scope:'/miniapp/'}).catch(() => {});
}
init();
})();