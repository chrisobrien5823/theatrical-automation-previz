// Offline cache for the booth: after one online load, the app works with no network.
//
// - Page loads (navigations): network first, revalidated with the server so a new deploy shows
//   up on the next reload; the cached copy is used only when offline.
// - Everything else (hashed JS/CSS bundles, icons): cache first, filled on first use.

const CACHE = 'previz-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          // 'no-cache' makes the browser check with the server instead of reusing its HTTP cache
          // (GitHub Pages sends max-age=600, which would otherwise hide a new deploy for 10 min).
          const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
          if (res.ok) cache.put('./', res.clone());
          return res;
        } catch {
          return (await cache.match('./')) || (await cache.match('./index.html')) || Response.error();
        }
      })(),
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});
