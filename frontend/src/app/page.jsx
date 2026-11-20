'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData, getTelegramWebApp, openInvoice } from '../lib/telegram';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const CATEGORIES = [
  { id: 'ALL', label: 'Semua' },
  { id: 'MLBB', label: 'MLBB' },
  { id: 'ROBLOX', label: 'Roblox' },
  { id: 'FREE_FIRE', label: 'Free Fire' },
  { id: 'GENSHIN', label: 'Genshin' }
];
const TIERS = [
  { id: 'ALL', label: 'Semua tier' },
  { id: 'SILVER', label: 'Silver' },
  { id: 'GOLD', label: 'Gold' },
  { id: 'PLATINUM', label: 'Platinum' },
  { id: 'SERVICE', label: 'Layanan' }
];

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

  useEffect(() => {
    const tg = getTelegramWebApp();
    tg?.ready();
    tg?.expand();
    const load = async () => {
      try {
        const response = await fetch(`${API}/api/catalog`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Katalog tidak dapat dimuat.');
        const data = await response.json();
        setProducts(data.products || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = useMemo(() => products.filter((p) =>
    (category === 'ALL' || p.game_category === category)
    && (tier === 'ALL' || p.tier === tier)
    && `${p.name} ${p.description} ${p.sku}`.toLowerCase().includes(query.toLowerCase())
    && p.is_available
  ), [products, category, tier, query]);

  async function buy(product) {
    const initData = getInitData();
    if (!initData) {
      setNotice('Buka toko melalui bot Telegram untuk melakukan checkout.');
      return;
    }
    setBuyingId(product.id);
    setNotice('Menyiapkan invoice Telegram Stars…');
    try {
      const response = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Checkout gagal dibuat.');
      setNotice(`Invoice ${data.orderNumber} siap dibayar.`);
      openInvoice(data.invoiceUrl);
    } catch (e) { setNotice(e.message); }
    finally { setBuyingId(null); }
  }

  async function showOrders() {
    const initData = getInitData();
    if (!initData) { setNotice('Riwayat pesanan tersedia di dalam Telegram.'); return; }
    const response = await fetch(`${API}/api/orders/mine`, { headers: { 'x-telegram-init-data': initData } });
    const data = await response.json();
    if (!response.ok) { setNotice(data.message || 'Riwayat pesanan tidak dapat dimuat.'); return; }
    setOrders(data.orders || []);
    setOrdersOpen(true);
  }

  return <>
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Vault Core home">
          <span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span>
        </a>
        <button className="icon-button" onClick={showOrders} aria-label="Riwayat pesanan">▤</button>
      </header>

      <section className="hero" id="home">
        <div className="hero-glow" />
        <div className="eyebrow"><span className="pulse" /> DIGITAL GAMING STORE</div>
        <h1>Level up your<br/><span>gaming vault.</span></h1>
        <p>Koleksi digital, voucher, dan layanan pilihan. Checkout praktis langsung melalui Telegram.</p>
        <a className="hero-cta" href="#catalog">Jelajahi katalog <span>↗</span></a>
        <div className="hero-stats">
          <div><strong>4</strong><small>Kategori game</small></div>
          <div><strong>3</strong><small>Tier pilihan</small></div>
          <div><strong>24/7</strong><small>Order online</small></div>
        </div>
      </section>

      <section className="section" id="catalog">
        <div className="section-heading"><div><span className="eyebrow muted">PILIH FAVORITMU</span><h2>Game categories</h2></div><span className="section-count">04 GAMES</span></div>
        <div className="category-grid">
          {CATEGORIES.slice(1).map((item, i) => <button key={item.id} className={`category-card cat-${i} ${category === item.id ? 'selected' : ''}`} onClick={() => setCategory(category === item.id ? 'ALL' : item.id)}>
            <span className="cat-number">0{i + 1}</span><span className="cat-name">{item.label}</span><span className="cat-arrow">↗</span>
          </button>)}
        </div>
      </section>

      <section className="section product-section">
        <div className="section-heading"><div><span className="eyebrow muted">THE COLLECTION</span><h2>Featured assets</h2></div><span className="section-count">{filtered.length.toString().padStart(2, '0')} ITEMS</span></div>
        <div className="filters">
          {TIERS.map((item) => <button key={item.id} className={`filter-chip ${tier === item.id ? 'active' : ''}`} onClick={() => setTier(item.id)}>{item.label}</button>)}
        </div>
        <label className="searchbox"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk atau layanan…" /></label>
        {loading ? <div className="empty-state">Memuat katalog…</div> : error ? <div className="empty-state error">{error}</div> : filtered.length === 0 ? <div className="empty-state"><span className="empty-icon">◇</span><strong>Belum ada produk tersedia</strong><p>Produk akan muncul setelah owner mengaktifkan katalog dan menambahkan stok yang dapat dijual.</p></div> : <div className="product-grid">
          {filtered.map((product) => <article className="product-card" key={product.id}>
            <div className="product-top"><span className={`tier-label ${product.tier.toLowerCase()}`}>{product.tier}</span><span className="stock-label">{typeof product.display_stock === 'number' ? `Sisa ${product.display_stock}` : product.display_stock === 'IN_STOCK' ? 'Tersedia' : 'Ready'}</span></div>
            <div className="product-category">{product.game_category.replace('_', ' ')}</div>
            <h3>{product.name}</h3><p>{product.description}</p>
            <div className="product-bottom"><div><small>HARGA</small><strong>{product.sale_price_idr ? `Rp${Number(product.sale_price_idr).toLocaleString('id-ID')}` : `${product.sale_price_xtr} Stars`}</strong></div>
              <button className="buy-button" disabled={buyingId === product.id} onClick={() => buy(product)}>{buyingId === product.id ? '…' : 'Beli'}</button></div>
          </article>)}
        </div>}
      </section>

      <section className="trust-strip"><span>✦</span><div><strong>Secure Telegram checkout</strong><small>Pembayaran digital menggunakan invoice Telegram Stars resmi.</small></div></section>
      <footer className="footer"><a className="brand" href="#home"><span className="brand-mark">V</span><span>VAULT<span className="brand-light">CORE</span></span></a><small>© {new Date().getFullYear()} VAULT CORE. Digital gaming store.</small></footer>

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup">×</button></div>}
      {ordersOpen && <div className="modal-backdrop" onClick={() => setOrdersOpen(false)}><section className="orders-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><h2>Pesanan saya</h2><button className="icon-button" onClick={() => setOrdersOpen(false)}>×</button></div>{orders.length ? orders.map((order) => <div className="order-row" key={order.order_number}><div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString('id-ID')}</small></div><span className={`order-status ${order.status.toLowerCase()}`}>{order.status}</span></div>) : <p className="muted-text">Belum ada pesanan.</p>}</section></div>}
    </main>
  </>;
}
