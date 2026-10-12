import { sb } from './supabase.js';
import { loadSession } from './auth.js';
import { route, render, setNotFound } from './router.js';
import { refreshNav } from './nav.js';
import * as P from './pages/public.js';
import { login, account } from './pages/account.js';
import { vendor } from './pages/vendor.js';
import { admin } from './pages/admin.js';
import { initPwa } from './pwa.js';

const fresh = h => async (...a) => { await loadSession(); refreshNav(); return h(...a); };
route('', P.home); route('/', P.home);
route('/marketplace', P.marketplace); route('/trending', P.trending); route('/deals', P.deals); route('/events', P.events);
route('/events/:slug', P.eventPage); route('/request', P.request); route('/saved', P.saved);
route('/shop/:store', P.shop); route('/shop/:store/:product', P.product);
route('/login', login); route('/account', fresh(account)); route('/vendor', fresh(vendor)); route('/admin', fresh(admin));
setNotFound(() => `<div class="wrap pad"><div class="empty"><h3>Page not found</h3><a class="btn" href="/" data-link>Go home</a></div></div>`);

initPwa();
await loadSession(); refreshNav();
sb.auth.onAuthStateChange(async ev => { if (ev === 'SIGNED_OUT' || ev === 'SIGNED_IN') { await loadSession(); refreshNav(); } });
await render();
