/* PULLUP PRO service worker (generated at build time by apps/web/vite.config.ts).
 * - Caches ONLY the static app shell (HTML, JS, CSS, manifest, icons).
 * - Never caches /api/* requests and never touches user data (localStorage / IndexedDB).
 * - On activation deletes only OLD caches whose names start with "pullup-pro-".
 * - A new version waits until the page asks it to activate (SKIP_WAITING), so an update
 *   never interrupts a running workout. */
const VERSION = '__VERSION__';
const CACHE = 'pullup-pro-shell-' + VERSION;
const PRECACHE = __PRECACHE__;
const SCOPE = new URL(self.registration.scope);
const SHELL = new URL('./index.html', SCOPE).href;
const isApi = url => url.pathname.startsWith(SCOPE.pathname + 'api/') || url.pathname.startsWith('/api/');

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(u => new Request(new URL(u, SCOPE).href, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('pullup-pro-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const d = event.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  else if (d.type === 'GET_VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isApi(url)) return; // API and third-party requests go straight to the network

  // App navigations (hash routing): serve the cached shell of THIS version (a new shell arrives with a new service worker).
  if (req.mode === 'navigate' && !/\.[a-z0-9]{2,5}$/i.test(url.pathname.replace(/\/index\.html$/, '/'))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(SHELL);
      if (cached) return cached;
      try { return await fetch(req); } catch (e) { return new Response('<h1>PULLUP PRO</h1><p>Нет сети. Откройте приложение, когда появится интернет.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }

  // Static assets: cache first (file names are content-hashed), then network with runtime caching.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && /\.(js|css|png|svg|webp|ico|webmanifest|woff2?)$/i.test(url.pathname)) cache.put(req, res.clone());
    return res;
  })());
});
