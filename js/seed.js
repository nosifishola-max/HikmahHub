// Feed seed: decides the vendor-mixed order of products. Same seed = same order (so "Load more" never repeats or skips),
// new seed = a fresh arrangement. The seed stays while you keep browsing and rotates after 20 minutes away.
// Stored on this device only; contains no personal data.
const KEY = 'hh:seed', IDLE_MS = 20 * 60 * 1000; let mem = null;
const fresh = () => Math.random().toString(36).slice(2, 10);
export function getSeed(now = Date.now(), store = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    let o = JSON.parse(store?.getItem(KEY) || 'null') || mem;
    if (!o || !o.s || now - o.t > IDLE_MS) o = { s: fresh(), t: now }; else o = { s: o.s, t: now };   // browsing keeps the seed alive
    mem = o; store?.setItem(KEY, JSON.stringify(o)); return o.s;
  } catch { if (!mem || now - mem.t > IDLE_MS) mem = { s: fresh(), t: now }; else mem.t = now; return mem.s; }
}
