// Homepage promo carousel. Only live promotions are fetched (active + inside its date window; expiry needs no manual step).
import { sb } from '../supabase.js';
import { esc, waLink } from '../util.js';
import { state } from '../auth.js';
import { current, onLeave } from '../router.js';
import { cached, invalidate, q } from '../cache.js';
import { watch, onResume } from '../live.js';

export const bannerUrl = p => p ? sb.storage.from('promo-banners').getPublicUrl(p).data.publicUrl : '';
export function safeUrl(u) { try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : null; } catch { return null; } }
export function ctaHref(p) {
  const web = p.destination_url && safeUrl(p.destination_url);
  if (web) return web;
  if (p.whatsapp_number && /^\d{10,15}$/.test(p.whatsapp_number)) return waLink(p.whatsapp_number, `Hello, I saw "${p.title}" on HikmahHub.`);
  return null;
}
export const slideHtml = (p, i, n) => { const href = p.cta_text ? ctaHref(p) : null; return `<div class="pc-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}">
  ${p.image_path ? `<img src="${esc(bannerUrl(p.image_path))}" alt="" width="1200" height="600" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">` : ''}<div class="shade"></div>
  ${p.is_sponsored ? '<span class="pc-lab">Sponsored</span>' : ''}
  <div class="txt"><h2>${esc(p.title)}</h2>${p.description ? `<p>${esc(p.description)}</p>` : ''}${href ? `<a class="btn gold" href="${esc(href)}" target="_blank" rel="noopener noreferrer${p.is_sponsored ? ' sponsored' : ''}">${esc(p.cta_text)}</a>` : ''}</div></div>`; };

export function buildCarousel(el, promos, { auto = true } = {}) {
  const n = promos.length; if (!n) { el.innerHTML = ''; return () => { }; }
  el.innerHTML = `<section class="pc" role="region" aria-roledescription="carousel" aria-label="Campus promotions"><div class="pc-track" tabindex="0">${promos.map((p, i) => slideHtml(p, i, n)).join('')}</div>
  ${n > 1 ? `<button class="pc-nav pc-prev" aria-label="Previous promotion">‹</button><button class="pc-nav pc-next" aria-label="Next promotion">›</button><div class="pc-dots">${promos.map((_, i) => `<button aria-label="Go to promotion ${i + 1}" ${i === 0 ? 'aria-current="true"' : ''}></button>`).join('')}</div>` : ''}</section>`;
  if (n < 2) return () => { };
  const track = el.querySelector('.pc-track'), dots = [...el.querySelectorAll('.pc-dots button')]; let idx = 0, timer = null, stopped = !auto || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = i => { idx = (i + n) % n; track.scrollTo({ left: idx * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  const sync = () => { idx = Math.round(track.scrollLeft / track.clientWidth); dots.forEach((d, i) => d.setAttribute('aria-current', i === idx ? 'true' : 'false')); };
  track.addEventListener('scroll', () => { clearTimeout(sync.t); sync.t = setTimeout(sync, 80); }, { passive: true });
  dots.forEach((d, i) => d.onclick = () => { halt(); go(i); });
  el.querySelector('.pc-prev').onclick = () => { halt(); go(idx - 1); }; el.querySelector('.pc-next').onclick = () => { halt(); go(idx + 1); };
  const halt = () => { stopped = true; clearInterval(timer); };           // any interaction stops auto-rotation for good
  ['pointerdown', 'touchstart', 'focusin', 'keydown', 'mouseenter'].forEach(ev => el.addEventListener(ev, halt, { passive: true }));
  if (!stopped) timer = setInterval(() => { if (document.hidden) return; go(idx + 1); }, 7000);
  return () => clearInterval(timer);
}

// Visibility is enforced by the database (RLS: active AND inside its window) and the query below. The browser only decides WHEN to re-check:
// at the exact next start/end time (next_promo_change), on realtime changes (signed-in users), every 3 minutes while the tab is visible, and when you return to the tab.
export async function mountPromos(el, placement = 'home_hero') {
  if (!el) return; const t = current(); let timer = null, poll = null, stopCarousel = () => { }, sig = '';
  if (localStorage.getItem('hh_promos') === '1') el.innerHTML = '<div class="skel pc-skel" aria-hidden="true"></div>';   // reserve space only when promos were shown last time (no layout shift)
  const fetchLive = () => cached(`promos:${placement}`, 60000, () => { const now = new Date().toISOString(); return q(sb.from('promotions').select('id,title,description,image_path,cta_text,destination_url,whatsapp_number,is_sponsored,category').eq('placement', placement).eq('status', 'active').lte('starts_at', now).gt('ends_at', now).order('starts_at', { ascending: false }).limit(6)); });
  const schedule = async () => { clearTimeout(timer); try { const { data } = await sb.rpc('next_promo_change', { p_placement: placement }); if (!data) return; const ms = Math.min(Math.max(new Date(data) - Date.now() + 1000, 5000), 900000); timer = setTimeout(() => draw(true), ms); } catch { } };
  async function draw(force) {
    if (t !== current() || !el.isConnected) return; if (force) invalidate('promos:');
    try {
      const data = await fetchLive(); if (t !== current()) return;
      const s = JSON.stringify(data.map(p => [p.id, p.title, p.description, p.image_path, p.cta_text, p.destination_url, p.whatsapp_number, p.is_sponsored]));
      if (s !== sig) { sig = s; stopCarousel(); stopCarousel = buildCarousel(el, data); }       // only rebuild when something actually changed
      localStorage.setItem('hh_promos', data.length ? '1' : '0'); schedule();
    } catch { if (!sig) el.innerHTML = ''; }
  }
  await draw(false);
  poll = setInterval(() => { if (!document.hidden) draw(true); }, 180000);
  const stopWatch = state.user ? watch('promotions', () => draw(true)) : () => { }, stopResume = onResume(() => draw(false));
  onLeave(() => { clearTimeout(timer); clearInterval(poll); stopCarousel(); stopWatch(); stopResume(); });
}
