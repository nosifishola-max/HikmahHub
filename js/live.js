// Supabase Realtime, used sparingly. Signed-in users only (anonymous visitors never open a socket). One channel per table+filter, shared by refcount.
// RLS decides which rows each subscriber receives. Falls back to refresh-on-return + short cache TTLs when realtime is unavailable.
import { sb } from './supabase.js';
import { state } from './auth.js';
const subs = new Map(); let paused = false, hiddenTimer = null;
export const liveState = { ok: true };
const fire = s => { clearTimeout(s.t); s.t = setTimeout(() => s.handlers.forEach(h => { try { h(); } catch { } }), 700); };   // coalesce bursts of events
function open(s) {
  if (s.ch || !state.user || paused) return;
  s.ch = sb.channel(`live:${s.key}`).on('postgres_changes', { event: '*', schema: 'public', table: s.table, ...(s.filter ? { filter: s.filter } : {}) }, () => fire(s))
    .subscribe(status => { if (status === 'SUBSCRIBED') { s.tries = 0; liveState.ok = true; } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') retry(s); });
}
function close(s) { if (s.ch) { sb.removeChannel(s.ch); s.ch = null; } }
function retry(s) {                                             // bounded backoff: 5s, 15s, 45s, then give up (no retry storms)
  close(s); if (s.tries >= 3 || !s.handlers.size) { liveState.ok = false; return; }
  setTimeout(() => { if (s.handlers.size && !paused) open(s); }, [5000, 15000, 45000][s.tries++]);
}
export function watch(table, handler, filter) {
  const key = `${table}|${filter || ''}`; let s = subs.get(key);
  if (!s) { s = { key, table, filter, handlers: new Set(), ch: null, tries: 0 }; subs.set(key, s); }
  s.handlers.add(handler); open(s);
  return () => { s.handlers.delete(handler); if (!s.handlers.size) { close(s); subs.delete(key); } };
}
export const stopAll = () => { subs.forEach(close); subs.clear(); };
export function onResume(fn) { const h = () => { if (!document.hidden) fn(); }; document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h); }
// hidden for a minute -> close sockets (saves connections); on return reconnect and catch up once
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(hiddenTimer); hiddenTimer = setTimeout(() => { paused = true; subs.forEach(close); }, 60000); }
  else { clearTimeout(hiddenTimer); if (paused) { paused = false; subs.forEach(s => { open(s); fire(s); }); } }
});
