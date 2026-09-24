/*
 * TrueLink Schema Studio service worker.
 * Precaches the app shell so the tool works offline. It only serves this
 * origin's own files; it never caches or forwards third-party requests and
 * the app itself stores documents in localStorage, not here.
 */
const VERSION = '__SW_VERSION__';
const CACHE_PREFIX = 'tl-schema-studio-';
const CACHE = `${CACHE_PREFIX}${VERSION}`;
const PRECACHE = __SW_PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const shell = (await cache.match('./index.html')) || (await cache.match('./'));
        if (shell) return shell;
        return fetch(request);
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      return cached || fetch(request);
    })(),
  );
});
