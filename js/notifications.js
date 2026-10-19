// Admin notification bell: unread badge, panel, mark-as-read, realtime. Data comes from admin_notifications (RLS: each admin sees only their own rows).
// Rows are created by database triggers, never by the browser.
import { sb } from './supabase.js';
import { state, isAdmin } from './auth.js';
import { watch, onResume } from './live.js';
import { go } from './router.js';

export const TYPES = { vendor_application: ['🏪', 'Vendor application'], vendor_resubmitted: ['🔁', 'Application resubmitted'], product_submitted: ['📦', 'New product'], product_changes: ['✏️', 'Listing changes'] };
export const ago = d => { const m = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeLink = l => (typeof l === 'string' && /^\/admin(\?[A-Za-z0-9=&%._-]*)?$/.test(l)) ? l : '/admin';

let stopW = null, stopR = null, list = [], unread = 0, status = 'idle', isOpen = false, last = 0, bound = false, lastShown = null, panel = null;
const $b = () => document.getElementById('bell');

export function syncBell() {                                   // called whenever the session/role changes
  const b = $b(); if (!b) return; const should = !!state.user && isAdmin(); b.hidden = !should;
  if (should && !stopW) start(); else if (!should && stopW) stop();
}
function start() {
  if (!bound) { bound = true; $b().addEventListener('click', toggle); }
  stopW = watch('admin_notifications', () => refresh(), `recipient_id=eq.${state.user.id}`);   // only this admin's rows
  stopR = onResume(() => { if (Date.now() - last > 30000) refresh(); });                       // catch anything missed while away
  refresh();
}
function stop() { stopW?.(); stopR?.(); stopW = stopR = null; list = []; unread = 0; status = 'idle'; close(); badge(); }
function badge() { const n = document.getElementById('bellN'); if (!n) return; n.hidden = unread < 1; n.textContent = unread > 99 ? '99+' : String(unread); $b()?.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications'); }

async function refresh() {
  if (!state.user) return; if (!list.length) { status = 'loading'; draw(); }
  try {
    const [a, c] = await Promise.all([sb.from('admin_notifications').select('id,type,title,body,link,created_at,read_at').order('created_at', { ascending: false }).limit(30), sb.from('admin_notifications').select('id', { count: 'exact', head: true }).is('read_at', null)]);
    if (a.error) throw a.error; if (c.error) throw c.error;
    const prevTop = list[0]?.id; list = a.data; unread = c.count ?? list.filter(x => !x.read_at).length; status = 'ok'; last = Date.now(); badge(); draw();
    const fresh = list.find(x => !x.read_at); if (fresh && fresh.id !== prevTop && fresh.id !== lastShown && prevTop) deviceAlert(fresh);
  } catch { status = 'error'; badge(); draw(); }
}
function deviceAlert(n) {                                      // optional; only if the admin already allowed it. In-app notifications never depend on this.
  lastShown = n.id; if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  try { new Notification(n.title, { body: n.body || '', tag: n.id }); } catch { }
}
async function markRead(ids) {
  const mine = ids ? list.filter(x => ids.includes(x.id) && !x.read_at) : list.filter(x => !x.read_at); mine.forEach(x => x.read_at = new Date().toISOString());
  unread = ids ? Math.max(0, unread - mine.length) : 0; badge(); draw();                       // optimistic
  const { error } = await sb.rpc('mark_admin_notifications_read', { p_ids: ids ?? null }); if (error) refresh();
}
function ensurePanel() {
  if (panel) return panel; panel = document.createElement('div'); panel.className = 'npanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Notifications'); panel.hidden = true; document.body.appendChild(panel);
  panel.addEventListener('click', e => {
    const it = e.target.closest('[data-n]'), act = e.target.closest('[data-act]');
    if (it) { const n = list.find(x => x.id === it.dataset.n); if (n) { markRead([n.id]); close(); go(safeLink(n.link)); } }
    else if (act?.dataset.act === 'all') markRead(null); else if (act?.dataset.act === 'retry') refresh(); else if (act?.dataset.act === 'device') Notification.requestPermission().then(draw);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) { close(); $b()?.focus(); } });
  document.addEventListener('click', e => { if (isOpen && !panel.contains(e.target) && !$b().contains(e.target)) close(); });
  return panel;
}
function toggle() { isOpen ? close() : open(); }
function open() { ensurePanel(); isOpen = true; panel.hidden = false; $b().setAttribute('aria-expanded', 'true'); draw(); if (Date.now() - last > 15000) refresh(); }
function close() { isOpen = false; if (panel) panel.hidden = true; $b()?.setAttribute('aria-expanded', 'false'); }
function draw() {
  if (!panel || !isOpen) return;
  const canDevice = typeof Notification !== 'undefined' && Notification.permission === 'default';
  const body = status === 'loading' ? '<p class="muted small" style="padding:14px">Loading…</p>'
    : status === 'error' ? '<div style="padding:14px"><p class="small" style="color:var(--danger)">Could not load notifications.</p><button class="btn sm" data-act="retry">Retry</button></div>'
    : !list.length ? '<div class="empty" style="margin:10px;padding:18px"><b>No notifications yet</b><p class="muted small">New vendor applications and product submissions will appear here.</p></div>'
    : list.map(n => { const [ic, label] = TYPES[n.type] || ['🔔', 'Notification']; return `<button class="nitem ${n.read_at ? 'read' : 'unread'}" data-n="${esc(n.id)}"><span class="dot" aria-hidden="true"></span><span class="ico" aria-hidden="true">${ic}</span><span><b>${esc(n.title)}</b><span class="t">${esc(label)} · ${ago(n.created_at)}${n.read_at ? '' : ' · unread'}</span><span class="t" style="display:block;color:var(--ink)">${esc(n.body)}</span></span></button>`; }).join('');
  panel.innerHTML = `<header><b class="grow">Notifications${unread ? ` (${unread})` : ''}</b>${unread ? '<button class="btn sm ghost" data-act="all">Mark all as read</button>' : ''}</header>${body}${canDevice ? '<div style="padding:10px"><button class="btn sm ghost" data-act="device">Turn on device alerts</button></div>' : ''}`;
}
