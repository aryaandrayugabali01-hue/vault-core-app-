'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const GAMES = [
  {id:'MLBB',name:'Mobile Legends',short:'MLBB',mark:'⚔',image:'/assets/03-categories/category-mlbb.png',desc:'Akun, top up, skin, dan layanan'},
  {id:'ROBLOX',name:'Roblox',short:'ROBLOX',mark:'R',image:'/assets/03-categories/category-roblox.png',desc:'Robux, akun, dan item pilihan'},
  {id:'FREE_FIRE',name:'Free Fire',short:'FREE FIRE',mark:'◎',image:'/assets/03-categories/category-free-fire.png',desc:'Akun, diamond, dan item game'},
  {id:'GENSHIN',name:'Genshin Impact',short:'GENSHIN',mark:'✧',image:'/assets/03-categories/category-genshin.png',desc:'Akun, crystal, dan layanan'}
];

export default function DashboardPage(){
  const [products,setProducts]=useState([]);
  const [categories,setCategories]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    fetch(API+'/api/catalog',{cache:'no-store'}).then(async r=>{
      const data=await r.json();
      if(!r.ok) throw new Error(data.message||'Katalog belum dapat dimuat');
      if(active){setProducts(data.products||[]);setCategories(data.categories||[]);}
    }).catch(()=>{}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const activeProducts=products.filter(p=>p.is_available!==false);
  const newest=[...activeProducts].slice(0,4);
  return <main className="dashboard-shell">
    <header className="dashboard-topbar">
      <a className="dashboard-brand" href="/" aria-label="VAULT CORE Dashboard"><img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/></a>
      <a className="dashboard-catalog-link" href="/catalog"><span>Jelajahi katalog</span><b>↗</b></a>
    </header>
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <span className="dashboard-eyebrow"><i/> VAULT CORE DIGITAL STORE</span>
        <h1>Semua kebutuhan gaming, <span>dalam satu tempat.</span></h1>
        <p>Temukan produk digital dan layanan gaming pilihan. Periksa detail, stok, serta panduan sebelum melanjutkan pembayaran Telegram Stars.</p>
        <div className="dashboard-hero-actions">
          <a href="/catalog" className="dashboard-primary-cta">Jelajahi Katalog <span>↗</span></a>
          <span className="dashboard-payment-note">Pembayaran Telegram Stars · XTR</span>
        </div>
      </div>
      <div className="dashboard-hero-art"><div className="dashboard-art-glow"/><img src="/assets/02-hero/hero-vaultcore.webp" alt="VAULT CORE gaming store"/></div>
      <div className="dashboard-hero-orbit" aria-hidden="true"/>
    </section>
    <section className="dashboard-overview">
      <div className="dashboard-overview-title"><span className="dashboard-eyebrow">RINGKASAN STORE</span><h2>Mulai dari pilihan game favorit</h2><p>Pilih salah satu game untuk melihat penawaran yang tersedia.</p></div>
      <div className="dashboard-stat-grid">
        <div><span>Produk tersedia</span><strong>{loading?'—':activeProducts.length.toLocaleString('id-ID')}</strong><small>Penawaran aktif di katalog</small></div>
        <div><span>Kategori produk</span><strong>{loading?'—':categories.length.toLocaleString('id-ID')}</strong><small>Kategori yang dikelola Owner</small></div>
        <div><span>Game utama</span><strong>04</strong><small>Empat ekosistem gaming</small></div>
      </div>
    </section>
    <section className="dashboard-games">
      <div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">PILIH GAME</span><h2>Kategori game</h2></div><a href="/catalog">Lihat semua <span>↗</span></a></div>
      <div className="dashboard-game-grid">
        {GAMES.map(game=>{
          const count=activeProducts.filter(p=>p.game_category===game.id).length;
          return <a className="dashboard-game-card" href="/catalog" key={game.id}>
            <div className="dashboard-game-art"><img src={game.image} alt="" loading="lazy"/><span>{game.mark}</span></div>
            <div className="dashboard-game-copy"><strong>{game.name}</strong><small>{game.desc}</small><span>{loading?'Memuat…':count+' produk tersedia'} <b>↗</b></span></div>
          </a>;
        })}
      </div>
    </section>
    <section className="dashboard-featured">
      <div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">PENAWARAN TERBARU</span><h2>Produk pilihan</h2></div><a href="/catalog">Buka katalog <span>↗</span></a></div>
      {loading?<div className="dashboard-product-placeholder">Memuat penawaran katalog…</div>:newest.length?<div className="dashboard-featured-grid">{newest.map(p=><a className="dashboard-featured-card" href="/catalog" key={p.id}><img src={p.image_url||GAMES.find(g=>g.id===p.game_category)?.image||'/assets/03-categories/category-other.png'} alt="" loading="lazy"/><div><small>{p.marketplace_category_name||p.game_category}</small><strong>{p.name}</strong><b>{Number(p.sale_price_xtr||0).toLocaleString('en-US')} XTR</b></div></a>)}</div>:<div className="dashboard-product-placeholder">Belum ada produk aktif. Penawaran akan tampil setelah Owner mengaktifkannya.</div>}
    </section>
    <section className="dashboard-trust">
      <div><span>✦</span><strong>Pembayaran Telegram Stars</strong><small>Invoice resmi dalam XTR</small></div>
      <div><span>◈</span><strong>Stok aktual</strong><small>Diperiksa ulang saat checkout</small></div>
      <div><span>✓</span><strong>Transaksi terpantau</strong><small>Status pesanan dapat dipantau</small></div>
    </section>
    <footer className="dashboard-footer"><img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/><span>© {new Date().getFullYear()} VAULT CORE · Digital Gaming Store</span></footer>
    <nav className="dashboard-bottom-nav"><a className="active" href="/">⌂ <span>Dashboard</span></a><a href="/catalog">▦ <span>Katalog</span></a><a href="/catalog#categories">◇ <span>Kategori</span></a><a href="/admin">▤ <span>Owner</span></a></nav>
  </main>;
}
