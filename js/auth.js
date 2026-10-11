import { sb } from './supabase.js';
export const state = { user: null, profile: null, vendor: null };
export async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user ?? null; state.profile = null; state.vendor = null;
  if (state.user) {
    const [p, v] = await Promise.all([
      sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle(),
      sb.from('vendors').select('*').eq('owner_id', state.user.id).maybeSingle()]);
    state.profile = p.data; state.vendor = v.data;
  }
  return state;
}
export const isAdmin = () => state.profile?.role === 'admin';
export const isVendor = () => state.vendor?.status === 'approved';
export const signOut = async () => { await sb.auth.signOut(); await loadSession(); };
