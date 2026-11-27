// Shell-only cache. API requests and dynamic product data always use the network.
const CACHE_NAME = 'vault-core-miniapp-v12';
const SHELL = [
  '/miniapp/index.html',
  '/miniapp/app.css',
  '/miniapp/app.js',
  '/miniapp/config.js',
  '/miniapp/manifest.webmanifest',
  '/assets/01-brand/vaultcore-mark.svg',
  '/assets/01-brand/vaultcore-horizontal.svg',
  '/assets/02-hero/hero-vaultcore-loop.webp',
  '/game-icons/mlbb.webp',
  '/game-icons/free-fire.webp',
  '/game-icons/roblox.webp',
  '/game-icons/genshin-impact.webp'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
