// v4: update installed HikmahHub promptly while retaining offline navigation.
// Only same-origin public app assets are cached; API and Supabase requests are excluded.
const V = 'hh-v4';
const SHELL = ['/', '/index.html', '/css/styles.css', '/manifest.webmanifest', '/assets/logo-sm.webp', '/offline.html'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('hh-') && k !== V).map(k => caches.delete(k)))));
  self.clients.claim();
});
const offline = async (req, fallback) => {
  const cache = await caches.open(V);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) await cache.put(fallback || req, res.clone());
    return res;
  } catch {
    return (await cache.match(fallback || req)) || (await caches.match('/offline.html')) || Response.error();
  }
};
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(offline(req, '/index.html'));
    return;
  }
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/') || url.pathname === '/index.html') {
    e.respondWith(offline(req));
    return;
  }
  e.respondWith(caches.open(V).then(async cache => {
    const hit = await cache.match(req);
    if (hit) return hit;
    return offline(req);
  }));
});
