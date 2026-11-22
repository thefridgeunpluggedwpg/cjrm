const CACHE = 'cjrm-v1.0.0';
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
  'icons/favicon-32.png',
  'icons/logo-full-320.png',
  'js/config.js',
  'js/logic.js',
  'js/demo.js',
  'js/storage.js',
  'js/hub.js',
  'js/app.js',
  'vendor/fonts/fonts.css',
  'vendor/fonts/alfa-slab-one-400.woff2',
  'vendor/fonts/barlow-400.woff2',
  'vendor/fonts/barlow-500.woff2',
  'vendor/fonts/barlow-600.woff2',
  'vendor/fonts/barlow-700.woff2',
  'vendor/fonts/barlow-condensed-400.woff2',
  'vendor/fonts/barlow-condensed-600.woff2',
  'vendor/fonts/barlow-condensed-700.woff2'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // Network-first: always try the live site so updates show on the first open; fall back to cache offline.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
