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
  return <nav className={'dashboard-bottom-nav' + (embedded ? ' dashboard-bottom-nav-embedded' : '')} aria-label="Navigasi utama">
    <a className={active === 'dashboard' ? 'active' : ''} href="/" aria-current={active === 'dashboard' ? 'page' : undefined}><NavigationIcon name="home"/><span>Dashboard</span></a>
    <a className={active === 'catalog' ? 'active' : ''} href="/catalog" aria-current={active === 'catalog' ? 'page' : undefined}><NavigationIcon name="catalog"/><span>Katalog</span></a>
    <a className={active === 'categories' ? 'active' : ''} href="/catalog#categories" aria-current={active === 'categories' ? 'page' : undefined}><NavigationIcon name="category"/><span>Kategori</span></a>
    <a className={active === 'owner' ? 'active' : ''} href="/admin" aria-current={active === 'owner' ? 'page' : undefined}><NavigationIcon name="owner"/><span>Owner</span></a>
  </nav>;
}
