// Vercel serverless function: serves Open Graph tags to link-preview crawlers (WhatsApp, Facebook, X, Telegram...).
// Real visitors get the normal single-page app. Env vars (Vercel -> Settings -> Environment Variables):
//   SUPABASE_URL, SUPABASE_ANON_KEY  (both are public values; never use the service-role key here)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLUG = /^[a-z0-9-]{1,120}$/;
module.exports = async (req, res) => {
  const base = process.env.SUPABASE_URL || 'https://tqfgrugtgjnxlbqffmgy.supabase.co', key = process.env.SUPABASE_ANON_KEY;
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const { store, product } = req.query;
  let title = 'HikmahHub – Campus marketplace', desc = "Discover what's being sold, wanted and happening around your campus.", image = `${origin}/assets/og-default.png`, path = '/';
  try {
    if (key && SLUG.test(store || '')) {
      const call = (fn, body) => fetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : []);
      if (product && SLUG.test(product)) {
        const p = (await call('get_shared_product', { p_store_slug: store, p_product_slug: product }))[0];
        if (p) { path = `/shop/${store}/${product}`; title = `${p.title} – ₦${Number(p.price).toLocaleString('en-NG')}`; desc = `${p.store_name} on HikmahHub${p.short_description ? ' · ' + p.short_description : ''}`;
          if (p.image_path) image = `${base}/storage/v1/object/public/product-images/${p.image_path.split('/').map(encodeURIComponent).join('/')}`; }
      } else {
        const s = (await call('get_shared_store', { p_store_slug: store }))[0];
        if (s) { path = `/shop/${store}`; title = `${s.store_name} on HikmahHub`; desc = s.short_description || 'Student store on HikmahHub'; if (s.logo_path) image = `${base}/storage/v1/object/public/vendor-logos/${s.logo_path.split('/').map(encodeURIComponent).join('/')}`; }
      }
    }
  } catch { /* fall back to defaults */ }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(origin + path)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="HikmahHub"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(origin + path)}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:image" content="${esc(image)}"></head>
<body><h1>${esc(title)}</h1><p>${esc(desc)}</p><p><a href="${esc(path)}">Open on HikmahHub</a></p></body></html>`);
};
