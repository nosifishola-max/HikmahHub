import { CONFIG } from './config.js';
// Loaded as ONE file by <script defer> in index.html (the ESM build pulls ~7 extra files in a chain). Falls back to the ESM build if that script is blocked.
const lib = window.supabase ?? await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
export const sb = lib.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
