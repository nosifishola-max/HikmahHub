import { sb } from '../supabase.js';
import { state, isAdmin } from '../auth.js';
import { $, $$, esc, money, img, toast, fmtDate, formData, upload, removeFiles, setMeta } from '../util.js';
import { go } from '../router.js';
import { regenerate, currentVersion, cleanupFiles } from '../branding.js';

let tab = 'overview';
const TABS = { overview: 'Overview', vendors: 'Vendors', products: 'Products', deals: 'Deals', events: 'Events', categories: 'Categories', reports: 'Reports', demand: 'Demand', branding: 'Branding', storage: 'Storage' };
const run = async (p, ok = 'Done') => { const { error } = await p; toast(error ? error.message : ok); return !error; };

export async function admin(app) {
  if (!state.user) return go('/login');
  if (!isAdmin()) { app.innerHTML = `<div class="wrap pad"><div class="empty"><h3>Admins only</h3><a class="btn" href="/" data-link>Go home</a></div></div>`; return; }
  setMeta('Admin', 'HikmahHub administration');
  app.innerHTML = `<div class="wrap pad"><h1>Admin</h1><div class="seg">${Object.entries(TABS).map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tab">Loading…</div></div>`;
  $$('.seg button').forEach(b => b.onclick = () => { tab = b.dataset.t; admin(app); });
  await ({ overview, vendors, products, deals, events, categories, reports, demand, branding, storage })[tab]($('#tab'));
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
