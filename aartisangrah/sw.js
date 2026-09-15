// Aarti Sangrah offline cache, for the separate installable page at
// /aartisangrah/app only (see that file's registration call for the scope
// that keeps this from ever touching the plain /aartisangrah page). Bump
// CACHE_VERSION whenever app.html, an icon, or the audio set changes —
// activate() drops every older-versioned cache, so a stale version never
// lingers once a device reconnects.
const CACHE_VERSION = 'aarti-v1';
const CACHE_NAME = 'aartisangrah-' + CACHE_VERSION;

const SHELL_URLS = [
  '/aartisangrah/app',
  '/aartisangrah/manifest.webmanifest',
  '/aartisangrah/icons/icon-192.png',
  '/aartisangrah/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);

    // Recordings aren't listed anywhere in the page's own source (see
    // CLAUDE.md — they're discovered from the folder at request time), so the
    // one place that knows the full set is the same manifest the page reads.
    // Precache every one of them now so the reader plays audio with zero
    // network the very first time it's opened offline, not just the pages.
    try {
      const res = await fetch('/aartisangrah/audio/manifest.json');
      if (res.ok) {
        const map = await res.json();
        const audioUrls = Object.values(map);
        await cache.addAll(audioUrls);
      }
    } catch (e) {
      // No network at install time: the shell above is still cached, and the
      // runtime fetch handler below fills in recordings the first time each
      // is actually played, so nothing is permanently missed.
    }

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

// Cache-first for everything in scope, plus the cross-origin Google Fonts
// files: a family reading an aarti offline should never wait on a network
// that isn't there. Whatever isn't precached yet (a font file fetched while
// online, a recording added after this device's last precache) is filled in
// here on its first successful fetch, so the cache only ever grows.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const inScope = url.pathname.startsWith('/aartisangrah');
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!inScope && !isFont) return;

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
        const shell = await caches.match('/aartisangrah/app');
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
