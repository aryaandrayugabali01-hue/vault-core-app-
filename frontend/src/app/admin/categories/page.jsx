'use client';

import { WEB_ROUTES } from '../../../lib/routes.js';

import { useEffect, useState } from 'react';
import { getInitData } from '../../../lib/telegram';
import { StoreHeader } from '../../../components/store-navigation.jsx';

const API=process.env.NEXT_PUBLIC_API_BASE_URL||'';
const headers=()=>({'content-type':'application/json','x-telegram-init-data':getInitData()});

export default function MarketplaceCategoriesPage(){
  const [categories,setCategories]=useState([]);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const session=await fetch(API+'/api/owner-auth/session',{headers:headers(),credentials:'include',cache:'no-store'});
        if(!session.ok){window.location.replace(WEB_ROUTES.owner);return;}
        const response=await fetch(API+'/api/admin/marketplace-categories',{headers:headers(),credentials:'include',cache:'no-store'});
        const data=await response.json();
        if(!response.ok)throw new Error(data.message||'Kategori tidak dapat dimuat.');
        if(active){setCategories(data.categories||[]);setReady(true);}
      }catch(e){if(active)setError(e.message||'Kategori gagal dimuat.');}
    }
    load();
    return ()=>{active=false;};
  },[]);

  return <main className="admin-shell">
    <StoreHeader centerLabel="PANEL PEMILIK" rightSlot={<a className="admin-logout" href={WEB_ROUTES.owner}>Dashboard</a>}/>
    <header className="admin-header">
      <div><span className="eyebrow muted">VAULT CORE / OWNER</span><h1>Struktur katalog</h1><p>Struktur kategori dikunci agar katalog pelanggan selalu konsisten.</p></div>
      <div className="admin-head-actions"><a className="admin-secondary-link" href={WEB_ROUTES.owner}>Kembali ke Dashboard Owner</a></div>
    </header>
    <section className="admin-panel">
      <div className="admin-section-head"><div><span className="eyebrow muted">ATURAN KATALOG</span><h2>4 game · 1 subkategori per game</h2></div><span className="section-count">{ready?categories.length:'—'} KATEGORI</span></div>
      <div className="admin-form-hint">Subkategori yang tersedia hanya Akun. Penambahan Skin, Top Up, Gift, Item, Voucher, dan jenis produk lain belum termasuk katalog saat ini.</div>
      {error&&<div className="admin-notice admin-error" role="alert">{error}</div>}
      {ready?categories.map((item)=><article className="marketplace-category-admin-row" key={item.id}>
        <div className="marketplace-category-admin-icon">{item.icon||'◇'}</div>
        <div className="marketplace-category-admin-copy"><strong>{item.name}</strong><small>/{item.slug} · {item.product_count} produk · {item.active_product_count} aktif</small><p>{item.description||'Akun game'}</p><span className={'marketplace-category-admin-status '+(item.is_active?'active':'paused')}>{item.is_active?'AKTIF':'NONAKTIF'}</span></div>
      </article>):<div className="admin-loading">Memuat struktur katalog…</div>}
    </section>
  </main>;
}
