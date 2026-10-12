// Homepage promo carousel. Only live promotions are fetched (active + inside its date window; expiry needs no manual step).
import { sb } from '../supabase.js';
import { esc, waLink } from '../util.js';

let cache = null;
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

export async function mountPromos(el, placement = 'home_hero') {
  if (!el) return;
  const flagged = localStorage.getItem('hh_promos') === '1'; if (flagged) el.innerHTML = '<div class="skel pc-skel" aria-hidden="true"></div>'; // reserve space to avoid layout shift
  try {
    if (!cache || Date.now() - cache.t > 300000) {
      const now = new Date().toISOString();
      const { data, error } = await sb.from('promotions').select('id,title,description,image_path,cta_text,destination_url,whatsapp_number,is_sponsored,category').eq('placement', placement).eq('status', 'active').lte('starts_at', now).gt('ends_at', now).order('starts_at', { ascending: false }).limit(6);
      if (error) throw error; cache = { t: Date.now(), data: data || [] };
    }
    localStorage.setItem('hh_promos', cache.data.length ? '1' : '0'); buildCarousel(el, cache.data);
  } catch { el.innerHTML = ''; }
}
