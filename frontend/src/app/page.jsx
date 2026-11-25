'use client';
import {useEffect,useMemo,useState} from 'react';
import {GAME_ORDER,GAME_NAMES,GAME_ART,GAME_BACKGROUNDS} from '../lib/marketplace.js';
import {getInitData,getTelegramWebApp} from '../lib/telegram.js';
import { StoreHeader, StoreBottomNav, NavigationIcon } from '../components/store-navigation.jsx';

const API=process.env.NEXT_PUBLIC_API_BASE_URL||'';
const ORDER_STATUS={PENDING_PAYMENT:'Menunggu pembayaran',PAID:'Pembayaran diterima',FULFILLING:'Sedang diproses',FULFILLED:'Selesai',CANCELLED:'Dibatalkan',REFUND_PENDING:'Refund diproses',REFUNDED:'Refund selesai',FAILED:'Pesanan gagal'};
const gameLabel=(id)=>GAME_NAMES[id]||id||'Game';
const formatXtr=(value)=>Number(value||0).toLocaleString('id-ID')+' XTR';
const formatOrderDate=(value)=>{if(!value)return'Tanggal belum tersedia';const date=new Date(value);return Number.isNaN(date.getTime())?'Tanggal belum tersedia':date.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});};

function ProductCard({product}){
  const game=product.game_category;
  const background=GAME_BACKGROUNDS[game]||GAME_BACKGROUNDS.MLBB;
  const logo=GAME_ART[game]||GAME_ART.MLBB;
  const inStock=product.is_available===true&&product.is_purchaseable===true;
  const style={'--product-background':'url("'+(product.image_url||background)+'")'};
  const detailUrl='/catalog?q='+encodeURIComponent(product.name||'')+'#products';
  return <article className="dashboard-product-card">
    <div className="dashboard-product-media" style={style}>
      {product.image_url?<img src={product.image_url} alt={product.name||gameLabel(game)} loading="lazy"/>:<img className="dashboard-product-mark product-category-logo" src={logo} alt={gameLabel(game)+' logo'} loading="lazy"/>}
      <div className="dashboard-product-badges"><span>Akun Game</span><span className={inStock?'':'out'}>{inStock?'Stok tersedia':'Stok habis'}</span></div>
    </div>
    <div className="dashboard-product-body">
      <span className="dashboard-product-category">{gameLabel(game)} · Akun</span>
      <h3>{product.name}</h3>
      <div className="dashboard-product-price"><small>HARGA JUAL</small><strong>{formatXtr(product.sale_price_xtr)}</strong></div>
      <a className={'dashboard-product-cta'+(inStock?'':' sold')} href={detailUrl}>{inStock?'Detail & Beli':'Lihat detail'}</a>
    </div>
  </article>;
}

function SectionHeading({eyebrow,title,subtitle,href='/catalog',linkLabel='Lihat semua ↗',count}){
  return <div className="dashboard-section-heading"><div>{eyebrow&&<span className="dashboard-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{subtitle&&<p className="dashboard-section-subtitle">{subtitle}</p>}</div><a href={href}>{count||linkLabel}</a></div>;
}

export default function DashboardPage(){
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [telegramContext,setTelegramContext]=useState(false);
  const [orders,setOrders]=useState([]);
  const [ordersLoading,setOrdersLoading]=useState(false);
  const [ordersError,setOrdersError]=useState('');
  const [orderFilter,setOrderFilter]=useState('ALL');

  useEffect(()=>{
    let active=true;
    const telegram=getTelegramWebApp();
    const initData=getInitData();
    const isMiniApp=Boolean(initData);
    setTelegramContext(isMiniApp);
    try{telegram?.ready?.();telegram?.expand?.();}catch{}
    fetch(API+'/api/catalog',{cache:'no-store'})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||'Katalog belum dapat dimuat.');if(active){setProducts(Array.isArray(data.products)?data.products:[]);setLoadError('');}})
      .catch(error=>{if(active)setLoadError(error.message||'Koneksi katalog belum tersedia.');})
      .finally(()=>{if(active)setLoading(false);});
    if(isMiniApp){
      setOrdersLoading(true);
      fetch(API+'/api/orders/mine',{headers:{'x-telegram-init-data':initData},cache:'no-store'})
        .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||'Riwayat pesanan belum dapat dimuat.');if(active){setOrders(Array.isArray(data.orders)?data.orders:[]);setOrdersError('');}})
        .catch(error=>{if(active)setOrdersError(error.message||'Riwayat pesanan belum dapat dimuat.');})
        .finally(()=>{if(active)setOrdersLoading(false);});
    }
    return()=>{active=false;};
  },[]);

  const accountProducts=useMemo(()=>{
    const source=products.filter(p=>!p.is_test&&p.is_purchaseable===true&&p.fulfillment_type==='GAME_ACCOUNT_TRANSFER'&&GAME_ORDER.includes(p.game_category));
    return GAME_ORDER.flatMap(game=>source.filter(p=>p.game_category===game).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'id')));
  },[products]);
  const featuredProducts=useMemo(()=>GAME_ORDER.map(game=>accountProducts.find(p=>p.game_category===game)).filter(Boolean),[accountProducts]);
  const recommendedProducts=accountProducts.slice(0,10);
  const bestTodayProducts=[...accountProducts].sort((a,b)=>{
    const stockPriority=Number(b.is_available===true)-Number(a.is_available===true);
    const detailsPriority=Object.keys(b.attributes||{}).length-Object.keys(a.attributes||{}).length;
    return stockPriority||detailsPriority||Number(a.sale_price_xtr)-Number(b.sale_price_xtr);
  }).slice(0,10);
  const cheapestProducts=[...accountProducts].sort((a,b)=>Number(a.sale_price_xtr)-Number(b.sale_price_xtr)).slice(0,10);

  const statusGroups=[
    {id:'ALL',label:'Semua',match:()=>true},
    {id:'PENDING',label:'Menunggu',match:o=>o.status==='PENDING_PAYMENT'},
    {id:'PROCESSING',label:'Diproses',match:o=>['PAID','FULFILLING'].includes(o.status)},
    {id:'DONE',label:'Selesai',match:o=>o.status==='FULFILLED'}
  ];
  const activeGroup=statusGroups.find(g=>g.id===orderFilter)||statusGroups[0];
  const filteredOrders=orders.filter(activeGroup.match);
  const groupCount=group=>orders.filter(group.match).length;
  const gameCards=GAME_ORDER.map(id=>({id,name:gameLabel(id),image:GAME_ART[id],count:accountProducts.filter(p=>p.game_category===id).length}));
  const gameBackgrounds=Object.fromEntries(gameCards.map(g=>[g.id,GAME_BACKGROUNDS[g.id]||GAME_BACKGROUNDS.MLBB]));
  const collections=[
    {id:'for-you',title:'Pilihan untukmu',icon:'✦',subtitle:'Rekomendasi akun dari seluruh game.',products:recommendedProducts},
    {id:'best-today',title:'Terbaik Hari Ini',icon:'🔥',subtitle:'Produk tersedia dengan spesifikasi paling lengkap.',products:bestTodayProducts},
    {id:'cheapest',title:'Dijamin Paling Murah',icon:'◆',subtitle:'Diurutkan dari harga XTR terendah pada katalog aktif.',products:cheapestProducts}
  ];

  return <main className="dashboard-shell">
    <StoreHeader rightSlot={<>
      <a className="dashboard-icon-button" href={telegramContext?'#transactions':'/catalog'} aria-label="Notifikasi dan pesanan" title="Notifikasi dan pesanan"><NavigationIcon name="bell"/></a>
      <a className="dashboard-icon-button" href="/catalog" aria-label="Buka katalog" title="Buka katalog"><NavigationIcon name="cart"/></a>
      <a className="dashboard-icon-button" href="/admin" aria-label="Portal Owner" title="Portal Owner"><NavigationIcon name="user"/></a>
    </>}/>

    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <span className="dashboard-eyebrow"><i/> VAULT CORE DIGITAL STORE</span>
        <h1>Marketplace akun game, <span>dalam satu tempat.</span></h1>
        <p>Temukan akun game Mobile Legends, Free Fire, Roblox, dan Genshin Impact. Periksa spesifikasi, stok, serta ketentuan sebelum membayar dengan Telegram Stars.</p>
        <div className="dashboard-hero-actions"><a href="/catalog" className="dashboard-primary-cta">Jelajahi Katalog <span>↗</span></a><span className="dashboard-payment-note">Pembayaran Telegram Stars · XTR</span></div>
        <div className="dashboard-hero-trust"><span><img src="/assets/06-icons/icon-shield.svg" alt="" loading="lazy"/> Transaksi Aman</span><span><img src="/assets/06-icons/icon-orders.svg" alt="" loading="lazy"/> Proses Cepat</span><span><img src="/assets/06-icons/icon-wallet.svg" alt="" loading="lazy"/> Pembayaran Telegram Stars (XTR)</span></div>
      </div>
    </section>

    <section className="dashboard-overview" aria-labelledby="dashboard-overview-title">
      <div className="dashboard-overview-title"><span className="dashboard-eyebrow">RINGKASAN STORE</span><h2 id="dashboard-overview-title">Mulai dari game favorit</h2><p>Pilihan akun terbaik dengan proses aman dan cepat.</p></div>
      <div className="dashboard-stat-grid">
        <div><span>Produk akun aktif</span><strong>{loading?'—':accountProducts.length.toLocaleString('id-ID')}</strong><small>Produk yang lolos pemeriksaan katalog</small></div>
        <div><span>Subkategori</span><strong>04</strong><small>Satu subkategori Akun per game</small></div>
        <div><span>Game tersedia</span><strong>04</strong><small>MLBB · Free Fire · Roblox · Genshin</small></div>
      </div>
    </section>

    <section className="dashboard-games" id="categories">
      <SectionHeading eyebrow="PILIH GAME" title="Game dan subkategori Akun" href="/catalog#categories"/>
      <div className="dashboard-game-grid">
        {loading?<div className="dashboard-product-placeholder">Memuat kategori game…</div>:gameCards.map(game=><a className="dashboard-game-card" href={game.id==='MLBB'?'/catalog/mlbb-akun':'/catalog'} key={game.id}>
          <div className="dashboard-game-art" style={{'--game-background':'url("'+gameBackgrounds[game.id]+'")'}}><img src={game.image} alt={game.name+' logo'} loading="lazy"/></div>
          <div className="dashboard-game-copy"><strong>{game.name}</strong><small>Subkategori Akun</small><span>{game.count?game.count+' akun terdaftar':'Akun segera tersedia'} <b>↗</b></span></div>
        </a>)}
      </div>
    </section>

    <section className="dashboard-featured" id="featured">
      <SectionHeading eyebrow="KATALOG PILIHAN" title="Katalog Pilihan" subtitle="Rekomendasi akun pilihan dari empat game." href="/catalog" linkLabel="Lihat katalog ↗"/>
      {loading?<div className="dashboard-product-placeholder">Memuat produk pilihan…</div>:loadError?<div className="dashboard-product-placeholder">{loadError} <a href="/catalog">Buka katalog ↗</a></div>:featuredProducts.length?<div className="dashboard-featured-grid">{featuredProducts.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<div className="dashboard-product-placeholder">Belum ada produk akun yang siap ditampilkan. Periksa kembali katalog nanti.</div>}
    </section>

    {collections.map(collection=><section className="dashboard-collection" id={collection.id} key={collection.id}>
      <SectionHeading eyebrow="KOLEKSI KATALOG" title={collection.icon+' '+collection.title} subtitle={collection.subtitle} href="/catalog" count={collection.products.length+' Produk'}/>
      {loading?<div className="dashboard-product-placeholder">Memuat koleksi produk…</div>:loadError?<div className="dashboard-product-placeholder">{loadError}</div>:collection.products.length?<div className="dashboard-product-grid">{collection.products.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<div className="dashboard-product-placeholder">Belum ada produk aktif untuk koleksi ini.</div>}
    </section>)}

    <section className="dashboard-guides" id="guides">
      <SectionHeading eyebrow="NAIKKAN PENGETAHUANMU" title="Tips & Panduan Mobile Legends Bang Bang" href="/catalog" linkLabel="Lihat katalog ↗"/>
      <div className="dashboard-guides-grid">
        <article className="dashboard-guide-card">
          <div className="dashboard-guide-art" style={{backgroundImage:'linear-gradient(180deg,rgba(4,10,22,.04),rgba(4,10,22,.45)),url("'+GAME_BACKGROUNDS.MLBB+'")'}}/>
          <div className="dashboard-guide-body"><span className="dashboard-guide-tag">AKUN AMAN</span><h3>Akun Mobile Legends Aman dan Terpercaya</h3><p>Kenali spesifikasi akun, detail produk, dan ketentuan sebelum melanjutkan pembelian.</p><details><summary>Baca panduan →</summary><p>Periksa rank, jumlah skin, jumlah hero, win rate, platform tertaut, serta metode penyerahan yang tercantum pada detail produk. Pastikan seluruh ketentuan sudah dibaca sebelum melanjutkan ke Telegram Mini App.</p></details></div>
        </article>
        <article className="dashboard-guide-card">
          <div className="dashboard-guide-art" style={{backgroundImage:'linear-gradient(180deg,rgba(4,10,22,.04),rgba(4,10,22,.45)),url("'+GAME_BACKGROUNDS.FREE_FIRE+'")'}}/>
          <div className="dashboard-guide-body"><span className="dashboard-guide-tag">PROTEKSI AKUN</span><h3>Hackback Adalah Ancaman & Anti-Hackback</h3><p>Pahami perlindungan, masa garansi, dan alur penanganan sesuai ketentuan produk.</p><details><summary>Baca panduan →</summary><p>Setiap produk dapat memiliki ketentuan garansi dan metode penyerahan yang berbeda. Simpan nomor pesanan dan hubungi VAULT CORE melalui kanal bantuan resmi bila menemukan masalah setelah pemenuhan.</p></details></div>
        </article>
      </div>
    </section>

    {telegramContext&&<section className="dashboard-transactions" id="transactions">
      <SectionHeading eyebrow="RIWAYAT PESANAN MINI APP" title="Papan transaksi — setiap baris satu lintasan" subtitle="Status pesanan pribadi dari sesi Telegram yang terverifikasi." href="/catalog" linkLabel="Katalog ↗"/>
      <div className="dashboard-transaction-summary" aria-label="Filter status pesanan">{statusGroups.map(group=><button type="button" className={'dashboard-transaction-filter'+(orderFilter===group.id?' active':'')} key={group.id} onClick={()=>setOrderFilter(group.id)}>{group.label} <b>{groupCount(group)}</b></button>)}</div>
      {ordersLoading?<div className="dashboard-order-empty">Memuat riwayat pesanan Telegram…</div>:ordersError?<div className="dashboard-order-empty">{ordersError}</div>:filteredOrders.length?<div className="dashboard-order-list">{filteredOrders.slice(0,5).map(order=>{
        const itemNames=(Array.isArray(order.items)?order.items:[]).map(item=>item.name).filter(Boolean).join(' · ');
        return <article className="dashboard-order-card" key={order.order_number}><span className="dashboard-order-icon">▣</span><div className="dashboard-order-copy"><strong>{order.order_number}</strong><small>{itemNames||'Pesanan VAULT CORE'} · {formatOrderDate(order.created_at)}</small></div><div className="dashboard-order-side"><strong>{formatXtr(order.total_xtr)}</strong><span className="dashboard-order-status">{ORDER_STATUS[order.status]||order.status}</span></div></article>;
      })}</div>:<div className="dashboard-order-empty">Belum ada pesanan pada akun Telegram ini. Pesanan yang dibuat melalui Mini App akan tampil di sini.</div>}
    </section>}

    <section className="dashboard-protection" id="protection">
      <div className="dashboard-protection-heading"><img className="dashboard-protection-logo" src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE" /><div className="dashboard-protection-heading-copy"><h2>Perlindungan Pembeli</h2><p>Lebih Yakin Bersama Vault Core</p></div></div>
      <div className="dashboard-protection-grid">
        <article className="dashboard-protection-card"><span>⬡</span><div><strong>Anti-Hackback</strong><p>Perlindungan sesuai masa garansi dan ketentuan produk.</p></div></article>
        <article className="dashboard-protection-card"><span>◎</span><div><strong>Akun Dicek Manual</strong><p>Detail akun diperiksa VAULT CORE sebelum ditampilkan.</p></div></article>
        <article className="dashboard-protection-card"><span>↻</span><div><strong>Garansi Refund</strong><p>Refund atau penggantian mengikuti ketentuan produk.</p></div></article>
      </div>
    </section>

    <StoreBottomNav active="dashboard"/>
  </main>;
}
