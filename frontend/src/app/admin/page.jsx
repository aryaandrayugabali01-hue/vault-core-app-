'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitData } from '../../lib/telegram';
import { GAME_LABELS } from '../../lib/marketplace.js';
import { StoreHeader } from '../../components/store-navigation.jsx';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

const STATUS_LABELS = {
  DRAFT:'Draf',
  ACTIVE:'Aktif',
  PAUSED:'Dijeda',
  ARCHIVED:'Diarsipkan'
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '—';
}

function xtr(value) {
  return Number(value || 0).toLocaleString('en-US') + ' XTR';
}

function priceRange(attributes = {}) {
  const min = Number(attributes.price_min_idr || 0);
  const max = Number(attributes.price_max_idr || 0);
  if (!min || !max) return '';
  const format = (value) => 'Rp ' + value.toLocaleString('id-ID');
  return min === max ? format(min) : format(min) + ' – ' + format(max);
}

function categoryLabel(product) {
  return product.marketplace_category_name || (
    product.marketplace_category_slug
      ? product.marketplace_category_slug.replace(/-/g, ' ')
      : 'Belum dikategorikan'
  );
}

export default function AdminPage() {
  const [products, setProducts] = useState([]);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState('checking');
  const [oidcReady, setOidcReady] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [availabilityBusyId, setAvailabilityBusyId] = useState(null);
  const [indentDays, setIndentDays] = useState({});

  const headers = () => ({
    'content-type':'application/json',
    'x-telegram-init-data':getInitData()
  });

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/admin/products`, {
        headers:headers(),
        credentials:'include',
        cache:'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Data produk tidak dapat dimuat. Periksa sesi Admin.');
      }
      setProducts(Array.isArray(data.products) ? data.products : []);
      setNotice('');
    } catch (error) {
      setNotice(error.message || 'Data produk tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('owner_login_error');
    if (error === 'owner_access_required') {
      setLoginMessage('Identitas Telegram valid, tetapi akun ini belum memiliki akses Admin.');
    } else if (error) {
      setLoginMessage('Login Telegram tidak berhasil. Silakan coba kembali.');
    }

    let alive = true;
    async function initializeAccess() {
      try {
        const session = await fetch(`${API}/api/owner-auth/session`, {
          headers:{ 'x-telegram-init-data':getInitData() },
          credentials:'include',
          cache:'no-store'
        });
        if (session.ok) {
          if (!alive) return;
          setAuthState('authenticated');
          await refresh();
          return;
        }
        const config = await fetch(`${API}/api/owner-auth/config`, {
          credentials:'include',
          cache:'no-store'
        });
        const data = await config.json().catch(() => ({}));
        if (!config.ok || data.loginMode !== 'oidc' || !data.clientId) {
          throw new Error('Login Telegram belum dapat disiapkan.');
        }
        if (alive) {
          setOidcReady(true);
          setAuthState('login');
        }
      } catch (error) {
        if (alive) {
          setAuthState('login');
          setLoginMessage(error.message || 'Login Telegram belum dapat dimuat.');
        }
      }
    }
    initializeAccess();
    return () => { alive = false; };
  }, []);

  async function setProductAvailability(product, availabilityStatus) {
    const days = Number(indentDays[product.id] ?? product.indent_deadline_days ?? 7);
    if (availabilityStatus === 'INDENT' && (!Number.isSafeInteger(days) || days < 1 || days > 365)) {
      setNotice('Jumlah hari Inden harus 1 sampai 365 hari.');
      return;
    }
    setAvailabilityBusyId(product.id);
    setNotice('');
    try {
      const response = await fetch(`${API}/api/admin/products/${product.id}/availability`, {
        method:'PATCH',
        headers:headers(),
        credentials:'include',
        body:JSON.stringify({
          availabilityStatus,
          ...(availabilityStatus === 'INDENT' ? {indentDays:days} : {})
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Status ketersediaan gagal diperbarui.');
      await refresh();
      const label = availabilityStatus === 'AVAILABLE' ? 'Tersedia'
        : availabilityStatus === 'INDENT' ? `Inden ${days} hari` : 'Tidak tersedia';
      setNotice(product.sku + ' berhasil diubah menjadi ' + label + '.');
    } catch (error) {
      setNotice(error.message || 'Status ketersediaan gagal diperbarui.');
    } finally {
      setAvailabilityBusyId(null);
    }
  }

  async function logoutOwner() {
    await fetch(`${API}/api/owner-auth/logout`, {
      method:'POST',
      credentials:'include'
    });
    setAuthState('login');
    setNotice('');
    setLoginMessage('Anda telah keluar dari Dashboard Admin.');
  }

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) => [
      product.sku,
      product.name,
      product.description,
      product.game_category,
      product.marketplace_category_name,
      product.marketplace_category_slug
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [products, search]);

  const totals = useMemo(() => ({
    total:products.length,
    active:products.filter((product) => product.status === 'ACTIVE').length,
    paused:products.filter((product) => ['PAUSED','DRAFT'].includes(product.status)).length
  }), [products]);

  if (authState !== 'authenticated') {
    return <main className="owner-login-screen">
      <StoreHeader centerLabel="DATA PRODUK" rightSlot={<a className="dashboard-icon-button" href="/" aria-label="Kembali ke katalog">⌂</a>} />
      <section className="owner-login-card">
        <span className="eyebrow muted">ADMIN SECURE ACCESS</span>
        <h1>Masuk dengan Telegram</h1>
        <p>Gunakan akun Telegram yang sudah terdaftar untuk membuka data produk VAULT CORE.</p>
        {authState === 'checking'
          ? <div className="owner-login-loading">Memeriksa sesi Telegram…</div>
          : <>
              {oidcReady
                ? <a className="telegram-login-oidc-button" href={`${API}/api/owner-auth/oidc/start`}>Masuk dengan Telegram</a>
                : <div className="owner-login-loading">Menyiapkan login Telegram…</div>}
              {loginMessage && <div className="owner-login-message" role="alert">{loginMessage}</div>}
            </>}
        <a className="owner-login-back" href="/">Kembali ke katalog</a>
      </section>
    </main>;
  }

  return <main className="admin-shell">
    <StoreHeader
      centerLabel="DATA PRODUK"
      rightSlot={<button type="button" className="admin-logout" onClick={logoutOwner}>Keluar</button>}
    />
    <section className="admin-title">
      <span className="eyebrow muted">KATALOG / ADMIN</span>
      <h1>Data Produk</h1>
      <p>Daftar produk VAULT CORE, harga, persediaan, dan status produk.</p>
    </section>

    {notice && <div className="admin-notice" role="alert">{notice}</div>}

    <section className="admin-stats" aria-label="Ringkasan produk">
      <div><small>Total produk</small><strong>{totals.total}</strong></div>
      <div><small>Produk aktif</small><strong>{totals.active}</strong></div>
      <div><small>Draf / dijeda</small><strong>{totals.paused}</strong></div>
    </section>

    <section className="admin-panel">
      <div className="admin-section-head">
        <div>
          <span className="eyebrow muted">DATA KATALOG</span>
          <h2>Daftar produk</h2>
          <p>Hanya data produk yang ditampilkan pada halaman ini.</p>
        </div>
        <span className="section-count">{filteredProducts.length} SKU</span>
      </div>

      <div className="admin-form" style={{marginBottom:'16px'}}>
        <label className="span-2">Cari produk
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari SKU, nama, game, atau kategori"
          />
        </label>
      </div>

      <div className="admin-table-wrap admin-products-only">
        <table className="admin-table">
          <thead><tr><th>Data Produk</th></tr></thead>
          <tbody>
            {filteredProducts.map((product) => {
              const availability = product.availability_status
                || (product.status !== 'ACTIVE' ? 'UNAVAILABLE' : product.availability_mode === 'INDENT' ? 'INDENT' : 'AVAILABLE');
              const busy = availabilityBusyId === product.id;
              return <tr key={product.id}>
                <td>
                  <div className="admin-product-entry">
                    <div className="admin-product-entry-main">
                      <strong>{product.name}</strong>
                      <small>{product.sku} · {GAME_LABELS[product.game_category] || product.game_category || '—'} · {categoryLabel(product)}</small>
                      <small>Harga jual: {xtr(product.sale_price_xtr)} · Slot tersedia: {Number(product.actual_stock || 0).toLocaleString('id-ID')}</small>
                      <span className={`admin-status ${availability.toLowerCase()}`}>
                        {availability === 'AVAILABLE' ? 'TERSEDIA' : availability === 'INDENT' ? `INDEN · ${product.indent_deadline_days || '—'} HARI` : 'TIDAK TERSEDIA'}
                      </span>
                      {product.description && <details className="admin-product-details">
                        <summary>Spesifikasi produk</summary>
                        <div>
                          <p>{product.description}</p>
                          {Object.entries(product.attributes || {}).length > 0 && <small>
                            {Object.entries(product.attributes).map(([key,value]) => key + ': ' + String(value)).join(' · ')}
                          </small>}
                        </div>
                      </details>}
                    </div>
                    <div className="admin-product-availability">
                      <div className="admin-availability-buttons">
                        <button type="button" className="admin-secondary-link" aria-pressed={availability === 'AVAILABLE'} disabled={busy} onClick={() => setProductAvailability(product,'AVAILABLE')}>Tersedia</button>
                        <button type="button" className="admin-secondary-link" aria-pressed={availability === 'INDENT'} disabled={busy} onClick={() => setProductAvailability(product,'INDENT')}>Inden</button>
                        <button type="button" className="admin-secondary-link" aria-pressed={availability === 'UNAVAILABLE'} disabled={busy} onClick={() => setProductAvailability(product,'UNAVAILABLE')}>Tidak tersedia</button>
                      </div>
                      <label className="admin-indent-days">Jumlah hari Inden
                        <input type="number" min="1" max="365" value={indentDays[product.id] ?? product.indent_deadline_days ?? 7}
                          onChange={(event) => setIndentDays((current) => ({...current,[product.id]:event.target.value}))}/>
                      </label>
                      <a className="admin-secondary-link" href="/admin/v4">Edit detail SKU</a>
                    </div>
                  </div>
                </td>
              </tr>;
            })}
            {!filteredProducts.length && <tr><td className="table-empty">{loading ? 'Memuat data produk…' : 'Produk tidak ditemukan.'}</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="admin-footnote">Data yang ditampilkan berasal dari database produk VAULT CORE.</p>
      <div className="admin-entry-actions" style={{marginTop:'18px'}}>
        <a className="admin-primary admin-product-entry-link" href="/admin/v4">Buka form produk</a>
        <button type="button" className="admin-secondary-link" onClick={refresh} disabled={loading}>
          {loading ? 'Memuat…' : 'Muat ulang data'}
        </button>
      </div>
    </section>
  </main>;
}
