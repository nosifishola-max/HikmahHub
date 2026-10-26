import { sb } from './supabase.js';
import { clearAll } from './cache.js';
export const state = { user: null, profile: null, vendor: null, ready: Promise.resolve(), loadedAt: 0 };
export const scope = () => state.user?.id || 'anon';      // cache keys for private data always include the user id
let inflight = null;
async function loadProfile(uid) {
  let [p, v] = await Promise.all([sb.from('profiles').select('*').eq('id', uid).maybeSingle(), sb.from('vendors').select('*').eq('owner_id', uid).maybeSingle()]);
  if (!p.error && !p.data) { const repair = await sb.rpc('ensure_my_profile'); if (!repair.error) p = await sb.from('profiles').select('*').eq('id', uid).maybeSingle(); }
  if (state.user?.id === uid) { state.profile = p.data; state.vendor = v.data; state.loadedAt = Date.now(); }
}
// full:false -> returns as soon as the local session is known (no network); profile/vendor load in the background (await state.ready when you need them)
export function loadSession({ full = true } = {}) {
  if (inflight) return inflight.then(async s => { if (full) await state.ready; return s; });
  inflight = (async () => {
    const { data: { session } } = await sb.auth.getSession(), uid = session?.user?.id ?? null;
    if ((state.user?.id ?? null) !== uid) { clearAll(); state.profile = null; state.vendor = null; }   // never reuse another user's cached data
    state.user = session?.user ?? null;
    state.ready = uid ? loadProfile(uid).catch(() => { }) : (state.profile = state.vendor = null, Promise.resolve());
    return state;
  })().finally(() => { inflight = null; });
  return inflight.then(async s => { if (full) await state.ready; return s; });
}
export const refreshProfile = async () => { if (state.user) { state.ready = loadProfile(state.user.id).catch(() => { }); await state.ready; } };
export const whenFresh = async (maxAge = 60000) => { await state.ready; if (state.user && Date.now() - state.loadedAt > maxAge) await refreshProfile(); };
export const isAdmin = () => state.profile?.role === 'admin';
export const isVendor = () => state.vendor?.status === 'approved';
export const signOut = async () => { await sb.auth.signOut(); await loadSession(); };


export async function requireProfile() { await state.ready; if (!state.user) throw Error('Sign in required'); if (!state.profile) await refreshProfile(); if (!state.profile) throw Error('Profile unavailable'); }
