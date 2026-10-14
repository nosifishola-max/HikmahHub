// Tiny in-memory cache with in-flight de-duplication. Memory only: nothing is written to storage, and keys for private data include the user id.
const store = new Map(), inflight = new Map();
export async function cached(key, ttlMs, fn) {
  const hit = store.get(key); if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  if (inflight.has(key)) return inflight.get(key);            // same request already running: share it
  const p = Promise.resolve().then(fn).then(v => { store.set(key, { t: Date.now(), v }); return v; }).finally(() => inflight.delete(key));
  inflight.set(key, p); return p;                              // failures are never cached
}
export const invalidate = prefix => { for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k); };
export const clearAll = () => { store.clear(); inflight.clear(); };
export const q = async p => { const { data, error } = await p; if (error) throw error; return data; };
