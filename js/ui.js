import { $ } from './util.js';
const eye = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0112 19C5 19 1 12 1 12a18 18 0 015.1-5.9M9.9 4.2A10.7 10.7 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 11-4.2-4.2"/></svg>';
let n = 0;
// Password input with a show/hide button. Hidden by default. Only the real password is ever submitted (confirm fields are checked in the browser, never sent).
export function passwordField(name, label, { auto = 'current-password', hint = '' } = {}) {
  const id = `pw-${name}-${++n}`;
  return `<label for="${id}">${label}</label><div class="pw"><input id="${id}" name="${name}" type="password" autocomplete="${auto}" required minlength="8" maxlength="72" autocapitalize="none" spellcheck="false">
  <button type="button" class="pwt" aria-controls="${id}" aria-pressed="false" aria-label="Show password">${eye}</button></div>${hint ? `<div class="small muted">${hint}</div>` : ''}`;
}
export function bindPasswordToggles(root = document) {
  root.querySelectorAll('.pwt').forEach(b => {
    if (b.dataset.bound) return; b.dataset.bound = '1';
    b.addEventListener('pointerdown', e => e.preventDefault());   // keep focus (and the on-screen keyboard) in the input
    b.addEventListener('click', () => { const i = document.getElementById(b.getAttribute('aria-controls')); const show = i.type === 'password'; i.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.innerHTML = show ? eyeOff : eye; });
  });
}
// Disable a button for N seconds (rate-limit friendliness), showing a countdown
export function cooldown(btn, seconds = 60) {
  const label = btn.textContent; let s = seconds; btn.disabled = true;
  const t = setInterval(() => { s--; if (s <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = label; } else btn.textContent = `Try again in ${s}s`; }, 1000);
  btn.textContent = `Try again in ${s}s`;
}
export const setMsg = (sel, text, kind = 'err') => { const el = $(sel); if (!el) return; el.textContent = text; el.style.color = kind === 'ok' ? 'var(--green2)' : 'var(--danger)'; };

// Accessible modal dialog: focus moves in and is trapped, Escape closes, focus returns, background scroll locked.
export function openDialog({ title, bodyHtml, actions = [] }) {
  const prev = document.activeElement, id = 'dlg-' + (++n), el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="${id}-t"><h3 id="${id}-t">${title}</h3>${bodyHtml}<p id="${id}-m" class="small" role="status" aria-live="polite"></p><div class="row dlg-actions" style="flex-direction:column;align-items:stretch;gap:6px;margin-top:8px">${actions.map((a, i) => `<button type="button" class="btn ${a.kind === 'primary' ? '' : 'ghost'}" data-i="${i}">${a.label}</button>`).join('')}</div></div>`;
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  const box = el.querySelector('.box'), msg = el.querySelector(`#${id}-m`);
  const api = { el, btn: i => el.querySelector(`[data-i="${i}"]`), setMsg: (t, kind) => { msg.textContent = t; msg.style.color = kind === 'ok' ? 'var(--green2)' : 'var(--danger)'; }, close() { document.removeEventListener('keydown', key, true); document.body.style.overflow = ''; el.remove(); prev?.focus?.(); } };
  function key(e) {
    if (e.key === 'Escape') { e.stopPropagation(); api.close(); return; }
    if (e.key !== 'Tab') return; const f = [...box.querySelectorAll('button:not([disabled]),a[href],input,select,textarea')]; if (!f.length) return;
    const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', key, true);
  el.querySelectorAll('[data-i]').forEach(b => b.onclick = e => actions[b.dataset.i].onClick?.(e, api));
  el.onclick = e => { if (e.target === el) api.close(); };
  (el.querySelector('[data-i]') || box).focus?.(); return api;
}
