'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData } from '../../../lib/telegram';

const API=process.env.NEXT_PUBLIC_API_BASE_URL||'';
const EMPTY={slug:'',name:'',description:'',icon:'◇',purchaseGuideText:'',sortOrder:'100',isActive:true};
const headers=()=>({'content-type':'application/json','x-telegram-init-data':getInitData()});

function guideToText(steps) {
  return (Array.isArray(steps)?steps:[]).map((step)=>String(step.title||'')+'|'+String(step.content||'')).join('\n');
}
function textToGuide(value) {
  return String(value||'').split(/\r?\n/).map((line)=>line.trim()).filter(Boolean).map((line)=>{
    const split=line.split('|');
    return {title:String(split.shift()||'').trim(),content:split.join('|').trim()};
  });
}
function apiMessage(data) {
  const known={
    MARKETPLACE_CATEGORY_SLUG_EXISTS:'Slug kategori sudah digunakan.',
    MARKETPLACE_CATEGORY_HAS_ACTIVE_PRODUCTS:'Kategori masih memiliki produk aktif. Jeda produk aktif sebelum menonaktifkan kategori.',
    INVALID_MARKETPLACE_CATEGORY:'Periksa nama, slug, urutan, dan isi panduan kategori.'
  };
  return known[data?.error]||data?.message||'Kategori tidak dapat disimpan.';
}

export default function MarketplaceCategoriesPage(){
  const [categories,setCategories]=useState([]);
  const [form,setForm]=useState(EMPTY);
  const [editingId,setEditingId]=useState('');
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');

  async function load(){
    setError('');
    const session=await fetch(API+'/api/owner-auth/session',{headers:headers(),credentials:'include',cache:'no-store'});
    if(!session.ok){window.location.replace('/admin');return;}
    const response=await fetch(API+'/api/admin/marketplace-categories',{headers:headers(),credentials:'include',cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new Error(apiMessage(data));
    setCategories(data.categories||[]);
    setReady(true);
  }
  useEffect(()=>{load().catch((e)=>setError(e.message||'Kategori gagal dimuat.'));},[]);

  const guideCount=useMemo(()=>textToGuide(form.purchaseGuideText).length,[form.purchaseGuideText]);

  function edit(category){
    setEditingId(String(category.id));
    setForm({
      slug:category.slug||'',name:category.name||'',description:category.description||'',
      icon:category.icon||'◇',purchaseGuideText:guideToText(category.purchase_guide),
      sortOrder:String(category.sort_order??100),isActive:category.is_active===true
    });
    setNotice('');
  }
  function reset(){
    setEditingId('');
    setForm(EMPTY);
  }
  async function save(event){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const payload={
        slug:form.slug.trim().toLowerCase(),name:form.name.trim(),description:form.description.trim(),
        icon:form.icon.trim(),purchaseGuide:textToGuide(form.purchaseGuideText),
        sortOrder:Number(form.sortOrder),isActive:form.isActive
      };
      const response=await fetch(API+(editingId?'/api/admin/marketplace-categories/'+editingId:'/api/admin/marketplace-categories'),{
        method:editingId?'PATCH':'POST',headers:headers(),credentials:'include',body:JSON.stringify(payload)
      });
      const data=await response.json();
      if(!response.ok)throw new Error(apiMessage(data));
      setNotice(editingId?'Kategori berhasil diperbarui.':'Kategori berhasil dibuat.');
      reset();
      await load();
    }catch(e){setError(e.message||'Kategori tidak dapat disimpan.');}
    finally{setBusy(false);}
  }

  return <main className="admin-shell">
    <header className="admin-header">
      <div><span className="eyebrow muted">VAULT CORE / OWNER</span><h1>Kategori marketplace</h1><p>Kelola kategori katalog dan panduan pembelian yang tampil pada detail produk.</p></div>
      <div className="admin-head-actions"><a className="admin-secondary-link" href="/admin">Kembali ke Dashboard Owner</a></div>
    </header>
    {notice&&<div className="admin-notice">{notice}</div>}
    {error&&<div className="admin-notice admin-error" role="alert">{error}</div>}
    <section className="admin-panel">
      <div className="admin-section-head"><div><span className="eyebrow muted">{editingId?'EDIT KATEGORI':'KATEGORI BARU'}</span><h2>{editingId?'Perbarui kategori':'Tambah kategori marketplace'}</h2></div></div>
      <form className="admin-form" onSubmit={save}>
        <label>Nama kategori<input required minLength="2" maxLength="80" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Contoh: Joki" /></label>
        <label>Slug unik<input required maxLength="64" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(e)=>setForm({...form,slug:e.target.value.toLowerCase()})} placeholder="contoh: joki" /></label>
        <label>Ikon / emoji<input required maxLength="24" value={form.icon} onChange={(e)=>setForm({...form,icon:e.target.value})} /></label>
        <label>Urutan tampil<input type="number" min="0" max="10000" step="1" value={form.sortOrder} onChange={(e)=>setForm({...form,sortOrder:e.target.value})} /></label>
        <label className="span-2">Deskripsi kategori<textarea rows="2" maxLength="500" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} placeholder="Deskripsi singkat sesuai jenis produk." /></label>
        <label className="span-2">Panduan Beli &amp; Tips <small className="field-hint">Satu langkah per baris dengan format Judul|Penjelasan. Maksimal 12 langkah. {guideCount}/12</small><textarea rows="6" maxLength="14000" value={form.purchaseGuideText} onChange={(e)=>setForm({...form,purchaseGuideText:e.target.value})} placeholder={'Periksa penawaran|Baca deskripsi dan cakupan produk.\nLengkapi data|Kirim data yang diperlukan melalui alur resmi.'} /></label>
        <label className="field-check"><input type="checkbox" checked={form.isActive} onChange={(e)=>setForm({...form,isActive:e.target.checked})} /> Kategori aktif untuk produk baru</label>
        <div className="span-2 admin-form-hint">Kategori yang dinonaktifkan tidak dapat dipilih untuk produk baru. Kategori yang masih memiliki produk aktif tidak dapat dinonaktifkan.</div>
        <div className="admin-actions"><button className="admin-primary" disabled={busy}>{busy?'Menyimpan…':editingId?'Simpan perubahan':'Buat kategori'}</button>{editingId&&<button type="button" onClick={reset} disabled={busy}>Batal</button>}</div>
      </form>
    </section>
    <section className="admin-panel">
      <div className="admin-section-head"><div><span className="eyebrow muted">DATA KATEGORI</span><h2>Daftar kategori</h2></div><span className="section-count">{ready?categories.length:'—'} KATEGORI</span></div>
      {ready&&categories.length?categories.map((item)=><article className="marketplace-category-admin-row" key={item.id}>
        <div className="marketplace-category-admin-icon">{item.icon||'◇'}</div>
        <div className="marketplace-category-admin-copy"><strong>{item.name}</strong><small>/{item.slug} · {item.product_count} produk · {item.active_product_count} aktif</small><p>{item.description||'Tanpa deskripsi kategori.'}</p><span className={'marketplace-category-admin-status '+(item.is_active?'active':'paused')}>{item.is_active?'AKTIF':'NONAKTIF'}</span></div>
        <button type="button" className="admin-secondary-link" onClick={()=>edit(item)}>Edit</button>
      </article>):ready?<div className="empty-state"><strong>Belum ada kategori</strong><p>Buat kategori pertama untuk mulai menyusun katalog marketplace.</p></div>:<div className="admin-loading">Memuat kategori…</div>}
    </section>
  </main>;
}
