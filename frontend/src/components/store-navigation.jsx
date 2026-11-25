'use client';

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
    help: active === 'help',
    account: accountView
  };
  const items = [
    { id: 'dashboard', label: 'Beranda', icon: 'home', href: '/' },
    { id: 'catalog', label: 'Produk', icon: 'catalog', href: '/catalog' },
    { id: 'help', label: 'Bantuan', icon: 'help', href: '/catalog/mlbb-akun#catalog-footer-support' },
    { id: 'account', label: 'Akun', icon: 'user', href: accountView ? '/admin' : '/catalog#profile' }
  ];

  return <nav className={'dashboard-bottom-nav' + (embedded ? ' dashboard-bottom-nav-embedded' : '')} aria-label="Navigasi utama">
    {items.map((item) => <a
      key={item.id}
      className={selected[item.id] ? 'active' : ''}
      href={item.href}
      aria-current={selected[item.id] ? 'page' : undefined}
    >
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

  return <footer className="store-global-footer" aria-label="Navigasi informasi VAULT CORE">
    <div className="store-global-footer-inner">
      <div className="store-global-footer-brand">
        <a href="/" aria-label="VAULT CORE Beranda">
          <img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/>
        </a>
        <span>Lebih Yakin Bersama Vault Core</span>
      </div>
      <div className="store-global-footer-heading"><span aria-hidden="true"/><h2>NAVIGASI</h2></div>
      <nav className="store-global-footer-links" aria-label="Navigasi informasi">
        {links.map((item) => <a href={item.href} key={item.label}>
          <span>{item.label}</span><NavigationIcon name="chevron"/>
        </a>)}
      </nav>
      <p className="store-global-footer-note">Ketentuan produk, garansi, dan refund mengikuti informasi yang tercantum pada setiap produk.</p>
      <small className="store-global-footer-copy">© {new Date().getFullYear()} VAULT CORE. Marketplace akun game.</small>
    </div>
  </footer>;
}
