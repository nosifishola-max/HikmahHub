// Product gallery (swipe / thumbnails / counter / arrows) and full-screen viewer (swipe, pinch, double-tap, pan, keyboard).
// No libraries: native scroll-snap for the gallery (smooth on low-end phones, never fights vertical page scroll) and Pointer Events for the viewer.
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fit = (nw, nh, vw, vh) => { const f = Math.min(vw / nw, vh / nh); return { w: nw * f, h: nh * f }; };
export function clampPan(s, tx, ty, vw, vh, iw, ih) { const mx = Math.max(0, (iw * s - vw) / 2), my = Math.max(0, (ih * s - vh) / 2); return { tx: clamp(tx, -mx, mx), ty: clamp(ty, -my, my) }; }
export function zoomAt(s0, tx0, ty0, s1, px, py) { const k = s1 / s0; return { tx: px - k * (px - tx0), ty: py - k * (py - ty0) }; }   // keeps the point under your fingers fixed (coordinates relative to the stage centre)
export const nearestIndex = (left, width, n) => clamp(Math.round(left / Math.max(width, 1)), 0, n - 1);
export function swipeResult(dx, dy, width) { const ax = Math.abs(dx), ay = Math.abs(dy); if (ax > Math.max(60, width * .15) && ax > ay * 1.5) return dx < 0 ? 'next' : 'prev'; if (dy > 120 && dy > ax * 1.5) return 'close'; return null; }
const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mountGallery(el, imgs, { alt = 'Product photo', onOpen } = {}) {
  const n = imgs.length; let idx = 0, raf = 0;
  if (!n) { el.innerHTML = '<div class="g-wrap"><div class="g-empty">No photo available</div></div>'; return { go() { }, index: () => 0 }; }
  el.innerHTML = `<div class="g-wrap"><div class="g-track" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${esc(alt)} photos">${imgs.map((m, i) => `<div class="g-slide" data-i="${i}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}" style="background-image:url('${esc(m.thumb)}')"><img src="${esc(m.src)}" alt="${esc(alt)}${n > 1 ? ` (${i + 1} of ${n})` : ''}" draggable="false" decoding="async" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`).join('')}</div>
  ${n > 1 ? `<button type="button" class="g-nav g-prev" aria-label="Previous image">‹</button><button type="button" class="g-nav g-next" aria-label="Next image">›</button><span class="g-count" aria-live="polite">1/${n}</span>` : ''}</div>
  ${n > 1 ? `<div class="g-thumbs" role="tablist" aria-label="Choose a photo">${imgs.map((m, i) => `<button type="button" class="g-th" role="tab" aria-selected="${i === 0}" aria-label="Show photo ${i + 1}" data-i="${i}"><img src="${esc(m.thumb)}" alt="" loading="lazy" decoding="async" width="56" height="56"></button>`).join('')}</div>` : ''}`;
  const track = el.querySelector('.g-track'), count = el.querySelector('.g-count'), thumbsEl = el.querySelector('.g-thumbs'), ths = [...el.querySelectorAll('.g-th')];
  el.querySelectorAll('.g-slide').forEach(sl => { const im = sl.querySelector('img'), ok = () => im.classList.add('ok');   // fade in when loaded; failed images keep the thumbnail/placeholder
    if (im.complete && im.naturalWidth) ok(); else { im.addEventListener('load', ok, { once: true }); im.addEventListener('error', () => { im.remove(); sl.classList.add('bad'); }, { once: true }); } });
  const preload = k => { if (imgs[k]) new Image().src = imgs[k].src; };
  function sync() {
    if (count) count.textContent = `${idx + 1}/${n}`;
    ths.forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
    const b = ths[idx]; if (b && thumbsEl) thumbsEl.scrollTo({ left: b.offsetLeft - (thumbsEl.clientWidth - b.offsetWidth) / 2, behavior: reduce() ? 'auto' : 'smooth' });
    preload(idx + 1); preload(idx - 1);                                              // nearby images only
  }
  function go(i, instant) { i = clamp(i, 0, n - 1); track.scrollTo({ left: i * track.clientWidth, behavior: instant || reduce() ? 'auto' : 'smooth' }); if (instant) { idx = i; sync(); } }
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = nearestIndex(track.scrollLeft, track.clientWidth, n); if (i !== idx) { idx = i; sync(); } }); }, { passive: true });
  el.querySelector('.g-prev')?.addEventListener('click', () => go(idx - 1)); el.querySelector('.g-next')?.addEventListener('click', () => go(idx + 1));
  ths.forEach(b => b.addEventListener('click', () => go(Number(b.dataset.i))));
  track.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); } else if (e.key === 'Enter') onOpen?.(idx); });
  track.addEventListener('click', e => { const s = e.target.closest('.g-slide'); if (s) onOpen?.(Number(s.dataset.i)); });   // a swipe never fires a click, so swiping does not open the viewer
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => track.scrollTo({ left: idx * track.clientWidth, behavior: 'auto' })).observe(track);   // keep the slide aligned on rotate/resize
  sync(); return { go, index: () => idx };
}

export function openViewer(imgs, start, { onClose } = {}) {
  const n = imgs.length; if (!n) return null;
  let i = clamp(start, 0, n - 1), s = 1, tx = 0, ty = 0, closing = false, cur = null, g = null, lastTap = { t: 0, x: 0, y: 0 };
  const prevFocus = document.activeElement, scrollY = window.scrollY, html = document.documentElement, ov = [html.style.overflow, document.body.style.overflow];
  const root = document.createElement('div'); root.className = 'vw'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Product photos');
  root.innerHTML = `<div class="vw-top"><span class="vw-count" aria-live="polite"></span><button type="button" class="vw-x" aria-label="Close photo viewer">✕</button></div><div class="vw-stage"></div>${n > 1 ? '<button type="button" class="vw-nav vw-prev" aria-label="Previous photo">‹</button><button type="button" class="vw-nav vw-next" aria-label="Next photo">›</button>' : ''}<div class="vw-hint">Pinch or double-tap to zoom</div>`;
  document.body.appendChild(root); html.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';   // no page scrolling behind the viewer
  const stage = root.querySelector('.vw-stage'), countEl = root.querySelector('.vw-count'), P = new Map();
  const rect = () => stage.getBoundingClientRect(), apply = () => { if (cur) cur.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; };
  const pan = (x, y) => { const r = rect(), f = fit(cur.naturalWidth || 1, cur.naturalHeight || 1, r.width, r.height); return clampPan(s, x, y, r.width, r.height, f.w, f.h); };
  const animate = () => { if (!cur) return; cur.style.transition = reduce() ? 'none' : 'transform .2s ease'; setTimeout(() => cur && (cur.style.transition = ''), 220); };
  function make(k) {
    const m = imgs[k], im = new Image(); im.className = 'vw-img'; im.draggable = false; im.alt = `Photo ${k + 1} of ${n}`; im.src = m.thumb;   // thumbnail instantly, sharp image swaps in when ready
    const big = new Image(); big.onload = () => { im.src = m.src; }; big.onerror = () => { im.classList.add('bad'); }; big.src = m.src; return im;
  }
  function show(k, dir) {
    const next = make(k), old = cur; if (dir && !reduce()) next.classList.add(dir > 0 ? 'in-r' : 'in-l'); stage.appendChild(next);
    if (old) { if (dir && !reduce()) { old.classList.add(dir > 0 ? 'out-l' : 'out-r'); setTimeout(() => old.remove(), 230); } else old.remove(); }
    cur = next; i = k; s = 1; tx = 0; ty = 0; apply(); countEl.textContent = `${i + 1}/${n}`; [i + 1, i - 1].forEach(j => imgs[j] && (new Image().src = imgs[j].src));
  }
  const go = k => { if (k < 0 || k >= n || k === i) { animate(); tx = ty = 0; s = 1; apply(); return; } show(k, k > i ? 1 : -1); };
  function close(fromPop) {
    if (closing) return; closing = true; document.removeEventListener('keydown', onKey, true); root.remove(); html.style.overflow = ov[0]; document.body.style.overflow = ov[1];
    window.__hhViewer = null; prevFocus?.focus?.({ preventScroll: true }); window.scrollTo(0, scrollY);
    if (!fromPop) { window.__hhSkipPop = true; history.back(); setTimeout(() => { window.__hhSkipPop = false; }, 600); }   // remove the history entry we added so Back works naturally
    onClose?.(i);
  }
  function toggleZoom(x, y) { const r = rect(), s1 = s > 1.05 ? 1 : 2.5, t = zoomAt(s, tx, ty, s1, x - r.left - r.width / 2, y - r.top - r.height / 2); animate(); s = s1; ({ tx, ty } = pan(t.tx, t.ty)); apply(); }
  stage.addEventListener('pointerdown', e => { stage.setPointerCapture?.(e.pointerId); P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (P.size === 2) { const [a, b] = [...P.values()]; g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, tx0: tx, ty0: ty, moved: true }; }
    else if (P.size === 1) g = { mode: s > 1 ? 'pan' : 'swipe', x0: e.clientX, y0: e.clientY, tx0: tx, ty0: ty, moved: false }; });
  stage.addEventListener('pointermove', e => {
    if (!P.has(e.pointerId) || !g) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY }); const r = rect();
    if (g.mode === 'pinch' && P.size === 2) { const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y), s1 = clamp(g.s0 * d / g.d0, 1, 4), t = zoomAt(g.s0, g.tx0, g.ty0, s1, (a.x + b.x) / 2 - r.left - r.width / 2, (a.y + b.y) / 2 - r.top - r.height / 2); s = s1; ({ tx, ty } = pan(t.tx, t.ty)); apply(); }
    else if (P.size === 1) { const dx = e.clientX - g.x0, dy = e.clientY - g.y0; if (Math.abs(dx) + Math.abs(dy) > 8) g.moved = true;
      if (g.mode === 'pan') { ({ tx, ty } = pan(g.tx0 + dx, g.ty0 + dy)); apply(); } else if (g.mode === 'swipe' && g.moved) { cur.style.transform = `translate(${dx * .8}px,${Math.max(dy, 0) * .6}px)`; } }
  });
  const end = e => {
    if (!P.has(e.pointerId)) return; P.delete(e.pointerId); if (!g) return;
    if (g.mode === 'pinch') { if (P.size === 1) { const [r] = [...P.values()]; if (s < 1.03) { s = 1; tx = ty = 0; animate(); apply(); } g = { mode: s > 1 ? 'pan' : 'swipe', x0: r.x, y0: r.y, tx0: tx, ty0: ty, moved: true }; } else if (!P.size) g = null; return; }
    if (P.size) return; const dx = e.clientX - g.x0, dy = e.clientY - g.y0, moved = g.moved, mode = g.mode; g = null;
    if (mode === 'swipe' && moved) { const r = swipeResult(dx, dy, rect().width); animate(); if (r === 'next') go(i + 1); else if (r === 'prev') go(i - 1); else if (r === 'close') close(); else { tx = ty = 0; apply(); } return; }
    if (!moved) { const now = Date.now(); if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { toggleZoom(e.clientX, e.clientY); lastTap.t = 0; } else lastTap = { t: now, x: e.clientX, y: e.clientY }; }
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', e => { e.preventDefault(); const r = rect(), s1 = clamp(s * Math.exp(-e.deltaY * .002), 1, 4), t = zoomAt(s, tx, ty, s1, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2); s = s1; ({ tx, ty } = pan(t.tx, t.ty)); apply(); }, { passive: false });   // desktop: scroll to zoom
  stage.addEventListener('dblclick', e => e.preventDefault());
  root.querySelector('.vw-x').addEventListener('click', () => close()); root.querySelector('.vw-prev')?.addEventListener('click', () => go(i - 1)); root.querySelector('.vw-next')?.addEventListener('click', () => go(i + 1));
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'Tab') { const f = [...root.querySelectorAll('button')]; if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  }
  document.addEventListener('keydown', onKey, true);
  history.pushState({ hhViewer: true }, ''); window.__hhViewer = () => close(true);          // phone Back button closes the viewer instead of leaving the page
  show(i, 0); root.querySelector('.vw-x').focus(); setTimeout(() => root.querySelector('.vw-hint')?.classList.add('gone'), 3000);
  return { close };
}
