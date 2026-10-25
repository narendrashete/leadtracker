// Shete Parivar Navratri — installable app shell, for the separate page at
// /shetenavratri/app only (see that file's registration call for the scope
// that keeps this from ever touching the plain /shetenavratri link people
// already have bookmarked/shared). Bump CACHE_VERSION whenever app.html, the
// manifest or an icon changes — activate() drops every older-versioned
// cache, so a stale version never lingers once a device reconnects.
//
// Deliberately NOT a full offline cache of the site: members.html,
// gallery.html, history.html and the family-tree pages are all edited
// through the admin panel on a running basis (new members, photos, history
// entries, reordered siblings), so aggressively caching them would show a
// family member stale, wrong data instead of just asking for a network
// request. This worker only makes the app shell itself (the page you land
// on when you tap the home-screen icon, plus its manifest and icons)
// available instantly and offline; everything you tap from inside the app
// goes to the network exactly as it would in a normal browser tab.
const CACHE_VERSION = 'shete-v1';
const CACHE_NAME = 'shetenavratri-' + CACHE_VERSION;

const SHELL_URLS = [
  '/shetenavratri/app',
  '/shetenavratri/manifest.webmanifest',
  '/shetenavratri/icons/icon-192.jpg',
  '/shetenavratri/icons/icon-512.jpg',
  '/shetenavratri/icons/icon-maskable-192.jpg',
  '/shetenavratri/icons/icon-maskable-512.jpg',
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

// Cache-first for the shell URLs only, so the app opens instantly (and
// offline) straight to its own page. Everything else — every link tapped
// inside the app, every admin edit someone else just made — is left
// untouched and goes to the network like a normal page load.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!SHELL_URLS.includes(url.pathname)) return;

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
      if (req.mode === 'navigate') {
        const shell = await caches.match('/shetenavratri/app');
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
