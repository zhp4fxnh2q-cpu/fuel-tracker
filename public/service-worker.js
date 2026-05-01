// FUEL minimal service worker — cache-first for shell, network-first for API.
// Real offline-queue logic lives in src/lib/offlineQueue.js (IndexedDB via Dexie).
const CACHE_NAME = 'fuel-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache Supabase, USDA, Anthropic, or our Worker — always network
  if (
    url.hostname.endsWith('supabase.co') ||
    url.hostname.endsWith('api.anthropic.com') ||
    url.hostname.endsWith('api.nal.usda.gov') ||
    url.pathname.startsWith('/api/')
  ) {
    return; // bypass SW
  }
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
