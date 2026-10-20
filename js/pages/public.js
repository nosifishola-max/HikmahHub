import { sb } from '../supabase.js';
import { state, scope } from '../auth.js';
import { $, $$, esc, money, img, fmtDate, toast, waLink, share, setMeta, skeleton, errBox, formData } from '../util.js';
import { go, current, onLeave } from '../router.js';
import { mountPromos } from './promos.js';
import { cached, invalidate, q } from '../cache.js';
import { watch, onResume } from '../live.js';
import { getSeed } from '../seed.js';
const openShareSheet = async o => (await import('../share.js')).openShareSheet(o);   // share code loads only when someone taps Share
const getCats = () => cached('cats:top', 600000, () => q(sb.from('categories').select('id,name,slug,parent_id').is('parent_id', null).eq('is_active', true).order('sort_order')));

const discount = p => (p.was && Number(p.was) > Number(p.price) && Number(p.price) >= 0) ? Math.round((1 - Number(p.price) / Number(p.was)) * 100) : 0;
export const card = (p, extra = '') => { const d = discount(p); return `<div class="card"><a class="cl" href="/shop/${esc(p.store_slug)}/${esc(p.slug)}" data-link>
  <div class="pw"><img class="ph" loading="lazy" decoding="async" width="400" height="400" src="${img('product-images', p.image_path, true)}" alt="${esc(p.title)}">${p.availability && p.availability !== 'available' ? `<span class="badge bad tag">${esc(p.availability.replace('_', ' '))}</span>` : ''}</div>
  <div class="b"><div class="t">${esc(p.title)}</div><div class="price">${money(p.price)}</div>
  ${d ? `<div class="pr2"><span class="was">${money(p.was)}</span><span class="disc">-${d}%</span></div>` : ''}
  <div class="store"><span class="sn">${esc(p.store_name)}</span>${p.is_verified ? '<span class="vf" title="Verified Student Vendor" aria-label="Verified Student Vendor">✓</span>' : ''}</div></div></a>${extra}</div>`; };
const signinCta = () => `<div class="notice"><b>See the full campus marketplace.</b> Sign in with your student account to browse every listing, trends, deals and events. <div class="row" style="margin-top:10px"><a class="btn" href="/login" data-link>Sign in or join</a></div></div>`;
const emptyReq = q => `<div class="empty"><h3>Can't find what you're looking for?</h3><p class="muted">Tell students and vendors what you need${q ? ` – "${esc(q)}"` : ''}.</p><a class="btn gold" href="/request?title=${encodeURIComponent(q || '')}" data-link>Request it</a></div>`;
const rankList = (items, line) => items.length ? `<ol class="rank">${items.map((x, i) => `<li><span class="n">${i + 1}</span>${line(x)}</li>`).join('')}</ol>` : '<p class="muted">Rankings appear once students start browsing.</p>';

const feedHtml = (tr, latest, tv) => `<div class="sec"><div class="head"><h2>HikmahHub Weekly</h2><a href="/trending" data-link>See all</a></div>
  <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"><div class="panel"><h3>Top vendors</h3>${rankList(tv || [], v => `<a href="/shop/${esc(v.slug)}" data-link>${esc(v.store_name)}</a>`)}</div>
  <div class="panel"><h3>Trending products</h3>${rankList(tr || [], t => `<a href="/shop/${esc(t.store_slug)}/${esc(t.slug)}" data-link>${esc(t.title)}</a>`)}</div></div></div>
  <div class="sec"><div class="head"><h2>Fresh listings</h2><a href="/marketplace" data-link>Browse all</a></div>${latest?.length ? `<div class="grid">${latest.map(x => card(x)).join('')}</div>` : emptyReq('')}</div>`;
const anonHtml = data => signinCta() + `<div class="sec"><div class="head"><h2>Featured on HikmahHub</h2></div>${data?.length ? `<div class="grid">${data.map(x => card(x)).join('')}</div>` : '<p class="muted">Featured listings will show here.</p>'}</div>
  <div class="sec"><div class="panel"><h3>Sell on campus</h3><p class="muted">Student with something to sell? Create an account, then apply to open your free store.</p><a class="btn ghost" href="/login?mode=signup" data-link>Create account</a></div></div>`;

export async function home(app) {
  setMeta('Campus marketplace', "Discover what's being sold, wanted and happening around your campus."); const t = current(), sc = scope();
  app.innerHTML = `<div class="wrap"><div id="promos"></div></div><section class="hero"><div class="wrap"><h1>Discover what's being sold, wanted and happening on campus</h1>
    <p>Browse student vendors, compare prices, then chat the seller on WhatsApp.</p>
    <form action="/marketplace" role="search"><input name="q" type="search" placeholder="Search phones, food, services…" aria-label="Search"><button class="btn gold">Search</button></form></div></section>
    <div class="wrap"><div class="sec"><div class="chips" id="cats"></div></div><div id="feed">${skeleton(4)}</div></div>`;
  mountPromos($('#promos'));
  getCats().then(cats => { if (t === current() && $('#cats')) $('#cats').innerHTML = cats.map(c => `<a href="/marketplace?cat=${c.id}" data-link>${esc(c.name)}</a>`).join(''); }).catch(() => { });   // never blocks the feed
  const load = () => state.user
    ? Promise.all([cached(`home:tr:${sc}`, 120000, () => q(sb.rpc('get_trending_products', { p_days: 7, p_limit: 4 }))), cached(`home:latest:${sc}:${getSeed()}`, 60000, () => q(sb.rpc('search_products', { p_limit: 8, p_sort: 'mixed', p_seed: getSeed() }))), cached(`home:tv:${sc}`, 120000, () => q(sb.rpc('get_top_vendors', { p_days: 7, p_limit: 3 })))])   // one parallel round
    : cached('home:prev', 120000, () => q(sb.from('public_product_previews').select('*')));
  const draw = async () => { try { const r = await load(); if (t !== current()) return; $('#feed').innerHTML = state.user ? feedHtml(...r) : anonHtml(r); } catch (e) { if (t === current() && !$('#feed .grid')) $('#feed').innerHTML = errBox(e); } };
  await draw();
  if (state.user) { onLeave(watch('products', () => { invalidate('home:'); invalidate('mk:'); draw(); })); onLeave(onResume(draw)); }
}

export async function marketplace(app, _, qs) {
  setMeta('Marketplace', 'Browse products and services from verified student vendors.'); const t = current(), sc = scope();
  const f = { q: qs.get('q') || '', cat: qs.get('cat') || '', type: qs.get('type') || '', sort: qs.get('sort') || 'mixed' };
  const catOpts = cats => `<option value="">All categories</option>${(cats || []).map(c => `<option value="${c.id}" ${c.id === f.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;
  app.innerHTML = `<div class="wrap pad"><h1>Marketplace</h1>
    <form id="f" class="row" role="search"><input class="grow" name="q" type="search" value="${esc(f.q)}" placeholder="Search products, services, stores" aria-label="Search">
    <button class="btn">Search</button></form>
    <div class="row" style="margin:8px 0"><select id="cat" aria-label="Category">${catOpts([])}</select>
    <select id="type" aria-label="Type"><option value="">Products and services</option><option value="product" ${f.type === 'product' ? 'selected' : ''}>Products</option><option value="service" ${f.type === 'service' ? 'selected' : ''}>Services</option></select>
    <select id="sort" aria-label="Sort"><option value="mixed" ${f.sort === 'mixed' ? 'selected' : ''}>Recommended</option><option value="newest" ${f.sort === 'newest' ? 'selected' : ''}>Newest</option><option value="oldest" ${f.sort === 'oldest' ? 'selected' : ''}>Oldest</option><option value="price_asc" ${f.sort === 'price_asc' ? 'selected' : ''}>Price: low to high</option><option value="price_desc" ${f.sort === 'price_desc' ? 'selected' : ''}>Price: high to low</option></select></div>
    <div id="newpill" hidden style="position:sticky;top:54px;z-index:5;text-align:center;margin-bottom:6px"><button class="btn sm gold" id="np">New listings available. Tap to refresh</button></div>
    <div id="res">${skeleton(8)}</div><div class="row" style="justify-content:center;margin-top:10px"><button id="more" class="btn ghost" hidden>Load more</button></div></div>`;
  getCats().then(c => { if (t === current() && $('#cat')) $('#cat').innerHTML = catOpts(c); }).catch(() => { });   // the list renders without waiting for categories
  const apply = () => go(`/marketplace?${new URLSearchParams({ q: $('#f [name=q]').value.trim(), cat: $('#cat').value, type: $('#type').value, sort: $('#sort').value })}`);
  $('#f').onsubmit = e => { e.preventDefault(); apply(); }; ['cat', 'type', 'sort'].forEach(i => $('#' + i).onchange = apply);
  if (!state.user) { try { const data = await cached('home:prev', 120000, () => q(sb.from('public_product_previews').select('*'))); if (t === current()) $('#res').innerHTML = signinCta() + (data?.length ? `<div class="grid">${data.map(x => card(x)).join('')}</div>` : ''); } catch (e) { if (t === current()) $('#res').innerHTML = errBox(e); } return; }
  let off = 0; const size = 24, seen = new Set();
  const page = o => q(sb.rpc('search_products', { p_q: f.q || null, p_category: f.cat || null, p_type: f.type || null, p_sort: f.sort, p_seed: getSeed(), p_limit: size, p_offset: o }));
  const load = async first => {
    try {
      const data = first ? await cached(`mk:${sc}:${getSeed()}:${qs.toString()}`, 30000, async () => { const d = await page(0); if (f.q) sb.rpc('record_search', { p_query: f.q, p_results: d.length }); return d; }) : await page(off);   // search is only recorded on real network fetches
      if (t !== current()) return;
      if (first) { seen.clear(); $('#res').innerHTML = data.length ? '<div class="grid" id="g"></div>' : emptyReq(f.q); $('#newpill').hidden = true; }
      const add = data.filter(x => !seen.has(x.id)); add.forEach(x => seen.add(x.id));            // never show the same product twice
      if (add.length) $('#g').insertAdjacentHTML('beforeend', add.map(x => card(x)).join(''));
      $('#more').hidden = data.length < size; off += size;
    } catch (e) { if (t === current() && first) $('#res').innerHTML = errBox(e); else toast('Could not load more. Check your connection.'); }
  };
  $('#more').onclick = () => load(false); $('#np').onclick = () => { off = 0; load(true); }; await load(true);
  onLeave(watch('products', () => { invalidate('mk:'); invalidate('home:'); if (window.scrollY < 300 && off <= size) { off = 0; load(true); } else $('#newpill') && ($('#newpill').hidden = false); }));   // never yanks the list while you're scrolling
}

export async function product(app, [store, slug]) {
  app.innerHTML = `<div class="wrap pad">${skeleton(2)}</div>`;
  let p, imgs = [], loggedIn = !!state.user;
  if (loggedIn) {
    const { data, error } = await sb.from('products').select('*, vendors!inner(id,store_name,slug,is_verified,whatsapp_number,campus_location), product_images(path,sort_order), categories(name)').eq('slug', slug).eq('vendors.slug', store).maybeSingle();
    if (error || !data) { app.innerHTML = `<div class="wrap pad"><div class="empty"><h3>Listing not found</h3><p class="muted">It may have been removed or is awaiting approval.</p><a class="btn" href="/marketplace" data-link>Back to marketplace</a></div></div>`; return; }
    p = data; imgs = (data.product_images || []).sort((a, b) => a.sort_order - b.sort_order).map(i => i.path);
  } else {
    const { data } = await sb.rpc('get_shared_product', { p_store_slug: store, p_product_slug: slug });
    const s = data?.[0]; if (!s) { app.innerHTML = `<div class="wrap pad"><div class="empty"><h3>Listing not found</h3><a class="btn" href="/" data-link>Home</a></div></div>`; return; }
    p = { id: s.id, title: s.title, description: s.short_description, price: s.price, availability: s.availability, vendors: { store_name: s.store_name, slug: s.store_slug, is_verified: s.is_verified } }; imgs = s.image_path ? [s.image_path] : [];
  }
  const v = p.vendors, url = `/shop/${v.slug}/${p.slug || slug}`;
  setMeta(p.title, `${money(p.price)} · ${v.store_name} on HikmahHub`, imgs[0] ? img('product-images', imgs[0]) : undefined);
  const msg = `Hello, I'm interested in ${p.title} on HikmahHub.\n${location.origin}${url}`;
  app.innerHTML = `<div class="wrap pad"><div class="pd"><div class="gal"><img id="main" src="${img('product-images', imgs[0])}" alt="${esc(p.title)}"><div class="thumbs">${imgs.map(i => `<img loading="lazy" src="${img('product-images', i, true)}" alt="" width="64" height="64" data-s="${img('product-images', i)}">`).join('')}</div></div>
  <div><h1>${esc(p.title)}</h1><p class="price" style="font-size:1.5rem;margin:.2rem 0">${money(p.price)}</p>
  <p><span class="badge ${p.availability === 'available' ? 'ok' : 'bad'}">${esc(String(p.availability).replace('_', ' '))}</span> ${p.categories ? `<span class="badge teal">${esc(p.categories.name)}</span>` : ''}</p>
  <p style="white-space:pre-wrap">${esc(p.description || '')}</p>
  <div class="panel"><a href="/shop/${esc(v.slug)}" data-link><b>${esc(v.store_name)}</b></a> ${v.is_verified ? '<span class="badge ok">✓ Verified Student Vendor</span>' : ''}<div class="small muted">${esc(v.campus_location || '')}</div><div class="small muted">Verification means the vendor was reviewed and approved by HikmahHub. HikmahHub does not guarantee transactions between buyers and vendors.</div></div>
  <div class="row">${loggedIn ? `<button id="wa" class="btn wa grow">Chat seller on WhatsApp</button>` : `<a class="btn grow" href="/login" data-link>Sign in to contact seller</a>`}
  <button id="sh" class="btn ghost">Share</button>${loggedIn ? `<button id="sv" class="btn ghost">Save</button>` : ''}</div>
  ${loggedIn ? `<details style="margin-top:14px"><summary>Report this listing</summary><form id="rp"><label>Reason<select name="reason"><option value="suspicious">Suspicious</option><option value="scam">Scam or fraud concern</option><option value="misleading">Misleading information</option><option value="inappropriate">Inappropriate content</option><option value="fake">Fake product or service</option><option value="prohibited">Prohibited item</option><option value="other">Other</option></select></label><label>Details<textarea name="details" maxlength="1000"></textarea></label><button class="btn sm danger" style="margin-top:8px">Send report</button></form></details>` : ''}</div></div>
  <div id="rel"></div></div>`;
  $$('.thumbs img').forEach(t => t.onclick = () => $('#main').src = t.dataset.s);
  $('#sh').onclick = () => openShareSheet({ title: p.title, price: p.price, store: v.store_name, path: url, imageUrl: imgs[0] ? img('product-images', imgs[0]) : null });
  sb.rpc('record_product_view', { p_product: p.id });
  if (!loggedIn) return;
  $('#wa').onclick = () => { sb.rpc('record_whatsapp_click', { p_vendor: v.id, p_product: p.id }); window.open(waLink(v.whatsapp_number, msg), '_blank', 'noopener'); };
  $('#sv').onclick = async () => { const { data, error } = await sb.rpc('toggle_save', { p_product: p.id }); error ? toast(error.message) : toast(data ? 'Saved' : 'Removed from saved'); };
  $('#rp').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); const { error } = await sb.from('reports').insert({ reporter_id: state.user.id, target_type: 'product', target_id: p.id, reason: d.reason, details: d.details || null }); toast(error ? error.message : 'Report sent. Thank you.'); if (!error) e.target.reset(); };
  const rel = await sb.rpc('search_products', { p_category: p.category_id || null, p_limit: 5, p_sort: 'mixed', p_seed: getSeed() });
  const r = (rel.data || []).filter(x => x.id !== p.id).slice(0, 4);
  if (r.length) $('#rel').innerHTML = `<div class="sec"><h2>More like this</h2><div class="grid">${r.map(card).join('')}</div></div>`;
}

export async function shop(app, [store]) {
  let s, items = [];
  if (state.user) {
    const { data } = await sb.from('vendors').select('*').eq('slug', store).eq('status', 'approved').maybeSingle(); s = data;
    if (s) { const r = await cached(`shop:${scope()}:${s.slug}`, 60000, () => q(sb.rpc('search_products', { p_q: s.store_name, p_limit: 60 }))); items = (r || []).filter(x => x.store_slug === s.slug); }
  } else { const { data } = await sb.rpc('get_shared_store', { p_store_slug: store }); s = data?.[0]; }
  if (!s) { app.innerHTML = `<div class="wrap pad"><div class="empty"><h3>Store not found</h3><a class="btn" href="/marketplace" data-link>Browse marketplace</a></div></div>`; return; }
  setMeta(s.store_name, s.description || s.short_description || 'Student store on HikmahHub', s.logo_path ? img('vendor-logos', s.logo_path) : undefined);
  const wa = state.user ? `<a class="btn wa" id="wa" href="${waLink(s.whatsapp_number, `Hello ${s.store_name}, I found your store on HikmahHub.\n${location.href}`)}" target="_blank" rel="noopener">Chat on WhatsApp</a>` : `<a class="btn" href="/login" data-link>Sign in to contact</a>`;
  app.innerHTML = `<div class="wrap pad"><div class="shop-h"><img src="${img('vendor-logos', s.logo_path)}" alt=""><div><h1>${esc(s.store_name)}</h1>${s.is_verified ? '<span class="badge ok">✓ Verified Student Vendor</span>' : ''}<div class="small muted">${esc(s.campus_location || '')}</div></div></div>
  <p>${esc(s.description || s.short_description || '')}</p><div class="row">${wa}<button id="sh" class="btn ghost">Share store</button></div>
  ${state.user ? `<div class="sec"><h2>Products</h2>${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<p class="muted">No active listings yet.</p>'}</div>` : signinCta()}</div>`;
  $('#sh').onclick = () => openShareSheet({ title: s.store_name, price: null, store: s.store_name, path: '/shop/' + s.slug, imageUrl: null });
  sb.rpc('record_store_view', { p_vendor: s.id });
  if (state.user) $('#wa')?.addEventListener('click', () => sb.rpc('record_whatsapp_click', { p_vendor: s.id }));
}

export async function deals(app) {
  setMeta('Campus deals', 'Limited-time offers from verified student vendors.');
  if (!state.user) { app.innerHTML = `<div class="wrap pad"><h1>Campus deals</h1>${signinCta()}</div>`; return; }
  const t = current(); app.innerHTML = `<div class="wrap pad"><h1>Campus deals</h1><div id="r">${skeleton(4)}</div></div>`;
  const draw = data => {
    const items = data.filter(d => new Date(d.ends_at) > Date.now()).map(d => ({ slug: d.products.slug, store_slug: d.vendors.slug, title: d.products.title, price: d.deal_price, was: d.original_price, store_name: d.vendors.store_name, is_verified: d.vendors.is_verified, image_path: d.products.product_images?.sort((a, b) => a.sort_order - b.sort_order)[0]?.path, ends: d.ends_at }));   // expired deals drop out even from cached data
    $('#r').innerHTML = items.length ? `<div class="grid">${items.map(x => card(x, `<div class="cx"><div class="small muted">Ends ${fmtDate(x.ends)}</div><button class="btn sm ghost" data-share="/shop/${esc(x.store_slug)}/${esc(x.slug)}" data-t="${esc(x.title)}">Share deal</button></div>`)).join('')}</div>` : `<div class="empty"><h3>No live deals right now</h3><p class="muted">Check back soon, new offers are added by student vendors.</p></div>`;
    $$('[data-share]').forEach(b => b.onclick = () => share(b.dataset.t, b.dataset.share));
  };
  const load = async () => { try { const data = await cached(`deals:${scope()}`, 60000, () => q(sb.from('campus_deals').select('id,deal_price,original_price,ends_at,products(title,slug,product_images(path,sort_order)),vendors(store_name,slug,is_verified)').eq('status', 'approved').gt('ends_at', new Date().toISOString()).order('ends_at').limit(40))); if (t === current()) draw(data); } catch (e) { if (t === current() && !$('#r .grid')) $('#r').innerHTML = errBox(e); } };
  await load(); onLeave(watch('campus_deals', () => { invalidate('deals:'); load(); })); onLeave(onResume(load));
}

export async function events(app) {
  setMeta('Campus events', 'Seminars, competitions, trainings and more around Al-Hikmah University.');
  if (!state.user) { app.innerHTML = `<div class="wrap pad"><h1>Campus events</h1>${signinCta()}</div>`; return; }
  const t = current(); app.innerHTML = `<div class="wrap pad"><h1>Campus events</h1><div id="r">${skeleton(4)}</div></div>`;
  const draw = data => { $('#r').innerHTML = data.length ? `<div class="grid">${data.map(e => `<a class="card" href="/events/${esc(e.slug)}" data-link><img class="ph" loading="lazy" decoding="async" src="${img('event-images', e.image_path, true)}" alt=""><div class="b"><div class="t">${esc(e.title)}</div><div class="small muted">${fmtDate(e.starts_at)}</div><div class="small muted">${esc(e.location || '')}</div></div></a>`).join('')}</div>` : `<div class="empty"><h3>No upcoming events</h3><p class="muted">Events published by HikmahHub will show up here.</p></div>`; };
  const load = async () => { try { const data = await cached(`events:${scope()}`, 60000, () => q(sb.from('events').select('id,title,slug,starts_at,location,image_path').eq('status', 'published').gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at').limit(40))); if (t === current()) draw(data); } catch (e) { if (t === current() && !$('#r .grid')) $('#r').innerHTML = errBox(e); } };
  await load(); onLeave(watch('events', () => { invalidate('events:'); load(); })); onLeave(onResume(load));
}

export async function eventPage(app, [slug]) {
  let e;
  if (state.user) e = (await sb.from('events').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()).data;
  else e = (await sb.rpc('get_shared_event', { p_slug: slug })).data?.[0];
  if (!e) { app.innerHTML = `<div class="wrap pad"><div class="empty"><h3>Event not found</h3><a class="btn" href="/events" data-link>All events</a></div></div>`; return; }
  setMeta(e.title, e.description || e.short_description || '', e.image_path ? img('event-images', e.image_path) : undefined);
  app.innerHTML = `<div class="wrap pad"><img src="${img('event-images', e.image_path)}" alt="" style="max-height:320px;width:100%;object-fit:cover;border-radius:12px"><h1 style="margin-top:12px">${esc(e.title)}</h1><p><b>${fmtDate(e.starts_at)}</b><br>${esc(e.location || '')}${e.organizer ? `<br>Organizer: ${esc(e.organizer)}` : ''}</p><p style="white-space:pre-wrap">${esc(e.description || e.short_description || '')}</p>${e.contact ? `<p class="muted">Contact: ${esc(e.contact)}</p>` : ''}<button id="sh" class="btn ghost">Share event</button>${state.user ? '' : signinCta()}</div>`;
  $('#sh').onclick = () => share(e.title, '/events/' + slug);
}

export async function trending(app) {
  setMeta('Trending', 'Top vendors, trending products and most wanted on campus this week.');
  if (!state.user) { app.innerHTML = `<div class="wrap pad"><h1>HikmahHub Weekly</h1>${signinCta()}</div>`; return; }
  const sc = scope(); const [v, p, m] = (await Promise.all([cached(`tr:v:${sc}`, 120000, () => q(sb.rpc('get_top_vendors', { p_days: 7, p_limit: 10 }))), cached(`tr:p:${sc}`, 120000, () => q(sb.rpc('get_trending_products', { p_days: 7, p_limit: 10 }))), cached(`tr:m:${sc}`, 120000, () => q(sb.rpc('get_most_wanted', { p_days: 7, p_limit: 10 })))])).map(data => ({ data }));
  app.innerHTML = `<div class="wrap pad"><h1>HikmahHub Weekly</h1><p class="muted">Ranked automatically from the last 7 days of views, saves, enquiries and searches.</p>
  <div class="panel"><h2>Top vendors</h2>${rankList(v.data || [], x => `<a href="/shop/${esc(x.slug)}" data-link>${esc(x.store_name)}</a>`)}</div>
  <div class="panel"><h2>Trending products</h2>${rankList(p.data || [], x => `<a href="/shop/${esc(x.store_slug)}/${esc(x.slug)}" data-link>${esc(x.title)}</a> <span class="small muted">${esc(x.store_name)}</span>`)}</div>
  <div class="panel"><h2>Most wanted</h2>${rankList(m.data || [], x => `<span class="grow">${esc(x.term)}</span><a class="btn sm ghost" href="/request?title=${encodeURIComponent(x.term)}" data-link>I want this too</a>`)}</div></div>`;
}

export async function request(app, _, qs) {
  setMeta('Request a product', 'Tell vendors what you are looking for.');
  if (!state.user) { app.innerHTML = `<div class="wrap pad"><h1>Request a product</h1>${signinCta()}</div>`; return; }
  const [cats, { data: mine }] = await Promise.all([getCats(), sb.from('demand_requests').select('id,title,status,created_at').order('created_at', { ascending: false }).limit(10)]);
  app.innerHTML = `<div class="wrap pad"><h1>Request a product</h1><p class="muted">Vendors see how many students want an item, never who you are.</p>
  <form id="f" class="panel"><label>What do you need?<input name="title" required minlength="3" maxlength="120" value="${esc(qs.get('title') || '')}"></label><div id="cnt" class="small muted"></div>
  <label>Details (optional)<textarea name="description" maxlength="1000"></textarea></label><label>Category<select name="category_id"><option value="">Any</option>${(cats || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
  <label>Budget in ₦ (optional)<input name="budget_max" type="number" min="0" inputmode="numeric"></label><button class="btn" style="margin-top:12px">Send request</button></form>
  <h2>Your requests</h2>${(mine || []).length ? `<ul>${mine.map(r => `<li>${esc(r.title)} <span class="badge">${esc(r.status)}</span></li>`).join('')}</ul>` : '<p class="muted">No requests yet.</p>'}</div>`;
  const count = async () => { const t = $('[name=title]').value.trim(); if (t.length < 3) return; const { data } = await sb.rpc('demand_count', { p_term: t }); $('#cnt').textContent = data > 0 ? `${data} student${data > 1 ? 's are' : ' is'} already looking for this.` : ''; };
  $('[name=title]').onblur = count; count();
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target);
    const { error } = await sb.from('demand_requests').insert({ user_id: state.user.id, title: d.title.trim(), description: d.description || null, category_id: d.category_id || null, budget_max: d.budget_max || null });
    if (error) return toast(error.message); toast('Request sent'); go('/request'); };
}

export async function saved(app) {
  setMeta('Saved', 'Products you saved');
  if (!state.user) { app.innerHTML = `<div class="wrap pad"><h1>Saved</h1>${signinCta()}</div>`; return; }
  const { data } = await sb.from('product_saves').select('products(id,title,slug,price,availability,vendors(store_name,slug,is_verified),product_images(path,sort_order))').order('created_at', { ascending: false });
  const list = (data || []).map(x => x.products).filter(Boolean).map(p => ({ ...p, store_name: p.vendors.store_name, store_slug: p.vendors.slug, is_verified: p.vendors.is_verified, image_path: p.product_images?.sort((a, b) => a.sort_order - b.sort_order)[0]?.path }));
  app.innerHTML = `<div class="wrap pad"><h1>Saved</h1>${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="empty"><h3>Nothing saved yet</h3><p class="muted">Tap Save on a product to keep it here.</p><a class="btn" href="/marketplace" data-link>Browse marketplace</a></div>`}</div>`;
}
