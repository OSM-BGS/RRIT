// sw.js — RRIT network-first for app assets
const CACHE_VERSION = 'rrit-v2';
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

self.addEventListener('install', event => {
  // skip waiting so a new SW takes control ASAP
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // remove old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    // become active immediately
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Same-origin GETs only
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const accept = req.headers.get('accept') || '';
  const isHTML = accept.includes('text/html');
  const isCSS  = req.destination === 'style' || req.url.endsWith('.css');
  const isJS   = req.destination === 'script' || req.url.endsWith('.js');
  const isJSON = req.destination === 'json' || req.url.endsWith('.json');

  if (!(isHTML || isCSS || isJS || isJSON)) return; // let other requests pass through

  event.respondWith((async () => {
    try {
      // Network-first: bypass HTTP cache to pick up fresh files
      const fresh = await fetch(req, { cache: 'reload' });
      // Cache a copy for offline
      const cache = await caches.open(ASSET_CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      // Offline or network error → try cache
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      // last resort: for HTML, return a minimal offline stub
      if (isHTML) {
        return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><p>Offline. Reload when back online.</p>', { headers: { 'Content-Type':'text/html; charset=utf-8' }});
      }
      throw err;
    }
  })());
});