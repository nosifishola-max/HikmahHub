import { sb } from '../supabase.js';
import { academics, optionsWithLegacy } from '../academics.js';
import { normalizeMatric } from '../vendor-identity.js';
import { state, loadSession, isVendor, refreshProfile } from '../auth.js';
import { onLeave } from '../router.js';
import { listingForm, closeListingForm } from './listing-form.js';
import { watch } from '../live.js';
import { cached, q } from '../cache.js';
import { $, $$, esc, money, img, toast, formData, upload, removeFiles, setMeta, fmtDate } from '../util.js';
import { go } from '../router.js';
import { computeAchievements, shareAchievement, period } from '../achievements.js';
import { normalizePhone } from '../phone.js';
import { validateListing, friendlyError } from '../validate.js';
import { prepare, brand, saveImage, cleanupFiles, trustedStoreName, currentVersion, regenerate } from '../branding.js';

let tab = 'listings';
let stopV = null, stopL = null, wired = false;
function wire(app) {   // realtime: my store's approval status, and my listings' statuses (own rows only, enforced by RLS + filters)
  stopV?.(); stopV = watch('vendors', async () => { const prev = state.vendor?.status; await refreshProfile(); if (state.vendor?.status !== prev && location.pathname === '/vendor') vendor(app); }, `owner_id=eq.${state.user.id}`);
  if (!wired) { wired = true; onLeave(() => { stopV?.(); stopL?.(); stopV = stopL = null; wired = false; }); }
}
export async function vendor(app) {
  if (!state.user) return go('/login?next=/vendor'); wire(app);
  setMeta('Vendor', 'Manage your HikmahHub store');
  const v = state.vendor;
  if (!v) return apply(app);
  if (v.status === 'pending') { app.innerHTML = `<div class="wrap pad"><div class="panel"><h1>Application under review</h1><p>We're reviewing <b>${esc(v.store_name)}</b>. We'll email <b>${esc(state.user.email)}</b> when it is approved or if changes are needed. You can also check this page any time.</p></div></div>`; return; }
  if (v.status === 'rejected') return apply(app, v);
  if (v.status === 'suspended') { app.innerHTML = `<div class="wrap pad"><div class="panel"><h1>Store suspended</h1><p>${esc(v.rejection_reason || 'Contact HikmahHub for details.')}</p></div></div>`; return; }
  dash(app);
}

async function apply(app, ex = null) {
  let hist = [];
  if (ex) { const { data } = await sb.from('vendor_review_events').select('status_to,reason,created_at').eq('vendor_id', ex.id).order('id', { ascending: false }).limit(6); hist = data || []; }
  app.innerHTML = `<div class="wrap pad" style="max-width:600px"><h1>${ex ? 'Update your application' : 'Open your store'}</h1>
  ${ex ? `<div class="notice bad"><b>Your application was not approved.</b><br>Reason: ${esc(ex.rejection_reason || 'No reason was recorded.')}<br><span class="small">Fix the details below and resubmit. It goes back into the review queue.</span></div>` : '<p class="muted">Free for students. HikmahHub reviews every application before your store goes live.</p>'}
  <form id="f" class="panel" novalidate><p class="small muted">Your matric number is private and used only to verify your application.</p><label>Matric number<input placeholder="26/01HUI001" name="matric_number" required maxlength="80" value="${esc(state.profile?.matric_number)}"></label><label>Faculty<select name="faculty" required id="faculty"></select></label><label>Department<select name="department" required id="department"></select></label><label for="sn">Store name</label><input id="sn" name="store_name" required minlength="2" maxlength="80" value="${esc(ex?.store_name)}">
  <label for="wa">WhatsApp number</label><input id="wa" name="whatsapp_number" required placeholder="e.g. 08012345678 or +2348012345678" inputmode="tel" autocomplete="tel" value="${esc(ex?.whatsapp_number)}"><div class="small muted">Buyers will contact you on this number. Nigerian numbers can start with 0; other countries start with + and the country code.</div>
  <label for="bc">What do you sell?</label><input id="bc" name="business_category" placeholder="e.g. Phones and accessories" value="${esc(ex?.business_category)}">
  <label for="cl">Campus location</label><input id="cl" name="campus_location" value="${esc(ex?.campus_location)}">
  <label for="ds">About your store</label><textarea id="ds" name="description" maxlength="1000">${esc(ex?.description)}</textarea>
  <p id="err" class="small" style="color:var(--danger)" role="alert"></p><button class="btn" style="margin-top:6px">${ex ? 'Resubmit application' : 'Submit application'}</button></form>
  ${hist.length ? `<details class="rv"><summary>Review history</summary><ul>${hist.map(h => `<li class="small">${fmtDate(h.created_at)}: ${esc(h.status_to)}${h.reason ? ` – ${esc(h.reason)}` : ''}</li>`).join('')}</ul></details>` : ''}</div>`;
  const options = (values, value) => '<option value="">Select</option>'+optionsWithLegacy(values,value).map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}${values.includes(v)?'':' (existing value)'}</option>`).join('');
  $('#faculty').innerHTML=options(Object.keys(academics),state.profile?.faculty);
  $('#department').innerHTML=options(academics[state.profile?.faculty]||[],state.profile?.department);
  $('#faculty').onchange=()=>{const old=$('#department').value;$('#department').innerHTML=options(academics[$('#faculty').value]||[],old);};
  $('#f').onsubmit = async e => {
    e.preventDefault(); const d = formData(e.target), err = $('#err'), b = e.submitter; err.textContent = '';
    if ((d.store_name || '').trim().length < 2) { err.textContent = 'Enter your store name (at least 2 characters).'; return; }
    const ph = normalizePhone(d.whatsapp_number); if (!ph.ok) { err.textContent = ph.error; return; }
    const row = { store_name: d.store_name.trim(), whatsapp_number: ph.value, business_category: d.business_category.trim() || null, campus_location: d.campus_location.trim() || null, description: d.description.trim() || null };
    const identity = { matric_number: normalizeMatric(d.matric_number), faculty: d.faculty.trim(), department: d.department.trim() };
    if (!identity.matric_number || !identity.faculty || !identity.department) { err.textContent = 'Enter your matric number, faculty and department.'; return; }
    b.disabled = true;
    const saved = await sb.from('profiles').update(identity).eq('id', state.user.id);
    if (saved.error) { err.textContent = saved.error.code === '23505' ? 'This matric number cannot be used. Contact HikmahHub if you need help.' : friendlyError(saved.error); b.disabled = false; return; }
    const { error } = ex ? await sb.from('vendors').update({ ...row, status: 'pending' }).eq('id', ex.id) : await sb.from('vendors').insert({ ...row, owner_id: state.user.id });
    if (error) { err.textContent = friendlyError(error); b.disabled = false; return; }
    toast(ex ? 'Application resubmitted' : 'Application submitted'); await loadSession(); vendor(app);
  };
}

function dash(app) {
  closeListingForm();
  const v = state.vendor;
  if (!stopL) stopL = watch('products', () => { if (tab === 'listings' && $('#tab')?.isConnected) listings($('#tab')); }, `vendor_id=eq.${v.id}`);
  app.innerHTML = `<div class="wrap pad"><h1>${esc(v.store_name)}</h1><p><span class="badge ok">✓ Verified</span> <a href="/shop/${esc(v.slug)}" data-link>View public store</a></p>
  <div class="seg" role="tablist">${['listings', 'new', 'store', 'deals', 'demand', 'wins'].map(t => `<button data-t="${t}" class="${t === tab ? 'on' : ''}">${{ listings: 'My listings', new: 'Add listing', store: 'Store profile', deals: 'Deals', demand: 'Demand', wins: 'Achievements' }[t]}</button>`).join('')}</div><div id="tab"></div></div>`;
  $$('.seg button').forEach(b => b.onclick = () => { tab = b.dataset.t; dash(app); });
  ({ listings, new: form, store, deals, demand, wins })[tab]($('#tab'));
}

async function listings(el) {
  if (!el.querySelector('table')) el.innerHTML = '<p class="muted small">Loading your listings…</p>';
  const { data, error } = await sb.from('products').select('id,title,price,status,availability,slug,review_note,pending_changes,category_id,product_images(path)').eq('vendor_id', state.vendor.id).order('created_at', { ascending: false });
  if (error) return el.innerHTML = `<p>${esc(friendlyError(error))}</p>`;
  const missing = p => [!p.title && 'title', !p.product_images?.length && 'image', !p.category_id && 'category', p.price == null && 'price'].filter(Boolean);
  const note = p => p.status === 'rejected' && p.review_note ? `<div class="small" style="color:var(--danger)">Not approved: ${esc(p.review_note)}</div>` : p.status === 'hidden' ? `<div class="small" style="color:var(--danger)">Hidden by HikmahHub${p.review_note ? ': ' + esc(p.review_note) : ''}. Contact us.</div>` : p.review_note && p.status === 'approved' ? `<div class="small muted">${esc(p.review_note)}</div>` : '';
  el.innerHTML = data.length ? `<div class="scroll"><table class="tbl vendor-listings"><tr><th></th><th>Listing</th><th>Status</th><th>Availability</th><th></th></tr>${data.map(p => `<tr><td><img src="${img('product-images', p.product_images?.[0]?.path, true)}" width="44" height="44" style="object-fit:cover;border-radius:8px" alt=""></td><td>${esc(p.title || 'Untitled draft')}<br><span class="price">${p.price == null ? '<span class="muted small">No price yet</span>' : money(p.price)}</span></td>
  <td><span class="badge ${p.status === 'approved' ? 'ok' : p.status === 'rejected' || p.status === 'hidden' ? 'bad' : ''}">${p.status}</span>${p.pending_changes ? '<br><span class="badge teal">Changes awaiting review</span>' : ''}${p.status === 'draft' && missing(p).length ? `<br><span class="badge">Incomplete draft</span><div class="small muted">Needs: ${missing(p).join(', ')}</div>` : ''}${note(p)}</td>
  <td><select data-av="${p.id}" aria-label="Availability">${['available', 'out_of_stock', 'sold', 'unavailable'].map(a => `<option ${a === p.availability ? 'selected' : ''} value="${a}">${a.replaceAll('_', ' ')}</option>`).join('')}</select></td>
  <td><div class="row"><button class="btn sm ghost" data-ed="${p.id}">Edit</button>${p.status === 'draft' && !missing(p).length ? `<button class="btn sm" data-sub="${p.id}">Submit</button>` : ''}<button class="btn sm danger" data-del="${p.id}">Delete</button></div></td></tr>`).join('')}</table></div>` : `<div class="empty"><h3>No listings yet</h3><p class="muted">Add your first product or service.</p><button class="btn" id="add">Add listing</button></div>`;
  $('#add') && ($('#add').onclick = () => { tab = 'new'; dash($('#app')); });
  $$('[data-av]').forEach(s => { let previous = s.value; s.onchange = async () => {
    s.disabled = true;
    try { const { error } = await sb.from('products').update({ availability: s.value }).eq('id', s.dataset.av); if (error) throw error; previous = s.value; toast('Updated'); }
    catch (error) { s.value = previous; toast(friendlyError(error)); }
    finally { s.disabled = false; }
  }; });
  $$('[data-sub]').forEach(b => b.onclick = async () => { const { error } = await sb.from('products').update({ status: 'pending' }).eq('id', b.dataset.sub); toast(error ? friendlyError(error) : 'Submitted for review'); listings(el); });
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this listing?')) return; const { data: im } = await sb.from('product_images').select('path,original_path').eq('product_id', b.dataset.del); const { error } = await sb.from('products').delete().eq('id', b.dataset.del); if (!error) await cleanupFiles((im || []).map(x => x.path), (im || []).map(x => x.original_path)); toast(error ? friendlyError(error) : 'Deleted'); listings(el); });
  $$('[data-ed]').forEach(b => b.onclick = () => form($('#tab'), b.dataset.ed));
}

function form(el, editId) { return listingForm(el, editId, () => { tab = 'listings'; dash($('#app')); }); }   // autosave form lives in listing-form.js

async function refreshBrand() {
  const m = $('#rbm'), say = t => { if (m) m.textContent = t; }; const ver = await currentVersion();
  const { data } = await sb.from('product_images').select('id,path,original_path,brand_status,brand_version,brand_store,products!inner(vendor_id)').eq('products.vendor_id', state.vendor.id).not('original_path', 'is', null);
  let n = 0, f = 0; for (const [i, r] of (data || []).entries()) { say(`Refreshing ${i + 1} of ${data.length}…`); try { if (await regenerate(r, state.vendor.id, ver) === 'regenerated') n++; } catch { f++; } }
  say(`Done. ${n} updated${f ? `, ${f} failed` : ''}.`); toast('Branded images refreshed');
}
function store(el) {
  const v = state.vendor;
  el.innerHTML = `<form id="f" class="panel"><h2>Store profile</h2><label>Store logo<input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label>
  <label>Store name (your link stays /shop/${esc(v.slug)})<input name="store_name" value="${esc(v.store_name)}" required></label><label>WhatsApp number<input name="whatsapp_number" value="${esc(v.whatsapp_number)}" required inputmode="tel" placeholder="e.g. 08012345678 or +2348012345678"></label>
  <label>Campus location<input name="campus_location" value="${esc(v.campus_location)}"></label><label>About<textarea name="description">${esc(v.description)}</textarea></label>
  <label>Instagram (optional)<input name="instagram" value="${esc(v.social_links?.instagram)}"></label><button class="btn" style="margin-top:14px">Save store</button></form>
  <div class="panel"><h3>Branded images</h3><p class="small muted">Product photos show HikmahHub and your store name. If you rename your store, refresh them here (done for you automatically after a rename).</p><button type="button" class="btn ghost" id="rb">Refresh branded images</button><p id="rbm" class="small" aria-live="polite"></p></div>`;
  $('#rb').onclick = refreshBrand;
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { const ph = normalizePhone(d.whatsapp_number); if (!ph.ok) return toast(ph.error); const upd = { store_name: d.store_name, whatsapp_number: ph.value, campus_location: d.campus_location || null, description: d.description || null, social_links: { instagram: d.instagram || null } };
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

