// Vercel serverless function: returns page-specific Open Graph / Twitter metadata in the FIRST HTML response, for link-preview crawlers
// (WhatsApp, Facebook, X/Twitter, Telegram, Slack, LinkedIn, Discord, Google ...). Normal visitors get the app (index.html) and never reach this.
// Test it in any browser by adding ?og=1 to a page URL. Data comes only from the public share functions (approved, public content).
const SITE = (process.env.SITE_URL || 'https://hikmahhub.com.ng').replace(/\/$/, '');
const BASE = process.env.SUPABASE_URL || 'https://tqfgrugtgjnxlbqffmgy.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZmdydWd0Z2pueGxicWZmbWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjA0OTIsImV4cCI6MjEwNzIzNjQ5Mn0.7jTwX0tR4W95MYIvdrgfrr4g483rZ5-NT1RsrG4ynKg';   // public anon key (safe by design; RLS protects data)
const DEFAULT_IMG = `${SITE}/assets/og-home.jpg`, SLUG = /^[a-z0-9-]{1,120}$/;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const money = n => '₦' + Number(n).toLocaleString('en-NG');
const pub = (bucket, path) => path && !String(path).includes('..') ? `${BASE}/storage/v1/object/public/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}` : null;
async function rpc(fn, args) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);   // never keep a crawler waiting
  try { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: 'POST', signal: ctl.signal, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); return r.ok ? ((await r.json())[0] || null) : null; } catch { return null; } finally { clearTimeout(t); }
}
const GENERIC = {
  home: ['HikmahHub', 'Discover products, services, student businesses, and opportunities around your campus.', '/'],
  marketplace: ['Marketplace | HikmahHub', 'Browse products and services from verified student vendors at Al-Hikmah University.', '/marketplace'],
  deals: ['Campus Deals | HikmahHub', 'Limited-time offers from verified student vendors on campus.', '/deals'],
  events: ['Campus Events | HikmahHub', 'Seminars, competitions, trainings and more around Al-Hikmah University.', '/events'],
};
async function build(q) {
  const kind = q.kind || 'home', g = GENERIC[kind];
  if (g) return { title: g[0], desc: g[1], path: g[2], image: DEFAULT_IMG, wide: true };
  if (kind === 'product' && SLUG.test(q.store || '') && SLUG.test(q.product || '')) {
    const p = await rpc('get_shared_product', { p_store_slug: q.store, p_product_slug: q.product }); if (!p) return null;
    const img = pub('product-images', p.image_path);
    return { title: `${clip(p.title, 70)} – ${money(p.price)} | HikmahHub`, desc: clip(`${money(p.price)} · Sold by ${p.store_name} on HikmahHub.${p.short_description ? ' ' + p.short_description : ''}`, 200), path: `/shop/${q.store}/${q.product}`, image: img || DEFAULT_IMG, wide: !img, alt: p.title, type: 'product', price: p.price };
  }
  if (kind === 'store' && SLUG.test(q.store || '')) {
    const s = await rpc('get_shared_store', { p_store_slug: q.store }); if (!s) return null;
    const cover = pub('product-images', s.cover_image_path), logo = pub('vendor-logos', s.logo_path);
    return { title: `${clip(s.store_name, 70)} on HikmahHub`, desc: clip(s.short_description || `Shop from ${s.store_name} on HikmahHub, the campus marketplace for Al-Hikmah University.${s.campus_location ? ' ' + s.campus_location : ''}`, 200), path: `/shop/${q.store}`, image: cover || logo || DEFAULT_IMG, wide: !!cover || !logo, alt: s.store_name };   // logos are only 256px: a product photo makes a better large preview
  }
  if (kind === 'event' && SLUG.test(q.slug || '')) {
    const e = await rpc('get_shared_event', { p_slug: q.slug }); if (!e) return null;
    const when = e.starts_at ? new Date(e.starts_at).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' }) : '';
    const img = pub('event-images', e.image_path);
    return { title: `${clip(e.title, 80)} | HikmahHub Events`, desc: clip([when, e.location, e.organizer && `By ${e.organizer}`].filter(Boolean).join(' · ') + (e.short_description ? '. ' + e.short_description : ''), 200), path: `/events/${q.slug}`, image: img || DEFAULT_IMG, wide: true, alt: e.title };
  }
  return null;
}
module.exports = async (req, res) => {
  const q = req.query || {}; let m = null;
  try { m = await build(q); } catch { m = null; }
  const missing = !m && !GENERIC[q.kind || 'home'];
  if (!m) m = { title: 'HikmahHub', desc: GENERIC.home[1], path: '/', image: DEFAULT_IMG, wide: true };
  const url = SITE + m.path, tags = [
    ['property', 'og:type', m.type || 'website'], ['property', 'og:site_name', 'HikmahHub'], ['property', 'og:locale', 'en_NG'], ['property', 'og:url', url], ['property', 'og:title', m.title], ['property', 'og:description', m.desc],
    ['property', 'og:image', m.image], ['property', 'og:image:secure_url', m.image], ['property', 'og:image:alt', m.alt || 'HikmahHub'],
    ['name', 'twitter:card', m.wide ? 'summary_large_image' : 'summary'], ['name', 'twitter:title', m.title], ['name', 'twitter:description', m.desc], ['name', 'twitter:image', m.image]];
  if (m.image === DEFAULT_IMG) tags.push(['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630']);
  if (m.type === 'product') tags.push(['property', 'product:price:amount', String(m.price)], ['property', 'product:price:currency', 'NGN']);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', missing ? 'public, s-maxage=60' : 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(missing ? 404 : 200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(m.title)}</title><meta name="description" content="${esc(m.desc)}"><link rel="canonical" href="${esc(url)}">${missing ? '<meta name="robots" content="noindex">' : ''}
${tags.map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}">`).join('\n')}
</head><body><h1>${esc(m.title)}</h1><p>${esc(m.desc)}</p><p><a href="${esc(url)}">Open on HikmahHub</a></p></body></html>`);
};
