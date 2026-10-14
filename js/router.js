const routes = []; let notFound = () => '', token = 0, leaves = [];
export const route = (pattern, handler) => routes.push({ re: new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '/?$'), handler });
export const setNotFound = h => notFound = h;
export const current = () => token;                    // pages compare this after awaits so a slow request never paints over a newer page
export const onLeave = fn => leaves.push(fn);          // timers, realtime channels and listeners register cleanup here
export function go(path) { history.pushState({}, '', path); render(); }
export async function render() {
  leaves.splice(0).forEach(f => { try { f(); } catch { } }); const my = ++token;
  const url = new URL(location.href), app = document.getElementById('app');
  for (const r of routes) { const m = url.pathname.match(r.re); if (m) { window.scrollTo(0, 0); await r.handler(app, m.slice(1).map(decodeURIComponent), url.searchParams); if (my === token) mark(); return; } }
  window.scrollTo(0, 0); app.innerHTML = notFound(); mark();
}
function mark() { document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === '/' ? location.pathname === '/' : location.pathname.startsWith(a.dataset.nav))); document.getElementById('app').focus({ preventScroll: true }); }
document.addEventListener('click', e => { const a = e.target.closest('a[data-link]'); if (a && !e.metaKey && !e.ctrlKey && a.target !== '_blank') { e.preventDefault(); go(a.getAttribute('href')); } });
addEventListener('popstate', render);
