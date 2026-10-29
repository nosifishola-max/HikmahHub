import { state, isAdmin } from './auth.js';
let notifications;
const syncBell = () => { if (!notifications && state.user && isAdmin()) notifications = import('./notifications.js'); if (notifications) notifications.then(m => m.syncBell()); else { const b = document.getElementById('bell'); if (b) b.hidden = true; } };
const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  home: ic('<path d="M3 11l9-8 9 8v10H3z"/>'),
  shop: ic('<path d="M4 7h16l-1 13H5z"/><path d="M9 7a3 3 0 016 0"/>'),
  deal: ic('<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="16" cy="8" r="1"/>'),
  ev: ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  sell: ic('<path d="M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>'),
  admin: ic('<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>'),
  me: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>') };
// Sell entry: logged out -> sign up then continue to /vendor; student -> apply; approved vendor -> My store; admin -> Admin
export function sellEntry() {
  if (!state.user) return ['/login?mode=signup&next=/vendor', 'Sell'];
  if (isAdmin()) return ['/admin', 'Admin'];
  return ['/vendor', state.vendor?.status === 'approved' ? 'My store' : 'Sell'];
}
export function refreshNav() {
  syncBell();
  const acct = state.user ? ['/account', 'Account'] : ['/login', 'Sign in'];
  const items = [['/', 'Home', I.home], ['/marketplace', 'Market', I.shop], ['/deals', 'Deals', I.deal], ['/events', 'Events', I.ev], [...sellEntry(), sellEntry()[1] === 'Admin' ? I.admin : I.sell], [acct[0], acct[1], I.me]];
  document.getElementById('tabnav').innerHTML = items.map(([h, l, i]) => `<a href="${h}" data-link data-nav="${h.startsWith('/login?') ? '/vendor' : h.split('?')[0]}">${i ?? ''}<span>${l}</span></a>`).join('');
  const extra = [['/trending', 'Trending']];
  if (isAdmin() && sellEntry()[0] !== '/admin') extra.push(['/admin', 'Admin']);
  document.getElementById('desknav').innerHTML = [...items.map(([h, l]) => [h, l]), ...extra].map(([h, l]) => `<a href="${h}" data-link data-nav="${h.startsWith('/login?') ? '/vendor' : h.split('?')[0]}">${l}</a>`).join('');
}

