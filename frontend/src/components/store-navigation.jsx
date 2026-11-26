'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

function NavigationIcon({ name }) {
  const common = { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.8, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true };
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>;
  if (name === 'bell') return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
  if (name === 'cart') return <svg {...common}><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 1.9-1.4L21 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>;
  if (name === 'user') return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-3.4 3.2-5.2 7.5-5.2s6.7 1.8 7.5 5.2"/></svg>;
  if (name === 'home') return <svg {...common}><path d="m3.5 10 8.5-7 8.5 7M5.5 9v11h13V9M9.5 20v-6h5v6"/></svg>;
  if (name === 'catalog') return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/></svg>;
  if (name === 'category') return <svg {...common}><path d="m12 2.8 9.2 9.2-9.2 9.2L2.8 12z"/><circle cx="12" cy="12" r="2"/></svg>;
  if (name === 'help') return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.8-2.4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M9 10a3 3 0 0 1 6 0c0 1.5-3 2-3 4M12 16.8h.01"/></svg>;
  if (name === 'receipt') return <svg {...common}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></svg>;
  if (name === 'chevron') return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
  return <svg {...common}><path d="M5 3.5h14v17H5zM8 8h8M8 12h8M8 16h5"/></svg>;
}

export { NavigationIcon };

export function StoreHeader({ searchValue, onSearchChange, searchPlaceholder = 'Cari akun game, hero, skin, bundle...', centerLabel, rightSlot, onSearchSubmit }) {
  return <header className="dashboard-topbar">
    <a className="dashboard-brand" href="/" aria-label="VAULT CORE Beranda">
      <img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE Digital Store"/>
    </a>
    {centerLabel
      ? <div className="dashboard-header-label">{centerLabel}</div>
      : <form className="dashboard-search" action="/catalog" method="get" role="search" onSubmit={onSearchSubmit ? (event) => { event.preventDefault(); onSearchSubmit(); } : undefined}>
          <NavigationIcon name="search"/>
          <input type="search" name="q" placeholder={searchPlaceholder} aria-label="Cari produk katalog" value={searchValue} onChange={onSearchChange ? (event) => onSearchChange(event.target.value) : undefined}/>
          <button type="submit" aria-label="Cari"><NavigationIcon name="search"/></button>
        </form>}
    <div className="dashboard-header-actions">{rightSlot}</div>
  </header>;
}

export function StoreBottomNav({ active = 'dashboard', embedded = false }) {
  const accountView = active === 'owner';
  const selected = {
    dashboard: active === 'dashboard',
    catalog: active === 'catalog' || active === 'categories',
    transactions: active === 'transactions',
    help: active === 'help',
    account: accountView || active === 'account'
  };
  const ownerItems = [
    { id: 'dashboard', label: 'Beranda', icon: 'home', href: '/' },
    { id: 'catalog', label: 'Produk', icon: 'catalog', href: '/catalog' },
    { id: 'help', label: 'Bantuan', icon: 'help', href: '/catalog#catalog-footer-support' },
    { id: 'account', label: 'Akun', icon: 'user', href: '/admin' }
  ];
  const customerItems = [
    { id: 'dashboard', label: 'Home', icon: 'home', href: '/' },
    { id: 'catalog', label: 'Store', icon: 'catalog', href: '/catalog' },
    { id: 'transactions', label: 'My Orders', icon: 'receipt', href: '/catalog#transactions' },
    { id: 'account', label: 'Profile', icon: 'user', href: '/account' }
  ];
  const items = accountView ? ownerItems : customerItems;
  return <nav className={'dashboard-bottom-nav' + (embedded ? ' dashboard-bottom-nav-embedded' : '')} aria-label="Navigasi utama">
    {items.map((item) => <a key={item.id} className={selected[item.id] ? 'active' : ''} href={item.href} aria-current={selected[item.id] ? 'page' : undefined}>
      <span className="dashboard-bottom-nav-icon"><span className="dashboard-bottom-nav-icon-inner"><NavigationIcon name={item.icon}/></span></span>
      <span className="dashboard-bottom-nav-label">{item.label}</span>
    </a>)}
  </nav>;
}
export function StoreFooter() {
  const links = [
    { label: 'Katalog', href: '/catalog' },
    { label: 'Kategori', href: '/#categories' },
    { label: 'Cara Beli', href: '/catalog/mlbb-akun#catalog-footer-buy-guide' },
    { label: 'Syarat & Ketentuan', href: '/#terms-and-conditions' },
    { label: 'Kebijakan Refund', href: '/#refund-policy' }
  ];
  return <footer className="store-global-footer" aria-label="Informasi dan navigasi VAULT CORE">
    <div className="store-global-footer-inner">
      <div className="store-trust-strip" aria-label="Perlindungan pembeli">
        <div className="store-trust-item"><span className="store-trust-icon trust-green" aria-hidden="true">⬡</span><span>Anti-Hackback</span></div>
        <span className="store-trust-divider" aria-hidden="true"/>
        <div className="store-trust-item"><span className="store-trust-icon trust-blue" aria-hidden="true">◎</span><span>Akun Dicek Manual</span></div>
        <span className="store-trust-divider" aria-hidden="true"/>
        <div className="store-trust-item"><span className="store-trust-icon trust-purple" aria-hidden="true">↻</span><span>Garansi Refund</span></div>
      </div>
      <div className="store-footer-columns">
        <section className="store-footer-brand">
          <a href="/" aria-label="VAULT CORE Beranda"><img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/></a>
          <h2>Lebih Yakin Bersama <span>Vault Core</span></h2>
          <p>Jelajahi katalog melalui website atau Telegram Mini App. Pembayaran digital menggunakan Telegram Stars.</p>
          <div className="store-footer-badges"><span>✓ Terverifikasi</span><span>✦ Sejak 2024</span></div>
        </section>
        <nav className="store-footer-column" aria-label="Navigasi footer">
          <h3><span/>Navigasi</h3>
          <ul>{links.map(item=><li key={item.label}><a href={item.href}>{item.label}<NavigationIcon name="chevron"/></a></li>)}</ul>
        </nav>
        <section className="store-footer-column" aria-label="Bantuan dan pembayaran">
          <h3><span/>Bantuan</h3>
          <a className="store-footer-help-link" href="/catalog#catalog-footer-support">
            <span className="store-footer-help-icon">✉</span><span><strong>Telegram</strong><small>Hubungi Admin VAULT CORE</small></span><NavigationIcon name="chevron"/>
          </a>
          <a className="store-footer-help-link store-footer-stars-link" href="/catalog">
            <span className="store-footer-help-icon">★</span><span><strong>Telegram Stars</strong><small>Bayar menggunakan Stars</small></span><NavigationIcon name="chevron"/>
          </a>
          <h4>Pembayaran</h4>
          <div className="store-footer-payment"><span>★</span><strong>Telegram Stars (XTR)</strong></div>
          <p className="store-footer-payment-note">Pembayaran diproses melalui invoice resmi Telegram.</p>
        </section>
      </div>
      <div className="store-global-footer-copy"><strong>Vault Core</strong><span>•</span>EST 2024<span>•</span>© {new Date().getFullYear()} - All Rights Reserved</div>
    </div>
  </footer>;
}

export function StoreChrome() {
  const pathname = usePathname() || '/';
  const [activeOverride, setActiveOverride] = useState(null);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash;
      if (hash === '#transactions') {
        setActiveOverride('transactions');
      } else if (hash === '#catalog-footer-support' || hash === '#catalog-footer-buy-guide' || hash === '#catalog-footer-warranty') {
        setActiveOverride('help');
      } else if (hash === '#categories') {
        setActiveOverride('catalog');
      } else {
        setActiveOverride(null);
      }
    };
    const syncNavigationState = (event) => {
      const next = event.detail;
      if (next === 'account' || next === 'catalog' || next === 'help' || next === 'transactions') setActiveOverride(next);
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('vaultcore:navigation-active', syncNavigationState);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('vaultcore:navigation-active', syncNavigationState);
    };
  }, [pathname]);

  const active = pathname.startsWith('/admin')
    ? 'owner'
    : pathname.startsWith('/account')
      ? 'account'
      : activeOverride || (pathname.startsWith('/catalog') ? 'catalog' : 'dashboard');

  const isOwnerPage = pathname.startsWith('/admin');

  return <>
    {!isOwnerPage && <StoreFooter/>}
    <div className="store-bottom-nav-shell">
      <StoreBottomNav active={active}/>
    </div>
  </>;
}
