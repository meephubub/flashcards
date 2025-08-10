self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Simple but more robust offline-first service worker ---
const SW_VERSION = 'v1.0.0';
const PRECACHE = `precache-${SW_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.png',
  '/IMG_2251.png',
  '/IMG_2253.png', // apple-touch-icon (180x180)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old caches
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !name.includes(SW_VERSION))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Runtime caching
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigation requests: try network, then offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Optionally cache successful navigations
          const copy = resp.clone();
          caches.open(PRECACHE).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match('/offline.html');
        })
    );
    return;
  }

  // Same-origin assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((resp) => {
            const copy = resp.clone();
            caches.open(PRECACHE).then((c) => c.put(req, copy)).catch(() => {});
            return resp;
          })
          .catch(() => caches.match('/offline.html'));
      })
    );
    return;
  }

  // Cross-origin: network-first with cache fallback
  event.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(PRECACHE).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
