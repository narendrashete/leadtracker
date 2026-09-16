// Kinetic Gem offline cache, for the installable page at /kinetic-gem/app
// only — see that page's registration call for the explicit scope that keeps
// this from ever touching the plain /kinetic-gem link. Bump CACHE_VERSION
// whenever the page, the manifest or an icon changes: activate() drops every
// older-versioned cache, so a stale version never lingers once a device
// reconnects.
const CACHE_VERSION = 'gem-v1';
const CACHE_NAME = 'kinetic-gem-' + CACHE_VERSION;

// The whole app is one self-contained HTML file with no external requests —
// no fonts, no audio, no library — so unlike the Aarti Sangrah worker this
// shell list IS the entire app. There is nothing to discover at install time.
const SHELL_URLS = [
  '/kinetic-gem/app',
  '/kinetic-gem/manifest.webmanifest',
  '/kinetic-gem/icons/icon-192.png',
  '/kinetic-gem/icons/icon-512.png',
  '/kinetic-gem/icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    );
    self.clients.claim();
  })());
});

// Cache-first for everything under /kinetic-gem. The page never changes at
// runtime, so a cache hit is always correct, and a device that has installed
// once needs no network again.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/kinetic-gem')) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // Offline and not cached. For the page itself, fall back to the shell
      // rather than surfacing the browser's own offline error page.
      if (req.mode === 'navigate') {
        const shell = await caches.match('/kinetic-gem/app');
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
