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
  initUpdates();
}

export function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let accepted = false, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (accepted && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
    const offer = () => {
      if (!reg.waiting || !navigator.serviceWorker.controller || document.getElementById('pwa-update')) return;
      const notice = document.createElement('aside'); notice.id = 'pwa-update'; notice.className = 'pwa-update';
      notice.setAttribute('aria-label', 'App update');
      notice.innerHTML = '<p>A HikmahHub update is ready. Save any unfinished forms before updating.</p><div class="row"><button class="btn" data-update>Update and reload</button><button class="btn ghost" data-later>Later</button></div>';
      notice.querySelector('[data-update]').onclick = () => {
        if (!reg.waiting) { notice.remove(); return; }
        accepted = true; notice.querySelector('[data-update]').disabled = true;
        reg.waiting.postMessage({ type: 'APPLY_UPDATE' });
      };
      notice.querySelector('[data-later]').onclick = () => notice.remove();
      document.body.appendChild(notice);
    };
    offer();
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', offer));
    let lastCheck = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        offer();
        if (Date.now() - lastCheck > 300000) { lastCheck = Date.now(); reg.update().catch(() => {}); }
      }
    });
    addEventListener('pageshow', offer);
  }).catch(() => {});
}

