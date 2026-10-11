const routes = []; let notFound = () => '';
export const route = (pattern, handler) => routes.push({ re: new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '/?$'), handler });
export const setNotFound = h => notFound = h;
export function go(path) { history.pushState({}, '', path); render(); }
export async function render() {
  const url = new URL(location.href); const app = document.getElementById('app');
  for (const r of routes) { const m = url.pathname.match(r.re); if (m) { window.scrollTo(0, 0); await r.handler(app, m.slice(1).map(decodeURIComponent), url.searchParams); mark(); return; } }
  window.scrollTo(0, 0); app.innerHTML = notFound(); mark();
}
function mark() { document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === '/' ? location.pathname === '/' : location.pathname.startsWith(a.dataset.nav))); document.getElementById('app').focus({ preventScroll: true }); }
document.addEventListener('click', e => { const a = e.target.closest('a[data-link]'); if (a && !e.metaKey && !e.ctrlKey && a.target !== '_blank') { e.preventDefault(); go(a.getAttribute('href')); } });
addEventListener('popstate', render);
