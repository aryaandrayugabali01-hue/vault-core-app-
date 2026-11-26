(() => {
'use strict';

const C = window.VAULT_CONFIG || {};
const VARIANTS = window.VAULT_VARIANTS || [];
const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = Boolean(tg && tg.initData);
const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat('id-ID');
const state = { products: [], categories: [], loaded: false, loadError: '', orderFilter: 'all', orderRows: [] };
let checkout = null;
let lastInvoice = null;
let renderId = 0;
let pollTimer = null;

const GAMES = {
  MLBB: { name:'Mobile Legends Bang Bang', short:'MLBB', art:'/assets/03-categories/category-mlbb.png' },
  FREE_FIRE: { name:'Free Fire', short:'Free Fire', art:'/assets/03-categories/category-free-fire.png' },
  ROBLOX: { name:'Roblox', short:'Roblox', art:'/assets/03-categories/category-roblox.png' },
  GENSHIN: { name:'Genshin Impact', short:'Genshin', art:'/assets/03-categories/category-genshin.png' }
};
const GAME_CODES = Object.keys(GAMES);
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
  telegram:'<path d="m21 4-18 7 5 2 2 6 3-4 5 4zM8 13l9-6"/>'
};
const icon = (name) => '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg></span>';
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (value) => money.format(Number(value || 0));
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
const stockLabel = (product) => isBuyable(product) ? 'Stok tersedia' : 'Stok habis';

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
    ['catalog','Katalog','grid'],
    ['orders','Transaksi','receipt'],
    ['profile','Profil','user']
  ].map(([key,label,symbol]) => '<button type="button" data-go="/' + key + '" class="' + (active === key ? 'on' : '') + '" aria-current="' + (active === key ? 'page' : 'false') + '">' + icon(symbol) + '<span>' + label + '</span></button>').join('');
  if (inTelegram && tg.BackButton) {
    if (hideNav || active === 'home' || active === 'catalog' || active === 'orders' || active === 'profile') tg.BackButton.hide();
    else tg.BackButton.show();
  }
  window.scrollTo(0,0);
}
function headerHome() {
  return '<header class="topbar"><a class="brand" href="#/home" aria-label="VAULT CORE Home"><img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"></a><div class="top-actions"><button class="icon-btn" type="button" data-go="/catalog" aria-label="Cari produk">' + icon('search') + '</button><button class="icon-btn" type="button" data-go="/profile" aria-label="Profil">' + icon('user') + '</button></div></header>';
}
function headerPage(title) {
  return '<header class="pagebar"><button class="back-btn" type="button" data-action="back" aria-label="Kembali">' + icon('back') + '</button><h1>' + esc(title) + '</h1><span class="spacer"></span></header>';
}
function priceMarkup(product, compact) {
  const compare = comparePrice(product);
  const small = compact ? ' class="small"' : '';
  return '<div class="price"' + small + '>' +
    (compare ? '<span class="discount">-' + discountPercent(product) + '%</span><del>' + fmt(compare) + '</del> ' : '') +
    '<b>★ ' + fmt(product.sale_price_xtr) + ' XTR</b></div>';
}
function productImage(product, cls) {
  const url = product.image_url || gameOf(product.game_category).art;
  const name = product.name || gameOf(product.game_category).name;
  return '<div class="' + (cls || 'product-art') + '"><img src="' + esc(url) + '" alt="' + esc(name) + '" loading="lazy"></div>';
}
function productCard(product) {
  return '<button type="button" class="product-card" data-go="/product/' + encodeURIComponent(product.id) + '">' +
    productImage(product,'product-art') +
    '<div class="product-copy"><small>' + esc(gameOf(product.game_category).name) + ' · Akun Game</small><b>' + esc(product.name) + '</b>' +
    priceMarkup(product,true) + '<small>' + esc(stockLabel(product)) + '</small></div></button>';
}
function productRow(product) {
  return '<button type="button" class="list-card" data-go="/product/' + encodeURIComponent(product.id) + '">' +
    productImage(product,'list-art') +
    '<span class="list-copy"><b>' + esc(product.name) + '</b><small>' + esc(gameOf(product.game_category).name) + ' · ' + esc(stockLabel(product)) + '</small>' + priceMarkup(product,true) + '</span>' +
    '<span class="chevron">›</span></button>';
}
function productsOf(variant) {
  return state.products.filter((product) => product.game_category === variant.game &&
    (product.attributes && product.attributes.variant_id
      ? Number(product.attributes.variant_id) === Number(variant.id)
      : variant.kind === 'AKUN' && product.fulfillment_type === 'GAME_ACCOUNT_TRANSFER'));
}
function home() {
  const available = state.products.filter(isBuyable);
  const recommended = available.slice().sort((a,b) =>
    Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) ||
    Number(b.display_stock || 0) - Number(a.display_stock || 0)
  ).slice(0,8);
  const promo = available.find((product) => comparePrice(product));
  const banner = promo
    ? '<button class="promo" type="button" data-go="/product/' + encodeURIComponent(promo.id) + '"><span class="promo-copy"><b>Promo Spesial</b><em>' + esc(promo.name) + '</em><p>Harga promo terverifikasi · ' + discountPercent(promo) + '%</p></span><span class="promo-mark">%' + '</span></button>'
    : '<button class="promo" type="button" data-go="/catalog"><span class="promo-copy"><b>Pilihan Spesial</b><em>Akun game pilihan</em><p>Lihat varian dan stok yang tersedia</p></span><span class="promo-mark">★</span></button>';
  setPage(
    headerHome() +
    '<main>' +
      '<section class="hero"><div class="hero-copy"><span class="eyebrow">VAULT CORE DIGITAL STORE</span><h1>Akun Game Premium<em>Pilihan Terbaik</em></h1><p>Mobile Legends • Free Fire • Roblox • Genshin Impact</p><button class="hero-cta" type="button" data-go="/catalog">Jelajahi Katalog <span>→</span></button></div></section>' +
      '<div class="dots" aria-hidden="true"><i class="on"></i><i></i><i></i></div>' +
      '<section class="games">' + GAME_CODES.map((code) => {
        const count = VARIANTS.filter((variant) => variant.game === code).length;
        return '<button class="game-tile" type="button" data-go="/game/' + code + '"><span class="game-art"><img src="' + gameOf(code).art + '" alt="" loading="lazy"></span><b>' + esc(gameOf(code).short) + '</b></button>';
      }).join('') + '</section>' +
      banner +
      '<div class="section-head"><h2>Rekomendasi Hari Ini</h2><button type="button" data-go="/catalog">Lihat Semua ›</button></div>' +
      (recommended.length ? '<div class="products-strip">' + recommended.map(productCard).join('') + '</div>' :
        '<div class="empty">' + (state.loaded ? 'Belum ada akun yang siap dijual. Silakan cek kembali nanti.' : 'Memuat katalog…') + '</div>') +
      '<div class="section-head"><h2>4 Game · 12 Varian</h2><button type="button" data-go="/catalog">Buka Katalog ›</button></div>' +
      '<div class="box info">' + icon('shield') + '<span>Periksa deskripsi, spesifikasi, stok, dan ketentuan sebelum melanjutkan pembelian. Pembayaran hanya melalui Telegram Stars (XTR).</span></div>' +
    '</main>',
    'home', false
  );
}
function catalog() {
  const query = state.search || '';
  const filtered = GAME_CODES.filter((code) => gameOf(code).name.toLowerCase().includes(query.toLowerCase()) ||
    gameOf(code).short.toLowerCase().includes(query.toLowerCase()));
  setPage(
    headerPage('Katalog Game') +
    '<main><label class="search">' + icon('search') + '<input id="catalog-search" type="search" placeholder="Cari produk, akun, atau game..." value="' + esc(query) + '" autocomplete="off"></label>' +
    '<div id="catalog-games">' + filtered.map((code) => {
      const variants = VARIANTS.filter((variant) => variant.game === code);
      return '<button class="list-card" type="button" data-go="/game/' + code + '">' +
        productImage({game_category:code},'list-art') +
        '<span class="list-copy"><b>' + esc(gameOf(code).name) + '</b><small>Game marketplace</small><span class="badge">' + variants.length + ' Varian</span></span><span class="chevron">›</span></button>';
    }).join('') + '</div>' +
    '<div class="sub">Pilih game untuk melihat varian Akun, Joki, Item, dan layanan terkait. Ketersediaan pembelian mengikuti katalog resmi.</div></main>',
    'catalog', false
  );
}
function gamePage(code) {
  const game = GAMES[code];
  if (!game) return go('/catalog');
  const variants = VARIANTS.filter((variant) => variant.game === code);
  const activeCount = state.products.filter((product) => product.game_category === code && isBuyable(product)).length;
  setPage(
    headerPage(game.name) +
    '<main><section class="game-cover" style="--cover:url(&quot;' + game.art + '&quot;)"><b>' + esc(game.name) + '</b></section>' +
    '<p class="sub">Pilih varian produk yang tersedia. Setiap varian menampilkan produk aktif dari katalog backend.</p>' +
    variants.map((variant) => {
      const products = productsOf(variant);
      const count = products.filter(isBuyable).length;
      const canOpen = count > 0;
      return '<button class="list-card" type="button" data-go="/variant/' + variant.id + '">' +
        productImage({game_category:code},'list-art') +
        '<span class="list-copy"><b>' + esc(variant.name) + '</b><small>' + esc(variant.sub.join(' · ')) + '</small><span class="badge ' + (canOpen ? '' : 'muted') + '">' + (canOpen ? count + ' Produk tersedia' : 'Segera hadir') + '</span></span><span class="chevron">›</span></button>';
    }).join('') +
    '<div class="sub">' + activeCount + ' produk aktif dan dapat dibeli pada game ini.</div></main>',
    'catalog', false
  );
}
function variantPage(id) {
  const variant = VARIANTS.find((item) => Number(item.id) === Number(id));
  if (!variant) return go('/catalog');
  const products = productsOf(variant).filter(isBuyable);
  setPage(
    headerPage(variant.name) +
    '<main>' +
    '<p class="sub">' + esc(gameOf(variant.game).name) + ' · ' + esc(variant.kind) + '</p>' +
    (products.length ? products.map(productRow).join('') :
      '<div class="empty"><b>Varian belum tersedia</b><br>Produk aktif untuk varian ini belum diterbitkan. Tidak ada stok atau harga yang ditampilkan sebelum tersedia dari backend.</div>') +
    '</main>',
    'catalog', false
  );
}
function safeAttributes(source) {
  return Object.entries(source || {}).filter(([key]) =>
    !/(login|password|pass|sandi|otp|session|recovery|token|credential|username|email)/i.test(key) &&
    !/^(variant_id)$/i.test(key)
  );
}
function productPage(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product) return go('/catalog');
  const attrs = safeAttributes(product.attributes);
  const details = [];
  if (product.description) details.push('<p>' + esc(product.description) + '</p>');
  if (attrs.length) details.push('<ul>' + attrs.map(([key,value]) => '<li><b>' + esc(key.replace(/[_-]/g,' ')) + ':</b> ' + esc(value) + '</li>').join('') + '</ul>');
  if (product.customer_terms) details.push('<p>' + esc(product.customer_terms) + '</p>');
  details.push('<li>Pembayaran Telegram Stars (XTR)</li><li>Penyerahan mengikuti instruksi dan ketentuan produk.</li>');
  setPage(
    headerPage('Detail Produk') +
    '<main>' + productImage(product,'detail-art') +
    '<h2 class="detail-title">' + esc(product.name) + '</h2>' +
    '<div class="chips"><span class="chip">' + esc(gameOf(product.game_category).short) + '</span><span class="chip">Akun Game</span></div>' +
    '<div class="detail-price">' + fmt(product.sale_price_xtr) + ' XTR</div>' +
    '<div class="box"><h3>Detail & Spesifikasi</h3>' + details.join('') + '</div>' +
    '<div class="box info">' + icon('info') + '<span>Jangan pernah membagikan kata sandi, OTP, session, atau kode pemulihan. Isi ID/Username hanya jika diminta pada instruksi produk.</span></div>' +
    '<div class="dock"><button class="cta" type="button" data-action="buy" data-id="' + esc(product.id) + '" ' + (isBuyable(product) ? '' : 'disabled') + '>' + (isBuyable(product) ? 'Beli Sekarang →' : 'Stok tidak tersedia') + '</button></div>' +
    '</main>',
    'catalog', true
  );
}
function beginCheckout(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product || !isBuyable(product)) return toast('Produk tidak tersedia.');
  if (!inTelegram) return toast('Pembelian dan invoice resmi tersedia melalui Telegram Mini App. Buka VAULT CORE dari bot Telegram.');
  checkout = { productId:String(id), step:1, buyerInput:'', busy:false, error:'' };
  go('/checkout/' + encodeURIComponent(id));
}
function renderCheckout(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product || !isBuyable(product)) return go('/catalog');
  if (!inTelegram) {
    setPage(headerPage('Pembelian') + '<div class="empty">Checkout dan invoice resmi Telegram Stars (XTR) hanya dapat dibuka melalui Telegram Mini App.</div>', 'catalog', false);
    return;
  }
  if (!checkout || checkout.productId !== String(id)) checkout = {productId:String(id),step:1,buyerInput:'',busy:false,error:''};
  const step = checkout.step;
  const steps = '<div class="stepper"><div class="step ' + (step===1?'on':step>1?'done':'') + '"><i>1</i>Data</div><div class="step ' + (step===2?'on':step>2?'done':'') + '"><i>2</i>Pembayaran</div><div class="step"><i>3</i>Selesai</div></div>';
  const input = step === 1 ?
    '<label class="label" for="buyer-input">Data Penerima</label><input class="input" id="buyer-input" maxlength="64" value="' + esc(checkout.buyerInput) + '" placeholder="ID / Username (jika diperlukan)" autocomplete="off"><p class="helptext">Isi sesuai instruksi produk jika diperlukan. Jangan masukkan kata sandi atau OTP.</p>' :
    '<div class="pay-card"><span class="star">★</span><span><b>Bayar dengan Telegram Stars (XTR)</b><small>Invoice resmi diproses oleh Telegram.</small></span></div>';
  const button = step === 1 ?
    '<button class="cta" type="button" data-action="checkout-next">Lanjut ke Pembayaran →</button>' :
    '<button class="cta" type="button" data-action="pay" ' + (checkout.busy?'disabled':'') + '>' + (checkout.busy?'Memproses…':'★ Bayar dengan Telegram Stars') + '</button>';
  setPage(
    headerPage(step === 1 ? 'Pembelian' : 'Pembayaran') + '<main>' + steps +
    '<div class="list-card">' + productImage(product,'list-art') + '<span class="list-copy"><b>' + esc(product.name) + '</b><small>' + esc(gameOf(product.game_category).short) + '</small><b class="price">' + fmt(product.sale_price_xtr) + ' XTR</b></span></div>' +
    input +
    '<div class="box info">' + icon('shield') + '<span>Pastikan data penerima sesuai instruksi produk. Pembayaran hanya sah setelah status dikonfirmasi sistem.</span></div>' +
    (checkout.error ? '<p class="error">' + esc(checkout.error) + '</p>' : '') +
    '<div class="dock">' + button + '</div></main>',
    'catalog', true
  );
}
async function createOrder() {
  if (!checkout || checkout.busy) return;
  if (!inTelegram || !tg || !tg.initData) return toast('Buka aplikasi melalui Telegram untuk membuat pesanan.');
  const product = state.products.find((item) => String(item.id) === checkout.productId);
  if (!product || !isBuyable(product)) return toast('Stok produk berubah. Muat ulang katalog.');
  checkout.buyerInput = ($('#buyer-input') && $('#buyer-input').value.trim()) || checkout.buyerInput || '';
  checkout.busy = true;
  checkout.error = '';
  renderCheckout(product.id);
  try {
    const body = {items:[{productId:Number(product.id),quantity:1}],paymentMethod:'XTR'};
    if (checkout.buyerInput) body.buyerInput = {gameId:checkout.buyerInput};
    const result = await api('/api/orders',{method:'POST',body});
    lastInvoice = {number:result.orderNumber,url:result.invoiceUrl};
    checkout = null;
    go('/done/' + encodeURIComponent(result.orderNumber));
    openInvoice();
  } catch (error) {
    checkout.busy = false;
    checkout.error = error.message || 'Pesanan tidak dapat dibuat.';
    renderCheckout(product.id);
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
    const itemNames = (Array.isArray(row.items)?row.items:[]).map((item) => item.name).filter(Boolean).join(', ');
    const date = row.created_at ? new Date(row.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    return '<div class="order-row"><span class="list-art"><img src="/assets/01-brand/vaultcore-mark.svg" alt=""></span><span class="tx"><small>' + esc(row.order_number) + ' · ' + esc(date) + '</small><b>' + esc(itemNames || 'Pesanan VAULT CORE') + '</b><small>★ ' + fmt(row.total_xtr) + ' XTR</small></span><span class="status ' + statusClass(row.status) + '">' + esc(STATUS[row.status] || row.status) + '</span></div>';
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
    privacy:['Kebijakan Privasi',['Identitas Telegram digunakan untuk menghubungkan pesanan ke akun pembeli.','Jangan masukkan kata sandi, OTP, session, atau kode pemulihan ke formulir aplikasi.','Data transaksi ditampilkan pada sesi Telegram pembeli yang terverifikasi.']]
  }[name] || ['Informasi',['Informasi belum tersedia.']];
  setPage(headerPage(content[0]) + '<main><div class="box">' + content[1].map((item) => '<p>' + esc(item) + '</p>').join('') + '</div></main>', 'profile', false);
}
function render() {
  renderId += 1;
  const myRender = renderId;
  const [name,arg] = routeParts();
  if (name !== 'checkout') checkout = null;
  switch (name || 'home') {
    case 'home': home(); break;
    case 'catalog': state.search=''; catalog(); break;
    case 'game': gamePage(arg); break;
    case 'variant': variantPage(arg); break;
    case 'product': productPage(arg); break;
    case 'checkout': renderCheckout(arg); break;
    case 'done': renderDone(arg,myRender); break;
    case 'orders': renderOrders(); break;
    case 'profile': renderProfile(); break;
    case 'about': case 'terms': case 'privacy': renderInfo(name); break;
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
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product || !isBuyable(product)) return toast('Produk tidak tersedia atau stok sudah habis.');
  if (!inTelegram) return toast('Untuk membeli, buka VAULT CORE melalui Telegram Mini App.');
  checkout = {productId:String(id),step:1,buyerInput:'',busy:false,error:''};
  go('/checkout/' + encodeURIComponent(id));
}
function handleClick(event) {
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
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  if (action === 'back') { history.length > 1 ? history.back() : go('/home'); return; }
  if (action === 'buy') { startCheckout(button.getAttribute('data-id')); return; }
  if (action === 'checkout-next') {
    if ($('#buyer-input')) checkout.buyerInput = $('#buyer-input').value.trim();
    checkout.step = 2;
    renderCheckout(checkout.productId);
    return;
  }
  if (action === 'pay') { createOrder(); return; }
  if (action === 'invoice') { openInvoice(); return; }
  if (action === 'copy') {
    const value = button.getAttribute('data-copy') || '';
    if (navigator.clipboard && value) navigator.clipboard.writeText(value).then(() => toast('Order ID disalin')).catch(() => toast(value));
    else toast(value);
    return;
  }
  if (action === 'support') {
    const username = String(C.supportContact || '').replace(/^@/,'');
    if (!username) return toast('Kontak bantuan belum tersedia.');
    const url = 'https://t.me/' + username;
    if (inTelegram && tg.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url,'_blank','noopener,noreferrer');
  }
}
function handleInput(event) {
  if (event.target && event.target.id === 'catalog-search') {
    const query = event.target.value.toLowerCase().trim();
    const list = $('#catalog-games');
    if (!list) return;
    const matches = GAME_CODES.filter((code) => gameOf(code).name.toLowerCase().includes(query) || gameOf(code).short.toLowerCase().includes(query));
    list.innerHTML = matches.map((code) => {
      const count = VARIANTS.filter((variant) => variant.game === code).length;
      return '<button class="list-card" type="button" data-go="/game/' + code + '">' +
        productImage({game_category:code},'list-art') +
        '<span class="list-copy"><b>' + esc(gameOf(code).name) + '</b><small>Game marketplace</small><span class="badge">' + count + ' Varian</span></span><span class="chevron">›</span></button>';
    }).join('') || '<div class="empty">Game tidak ditemukan.</div>';
  }
  if (event.target && event.target.id === 'buyer-input' && checkout) checkout.buyerInput = event.target.value;
}
function init() {
  if (inTelegram) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#070914');
      tg.setBackgroundColor('#070914');
      if (tg.BackButton) tg.BackButton.onClick(() => { history.length > 1 ? history.back() : go('/home'); });
    } catch (_) {}
  }
  document.addEventListener('click',handleClick);
  document.addEventListener('input',handleInput);
  window.addEventListener('hashchange',render);
  const splash = $('#splash');
  const started = Date.now();
  api('/api/catalog').then((result) => {
    state.products = Array.isArray(result.products) ? result.products : [];
    state.categories = Array.isArray(result.categories) ? result.categories : [];
    state.loaded = true;
  }).catch((error) => {
    state.loadError = error.message || 'Katalog belum dapat dimuat.';
  }).finally(() => {
    render();
    const delay = Math.max(0,900 - (Date.now() - started));
    setTimeout(() => { if (splash) splash.classList.add('out'); setTimeout(() => splash && splash.remove(),380); },delay);
  });
  if ('serviceWorker' in navigator && !inTelegram) navigator.serviceWorker.register('./sw.js',{scope:'/miniapp/'}).catch(() => {});
}
init();
})();