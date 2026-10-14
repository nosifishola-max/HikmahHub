// v3: app shell loads instantly from cache and refreshes in the background (stale-while-revalidate). Only same-origin static files and the
// HTML shell are cached; Supabase API, storage and /api/* are never touched, so no private data is ever stored here.
const V = 'hh-v3', SHELL = ['/', '/index.html', '/css/styles.css', '/manifest.webmanifest', '/assets/logo-sm.webp', '/offline.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); self.clients.claim(); });
const swr = (req, key) => caches.open(V).then(async c => {
  const hit = await c.match(key || req);
  const net = fetch(req).then(res => { if (res.ok) c.put(key || req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || caches.match('/offline.html');
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (r.mode === 'navigate') return e.respondWith(swr(r, '/index.html'));             // one shell for every app route
  e.respondWith(swr(r));
});
