import { $, toast } from './util.js';
const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome|android/i.test(ua);

function help() {
  const secure = location.protocol === 'https:' || location.hostname === 'localhost';
  let title = 'Install HikmahHub', steps;
  if (!secure) steps = ['Installing needs a secure (https) connection. Open the live HikmahHub website to install.'];
  else if (isIOS) steps = isSafari ? ['Tap the <b>Share</b> button at the bottom of Safari.', 'Scroll down and tap <b>Add to Home Screen</b>.', 'Tap <b>Add</b>. HikmahHub now opens like an app.'] : ['On iPhone, installing works from <b>Safari</b>.', 'Open this page in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.'];
  else if (/android/i.test(ua)) steps = ['Tap the browser menu (<b>⋮</b> or <b>≡</b>).', 'Choose <b>Install app</b> or <b>Add to Home screen</b>.', 'Confirm. If you do not see it, refresh once and try again.'];
  else steps = ['Look for the <b>install icon</b> in the address bar, or open the browser menu.', 'Choose <b>Install HikmahHub</b> (Chrome or Edge).', 'Firefox on desktop does not support installing web apps.'];
  const el = document.createElement('div'); el.className = 'modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="box"><h3>${title}</h3><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol><button class="btn" style="width:100%" id="ok">Got it</button></div>`;
  document.body.appendChild(el); const close = () => el.remove();
  el.onclick = e => { if (e.target === el) close(); }; el.querySelector('#ok').onclick = close; el.querySelector('#ok').focus();
}

export function initPwa() {
  const btn = $('#install'); if (!btn || btn.dataset.ready) return; btn.dataset.ready = '1';
  const refresh = () => { btn.hidden = standalone(); };
  refresh(); matchMedia('(display-mode: standalone)').addEventListener?.('change', refresh);
  addEventListener('hh-installed', () => { btn.hidden = true; toast('HikmahHub installed'); });
  btn.addEventListener('click', async () => {
    const ev = window.__bip;
    if (!ev) return help();                       // no native prompt available: show instructions, never fail silently
    window.__bip = null;                           // a prompt event can only be used once
    try { ev.prompt(); const { outcome } = await ev.userChoice; if (outcome === 'accepted') btn.hidden = true; else toast('You can install later from this button'); }
    catch { help(); }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
