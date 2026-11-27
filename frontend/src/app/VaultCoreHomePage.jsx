'use client';

import { useEffect, useMemo, useState } from 'react';
import { GAME_ART } from '../lib/marketplace.js';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const GAME_CARDS = [
  { code:'MLBB', label:'Mobile Legends', short:'MLBB', art:GAME_ART.MLBB },
  { code:'FF', label:'Free Fire', short:'Free Fire', art:GAME_ART.FREE_FIRE },
  { code:'ROBLOX', label:'Roblox', short:'Roblox', art:GAME_ART.ROBLOX },
  { code:'GI', label:'Genshin Impact', short:'Genshin', art:GAME_ART.GENSHIN }
];
const ART_BY_CODE = { MLBB:GAME_ART.MLBB, FF:GAME_ART.FREE_FIRE, ROBLOX:GAME_ART.ROBLOX, GI:GAME_ART.GENSHIN };
const formatXtr = (value) => Number(value || 0).toLocaleString('id-ID');
function getHomeProductAvailability(product) {
  const entries = Object.entries(product?.attributes || {});
  const normalizeKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
  const read = (keys) => {
    const found = entries.find(([key]) => keys.includes(normalizeKey(key)));
    return found ? String(found[1] ?? '').trim() : '';
  };
  const kind = String(product?.availability_mode || read(['availabilitystatus','availabilitytype','stocktype','ketersediaan'])).toUpperCase();
  const days = Number(product?.indent_deadline_days || read(['indentdays','indentdaycount','jumlahhariindent','durasiindent']));
  if (kind === 'INDEN' || kind === 'INDENT') {
    return Number.isSafeInteger(days) && days > 0 ? 'Inden ' + days + ' hari' : 'Inden';
  }
  return product?.is_available === true ? 'Ready' : 'Belum tersedia';
}

function HomeSkeleton() {
  return (
    <div className="vc-home-skeleton" aria-label="Memuat katalog">
      <div className="vc-skeleton vc-home-skeleton-hero"/>
      <div className="vc-home-skeleton-games">{GAME_CARDS.map((game) => <div className="vc-skeleton" key={game.code}/>)}</div>
      <div className="vc-home-skeleton-grid">{Array.from({length:4},(_,i)=><div className="vc-skeleton" key={i}/>)}</div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, href = '/catalog', action = 'Lihat semua' }) {
  return (
    <div className="vc-home-section-heading">
      <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>
      <a href={href}>{action}<b>›</b></a>
    </div>
  );
}

function VariantCard({ variant }) {
  const gameCode = variant.game_code;
  const products = Array.isArray(variant.skus) ? variant.skus : [];
  const readyProducts = products.filter((product) => product.is_available === true);
  const indentProducts = products.filter((product) => ['INDEN','INDENT'].includes(String(product.availability_mode || '').toUpperCase()));
  const available = readyProducts.length;
  const eta = products.find((product) => product.fulfillment_eta)?.fulfillment_eta;
  const indentDays = indentProducts.find((product) => Number(product.indent_deadline_days) > 0)?.indent_deadline_days;
  const isJoki = variant.category === 'Jasa Joki';
  const query = new URLSearchParams({ game:gameCode, group:variant.category }).toString();
  const status = available ? 'Ready · ' + available + ' tersedia' : indentProducts.length ? 'Inden' + (indentDays ? ' · ' + indentDays + ' hari' : '') : 'Belum tersedia';
  return (
    <a className={'vc-home-variant-card' + (isJoki ? ' is-service' : '')} href={'/catalog?' + query}>
      <span className="vc-home-variant-art">
        <img src={ART_BY_CODE[gameCode] || GAME_ART.MLBB} alt="" loading="lazy"/>
        <small>{isJoki ? 'LAYANAN JOKI' : 'AKUN GAME'}</small>
      </span>
      <span className="vc-home-variant-copy">
        <span className="vc-home-eyebrow">{variant.game}</span>
        <strong>{variant.name}</strong>
        <small>{isJoki ? (eta ? 'Estimasi: ' + eta : 'Detail dan estimasi mengikuti listing layanan') : 'Periksa spesifikasi dan status akun'}</small>
        <span className={'vc-home-status' + (ready ? ' is-ready' : '')}>{status}</span>
      </span>
      <span className="vc-home-arrow">↗</span>
    </a>
  );
}

function ProductCard({ product }) {
  const price = Number(product.sale_price_xtr || 0);
  const availability = getHomeProductAvailability(product);
  const statusClass = availability === 'Ready' ? 'is-ready' : availability.startsWith('Inden') ? 'is-indent' : 'is-unavailable';
  const statusLabel = availability === 'Ready' ? 'Ready' : availability.startsWith('Inden') ? 'Pending' : 'Habis';
  return (
    <a href={'/catalog?game=' + encodeURIComponent(product.game_code) + '&group=' + encodeURIComponent(product.group || 'Akun') + '&product=' + encodeURIComponent(product.id)} className={'vc-home-product-card' + (String(product.tier || '').toUpperCase()==='GOLD' ? ' vc-tier-gold' : '')}>
      <div className="vc-home-product-art">
        <img src={product.image_url || ART_BY_CODE[product.game_code] || GAME_ART.MLBB} alt="" loading="lazy"/>
        <span className={'vc-home-stock-dot '+statusClass}><i/>{statusLabel}</span>
        {String(product.tier || '').toUpperCase()==='GOLD' && <span className="vc-home-best-value">GOLD · BEST VALUE</span>}
      </div>
      <div className="vc-home-product-copy">
        <small>{product.game} · {product.group}</small>
        <strong>{product.name}</strong>
        <span className="vc-home-price">{formatXtr(price)} XTR</span>
      </div>
    </a>
  );
}

export default function VaultCoreHomePage() {
  const [variants,setVariants] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(API + '/api/catalog/v4/variants',{cache:'no-store'})
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Katalog belum dapat dimuat.');
        return Array.isArray(data.variants) ? data.variants : [];
      })
      .then((data) => { if (alive) setVariants(data); })
      .catch((cause) => { if (alive) setError(cause.message || 'Katalog belum dapat dimuat.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  },[]);

  const accountVariants = useMemo(() => variants.filter((variant) => variant.category === 'Akun' && (variant.skus || []).length>0),[variants]);
  const jokiVariants = useMemo(() => variants.filter((variant) => variant.category === 'Jasa Joki' && (variant.skus || []).length>0),[variants]);
  const availableGroups = useMemo(() => ['Akun','Jasa Joki'].filter((category) => variants.some((variant) => variant.category===category && (variant.skus||[]).length>0)),[variants]);
  const availableProducts = useMemo(() => variants.flatMap((variant) =>
    (variant.skus || [])
      .filter((product) => product.is_available === true && product.is_purchaseable === true)
      .map((product) => ({...product,game_code:variant.game_code,game:variant.game,group:variant.category}))
  ),[variants]);

  return (
    <main className="vc-home">
      <header className="vc-home-header">
        <a href="/" className="vc-home-brand" aria-label="VAULT CORE Home">
          <img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/>
        </a>
        <div className="vc-home-header-actions">
          <a href="/catalog#transactions" className="vc-home-notification" aria-label="My Orders">
            <svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
          </a>
          <a href="/account" className="vc-home-profile" aria-label="Profile">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-3.4 3.2-5.2 7.5-5.2s6.7 1.8 7.5 5.2"/></svg>
          </a>
        </div>
      </header>

      <form className="vc-home-search" action="/catalog" method="get" role="search">
        <span aria-hidden="true">⌕</span>
        <input type="search" name="q" placeholder="Cari akun game atau layanan joki..." aria-label="Cari produk"/>
        <button type="submit" aria-label="Cari">→</button>
      </form>

      <section className="vc-home-promo" aria-label="Papan promo VAULT CORE">
        <div className="vc-home-promo-copy">
          <span className="vc-promo-kicker"><i/> PAPAN PROMO · VAULT CORE</span>
          <h1>Temukan akun game <em>& layanan joki</em></h1>
          <p>Telusuri katalog Mobile Legends, Free Fire, Roblox, dan Genshin Impact.</p>
          <div className="vc-home-promo-tags"><span>AKUN GAME</span><span>JOKI</span><span>4 GAME</span></div>
          <a href="/catalog">Jelajahi Store <b>↗</b></a>
        </div>
        <aside className="vc-home-promo-board" aria-hidden="true">
          <div className="vc-home-promo-board-head"><b>FEATURED</b><small>VAULT CORE / STORE</small></div>
          <div className="vc-home-promo-board-grid">
            {GAME_CARDS.map((game) => <span key={game.code}><img src={game.art} alt=""/><i>{game.short}</i></span>)}
          </div>
          <div className="vc-home-promo-board-foot"><span>DISCOVER</span><span>PLAY</span></div>
        </aside>
      </section>

      <section className="vc-home-section" id="categories">
        <SectionHeading eyebrow="PILIH GAME" title="Kategori Game"/>
        <div className="vc-home-games">
          {GAME_CARDS.map((game) => (
            <a className="vc-home-game" href={'/catalog?game=' + game.code} key={game.code}>
              <span><img src={game.art} alt="" loading="lazy"/></span>
              <strong>{game.short}</strong>
              <small>{game.label}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="vc-home-quick-filters" aria-label="Jenis produk">
        <a className="is-selected" href="/catalog">Semua</a>
        {availableGroups.map((category)=><a href={'/catalog?group='+encodeURIComponent(category)} key={category}>{category==='Jasa Joki'?'Joki':category}</a>)}
      </section>

      {loading ? <HomeSkeleton/> : (
        <>
          <section className="vc-home-section">
            <SectionHeading eyebrow="KATALOG TERSEDIA" title="Pilihan Akun" href="/catalog?group=Akun"/>
            {availableProducts.filter((product) => product.group === 'Akun').length
              ? <div className="vc-home-products">{availableProducts.filter((product) => product.group === 'Akun').slice(0,4).map((product) => <ProductCard product={product} key={product.id}/>)}</div>
              : <div className="vc-home-empty"><strong>{error ? 'Katalog belum dapat dimuat' : 'Akun pilihan sedang disiapkan'}</strong><span>{error || 'Varian dan spesifikasi tersedia di Store. Produk yang dapat dipesan akan muncul setelah status dan stok backend memenuhi syarat.'}</span><a href="/catalog?group=Akun">Lihat kategori akun <b>↗</b></a></div>}
          </section>

          <section className="vc-home-section">
            <SectionHeading eyebrow="EMPAT GAME" title="Kategori Akun" href="/catalog?group=Akun"/>
            <div className="vc-home-variant-list">
              {accountVariants.map((variant) => <VariantCard variant={variant} key={variant.variant_id}/>)}
              {!accountVariants.length && <div className="vc-home-empty"><strong>Varian akun belum dapat dimuat</strong><span>{error || 'Coba periksa kembali katalog.'}</span></div>}
            </div>
          </section>

          {jokiVariants.length>0&&<section className="vc-home-section">
            <SectionHeading eyebrow="LAYANAN GAME" title="Layanan Joki" href="/catalog?group=Jasa%20Joki"/>
            <div className="vc-home-variant-list">
              {jokiVariants.map((variant) => <VariantCard variant={variant} key={variant.variant_id}/>)}
            </div>
          </section>}
        </>
      )}

      <section className="vc-home-section">
        <SectionHeading eyebrow="PENGELOLAAN PESANAN" title="Aktivitas Pesanan" href="/catalog#transactions" action="My Orders"/>
        <a className="vc-home-activity" href="/catalog#transactions" aria-label="Buka My Orders">
          <span className="vc-home-activity-icon">▤</span>
          <div><strong>Riwayat pesanan pribadi</strong><small>Status pembayaran dan pemenuhan ditampilkan pada akun pelanggan.</small></div>
          <span className="vc-home-activity-arrow" aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="vc-home-section">
        <SectionHeading eyebrow="VAULT CORE" title="Keunggulan Layanan"/>
        <div className="vc-home-benefits">
          <article><span>◇</span><strong>Katalog Terpusat</strong><small>Data produk dan ketersediaan dari backend.</small></article>
          <article><span>⌁</span><strong>Pesanan Terpantau</strong><small>Riwayat dan status pada akun pelanggan.</small></article>
          <article><span>◈</span><strong>Informasi Transparan</strong><small>Spesifikasi dan ketentuan tampil pada detail.</small></article>
          <article><span>☏</span><strong>Pusat Bantuan</strong><small>Dukungan mengikuti kanal bantuan VAULT CORE.</small></article>
        </div>
      </section>
    </main>
  );
}
