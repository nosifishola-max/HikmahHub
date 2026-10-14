// Vendor listing form with autosave, recovery and image handling. Engine: ../autosave.js (tested separately).
//  - NEW listings and drafts/rejected: autosave writes the listing's own draft row (status stays draft/rejected, never submitted, never public).
//  - LIVE / in-review listings: autosave goes to the private listing_autosaves table, so the published version is untouched until "Save changes".
import { sb } from '../supabase.js';
import { state } from '../auth.js';
import { $, $$, esc, img, toast, fmtDate } from '../util.js';
import { cached, q } from '../cache.js';
import { onLeave } from '../router.js';
import { prepare, saveImage, cleanupFiles, currentVersion } from '../branding.js';
import { listingErrors, friendlyError } from '../validate.js';
import { createAutosaver, mergeDraft } from '../autosave.js';

const FIELDS = ['title', 'listing_type', 'category_id', 'price', 'condition', 'location', 'description'];
const LS = (uid, id) => `hh:draft:${uid}:${id || 'new'}`;
const loadLocal = (uid, id) => { try { return JSON.parse(localStorage.getItem(LS(uid, id)) || 'null'); } catch { return null; } };   // only form text; never passwords or tokens
const dropLocal = (uid, id) => { try { localStorage.removeItem(LS(uid, id)); } catch { } };
const fromServer = (p, pc = {}) => ({ title: pc.title ?? p?.title ?? '', listing_type: pc.listing_type ?? p?.listing_type ?? 'product', category_id: ('category_id' in pc ? pc.category_id : p?.category_id) ?? '', price: p?.price == null ? '' : String(p.price), condition: p?.condition || 'new', location: p?.location || '', description: ('description' in pc ? pc.description : p?.description) ?? '' });
const toRow = v => { const n = Number(v.price); return { title: v.title.trim() || null, listing_type: v.listing_type, category_id: v.category_id || null, price: v.price === '' || !Number.isFinite(n) || n < 0 ? null : n, condition: v.condition, location: v.location.trim() || null, description: v.description.trim() || null }; };
const hasContent = v => !!(v.title.trim() || v.price || v.description.trim() || v.category_id || v.location.trim());

let active = null;
export const closeListingForm = () => { active?.(); active = null; };

export async function listingForm(el, editId, onDone) {
  closeListingForm();
  const uid = state.user.id, vendorId = state.vendor.id;
  el.innerHTML = '<p class="muted small">Loading…</p>';
  const [cats, pr, im] = await Promise.all([cached('cats:all', 600000, () => q(sb.from('categories').select('id,name,parent_id').eq('is_active', true).order('name'))), editId ? sb.from('products').select('*').eq('id', editId).maybeSingle() : { data: null }, editId ? sb.from('product_images').select('id,path,original_path,sort_order').eq('product_id', editId).order('sort_order') : { data: [] }]);
  const p = pr.data; if (editId && !p) { el.innerHTML = '<div class="empty">Listing not found.</div>'; return; }
  const status = p?.status || 'new', rowTarget = ['new', 'draft', 'rejected'].includes(status), serverVals = fromServer(p, p?.pending_changes || {});
  const S = { id: editId || null, clientId: editId || crypto.randomUUID(), known: p?.updated_at || null, lastVals: { ...serverVals }, images: im.data || [], chips: [], conflict: null };

  // ---- recovery: server autosave (live listings) and/or this device's unsynced copy; 3-way merge so newer server data is never overwritten silently
  let cand = null;
  if (!rowTarget) { const r = await sb.from('listing_autosaves').select('data,updated_at').eq('product_id', editId).maybeSingle(); if (r.data) cand = { mine: r.data.data.v, base: r.data.data.base, when: new Date(r.data.updated_at).getTime() }; }
  const loc = loadLocal(uid, editId); if (loc && (!cand || loc.savedAt > cand.when)) cand = { mine: loc.v, base: loc.base || serverVals, when: loc.savedAt };
  let startVals = { ...serverVals }, banner = '';
  if (cand && FIELDS.some(f => (cand.mine[f] ?? '') !== (serverVals[f] ?? ''))) {
    const m = mergeDraft(serverVals, { ...serverVals, ...cand.base }, { ...serverVals, ...cand.mine }, FIELDS); startVals = m.vals; S.conflicts = m.conflicts; S.mine = cand.mine;
    banner = m.conflicts.length ? 'conflict' : 'restored'; S.when = cand.when;
  }
  const drafts = !editId && !banner ? ((await sb.from('products').select('id,title,updated_at').eq('vendor_id', vendorId).eq('status', 'draft').order('updated_at', { ascending: false }).limit(3)).data || []) : [];

  // ---- render
  const v = startVals, canDraft = rowTarget;
  el.innerHTML = `<form id="f" class="panel" novalidate><div class="row"><h2 class="grow">${editId ? (status === 'draft' ? 'Continue draft' : 'Edit listing') : 'Add listing'}</h2><span id="as" class="small muted" role="status" aria-live="polite">Changes save automatically</span></div>
  ${status === 'draft' || status === 'new' ? '<div id="inc" class="small"></div>' : ''}
  ${drafts.length ? `<div class="notice"><b>Unfinished drafts</b>${drafts.map(d => `<div class="row" style="margin-top:4px"><span class="grow small">${esc(d.title || 'Untitled draft')} · edited ${fmtDate(d.updated_at)}</span><button type="button" class="btn sm ghost" data-cont="${d.id}">Continue</button></div>`).join('')}</div>` : ''}
  <div id="rec"></div>
  ${status === 'rejected' ? `<div class="notice bad"><b>This listing was not approved.</b><br>Reason: ${esc(p.review_note || 'No reason was recorded.')}<br><span class="small">Fix it and tap Submit for review.</span></div>` : ''}
  ${status === 'hidden' ? `<div class="notice bad"><b>Hidden by HikmahHub.</b> ${esc(p.review_note || '')} Contact us if this is a mistake.</div>` : ''}
  ${p?.pending_changes ? '<div class="notice"><b>Changes awaiting review.</b> Your current listing stays online. <button type="button" class="btn sm ghost" id="disc">Discard pending changes</button></div>' : ''}
  ${status === 'approved' ? '<div class="notice small">This listing is live. Price, availability, condition and location apply when you tap Save changes. Title, description and category changes are reviewed first and the current version stays online. Your edits are saved privately as you type; nothing changes publicly until you save.</div>' : ''}
  <label for="t">Title <span aria-hidden="true" style="color:var(--danger)">*</span></label><input id="t" name="title" maxlength="120" placeholder="Enter product name" value="${esc(v.title)}" aria-required="true">
  <label for="ty">Type</label><select id="ty" name="listing_type"><option value="product" ${v.listing_type !== 'service' ? 'selected' : ''}>Product</option><option value="service" ${v.listing_type === 'service' ? 'selected' : ''}>Service</option></select>
  <label for="ct">Category <span aria-hidden="true" style="color:var(--danger)">*</span></label><select id="ct" name="category_id"><option value="">Select</option>${(cats || []).map(c => `<option value="${c.id}" ${c.id === v.category_id ? 'selected' : ''}>${c.parent_id ? '— ' : ''}${esc(c.name)}</option>`).join('')}</select>
  <label for="pr">Price (₦) <span aria-hidden="true" style="color:var(--danger)">*</span></label><input id="pr" name="price" type="number" min="0" step="1" inputmode="numeric" placeholder="e.g. 15000" value="${esc(v.price)}">
  <label for="cd">Condition</label><select id="cd" name="condition"><option value="new">New</option><option value="used" ${v.condition === 'used' ? 'selected' : ''}>Used</option><option value="not_applicable" ${v.condition === 'not_applicable' ? 'selected' : ''}>Not applicable (service)</option></select>
  <label for="lc">Location</label><input id="lc" name="location" value="${esc(v.location)}"><label for="dc">Description</label><textarea id="dc" name="description" maxlength="5000">${esc(v.description)}</textarea>
  <label for="im">Product images <span aria-hidden="true" style="color:var(--danger)">*</span></label><div id="imgs" class="row" aria-live="polite"></div>
  <input id="im" type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="small muted">JPG, PNG or WebP, up to 15 MB each (compressed automatically). ${rowTarget ? 'Images upload as soon as you pick them.' : 'New photos are added when you tap Save changes.'}</div>
  <div id="ferr" class="small" style="color:var(--danger)" role="alert"></div>
  <div class="row" style="margin-top:10px">${canDraft ? '<button class="btn" data-go="pending">Submit for review</button><button class="btn ghost" data-go="draft">Save draft</button>' : '<button class="btn" data-go="keep">Save changes</button>'}</div></form>`;
  const form = $('#f', el), read = () => { const o = {}; FIELDS.forEach(f => o[f] = form.elements[f].value); return o; }, apply = vals => FIELDS.forEach(f => form.elements[f].value = vals[f] ?? '');

  // ---- status line + incomplete-draft hint
  const T = { pending: 'Unsaved changes…', saving: 'Saving…', saved: 'All changes saved', retry: "Couldn't save changes. Retrying…", failed: "Couldn't save automatically. Use Save draft.", offline: "You're offline. Saved on this device; will sync when you're back online.", conflict: 'Autosave paused: this listing changed elsewhere.' };
  const setStatus = k => { const a = $('#as', el); if (a) { a.textContent = T[k]; a.style.color = ['retry', 'failed', 'conflict', 'offline'].includes(k) ? 'var(--danger)' : 'var(--muted)'; } hints(); };
  const busy = () => S.chips.filter(c => ['processing', 'uploading'].includes(c.state)).length, imgCount = () => S.images.length + (rowTarget ? 0 : S.chips.filter(c => c.state === 'queued').length);
  const hints = () => { const inc = $('#inc', el); if (!inc) return; const x = read(), miss = [!x.title.trim() && 'a title', !imgCount() && 'a product image', !x.category_id && 'a category', x.price === '' && 'a price'].filter(Boolean); inc.innerHTML = miss.length ? `<span class="badge">Incomplete draft</span> still needs ${miss.join(', ')}.` : '<span class="badge ok">Ready to submit</span>'; };

  // ---- autosave wiring
  const writeRow = async vals => {
    const row = toRow(vals), last = toRow(S.lastVals);
    if (!S.id) {
      const r = await sb.from('products').insert({ id: S.clientId, vendor_id: vendorId, status: 'draft', ...row }).select('updated_at').single();   // client-made id: a retried insert can never create a duplicate draft
      if (!r.error) { S.id = S.clientId; S.known = r.data.updated_at; S.lastVals = { ...vals }; dropLocal(uid, null); return; }
      if (r.error.code !== '23505') throw r.error;
      const k = await sb.from('products').select('updated_at').eq('id', S.clientId).single(); if (k.error) throw k.error; S.id = S.clientId; S.known = k.data.updated_at;   // earlier attempt had succeeded: update instead
    }
    const changed = {}; Object.keys(row).forEach(k => { if (row[k] !== (S.lastVals && k in last ? last[k] : undefined)) changed[k] = row[k]; });   // only changed fields
    if (!Object.keys(changed).length) return;
    const r = await sb.from('products').update(changed).eq('id', S.id).eq('updated_at', S.known).select('updated_at');        // optimistic lock: refuses if someone else changed the row
    if (r.error) throw r.error; if (!r.data?.length) throw { conflict: true };
    S.known = r.data[0].updated_at; S.lastVals = { ...vals };
  };
  const writeAuto = async vals => { const r = await sb.from('listing_autosaves').upsert({ product_id: S.id, owner_id: uid, data: { v: vals, base: S.lastVals }, base_updated_at: p.updated_at, updated_at: new Date().toISOString() }, { onConflict: 'product_id' }); if (r.error) throw r.error; };
  const key = () => LS(uid, S.id || editId);
  const eng = createAutosaver({ read, write: rowTarget ? writeRow : writeAuto, canSave: s => !!S.id || hasContent(s), isOnline: () => navigator.onLine, setStatus, initialKey: JSON.stringify(serverVals),
    saveLocal: s => { try { localStorage.setItem(key(), JSON.stringify({ v: s, base: S.lastVals, savedAt: Date.now() })); } catch { } }, clearLocal: () => { dropLocal(uid, S.id || editId); dropLocal(uid, null); } });
  const ensureRow = async () => { if (!S.id) await eng.flush(true); if (!S.id) throw new Error('Could not create the draft. Check your connection.'); };
  form.addEventListener('input', () => { eng.schedule(); }); form.addEventListener('change', () => { eng.schedule(); });
  const onHide = () => { if (document.hidden) eng.checkpoint(); }, onOnline = () => eng.online(), onUnload = () => eng.checkpoint();
  document.addEventListener('visibilitychange', onHide); addEventListener('online', onOnline); addEventListener('pagehide', onUnload);
  const teardown = silent => { document.removeEventListener('visibilitychange', onHide); removeEventListener('online', onOnline); removeEventListener('pagehide', onUnload); S.chips.forEach(c => c.url && URL.revokeObjectURL(c.url)); if (silent === true) eng.stop(); else eng.leaving(); };
  active = teardown; onLeave(() => { if (active === teardown) { teardown(); active = null; } });

  // ---- restore / conflict banners
  const rec = $('#rec', el);
  if (banner === 'restored') { rec.innerHTML = `<div class="notice small">Restored your unsaved changes from ${fmtDate(S.when)}. They save automatically.</div>`; eng.schedule(); }
  if (banner === 'conflict') {
    eng.pause(); rec.innerHTML = `<div class="notice bad small"><b>Choose which version to keep.</b> We found unsaved changes from ${fmtDate(S.when)}, but this listing was changed more recently. Different values: ${S.conflicts.map(c => c.f).join(', ')}.<div class="row" style="margin-top:6px"><button type="button" class="btn sm" id="mine">Use my unsaved changes</button><button type="button" class="btn sm ghost" id="theirs">Keep the saved version</button></div></div>`;
    const done = useMine => { if (useMine) { const o = { ...startVals }; S.conflicts.forEach(c => o[c.f] = c.mine); apply(o); } rec.innerHTML = ''; eng.resume(); eng.schedule(); };
    $('#mine', el).onclick = () => done(true); $('#theirs', el).onclick = () => done(false);
  }
  $$('[data-cont]', el).forEach(b => b.onclick = () => listingForm(el, b.dataset.cont, onDone));
  $('#disc', el) && ($('#disc', el).onclick = async () => { const { error } = await sb.rpc('vendor_discard_pending', { p_product: editId }); toast(error ? friendlyError(error) : 'Pending changes discarded'); listingForm(el, editId, onDone); });

  // ---- images
  const reloadImages = async () => { S.images = (await sb.from('product_images').select('id,path,original_path,sort_order').eq('product_id', S.id).order('sort_order')).data || []; };
  const renderImages = () => {
    const box = $('#imgs', el), stateTxt = { processing: 'Processing…', uploading: 'Uploading…', queued: 'Ready (added when you save)', failed: 'Failed', dup: 'Already added', saved: 'Saved' };
    box.innerHTML = (S.images.length || S.chips.length) ? S.images.map(i => `<div style="text-align:center;width:76px"><img src="${img('product-images', i.path, true)}" width="64" height="64" style="object-fit:cover;border-radius:8px" alt="Product image"><br><button type="button" class="btn sm danger" data-rm="${i.id}">Remove</button></div>`).join('') +
      S.chips.map((c, i) => `<div style="text-align:center;width:76px"><img src="${c.url}" width="64" height="64" style="object-fit:cover;border-radius:8px;opacity:${c.state === 'failed' ? .4 : .75}" alt="Selected image"><div class="small ${c.state === 'failed' ? '' : 'muted'}" style="${c.state === 'failed' ? 'color:var(--danger)' : ''}">${stateTxt[c.state]}${c.error ? '<br>' + esc(c.error) : ''}</div>${c.state === 'failed' ? `<button type="button" class="btn sm" data-retry="${i}">Retry</button> ` : ''}${['failed', 'queued', 'dup'].includes(c.state) ? `<button type="button" class="btn sm ghost" data-drop="${i}">Remove</button>` : ''}</div>`).join('')
      : '<div class="empty small" style="padding:12px;width:100%">Upload at least one clear product image</div>';
    $$('[data-rm]', box).forEach(b => b.onclick = async () => { const row = S.images.find(x => x.id === b.dataset.rm); const { error } = await sb.from('product_images').delete().eq('id', row.id); if (error) return toast(friendlyError(error)); await cleanupFiles([row.path], [row.original_path]); await reloadImages(); renderImages(); hints(); toast('Image removed'); });
    $$('[data-drop]', box).forEach(b => b.onclick = () => { const c = S.chips.splice(b.dataset.drop, 1)[0]; c.url && URL.revokeObjectURL(c.url); renderImages(); hints(); });
    $$('[data-retry]', box).forEach(b => b.onclick = () => processChip(S.chips[b.dataset.retry]));
  };
  async function processChip(c) {
    try {
      c.error = ''; c.state = 'processing'; renderImages(); c.prep ??= await prepare(c.file);
      if (S.images.some(i => i.original_path?.includes(c.prep.masterHash))) { c.state = 'dup'; renderImages(); return; }      // same photo already on this listing: do not upload again
      if (!rowTarget) { c.state = 'queued'; renderImages(); hints(); return; }
      await ensureRow(); c.state = 'uploading'; renderImages();
      await saveImage(vendorId, S.id, S.images.length, c.prep, await currentVersion(), read().title.trim() || 'Product');       // the image row is only created after every upload step succeeded
      await reloadImages(); S.chips.splice(S.chips.indexOf(c), 1); c.url && URL.revokeObjectURL(c.url); renderImages();
    } catch (e) { c.state = 'failed'; c.error = /already exists/i.test(e.message) ? 'Already uploaded' : (e.message || 'Upload failed').slice(0, 60); renderImages(); }
    hints();
  }
  $('#im', el).onchange = async e => {
    const room = 5 - S.images.length - S.chips.filter(c => c.state !== 'failed').length; const files = [...e.target.files].slice(0, Math.max(room, 0)); e.target.value = '';
    if (!files.length) return toast('A listing can have at most 5 images.');
    const added = files.map(file => ({ file, url: URL.createObjectURL(file), state: 'processing' })); S.chips.push(...added); renderImages();
    for (const c of added) await processChip(c);                                    // one at a time: gentle on phones and bandwidth
  };
  renderImages(); hints();

  // ---- explicit actions (Save draft / Submit for review / Save changes). Autosave never does any of these.
  form.onsubmit = async e => {
    e.preventDefault(); const btn = e.submitter, go = btn?.dataset.go || 'keep', fe = $('#ferr', el); fe.innerHTML = ''; const vals = read();
    const errs = listingErrors(vals, go === 'draft' ? 'draft' : 'submit', { images: imgCount(), busy: busy() });
    if (errs.length) { fe.innerHTML = `<ul style="margin:4px 0;padding-left:18px">${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; fe.scrollIntoView?.({ block: 'nearest' }); return; }
    if (eng.state.paused) { fe.textContent = 'Choose which version to keep first (see the notice above).'; return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Saving…';
    try {
      await eng.flush();                                                               // make sure the latest text is on the server first
      const row = toRow(vals);
      if (rowTarget) {
        await ensureRow();
        const { error } = await sb.from('products').update({ ...row, status: go === 'draft' ? 'draft' : 'pending' }).eq('id', S.id); if (error) throw error;
        toast(go === 'draft' ? 'Draft saved' : 'Submitted for review');
      } else {
        const { error } = await sb.from('products').update({ ...row, status: p.status }).eq('id', S.id); if (error) throw error;
        let failed = 0; const ver = await currentVersion(); for (const c of S.chips.filter(c => c.state === 'queued')) { try { await saveImage(vendorId, S.id, S.images.length, c.prep, ver, row.title || 'Product'); } catch { failed++; } }
        await sb.from('listing_autosaves').delete().eq('product_id', S.id);
        const sens = p.status === 'approved' && (row.title !== p.title || row.description !== (p.description ?? null) || row.category_id !== (p.category_id ?? null) || row.listing_type !== p.listing_type);
        toast(failed ? `Saved, but ${failed} image(s) failed. Edit the listing to add them again.` : sens ? 'Saved. Price and stock updates are live; title, description or category changes are waiting for review.' : 'Changes saved');
      }
      active = null; teardown(true); dropLocal(uid, S.id); dropLocal(uid, null); dropLocal(uid, editId); onDone();
    } catch (err) { fe.textContent = friendlyError(err); btn.disabled = false; btn.textContent = label; }
  };
}
