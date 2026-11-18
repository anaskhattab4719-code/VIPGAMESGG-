const CACHE_VERSION = 'vip-ai-pwa-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png',
  '/vip-ai-icon-512.png',
  '/vip-ai-splash-logo.png',
    '/assets/index-CbAl0rY7.js',
  '/assets/index-DwuMg0pI.css',
  '/assets/web-g9AgSp1O.js',
  '/favicon.ico',
  '/pwa-128x128.png',
  '/pwa-144x144.png',
  '/pwa-152x152.png',
  '/pwa-384x384.png',
  '/pwa-72x72.png',
  '/pwa-96x96.png',
  '/vip-ai-adaptive-icon.png',
  '/vip-ai-icon-1024.png',
  '/vip-ai-splash-screen.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null),
        ),
      );
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET requests (keeps auth POSTs, store sync, and AI calls live)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache backend API or SSE requests
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle Google Fonts cleanly with cache-first
  if (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Only handle same-origin web assets & navigations below
  if (url.origin !== self.location.origin) return;

  // App shell navigations: network-first, fall back to cached /index.html offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          return caches.match('/');
        }),
    );
    return;
  }

  // Static assets: stale-while-revalidate for fast loads + fresh updates
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});
