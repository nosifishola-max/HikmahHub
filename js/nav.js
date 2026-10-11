import { state, isAdmin } from './auth.js';
const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = { home: ic('<path d="M3 11l9-8 9 8v10H3z"/>'), shop: ic('<path d="M4 7h16l-1 13H5z"/><path d="M9 7a3 3 0 016 0"/>'), deal: ic('<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="16" cy="8" r="1"/>'), ev: ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'), me: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>') };
export function refreshNav() {
  const acct = state.user ? ['/account', 'Account'] : ['/login', 'Sign in'];
  const items = [['/', 'Home', I.home], ['/marketplace', 'Market', I.shop], ['/deals', 'Deals', I.deal], ['/events', 'Events', I.ev], [acct[0], acct[1], I.me]];
  document.getElementById('tabnav').innerHTML = items.map(([h, l, i]) => `<a href="${h}" data-link data-nav="${h}">${i}<span>${l}</span></a>`).join('');
  const extra = [['/trending', 'Trending'], ['/vendor', state.vendor ? 'My store' : 'Sell']];
  if (isAdmin()) extra.push(['/admin', 'Admin']);
  document.getElementById('desknav').innerHTML = [...items.map(([h, l]) => [h, l]), ...extra].map(([h, l]) => `<a href="${h}" data-link data-nav="${h}">${l}</a>`).join('');
}
