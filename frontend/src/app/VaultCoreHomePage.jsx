'use client';

import { useEffect, useMemo, useState } from 'react';
import { WEB_ROUTES, catalogHref } from '../lib/routes.js';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const GAME_CARDS = [
  { code:'MLBB', label:'Mobile Legends', short:'MLBB', art:'/game-icons/mlbb.webp' },
  { code:'FF', label:'Free Fire', short:'Free Fire', art:'/game-icons/free-fire.webp' },
  { code:'ROBLOX', label:'Roblox', short:'Roblox', art:'/game-icons/roblox.webp' },
  { code:'GI', label:'Genshin Impact', short:'Genshin', art:'/game-icons/genshin-impact.webp' }
];
const ART_BY_CODE = {
  MLBB:'/game-icons/mlbb.webp',
  FF:'/game-icons/free-fire.webp',
  FREE_FIRE:'/game-icons/free-fire.webp',
  ROBLOX:'/game-icons/roblox.webp',
  GI:'/game-icons/genshin-impact.webp',
  GENSHIN:'/game-icons/genshin-impact.webp'
};
const formatXtr = (value) => Number(value || 0).toLocaleString('id-ID');
function getHomeProductAvailability(product) {
  const mode = String(product?.availability_mode || '').toUpperCase();
  const days = Number(product?.indent_deadline_days || 0);
  if (mode === 'INDEN' || mode === 'INDENT') {
    return Number.isSafeInteger(days) && days > 0 ? 'Inden ' + days + ' hari' : 'Inden';
  }
  return product?.is_available === true && product?.is_purchaseable === true ? 'Ready' : 'Belum tersedia';
}
function HomeSkeleton() {
  return (
    <div className="home-skeleton-grid" aria-label="Memuat katalog">
      {Array.from({length:4},(_,index)=><div className="vc-skeleton" key={index}/>)}
    </div>
  );
}

function SectionHeading({ eyebrow, title, href = WEB_ROUTES.catalog, action = 'Lihat semua' }) {
  return (
    <div className="vc-home-section-heading">
      <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>
      <a href={href}>{action}<b>›</b></a>
    </div>
  );
}

function ProductCard({ product }) {
  const price = Number(product.sale_price_xtr || 0);
  const original = Number(product.compare_at_price_xtr || product.original_price_xtr || 0);
  const hasComparePrice = Number.isSafeInteger(original) && Number.isSafeInteger(price) && original > price && price > 0;
  const discount = hasComparePrice ? Math.round(((original - price) / original) * 100) : 0;
  const availability = getHomeProductAvailability(product);
  const available = product.is_available === true && product.is_purchaseable === true ? 1 : 0;
  const statusLabel = availability.startsWith('Inden') ? 'INDEN' : available > 0 ? 'READY' : 'TIDAK TERSEDIA';
  const availabilityClass = (available > 0 ? ' is-ready' : '') + (availability.startsWith('Inden') ? ' is-indent' : '');
  const stockLabel = product.display_stock === 1
    ? "STOK TERAKHIR"
    : typeof product.display_stock === "number" && product.display_stock > 1
      ? formatXtr(product.display_stock) + " stok"
      : "Stok tersedia";
  const gold = String(product.tier || "").toUpperCase() === "GOLD";
  const href = catalogHref({ game: product.game_code, group: product.group || 'Akun', product: product.id });

  return (
    <a href={href} className={"product-card" + (gold ? " tier-gold" : "")}>
      <div className="product-art">
        <img src={product.image_url || ART_BY_CODE[product.game_code] || '/game-icons/mlbb.webp'} alt="" loading="lazy"/>
      </div>
      <span className={"product-availability-dot" + availabilityClass}><i/>{statusLabel}</span>
      {gold && <span className="tier-gold-label">GOLD · BEST VALUE</span>}
      <div className="product-copy">
        <small>{product.game} · {product.group}</small>
        <b>{product.name}</b>
        <div className="price small">
          {hasComparePrice && <><span className="discount">-{discount}%</span><del>{formatXtr(original)}</del>{" "}</>}
          <b>{formatXtr(price)} XTR</b>
        </div>
        <small className="product-stock-caption">{stockLabel}</small>
      </div>
    </a>
  );
}

function JokiCard({ variant }) {
  const readyCount = (Array.isArray(variant.skus) ? variant.skus : [])
    .filter((product) => product.is_available === true && product.is_purchaseable === true).length;
  const art = ART_BY_CODE[variant.game_code] || '/game-icons/mlbb.webp';
  const href = catalogHref({ game: variant.game_code, group: 'Jasa Joki' });

  return (
    <a className="home-joki-card" href={href}>
      <span className="home-joki-art">
        <img src={art} alt="" loading="lazy"/>
        <small>JOKI</small>
      </span>
      <span className="home-joki-copy">
        <small>{variant.game} · LAYANAN</small>
        <b>{variant.name}</b>
        <span className={"home-joki-status" + (readyCount ? " ready" : "")}>
          {readyCount ? "Ready · " + readyCount + " layanan" : "Belum tersedia"}
        </span>
      </span>
    </a>
  );
}

export default function VaultCoreHomePage() {
  const [variants,setVariants] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(API + "/api/catalog/v4/variants",{cache:"no-store"})
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Katalog belum dapat dimuat.");
        return Array.isArray(data.variants) ? data.variants : [];
      })
      .then((data) => { if (alive) setVariants(data); })
      .catch((cause) => { if (alive) setError(cause.message || "Katalog belum dapat dimuat."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  },[]);

  const services = useMemo(
    () => variants.filter((variant) => variant.category === "Jasa Joki"),
    [variants]
  );
  const availableProducts = useMemo(() => variants.flatMap((variant) =>
    (variant.skus || [])
      .filter((product) => product.is_available === true && product.is_purchaseable === true)
      .map((product) => ({...product,game_code:variant.game_code,game:variant.game,group:variant.category}))
  ),[variants]);
  const recommendedAccounts = availableProducts
    .filter((product) => product.group === "Akun")
    .slice(0,2);
  const jokiByGame = ["MLBB","FF","ROBLOX","GI"]
    .map((code) => services.find((variant) => variant.game_code === code))
    .filter(Boolean);

  return (
    <main className="vc-home home-v3">
      <header className="vc-home-header">
        <a href={WEB_ROUTES.home} className="vc-home-brand" aria-label="VAULT CORE Home">
          <img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/>
        </a>
        <div className="vc-home-header-actions">
          <a href={WEB_ROUTES.catalog} className="vc-home-search-shortcut" aria-label="Cari produk">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
          </a>
          <a href={WEB_ROUTES.orders} className="vc-home-notification" aria-label="My Orders">
            <svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
          </a>
          <a href={WEB_ROUTES.account} className="vc-home-profile" aria-label="Profile">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-3.4 3.2-5.2 7.5-5.2s6.7 1.8 7.5 5.2"/></svg>
          </a>
        </div>
      </header>

      <form className="vc-home-search home-search" action={WEB_ROUTES.catalog} method="get" role="search">
        <span aria-hidden="true">⌕</span>
        <input type="search" name="q" placeholder="Cari akun game atau layanan joki..." aria-label="Cari produk" autoComplete="off"/>
        <button type="submit" aria-label="Cari">›</button>
      </form>

      <section className="home-promo promo-board" aria-label="Papan promo VAULT CORE">
        <div className="home-promo-copy vc-home-promo-copy">
          <small><i/>PAPAN PROMO · VAULT CORE</small>
          <h1>Temukan akun game <em>&amp; layanan joki</em></h1>
          <p>Telusuri katalog empat game pilihan.</p>
          <div className="home-promo-tags">
            <span>AKUN GAME</span><span>JOKI</span><span>4 GAME</span>
          </div>
          <a href={WEB_ROUTES.catalog}>Jelajahi Store <b>↗</b></a>
        </div>
        <div className="vc-home-promo-visual" aria-hidden="true">
          <picture>
            <source media="(prefers-reduced-motion: no-preference)" srcSet="/assets/02-hero/hero-vaultcore-loop.webp" type="image/webp"/>
            <img src="/assets/02-hero/hero-vaultcore.jpg" alt=""/>
          </picture>
          <span>VAULT CORE · DIGITAL STORE</span>
        </div>
      </section>

      <section className="vc-home-section" id="categories">
        <SectionHeading title="Kategori Game" href={WEB_ROUTES.catalog} action="Lihat Semua"/>
        <div className="vc-home-games">
          {GAME_CARDS.map((game) => (
            <a className="vc-home-game" href={catalogHref({ game: game.code })} key={game.code}>
              <span><img src={game.art} alt="" loading="lazy"/></span>
              <strong>{game.short}</strong>
              <small>{game.label}</small>
            </a>
          ))}
        </div>
      </section>

      <div className="vc-home-quick-filters home-group-tabs" aria-label="Jenis produk">
        <a className="is-selected" href={WEB_ROUTES.catalog}>Semua</a>
        <a href={catalogHref({ group: "Akun" })}>Akun</a>
        <a href={catalogHref({ group: "Jasa Joki" })}>Joki</a>
      </div>

      {loading ? (
        <HomeSkeleton/>
      ) : (
        <>
          <section className="vc-home-section">
            <SectionHeading title="Pilihan Akun" href={catalogHref({ group: "Akun" })} action="Lihat Semua"/>
            {recommendedAccounts.length ? (
              <div className="home-featured-grid">
                {recommendedAccounts.map((product) => <ProductCard product={product} key={product.id}/>)}
              </div>
            ) : (
              <div className="vc-home-empty">
                <strong>{error ? "Katalog belum dapat dimuat" : "Belum ada akun yang siap dipesan pada katalog publik."}</strong>
                <span>{error || "Akun yang dapat dipesan akan muncul setelah status dan stok backend memenuhi syarat."}</span>
                <a href={catalogHref({ group: "Akun" })}>Lihat kategori akun <b>↗</b></a>
              </div>
            )}
          </section>

          <section className="vc-home-section">
            <SectionHeading title="Layanan Joki" href={catalogHref({ group: "Jasa Joki" })} action="Lihat Kategori"/>
            {jokiByGame.length ? (
              <div className="home-joki-grid">
                {jokiByGame.map((variant) => <JokiCard variant={variant} key={variant.variant_id}/>)}
              </div>
            ) : (
              <div className="vc-home-empty">
                <strong>Layanan Joki belum tersedia</strong>
                <span>{error || "Kategori layanan Joki belum dapat dimuat."}</span>
              </div>
            )}
          </section>
        </>
      )}

      <section className="vc-home-section">
        <SectionHeading title="Aktivitas Pesanan" href={WEB_ROUTES.orders} action="My Orders"/>
        <a className="vc-home-activity" href={WEB_ROUTES.orders} aria-label="Buka My Orders">
          <span className="ic">▤</span>
          <div><b>Riwayat pesanan pribadi</b><small>Status dan detail pesanan tampil pada akun pelanggan terverifikasi.</small></div>
          <span className="home-activity-arrow">›</span>
        </a>
      </section>

      <section className="vc-home-section">
        <SectionHeading title="Keunggulan VAULT CORE"/>
        <div className="home-benefits">
          <div><span className="ic">◇</span><b>Transaksi Terpantau</b><small>Riwayat dan status pada akun pelanggan.</small></div>
          <div><span className="ic">☏</span><b>Pusat Bantuan</b><small>Dukungan melalui kanal resmi VAULT CORE.</small></div>
        </div>
      </section>
    </main>
  );
}
