import { sb } from '../supabase.js';
import { state, isAdmin } from '../auth.js';
import { $, $$, esc, money, img, toast, fmtDate, formData, upload, removeFiles, setMeta } from '../util.js';
import { go } from '../router.js';
import { regenerate, currentVersion, cleanupFiles } from '../branding.js';
import { buildCarousel, bannerUrl } from './promos.js';
import { encode, sha256, put } from '../util.js';

let tab = 'overview';
const TABS = { overview: 'Overview', vendors: 'Vendors', products: 'Products', deals: 'Deals', events: 'Events', categories: 'Categories', reports: 'Reports', demand: 'Demand', promotions: 'Promotions', branding: 'Branding', storage: 'Storage' };
const run = async (p, ok = 'Done') => { const { error } = await p; toast(error ? error.message : ok); return !error; };

export async function admin(app) {
  if (!state.user) return go('/login');
  if (!isAdmin()) { app.innerHTML = `<div class="wrap pad"><div class="empty"><h3>Admins only</h3><a class="btn" href="/" data-link>Go home</a></div></div>`; return; }
  setMeta('Admin', 'HikmahHub administration');
  app.innerHTML = `<div class="wrap pad"><h1>Admin</h1><div class="seg">${Object.entries(TABS).map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tab">Loading…</div></div>`;
  $$('.seg button').forEach(b => b.onclick = () => { tab = b.dataset.t; admin(app); });
  await ({ overview, vendors, products, deals, events, categories, reports, demand, promotions, branding, storage })[tab]($('#tab'));
}
const again = () => admin($('#app'));
const table = (head, rows) => rows.length ? `<div class="scroll"><table class="tbl"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table></div>` : '<div class="empty">Nothing here yet.</div>';

async function overview(el) {
  const [{ data: o, error }, { data: rk }] = await Promise.all([sb.rpc('get_admin_overview'), sb.from('weekly_rankings').select('*').order('week_start', { ascending: false }).order('rank').limit(30)]);
  if (error) return el.innerHTML = esc(error.message);
  const L = { students: 'Students', vendors_total: 'Vendors', vendors_pending: 'Pending vendors', vendors_verified: 'Verified vendors', products_active: 'Active products', products_pending: 'Pending products', product_views_7d: 'Product views (7d)', store_views_7d: 'Store views (7d)', whatsapp_clicks_7d: 'WhatsApp clicks (7d)', demand_requests_open: 'Open requests', deals_active: 'Active deals', events_upcoming: 'Upcoming events', reports_open: 'Open reports' };
  el.innerHTML = `<div class="stats">${Object.entries(L).map(([k, l]) => `<div class="stat"><b>${o[k]}</b>${l}</div>`).join('')}</div>
  <div class="panel" style="margin-top:14px"><div class="row"><h2 class="grow">Weekly rankings</h2><button id="snap" class="btn sm">Generate this week</button></div>
  ${rk?.length ? table(['Week', 'Type', '#', 'Name', 'Score'], rk.map(r => `<tr><td>${r.week_start}</td><td>${r.kind.replace('_', ' ')}</td><td>${r.rank}</td><td>${esc(r.label)}</td><td>${r.score}</td></tr>`)) : '<p class="muted">No snapshot yet. Rankings are also live for students.</p>'}</div>`;
  $('#snap').onclick = async () => { if (await run(sb.rpc('snapshot_weekly_rankings'), 'Rankings generated')) again(); };
}

async function vendors(el) {
  const { data } = await sb.from('vendors').select('id,store_name,status,is_verified,is_featured,whatsapp_number,business_category,created_at,profiles!vendors_owner_id_fkey(full_name,email,matric_number)').order('created_at', { ascending: false });
  el.innerHTML = table(['Store', 'Owner', 'Status', 'Actions'], (data || []).map(v => `<tr><td><b>${esc(v.store_name)}</b><br><span class="small muted">${esc(v.business_category || '')}<br>${esc(v.whatsapp_number)}</span></td><td>${esc(v.profiles?.full_name)}<br><span class="small muted">${esc(v.profiles?.email)}<br>${esc(v.profiles?.matric_number || '')}</span></td><td><span class="badge ${v.status === 'approved' ? 'ok' : v.status === 'pending' ? '' : 'bad'}">${v.status}</span></td>
  <td><div class="row">${v.status !== 'approved' ? `<button class="btn sm" data-a="approved" data-id="${v.id}">Approve</button>` : `<button class="btn sm danger" data-a="suspended" data-id="${v.id}">Suspend</button>`}${v.status === 'pending' ? `<button class="btn sm danger" data-a="rejected" data-id="${v.id}">Reject</button>` : ''}<button class="btn sm ghost" data-f="${v.id}" data-v="${!v.is_featured}">${v.is_featured ? 'Unfeature' : 'Feature'}</button></div></td></tr>`));
  $$('[data-a]', el).forEach(b => b.onclick = async () => { const reason = b.dataset.a === 'approved' ? null : prompt('Reason (shown to the vendor):') ; if (b.dataset.a !== 'approved' && reason === null) return; if (await run(sb.rpc('admin_set_vendor_status', { p_vendor: b.dataset.id, p_status: b.dataset.a, p_reason: reason }), 'Vendor updated')) again(); });
  $$('[data-f]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('vendors').update({ is_featured: b.dataset.v === 'true' }).eq('id', b.dataset.f))) again(); });
}

async function products(el) {
  const { data } = await sb.from('products').select('id,title,price,status,is_featured,slug,vendors(store_name,slug)').order('status').order('created_at', { ascending: false }).limit(100);
  el.innerHTML = table(['Listing', 'Store', 'Status', 'Actions'], (data || []).map(p => `<tr><td><a href="/shop/${esc(p.vendors.slug)}/${esc(p.slug)}" data-link>${esc(p.title)}</a><br>${money(p.price)}</td><td>${esc(p.vendors.store_name)}</td><td><span class="badge ${p.status === 'approved' ? 'ok' : p.status === 'pending' ? '' : 'bad'}">${p.status}</span></td>
  <td><div class="row"><button class="btn sm" data-s="approved" data-id="${p.id}">Approve</button><button class="btn sm ghost" data-s="rejected" data-id="${p.id}">Reject</button><button class="btn sm ghost" data-s="hidden" data-id="${p.id}">Hide</button><button class="btn sm ghost" data-ft="${p.id}" data-v="${!p.is_featured}">${p.is_featured ? 'Unfeature' : 'Feature'}</button><button class="btn sm danger" data-d="${p.id}">Delete</button></div></td></tr>`));
  $$('[data-s]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('products').update({ status: b.dataset.s }).eq('id', b.dataset.id))) again(); });
  $$('[data-ft]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('products').update({ is_featured: b.dataset.v === 'true' }).eq('id', b.dataset.ft))) again(); });
  $$('[data-d]', el).forEach(b => b.onclick = async () => { if (!confirm('Delete permanently?')) return; const { data: im } = await sb.from('product_images').select('path,original_path').eq('product_id', b.dataset.d); if (await run(sb.from('products').delete().eq('id', b.dataset.d), 'Deleted')) { await cleanupFiles((im || []).map(x => x.path), (im || []).map(x => x.original_path)); again(); } });
}

async function deals(el) {
  const { data } = await sb.from('campus_deals').select('id,deal_price,original_price,status,ends_at,products(title),vendors(store_name)').order('created_at', { ascending: false });
  el.innerHTML = table(['Deal', 'Prices', 'Ends', 'Status', ''], (data || []).map(d => `<tr><td>${esc(d.products.title)}<br><span class="small muted">${esc(d.vendors.store_name)}</span></td><td>${money(d.deal_price)} <span class="was">${money(d.original_price)}</span></td><td>${fmtDate(d.ends_at)}</td><td>${d.status}</td><td><div class="row"><button class="btn sm" data-s="approved" data-id="${d.id}">Approve</button><button class="btn sm ghost" data-s="rejected" data-id="${d.id}">Reject</button></div></td></tr>`));
  $$('[data-s]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('campus_deals').update({ status: b.dataset.s }).eq('id', b.dataset.id))) again(); });
}

async function events(el) {
  const { data } = await sb.from('events').select('*').order('starts_at', { ascending: false });
  el.innerHTML = `<form id="f" class="panel"><h2>New event</h2><label>Title<input name="title" required></label><label>Starts<input name="starts_at" type="datetime-local" required></label><label>Location<input name="location"></label><label>Organizer<input name="organizer"></label><label>Contact<input name="contact"></label><label>Description<textarea name="description"></textarea></label><label>Image<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="row" style="margin-top:12px"><button class="btn" name="s" value="published">Publish</button><button class="btn ghost" name="s" value="draft" formnovalidate>Save draft</button></div></form>
  ${table(['Event', 'When', 'Status', ''], (data || []).map(e => `<tr><td>${esc(e.title)}</td><td>${fmtDate(e.starts_at)}</td><td>${e.status}</td><td><div class="row"><button class="btn sm ghost" data-s="${e.status === 'published' ? 'draft' : 'published'}" data-id="${e.id}">${e.status === 'published' ? 'Unpublish' : 'Publish'}</button><button class="btn sm danger" data-d="${e.id}">Delete</button></div></td></tr>`))}`;
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { const f = e.target.image.files[0]; const image_path = f ? await upload('event-images', 'events', f) : null;
    const { error } = await sb.from('events').insert({ title: d.title, starts_at: new Date(d.starts_at).toISOString(), location: d.location || null, organizer: d.organizer || null, contact: d.contact || null, description: d.description || null, image_path, status: e.submitter.value, created_by: state.user.id }); if (error) throw error; toast('Event saved'); again(); } catch (err) { toast(err.message); } };
  $$('[data-s]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('events').update({ status: b.dataset.s }).eq('id', b.dataset.id))) again(); });
  $$('[data-d]', el).forEach(b => b.onclick = async () => { if (confirm('Delete event?') && await run(sb.from('events').delete().eq('id', b.dataset.d), 'Deleted')) again(); });
}

async function categories(el) {
  const { data } = await sb.from('categories').select('*').order('sort_order');
  const top = (data || []).filter(c => !c.parent_id);
  el.innerHTML = `<form id="f" class="panel row"><input name="name" placeholder="Category name" required class="grow"><select name="parent_id"><option value="">Top level</option>${top.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="btn">Add</button></form>
  ${table(['Category', 'Active', ''], (data || []).map(c => `<tr><td>${c.parent_id ? '— ' : '<b>'}${esc(c.name)}${c.parent_id ? '' : '</b>'}</td><td>${c.is_active ? 'Yes' : 'No'}</td><td><button class="btn sm ghost" data-t="${c.id}" data-v="${!c.is_active}">${c.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>`))}`;
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); if (await run(sb.from('categories').insert({ name: d.name, slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), parent_id: d.parent_id || null }), 'Category added')) again(); };
  $$('[data-t]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('categories').update({ is_active: b.dataset.v === 'true' }).eq('id', b.dataset.t))) again(); });
}

async function reports(el) {
  const { data } = await sb.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
  el.innerHTML = table(['Report', 'Status', 'Actions'], (data || []).map(r => `<tr><td><b>${esc(r.reason)}</b> on ${r.target_type}<br><span class="small muted">${fmtDate(r.created_at)}</span><br>${esc(r.details || '')}</td><td>${r.status}</td><td><div class="row"><button class="btn sm" data-r="resolved" data-id="${r.id}">Resolve</button><button class="btn sm danger" data-r="resolved" data-h="1" data-id="${r.id}">Resolve and hide</button><button class="btn sm ghost" data-r="dismissed" data-id="${r.id}">Dismiss</button></div></td></tr>`));
  $$('[data-r]', el).forEach(b => b.onclick = async () => { if (await run(sb.rpc('admin_resolve_report', { p_report: b.dataset.id, p_status: b.dataset.r, p_hide_target: !!b.dataset.h }), 'Report updated')) again(); });
}

async function demand(el) {
  const { data } = await sb.from('demand_requests').select('id,title,status,budget_max,created_at').order('created_at', { ascending: false }).limit(100);
  el.innerHTML = table(['Request', 'Budget', 'Status', ''], (data || []).map(d => `<tr><td>${esc(d.title)}<br><span class="small muted">${fmtDate(d.created_at)}</span></td><td>${d.budget_max ? money(d.budget_max) : ''}</td><td>${d.status}</td><td><div class="row"><button class="btn sm ghost" data-s="fulfilled" data-id="${d.id}">Fulfilled</button><button class="btn sm danger" data-s="hidden" data-id="${d.id}">Hide</button></div></td></tr>`));
  $$('[data-s]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('demand_requests').update({ status: b.dataset.s }).eq('id', b.dataset.id))) again(); });
}

const mb = n => (n / 1048576).toFixed(1) + ' MB';
async function storage(el) {
  const { data: st, error } = await sb.rpc('admin_storage_stats');
  if (error) return el.innerHTML = esc(error.message);
  el.innerHTML = `<div class="panel"><h2>Storage use</h2>${table(['Bucket', 'Files', 'Total', 'Average file'], (st || []).map(s => `<tr><td>${s.bucket_id}</td><td>${s.files}</td><td>${mb(s.total_bytes)}</td><td>${Math.round(s.avg_bytes / 1024)} KB</td></tr>`))}
  <p class="small muted">Images only, compressed in the browser (max 1280px, WebP) with a small thumbnail beside each one. Videos are never stored.</p></div>
  <div class="panel"><h2>Orphaned files</h2><p class="muted small">Files no longer used by any listing, store or event (older than 2 hours), usually from failed uploads or deleted items.</p><div class="row"><button id="scan" class="btn">Scan</button><button id="purge" class="btn danger" hidden>Delete all found</button></div><div id="out"></div></div>`;
  let found = [];
  $('#scan').onclick = async () => { const { data, error } = await sb.rpc('admin_list_orphan_files', { p_min_age: '2 hours', p_limit: 500 }); if (error) return toast(error.message); found = data || [];
    $('#out').innerHTML = found.length ? `<p>${found.length} orphaned file(s), ${mb(found.reduce((s, f) => s + Number(f.bytes), 0))}</p>` : '<p>No orphaned files. Storage is clean.</p>'; $('#purge').hidden = !found.length; };
  $('#purge').onclick = async () => { if (!confirm(`Permanently delete ${found.length} file(s)?`)) return; const by = {}; found.forEach(f => (by[f.bucket_id] ??= []).push(f.name));
    for (const [b, names] of Object.entries(by)) for (let i = 0; i < names.length; i += 100) await sb.storage.from(b).remove(names.slice(i, i + 100));
    toast('Orphaned files deleted'); storage(el); };
}

async function branding(el) {
  const [{ data: st }, { data: rows, error }] = await Promise.all([sb.rpc('admin_branding_stats'), sb.rpc('admin_branding_report', { p_limit: 100 })]);
  if (error) return el.innerHTML = esc(error.message);
  const R = { failed: 'Processing failed', legacy: 'No original (legacy)', old_version: 'Older design', store_renamed: 'Store renamed' };
  el.innerHTML = `<div class="stats"><div class="stat"><b>${st.branded}</b>Branded</div><div class="stat"><b>${st.failed}</b>Failed</div><div class="stat"><b>${st.legacy}</b>Legacy</div><div class="stat"><b>v${st.version}</b>Design version</div></div>
  <div class="panel" style="margin-top:12px"><div class="row"><h2 class="grow">Needs attention (${rows.length})</h2><button id="rg" class="btn sm" ${rows.some(r => r.original_path) ? '' : 'disabled'}>Regenerate (up to 25)</button><button id="bump" class="btn sm ghost">New design version</button></div><p id="bm" class="small muted" aria-live="polite">Changing the badge design? Edit js/branding.js, then press "New design version" and regenerate.</p>
  ${table(['Image', 'Listing', 'Reason', 'Error'], rows.map(r => `<tr><td><img src="${img('product-images', r.path, true)}" width="48" height="48" style="object-fit:cover;border-radius:6px" alt=""></td><td>${esc(r.title)}<br><span class="small muted">${esc(r.store_name)}</span></td><td>${R[r.reason] || r.reason}</td><td class="small">${esc(r.brand_error || '')}</td></tr>`))}</div>`;
  $('#rg').onclick = async () => { const ver = await currentVersion(); let n = 0, f = 0; const batch = rows.filter(r => r.original_path).slice(0, 25);
    for (const [i, r] of batch.entries()) { $('#bm').textContent = `Regenerating ${i + 1} of ${batch.length}…`; try { await regenerate({ ...r, id: r.image_id }, r.store_id, ver); n++; } catch (e) { f++; await sb.from('product_images').update({ brand_status: 'failed', brand_error: String(e.message || e).slice(0, 300) }).eq('id', r.image_id); } }
    toast(`${n} regenerated, ${f} failed`); again(); };
  $('#bump').onclick = async () => { if (!confirm('Mark every branded image as outdated? You will need to regenerate them in batches.')) return; if (await run(sb.from('site_settings').update({ value: st.version + 1, updated_at: new Date().toISOString() }).eq('key', 'brand_version'), 'Design version increased')) again(); };
}

// ---------- Promotions ----------
const livenessOf = p => { const n = Date.now(); if (p.status === 'draft') return ['Draft', '']; if (p.status === 'inactive') return ['Inactive', 'bad']; if (new Date(p.ends_at) <= n) return ['Expired', 'bad']; if (new Date(p.starts_at) > n) return ['Scheduled', '']; return ['Live', 'ok']; };
const toLocal = d => d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
async function bannerBlob(file) { // center-crop to 2:1, 1200x600, WebP <= 200 KB
  if (file.type.startsWith('video/') || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Banner must be a JPG, PNG or WebP image.');
  if (file.size > 15 * 1048576) throw new Error('Image is too large (max 15 MB before compression).');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); const want = 2, have = bmp.width / bmp.height;
  const sw = have > want ? bmp.height * want : bmp.width, sh = have > want ? bmp.height : bmp.width / want, sx = (bmp.width - sw) / 2, sy = (bmp.height - sh) / 2;
  for (const w of [1200, 900, 700]) { const c = document.createElement('canvas'); c.width = w; c.height = w / 2; c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, w, w / 2);
    for (const q of [0.82, 0.7, 0.55]) { let b = await new Promise(r => c.toBlob(r, 'image/webp', q)); if (b && b.type !== 'image/webp') b = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (b && b.size <= 200 * 1024) return b; } }
  throw new Error('Could not compress this banner enough. Try a simpler image.');
}
const imageStillUsed = async (path, exceptId) => { if (!path) return true; const { count } = await sb.from('promotions').select('id', { count: 'exact', head: true }).eq('image_path', path).neq('id', exceptId || '00000000-0000-0000-0000-000000000000'); return !!count; };
function normWhatsApp(v) { v = (v || '').trim(); if (!v) return ''; const m = v.match(/^https?:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{10,15})/i); const d = m ? m[1] : v.replace(/[\s+()-]/g, ''); if (!/^\d{10,15}$/.test(d)) throw new Error('WhatsApp must be a number with country code (e.g. 2348012345678) or a wa.me link.'); return d; }

async function promotions(el, editId) {
  const { data, error } = await sb.from('promotions').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return el.innerHTML = esc(error.message);
  const p = editId ? data.find(x => x.id === editId) || {} : {};
  const start = p.starts_at ? toLocal(p.starts_at) : toLocal(new Date()), end = p.ends_at ? toLocal(p.ends_at) : toLocal(new Date(Date.now() + 7 * 864e5));
  el.innerHTML = `<form id="f" class="panel" novalidate><h2>${editId ? 'Edit promotion' : 'New promotion'}</h2>
  <label for="t">Title</label><input id="t" name="title" maxlength="120" placeholder="Enter a clear promotional headline" value="${esc(p.title)}" required>
  <label for="d">Description</label><textarea id="d" name="description" maxlength="300" placeholder="Briefly explain the offer, event or opportunity">${esc(p.description)}</textarea>
  <label for="c">CTA text</label><input id="c" name="cta_text" maxlength="30" placeholder="e.g. Explore Now" value="${esc(p.cta_text)}">
  <label for="u">Destination URL</label><input id="u" name="destination_url" type="url" placeholder="https://example.com" value="${esc(p.destination_url)}">
  <label for="w">WhatsApp destination</label><input id="w" name="whatsapp" placeholder="Enter the business WhatsApp number or approved WhatsApp link" value="${esc(p.whatsapp_number)}"><div class="small muted">Used only when there is no destination URL.</div>
  <label for="i">Banner image</label><input id="i" name="image" type="file" accept="image/jpeg,image/png,image/webp"><div class="small muted">Upload a promotional image. It is cropped to 2:1 (e.g. 1200×600) and compressed automatically.</div>
  <label for="pl">Placement</label><select id="pl" name="placement"><option value="home_hero" ${p.placement !== 'home_section' ? 'selected' : ''}>Homepage banner (top)</option><option value="home_section" ${p.placement === 'home_section' ? 'selected' : ''}>Homepage promotional section</option></select>
  <label for="cat">Category</label><input id="cat" name="category" list="cats" maxlength="40" placeholder="e.g. Event, Election, Business, Offer" value="${esc(p.category || 'announcement')}"><datalist id="cats"><option>announcement</option><option>election</option><option>business</option><option>event</option><option>training</option><option>offer</option><option>opportunity</option></datalist>
  <label for="s">Start date and time</label><input id="s" name="starts_at" type="datetime-local" value="${start}" required><label for="e">End date and time</label><input id="e" name="ends_at" type="datetime-local" value="${end}" required>
  <label for="st">Status</label><select id="st" name="status">${['draft', 'active', 'inactive'].map(s => `<option value="${s}" ${(p.status === s || (!p.status && s === 'draft')) ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select>
  <label class="row" style="font-weight:400"><input type="checkbox" name="is_sponsored" style="width:auto;min-height:0" ${p.is_sponsored ? 'checked' : ''}> Show a "Sponsored" label <span class="small muted">(tick only for paid or sponsored placements, not ordinary announcements)</span></label>
  <p id="err" class="small" style="color:var(--danger)" role="alert"></p>
  <div class="row"><button class="btn" id="save">${editId ? 'Save changes' : 'Create promotion'}</button>${editId ? '<button type="button" class="btn ghost" id="cancel">Cancel</button>' : ''}</div></form>
  <div class="panel"><div class="row"><h3 class="grow">Preview</h3><div class="seg" style="margin:0"><button type="button" class="on" id="pm">Mobile</button><button type="button" id="pd">Desktop</button></div></div><div id="pv" class="pvbox m"></div></div>
  <div class="panel"><h2>All promotions</h2>${table(['Promotion', 'Window', 'Status', ''], data.map(x => { const [l, k] = livenessOf(x); return `<tr><td><b>${esc(x.title)}</b>${x.is_sponsored ? ' <span class="badge">Sponsored</span>' : ''}<br><span class="small muted">${esc(x.category)} · ${x.placement.replace('_', ' ')}</span></td><td class="small">${fmtDate(x.starts_at)}<br>${fmtDate(x.ends_at)}</td><td><span class="badge ${k}">${l}</span></td>
  <td><div class="row"><button class="btn sm ghost" data-ed="${x.id}">Edit</button><button class="btn sm ghost" data-tg="${x.id}" data-to="${x.status === 'active' ? 'inactive' : 'active'}">${x.status === 'active' ? 'Deactivate' : 'Activate'}</button><button class="btn sm danger" data-rm="${x.id}">Delete</button></div></td></tr>`; }))}</div>`;
  const f = $('#f'); let blob = null, previewUrl = p.image_path ? bannerUrl(p.image_path) : null, cur = 'm';
  const read = () => { const d = formData(f); return { title: d.title.trim(), description: d.description.trim() || null, cta_text: d.cta_text.trim() || null, destination_url: d.destination_url.trim() || null, whatsapp: d.whatsapp, placement: d.placement, category: (d.category || 'announcement').trim(), status: d.status, is_sponsored: !!d.is_sponsored, starts: d.starts_at, ends: d.ends_at }; };
  const draw = () => { const v = read(); let wa = null; try { wa = normWhatsApp(v.whatsapp) || null; } catch { } const live = { ...v, whatsapp_number: wa, image_path: null };
    const box = $('#pv'); box.className = 'pvbox ' + cur; buildCarousel(box, [live], { auto: false }); const im = previewUrl; if (im) box.querySelector('.pc-slide')?.insertAdjacentHTML('afterbegin', `<img src="${esc(im)}" alt="">`); };
  f.addEventListener('input', draw); $('#pm').onclick = () => { cur = 'm'; $('#pm').classList.add('on'); $('#pd').classList.remove('on'); draw(); }; $('#pd').onclick = () => { cur = ''; $('#pd').classList.add('on'); $('#pm').classList.remove('on'); draw(); };
  $('#i').onchange = async e => { const err = $('#err'); err.textContent = ''; blob = null; const file = e.target.files[0]; if (!file) return; try { blob = await bannerBlob(file); previewUrl = URL.createObjectURL(blob); draw(); } catch (x) { err.textContent = x.message; e.target.value = ''; } };
  draw(); $('#cancel') && ($('#cancel').onclick = () => promotions(el));
  f.onsubmit = async e => { e.preventDefault(); const err = $('#err'); err.textContent = ''; const btn = $('#save'); btn.disabled = true;
    try {
      const v = read(); if (v.title.length < 3) throw new Error('Title is required (at least 3 characters).');
      if (v.destination_url) { try { const u = new URL(v.destination_url); if (!['http:', 'https:'].includes(u.protocol)) throw 0; } catch { throw new Error('Destination URL must be a valid http(s) address, e.g. https://example.com'); } }
      const wa = normWhatsApp(v.whatsapp) || null; if (v.cta_text && !v.destination_url && !wa) throw new Error('A CTA button needs a destination URL or a WhatsApp destination.');
      if (!v.starts || !v.ends) throw new Error('Choose a start and end date.'); const s = new Date(v.starts), en = new Date(v.ends); if (!(en > s)) throw new Error('The end date must be later than the start date.');
      if (v.status === 'active' && !p.image_path && !blob) throw new Error('Upload a banner image before activating.');
      let image_path = p.image_path || null, uploaded = null;
      if (blob) { const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'; image_path = `banners/${(await sha256(blob)).slice(0, 32)}.${ext}`; await put('promo-banners', image_path, blob); uploaded = image_path; }
      const row = { title: v.title, description: v.description, cta_text: v.cta_text, destination_url: v.destination_url, whatsapp_number: wa, placement: v.placement, category: v.category, is_sponsored: v.is_sponsored, status: v.status, starts_at: s.toISOString(), ends_at: en.toISOString(), image_path };
      const r = editId ? await sb.from('promotions').update(row).eq('id', editId) : await sb.from('promotions').insert(row);
      if (r.error) { if (uploaded && !(await imageStillUsed(uploaded))) await sb.storage.from('promo-banners').remove([uploaded]); throw r.error; }
      if (blob && p.image_path && p.image_path !== image_path && !(await imageStillUsed(p.image_path, editId))) await sb.storage.from('promo-banners').remove([p.image_path]);
      toast(editId ? 'Promotion updated' : 'Promotion created'); promotions(el);
    } catch (x) { err.textContent = x.message || String(x); btn.disabled = false; } };
  $$('[data-ed]', el).forEach(b => b.onclick = () => { promotions(el, b.dataset.ed); window.scrollTo(0, 0); });
  $$('[data-tg]', el).forEach(b => b.onclick = async () => { if (await run(sb.from('promotions').update({ status: b.dataset.to }).eq('id', b.dataset.tg), 'Updated')) promotions(el); });
  $$('[data-rm]', el).forEach(b => b.onclick = async () => { if (!confirm('Delete this promotion? This cannot be undone.')) return; const x = data.find(y => y.id === b.dataset.rm);
    if (await run(sb.from('promotions').delete().eq('id', x.id), 'Deleted')) { if (x.image_path && !(await imageStillUsed(x.image_path, x.id))) await sb.storage.from('promo-banners').remove([x.image_path]); promotions(el); } });
}
