import { sb } from '../supabase.js';
import { state, loadSession, isVendor } from '../auth.js';
import { $, $$, esc, money, img, toast, formData, upload, removeFiles, setMeta, fmtDate } from '../util.js';
import { go } from '../router.js';
import { computeAchievements, shareAchievement, period } from '../achievements.js';
import { prepare, brand, saveImage, cleanupFiles, trustedStoreName, currentVersion, regenerate } from '../branding.js';

let tab = 'listings';
export async function vendor(app) {
  if (!state.user) return go('/login');
  setMeta('Vendor', 'Manage your HikmahHub store');
  const v = state.vendor;
  if (!v) return apply(app);
  if (v.status === 'pending') { app.innerHTML = `<div class="wrap pad"><div class="panel"><h1>Application under review</h1><p>We're reviewing <b>${esc(v.store_name)}</b>. You'll get vendor access here once HikmahHub approves it.</p></div></div>`; return; }
  if (v.status === 'rejected' || v.status === 'suspended') { app.innerHTML = `<div class="wrap pad"><div class="panel"><h1>Store ${esc(v.status)}</h1><p>${esc(v.rejection_reason || 'Contact HikmahHub for details.')}</p>${v.status === 'rejected' ? '<button id="re" class="btn">Update and reapply</button>' : ''}</div></div>`; $('#re') && ($('#re').onclick = async () => { await sb.from('vendors').update({ status: 'pending' }).eq('id', v.id); await loadSession(); vendor(app); }); return; }
  dash(app);
}

function apply(app) {
  app.innerHTML = `<div class="wrap pad" style="max-width:600px"><h1>Open your store</h1><p class="muted">Free for students. HikmahHub reviews every application before your store goes live.</p>
  <form id="f" class="panel"><label>Store name<input name="store_name" required minlength="2" maxlength="80"></label>
  <label>WhatsApp number (with country code)<input name="whatsapp_number" required placeholder="2348012345678" inputmode="tel" pattern="\\+?[0-9]{10,15}"></label>
  <label>What do you sell?<input name="business_category" placeholder="e.g. Phones and accessories"></label><label>Campus location<input name="campus_location"></label>
  <label>About your store<textarea name="description" maxlength="1000"></textarea></label><button class="btn" style="margin-top:14px">Submit application</button></form></div>`;
  $('#f').onsubmit = async e => { e.preventDefault(); const { error } = await sb.from('vendors').insert({ ...formData(e.target), owner_id: state.user.id }); if (error) return toast(error.message); toast('Application submitted'); await loadSession(); vendor(app); };
}

function dash(app) {
  const v = state.vendor;
  app.innerHTML = `<div class="wrap pad"><h1>${esc(v.store_name)}</h1><p><span class="badge ok">✓ Verified</span> <a href="/shop/${esc(v.slug)}" data-link>View public store</a></p>
  <div class="seg" role="tablist">${['listings', 'new', 'store', 'deals', 'demand', 'wins'].map(t => `<button data-t="${t}" class="${t === tab ? 'on' : ''}">${{ listings: 'My listings', new: 'Add listing', store: 'Store profile', deals: 'Deals', demand: 'Demand', wins: 'Achievements' }[t]}</button>`).join('')}</div><div id="tab"></div></div>`;
  $$('.seg button').forEach(b => b.onclick = () => { tab = b.dataset.t; dash(app); });
  ({ listings, new: form, store, deals, demand, wins })[tab]($('#tab'));
}

async function listings(el) {
  const { data, error } = await sb.from('products').select('id,title,price,status,availability,slug,product_images(path)').eq('vendor_id', state.vendor.id).order('created_at', { ascending: false });
  if (error) return el.innerHTML = `<p>${esc(error.message)}</p>`;
  el.innerHTML = data.length ? `<div class="scroll"><table class="tbl"><tr><th></th><th>Listing</th><th>Status</th><th>Availability</th><th></th></tr>${data.map(p => `<tr><td><img src="${img('product-images', p.product_images?.[0]?.path, true)}" width="44" height="44" style="object-fit:cover;border-radius:8px" alt=""></td><td>${esc(p.title)}<br><span class="price">${money(p.price)}</span></td>
  <td><span class="badge ${p.status === 'approved' ? 'ok' : p.status === 'rejected' || p.status === 'hidden' ? 'bad' : ''}">${p.status}</span></td>
  <td><select data-av="${p.id}">${['available', 'out_of_stock', 'sold', 'unavailable'].map(a => `<option ${a === p.availability ? 'selected' : ''} value="${a}">${a.replace('_', ' ')}</option>`).join('')}</select></td>
  <td><div class="row"><button class="btn sm ghost" data-ed="${p.id}">Edit</button>${p.status === 'draft' || p.status === 'rejected' ? `<button class="btn sm" data-sub="${p.id}">Submit</button>` : ''}<button class="btn sm danger" data-del="${p.id}">Delete</button></div></td></tr>`).join('')}</table></div>` : `<div class="empty"><h3>No listings yet</h3><p class="muted">Add your first product or service.</p><button class="btn" id="add">Add listing</button></div>`;
  $('#add') && ($('#add').onclick = () => { tab = 'new'; dash($('#app')); });
  $$('[data-av]').forEach(s => s.onchange = async () => { const { error } = await sb.from('products').update({ availability: s.value }).eq('id', s.dataset.av); toast(error ? error.message : 'Updated'); });
  $$('[data-sub]').forEach(b => b.onclick = async () => { const { error } = await sb.from('products').update({ status: 'pending' }).eq('id', b.dataset.sub); toast(error ? error.message : 'Submitted for review'); listings(el); });
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this listing?')) return; const { data: im } = await sb.from('product_images').select('path,original_path').eq('product_id', b.dataset.del); const { error } = await sb.from('products').delete().eq('id', b.dataset.del); if (!error) await cleanupFiles((im || []).map(x => x.path), (im || []).map(x => x.original_path)); toast(error ? error.message : 'Deleted'); listings(el); });
  $$('[data-ed]').forEach(b => b.onclick = () => form($('#tab'), data.find(p => p.id === b.dataset.ed).id));
}

async function form(el, editId) {
  const [{ data: cats }, ex, { data: ims }] = await Promise.all([sb.from('categories').select('id,name,parent_id').eq('is_active', true).order('name'), editId ? sb.from('products').select('*').eq('id', editId).single() : { data: {} }, editId ? sb.from('product_images').select('id,path,original_path').eq('product_id', editId).order('sort_order') : { data: [] }]);
  const p = ex.data || {}; const have = ims || [];
  el.innerHTML = `<form id="f" class="panel"><h2>${editId ? 'Edit listing' : 'Add listing'}</h2><label>Title<input name="title" required minlength="2" maxlength="120" value="${esc(p.title)}"></label>
  <label>Type<select name="listing_type"><option value="product" ${p.listing_type !== 'service' ? 'selected' : ''}>Product</option><option value="service" ${p.listing_type === 'service' ? 'selected' : ''}>Service</option></select></label>
  <label>Category<select name="category_id" required><option value="">Select</option>${(cats || []).map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.parent_id ? '— ' : ''}${esc(c.name)}</option>`).join('')}</select></label>
  <label>Price (₦)<input name="price" type="number" min="0" step="1" required inputmode="numeric" value="${p.price ?? ''}"></label>
  <label>Condition<select name="condition"><option value="new">New</option><option value="used" ${p.condition === 'used' ? 'selected' : ''}>Used</option><option value="not_applicable" ${p.condition === 'not_applicable' ? 'selected' : ''}>Not applicable (service)</option></select></label>
  <label>Location<input name="location" value="${esc(p.location)}"></label><label>Description<textarea name="description" maxlength="5000">${esc(p.description)}</textarea></label>
  ${have.length ? `<div class="row">${have.map(i => `<div style="text-align:center"><img src="${img('product-images', i.path, true)}" width="64" height="64" style="object-fit:cover;border-radius:8px" alt=""><br><button type="button" class="btn sm danger" data-rm="${i.id}" data-path="${esc(i.path)}" data-orig="${esc(i.original_path || '')}">Remove</button></div>`).join('')}</div>` : ''}
  <label>Add images (${5 - have.length} more allowed; photos are compressed automatically)<input name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
  <div id="prev" class="row" aria-live="polite"></div>
  <div class="row" style="margin-top:14px"><button class="btn" name="go" value="pending">Submit for review</button><button class="btn ghost" name="go" value="draft" formnovalidate>Save draft</button></div></form>`;
  $$('[data-rm]', el).forEach(b => b.onclick = async () => { const { error } = await sb.from('product_images').delete().eq('id', b.dataset.rm); if (error) return toast(error.message); await cleanupFiles([b.dataset.path], [b.dataset.orig]); toast('Image removed'); form(el, editId); });
  let procs = [];
  $('#f [name=files]').onchange = async ev => {
    const out = $('#prev'); procs.forEach(x => x.url && URL.revokeObjectURL(x.url)); procs = []; out.innerHTML = '';
    const list = [...ev.target.files].filter(f => f.size).slice(0, 5 - have.length); if (!list.length) return;
    try {
      const [store, ver] = await Promise.all([trustedStoreName(state.vendor.id), currentVersion()]);
      for (const [i, f] of list.entries()) { out.textContent = `Processing image ${i + 1} of ${list.length}…`; const prep = await prepare(f); let url = null; try { url = (await brand(prep, state.vendor.id, store, ver)).previewUrl; } catch { } procs.push({ prep, url }); }
      out.innerHTML = procs.map(x => x.url ? `<img src="${x.url}" alt="Branded preview" width="96" height="96" style="object-fit:cover;border-radius:8px">` : '<span class="badge bad">Preview unavailable</span>').join('') + '<div class="small muted" style="width:100%">HikmahHub and your store name are added automatically.</div>';
    } catch (err) { out.textContent = err.message; ev.target.value = ''; procs = []; }
  };
  $('#f').onsubmit = async e => { e.preventDefault(); const btn = e.submitter; const d = formData(e.target); const files = [...e.target.files.files].filter(f => f.size).slice(0, 5 - have.length); btn.disabled = true;
    try {
      const row = { title: d.title, listing_type: d.listing_type, category_id: d.category_id, price: d.price, condition: d.condition, location: d.location || null, description: d.description || null };
      let id = editId;
      if (editId) { const { error } = await sb.from('products').update({ ...row, status: btn.value }).eq('id', id); if (error) throw error; }
      else { const { data, error } = await sb.from('products').insert({ ...row, vendor_id: state.vendor.id, status: btn.value }).select('id').single(); if (error) throw error; id = data.id; }
      const ver = await currentVersion(); let failed = 0;
      for (const [i, pr] of procs.entries()) { btn.textContent = `Uploading image ${i + 1} of ${procs.length}…`; try { await saveImage(state.vendor.id, id, have.length + i, pr.prep, ver, d.title); } catch { failed++; } }
      if (failed) { toast(`Listing saved, but ${failed} image(s) failed. Edit the listing to add them again.`); tab = 'listings'; dash($('#app')); return; }
      toast(btn.value === 'draft' ? 'Draft saved' : 'Submitted for review'); tab = 'listings'; dash($('#app'));
    } catch (err) { toast(err.message); btn.disabled = false; } };
}

async function refreshBrand() {
  const m = $('#rbm'), say = t => { if (m) m.textContent = t; }; const ver = await currentVersion();
  const { data } = await sb.from('product_images').select('id,path,original_path,brand_status,brand_version,brand_store,products!inner(vendor_id)').eq('products.vendor_id', state.vendor.id).not('original_path', 'is', null);
  let n = 0, f = 0; for (const [i, r] of (data || []).entries()) { say(`Refreshing ${i + 1} of ${data.length}…`); try { if (await regenerate(r, state.vendor.id, ver) === 'regenerated') n++; } catch { f++; } }
  say(`Done. ${n} updated${f ? `, ${f} failed` : ''}.`); toast('Branded images refreshed');
}
function store(el) {
  const v = state.vendor;
  el.innerHTML = `<form id="f" class="panel"><h2>Store profile</h2><label>Store logo<input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label>
  <label>Store name (your link stays /shop/${esc(v.slug)})<input name="store_name" value="${esc(v.store_name)}" required></label><label>WhatsApp number<input name="whatsapp_number" value="${esc(v.whatsapp_number)}" required pattern="\\+?[0-9]{10,15}"></label>
  <label>Campus location<input name="campus_location" value="${esc(v.campus_location)}"></label><label>About<textarea name="description">${esc(v.description)}</textarea></label>
  <label>Instagram (optional)<input name="instagram" value="${esc(v.social_links?.instagram)}"></label><button class="btn" style="margin-top:14px">Save store</button></form>
  <div class="panel"><h3>Branded images</h3><p class="small muted">Product photos show HikmahHub and your store name. If you rename your store, refresh them here (done for you automatically after a rename).</p><button type="button" class="btn ghost" id="rb">Refresh branded images</button><p id="rbm" class="small" aria-live="polite"></p></div>`;
  $('#rb').onclick = refreshBrand;
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { const upd = { store_name: d.store_name, whatsapp_number: d.whatsapp_number, campus_location: d.campus_location || null, description: d.description || null, social_links: { instagram: d.instagram || null } };
    const f = e.target.logo.files[0]; if (f) { upd.logo_path = await upload('vendor-logos', v.id, f); }
    const { error } = await sb.from('vendors').update(upd).eq('id', v.id); if (error) throw error; if (upd.logo_path && v.logo_path && v.logo_path !== upd.logo_path) await removeFiles('vendor-logos', [v.logo_path]); await loadSession(); toast('Store updated'); if (d.store_name !== v.store_name) refreshBrand();  } catch (err) { toast(err.message); } };
}

async function deals(el) {
  const [{ data: ps }, { data: ds }] = await Promise.all([sb.from('products').select('id,title,price').eq('vendor_id', state.vendor.id).eq('status', 'approved'), sb.from('campus_deals').select('id,deal_price,original_price,status,ends_at,products(title)').eq('vendor_id', state.vendor.id).order('created_at', { ascending: false })]);
  el.innerHTML = `<form id="f" class="panel"><h2>Propose a campus deal</h2>${(ps || []).length ? `<label>Product<select name="product_id" id="pp">${ps.map(p => `<option value="${p.id}" data-p="${p.price}">${esc(p.title)}</option>`).join('')}</select></label>
  <label>Original price (₦)<input name="original_price" type="number" id="op" required></label><label>Deal price (₦)<input name="deal_price" type="number" min="0" required></label><label>Ends<input name="ends_at" type="datetime-local" required></label>
  <label>Note<input name="description" maxlength="500"></label><button class="btn" style="margin-top:12px">Submit for approval</button>` : '<p class="muted">Get a listing approved first, then you can attach a deal to it.</p>'}</form>
  <h3>Your deals</h3>${(ds || []).length ? `<ul>${ds.map(d => `<li>${esc(d.products.title)}: ${money(d.deal_price)} (was ${money(d.original_price)}) · ends ${fmtDate(d.ends_at)} <span class="badge">${d.status}</span></li>`).join('')}</ul>` : '<p class="muted">No deals yet.</p>'}`;
  if (!(ps || []).length) return;
  const sync = () => $('#op').value = $('#pp').selectedOptions[0].dataset.p; $('#pp').onchange = sync; sync();
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); const { error } = await sb.from('campus_deals').insert({ product_id: d.product_id, vendor_id: state.vendor.id, original_price: d.original_price, deal_price: d.deal_price, ends_at: new Date(d.ends_at).toISOString(), description: d.description || null }); toast(error ? error.message : 'Deal submitted for approval'); if (!error) deals(el); };
}

async function demand(el) {
  const { data, error } = await sb.rpc('get_demand_opportunities', { p_limit: 20 });
  el.innerHTML = error ? `<p>${esc(error.message)}</p>` : data.length ? `<div class="panel"><h2>What students are asking for</h2><ol class="rank">${data.map(d => `<li><span class="grow"><b>${esc(d.term)}</b><br><span class="small muted">${d.students_looking} student${d.students_looking > 1 ? 's' : ''} looking${d.max_budget ? ` · budget up to ${money(d.max_budget)}` : ''}</span></span></li>`).join('')}</ol></div>` : `<div class="empty"><h3>No open requests</h3><p class="muted">When students request items, they'll show up here.</p></div>`;
}

async function wins(el) {
  el.innerHTML = '<p class="muted">Checking this week\'s activity…</p>';
  try {
    const { out, total, me } = await computeAchievements(state.vendor);
    el.innerHTML = `<p class="small muted">Week of ${esc(period())}. Achievements are calculated automatically from real store views, saves and WhatsApp enquiries. Only stores that meet the criteria get one.</p>` + (out.length ? out.map((a, i) => `<div class="ach"><span class="badge ok">🏆 Earned</span><h3 style="margin-top:6px">${esc(a.title)}</h3><p class="small muted">${esc(a.detail)}</p><div class="row"><button class="btn sm" data-i="${i}" data-m="img">Share achievement</button><button class="btn sm ghost" data-i="${i}" data-m="text">Share as text</button></div></div>`).join('') : `<div class="empty"><h3>No achievements yet this week</h3><p class="muted">${me ? 'Your store has activity but has not reached a ranking threshold yet.' : 'Your store has no recorded activity in the last 7 days.'} Keep your listings fresh and share your store link to get seen.</p></div>`);
    $$('[data-i]', el).forEach(b => b.onclick = async () => { try { await shareAchievement(out[b.dataset.i], state.vendor, b.dataset.m); } catch (e) { toast(e.message); } });
  } catch (e) { el.innerHTML = `<p>${esc(e.message)}</p>`; }
}
