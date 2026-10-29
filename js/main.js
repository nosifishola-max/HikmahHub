import { sb } from './supabase.js';
import { loadSession, whenFresh, state } from './auth.js';
import { route, render, setNotFound, go } from './router.js';
import { refreshNav } from './nav.js';
import * as P from './pages/public.js';
import { initPwa } from './pwa.js';
import { clearAll } from './cache.js';
import { stopAll } from './live.js';
import { skeleton, toast } from './util.js';

// Admin, vendor and account code is only downloaded when someone opens those pages.
const lazy = (loader, name, needsProfile) => async (app, ...rest) => {
  app.innerHTML = `<div class="wrap pad">${skeleton(2)}</div>`;
  const [m] = await Promise.all([loader(), needsProfile ? whenFresh() : null]);
  return m[name](app, ...rest);
};
route('', P.home); route('/', P.home);
const legal = () => import('./pages/legal.js');
route('/privacy', lazy(legal, 'privacy')); route('/terms', lazy(legal, 'terms'));
route('/marketplace', P.marketplace); route('/trending', P.trending); route('/deals', P.deals); route('/events', P.events);
route('/events/:slug', P.eventPage); route('/request', P.request); route('/saved', P.saved);
route('/shop/:store', P.shop); route('/shop/:store/:product', P.product);
const acct = () => import('./pages/account.js');
route('/login', lazy(acct, 'login')); route('/reset-password', lazy(acct, 'resetPassword')); route('/account', lazy(acct, 'account', true));
route('/vendor', lazy(() => import('./pages/vendor.js'), 'vendor', true)); route('/admin', lazy(() => import('./pages/admin.js'), 'admin', true));
setNotFound(() => `<div class="wrap pad"><div class="empty"><h3>Page not found</h3><a class="btn" href="/" data-link>Go home</a></div></div>`);

initPwa();
await loadSession({ full: false });                 // local only: first paint is not blocked by profile/vendor queries
refreshNav(); state.ready.then(refreshNav);
sb.auth.onAuthStateChange((ev, session) => {         // keep this callback synchronous (no awaiting Supabase calls inside)
  if (ev === 'SIGNED_OUT') { clearAll(); stopAll(); try { Object.keys(localStorage).filter(k => k.startsWith('hh:draft:')).forEach(k => localStorage.removeItem(k)); } catch { } setTimeout(() => loadSession({ full: false }).then(() => { refreshNav(); render(); }), 0); }
  else if (ev === 'SIGNED_IN' && session?.user?.id !== state.user?.id) setTimeout(() => { loadSession({ full: false }).then(refreshNav); state.ready.then(refreshNav); }, 0);
});
await render();

const h = String(window.__authHash || '');            // returning from the confirmation email link
if (/type=signup/.test(h) && state.user) { toast('Email confirmed. Welcome to HikmahHub!'); await state.ready; go(state.profile?.phone ? '/' : '/account'); }
else if (/error_code=otp_expired|error=access_denied/.test(h)) toast('That confirmation link has expired. Sign in, or create the account again to get a new link.');


