'use client';

import VaultCoreV4Catalog from './VaultCoreV4Page.jsx';

export default function CatalogPage({ initialCategory = 'ALL' } = {}) {
  return <VaultCoreV4Catalog initialCategory={initialCategory}/>;
}
