const CACHE_NAME = 'kin-v1';

// Resolve URLs relative to the SW's own scope so the cache works
// regardless of what base path the app is deployed under.
const BASE = self.registration.scope; // e.g. "https://example.com/kin-web/"

const SHELL = [
  BASE,
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
];

// ── Install: pre-cache shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first, fall back to cache ─────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Never cache cross-origin or Supabase requests
  if (url.origin !== self.location.origin) return;
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
