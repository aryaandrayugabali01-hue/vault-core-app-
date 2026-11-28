/**
 * Canonical website route registry.
 * Query parameters represent filters or selection state on the canonical catalog page.
 */
export const WEB_ROUTES = Object.freeze({
  home: '/',
  catalog: '/catalog',
  mlbbAccountCatalog: '/catalog/mlbb-akun',
  orders: '/catalog#transactions',
  account: '/account',
  owner: '/admin',
  ownerProducts: '/admin/v4',
  ownerCategories: '/admin/categories',
  ownerNewProduct: '/admin/products/new',
  homeCategories: '/#categories',
  catalogBuyGuide: '/catalog#catalog-footer-buy-guide',
  terms: '/miniapp/index.html#/terms',
  privacy: '/miniapp/index.html#/privacy',
  refund: '/miniapp/index.html#/refund',
  support: 'https://t.me/vaultcore_support'
});
export function catalogHref({ game, group, product, query } = {}) {
  const params = new URLSearchParams();
  if (game) params.set('game', String(game));
  if (group) params.set('group', String(group));
  if (product !== undefined && product !== null && product !== '') params.set('product', String(product));
  if (query) params.set('q', String(query));
  const suffix = params.toString();
  return suffix ? WEB_ROUTES.catalog + '?' + suffix : WEB_ROUTES.catalog;
}
export function customerLoginHref(next = WEB_ROUTES.catalog) {
  return WEB_ROUTES.account + '?next=' + encodeURIComponent(next);
}
