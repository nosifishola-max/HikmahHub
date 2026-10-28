// Static-only caching. API responses, prices, availability and student data never enter Cache Storage.
const VERSION = 'hh-v1-1-integration-1';
const STATIC = /\.(?:js|css|webp|png|jpg|jpeg|svg|ico|webmanifest)$/;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.add('/offline.html')));
  // Wait for existing clients to close; do not mix a new worker with old modules mid-session.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(k => k.startsWith('hh-') && k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') self.skipWaiting();
});
async function remember(cache, request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  while (keys.length > 80) await cache.delete(keys.shift());
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match('/offline.html')));
    return;
  }
  if (!STATIC.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION), hit = await cache.match(request);
    // Artwork paths are stable; use cached bytes without a background redownload.
    if (hit && url.pathname.startsWith('/assets/')) return hit;
    // Modules/styles keep fixed names, so revalidate before reuse across app launches.
    try { const response = await fetch(request); event.waitUntil(remember(cache, request, response)); return response; }
    catch (error) { if (hit) return hit; throw error; }
  })());
});
