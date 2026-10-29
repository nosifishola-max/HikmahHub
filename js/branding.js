// Smart branding: master (private) + branded display image (public) + thumbnail. Runs in the browser, store name read from the DB.
import { sb } from './supabase.js';
import { PROFILE, encode, sha256, put, thumbPath, validImage } from './util.js';

const MAIN = { max: 1280, limit: 250 * 1024 }, THUMB = { max: 400, limit: 60 * 1024 };
let logoP; const logo = () => logoP ??= fetch('/assets/logo-wm.png').then(r => r.blob()).then(b => createImageBitmap(b));
export const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
const blobOf = async (c, q) => { let b = await new Promise(r => c.toBlob(r, 'image/webp', q)); if (b && b.type !== 'image/webp') b = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); return b; };
const extOf = b => b.type === 'image/webp' ? 'webp' : 'jpg';

export async function trustedStoreName(vendorId) {
  const { data, error } = await sb.from('vendors').select('store_name').eq('id', vendorId).single();
  if (error || !data) throw new Error('Could not read your store details.');
  return cleanName(data.store_name);
}
export async function currentVersion() { const { data } = await sb.rpc('current_brand_version'); return data || 1; }

// Watermark (design v2): a small white HikmahHub logo with the store name under it, bottom-right, soft shadow, NO box. Sized from the shorter side so it stays
// subtle on every image shape. Baked into the delivered image (so downloads and shares carry it); the original master is kept private and untouched.
function drawBadge(ctx, w, h, store, lg) {
  const base = Math.min(w, h), lh = Math.max(14, base * 0.045), lw = lh * (lg.width / lg.height), fs = Math.max(9, lh * 0.46), m = Math.max(8, base * 0.025);
  ctx.save(); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  let t = store; const maxW = Math.max(lw, w * 0.5); while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1); if (t !== store) t = t.trimEnd() + '…';
  const x = w - m, yText = h - m, yLogo = yText - fs * 1.35 - lh;
  ctx.globalAlpha = .88; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = Math.max(2, lh * .18); ctx.shadowOffsetY = 1; ctx.drawImage(lg, x - lw, yLogo, lw, lh);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, fs * .24); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.globalAlpha = .92;
  ctx.strokeText(t, x, yText); ctx.fillStyle = '#fff'; ctx.fillText(t, x, yText);   // dark outline + white fill: readable on light and dark photos
  ctx.restore();
}
async function render(bmp, store, { max, limit }, brand) {
  const lg = brand ? await logo() : null; let scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  for (let pass = 0; pass < 3; pass++) {
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    if (brand) drawBadge(g, c.width, c.height, store, lg);
    for (const q of [0.82, 0.7, 0.58]) { const b = await blobOf(c, q); if (b && b.size <= limit) return b; }
    scale *= 0.75;
  }
  throw new Error('Image is too large to compress. Try a smaller photo.');
}
const keyOf = async (masterHash, version, store) => (await sha256(new Blob([`${masterHash}|v${version}|${store}`]))).slice(0, 20);

// Step 1: decode + master (no branding yet)
export async function prepare(file) {
  validImage(file);
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const master = await encode(bmp, PROFILE['product-originals'].max, PROFILE['product-originals'].limit);
  return { bmp, master, masterHash: (await sha256(master)).slice(0, 32) };
}
// Step 2: branded display + thumbnail from a prepared master
export async function brand(prep, vendorId, store, version) {
  const [branded, thumb] = await Promise.all([render(prep.bmp, store, MAIN, true), render(prep.bmp, store, THUMB, true)]);
  const key = await keyOf(prep.masterHash, version, store);
  return { ...prep, branded, thumb, store, version, key, path: `${vendorId}/${key}.${extOf(branded)}`, originalPath: `${vendorId}/${prep.masterHash}.${extOf(prep.master)}`, previewUrl: URL.createObjectURL(branded) };
}
async function plain(prep, vendorId) { // fallback when branding fails: optimized, unbranded
  const [m, t] = await Promise.all([render(prep.bmp, '', MAIN, false), render(prep.bmp, '', THUMB, false)]);
  return { branded: m, thumb: t, path: `${vendorId}/${prep.masterHash}-plain.${extOf(m)}` };
}

// Upload + insert row. Never throws for branding problems: falls back to an unbranded image and records the failure.
export async function saveImage(vendorId, productId, sortOrder, prep, version, altText) {
  const store = await trustedStoreName(vendorId); let proc, status = 'branded', err = null;
  try { proc = await brand(prep, vendorId, store, version); } catch (e) { status = 'failed'; err = String(e.message || e).slice(0, 300); }
  const up = [];
  try {
    const originalPath = `${vendorId}/${prep.masterHash}.${extOf(prep.master)}`;
    await put('product-originals', originalPath, prep.master); up.push(['product-originals', originalPath]);
    let main = proc; if (!proc) main = await plain(prep, vendorId);
    await put('product-images', main.path, main.branded); up.push(['product-images', main.path]);
    await put('product-images', thumbPath(main.path), main.thumb); up.push(['product-images', thumbPath(main.path)]);
    const { error } = await sb.from('product_images').insert({ product_id: productId, path: main.path, original_path: originalPath, alt_text: altText, sort_order: sortOrder, brand_status: status, brand_version: status === 'branded' ? version : null, brand_error: err });
    if (error && error.code !== '23505') throw error;
    return { status };
  } catch (e) { await cleanupFiles(up.filter(u => u[0] === 'product-images').map(u => u[1]).filter(p => !p.includes('_t.')), up.filter(u => u[0] === 'product-originals').map(u => u[1])); throw e; }
}

// Delete files only when no other row references them
export async function cleanupFiles(paths = [], originals = []) {
  for (const p of [...new Set(paths.filter(Boolean))]) {
    const { count, error } = await sb.from('product_images').select('id', { count: 'exact', head: true }).eq('path', p);
    if (!error && count === 0) await sb.storage.from('product-images').remove([p, thumbPath(p)]);
  }
  for (const o of [...new Set(originals.filter(Boolean))]) {
    const { count, error } = await sb.from('product_images').select('id', { count: 'exact', head: true }).eq('original_path', o);
    if (!error && count === 0) await sb.storage.from('product-originals').remove([o]);
  }
}

// Regenerate one stored image from its private master (store renamed / design version bumped). Skips when nothing changed.
export async function regenerate(row, vendorId, version) {
  if (!row.original_path) throw new Error('No original stored (legacy image).');
  const store = await trustedStoreName(vendorId);
  const { data: blob, error } = await sb.storage.from('product-originals').download(row.original_path);
  if (error) throw error;
  const masterHash = (await sha256(blob)).slice(0, 32), key = await keyOf(masterHash, version, store);
  if (row.brand_status === 'branded' && row.brand_version === version && row.brand_store === store && row.path.includes(key)) return 'unchanged';
  const bmp = await createImageBitmap(blob), prep = { bmp, master: blob, masterHash };
  const p = await brand(prep, vendorId, store, version);
  await put('product-images', p.path, p.branded); await put('product-images', thumbPath(p.path), p.thumb);
  const old = row.path;
  const { error: ue } = await sb.from('product_images').update({ path: p.path, brand_status: 'branded', brand_version: version, brand_error: null }).eq('id', row.id);
  if (ue) throw ue;
  if (old !== p.path) await cleanupFiles([old]);
  return 'regenerated';
}

