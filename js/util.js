import { CONFIG } from './config.js';
import { sb } from './supabase.js';
import { waDigits } from './phone.js';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = n => '₦' + Number(n || 0).toLocaleString('en-NG');
export const thumbPath = p => p.replace(/(\.\w+)$/, '_t$1');
export const img = (bucket, path, thumb = false) => path ? sb.storage.from(bucket).getPublicUrl(thumb ? thumbPath(path) : path).data.publicUrl : '/assets/icons/icon-192.png';
export const fmtDate = d => new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800); }
export const waLink = (num, msg) => `https://wa.me/${waDigits(num)}?text=${encodeURIComponent(msg)}`;
export const hhWhatsApp = msg => waLink(CONFIG.HIKMAHHUB_WHATSAPP, msg);
export async function share(title, path) {
  const url = location.origin + path;
  if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  await navigator.clipboard.writeText(url).catch(() => {}); toast('Link copied');
}
export function setMeta(title, desc, image) {
  document.title = title + ' | HikmahHub';
  const set = (sel, attr, v) => { const e = $(sel); if (e && v) e.setAttribute(attr, v); };
  set('meta[name=description]', 'content', desc); set('meta[property="og:title"]', 'content', title); set('meta[property="og:description"]', 'content', desc);
  if (image) set('meta[property="og:image"]', 'content', image);
}
export const skeleton = (n = 4) => `<div class="grid">${'<div class="skel"></div>'.repeat(n)}</div>`;
export const errBox = e => `<div class="empty"><h3>Something went wrong</h3><p class="muted">${esc(e?.message || e)}</p><button class="btn ghost" onclick="location.reload()">Try again</button></div>`;
// ---- Image pipeline: validate -> resize/compress in the browser -> content-hash name -> upload once ----
export const PROFILE = { 'product-images': { max: 1280, thumb: 400, limit: 1048576 }, 'vendor-logos': { max: 256, thumb: 0, limit: 524288 }, 'event-images': { max: 1280, thumb: 480, limit: 1572864 }, 'product-originals': { max: 1600, thumb: 0, limit: 350 * 1024 } };
const RAW_MAX = 15 * 1024 * 1024; // phone photos are shrunk before upload, so allow big raw files
export function validImage(f) {
  if (f.type.startsWith('video/')) throw new Error('Videos are not supported. Please upload an image.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw new Error('Use a JPG, PNG or WebP image.');
  if (f.size > RAW_MAX) throw new Error('Image is too large (max 15 MB before compression).');
}
export async function encode(bitmap, maxSide, limit) {
  let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  for (let pass = 0; pass < 3; pass++) {
    const c = document.createElement('canvas'); c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bitmap, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.58]) {
      let b = await new Promise(r => c.toBlob(r, 'image/webp', q));
      if (b && b.type !== 'image/webp') b = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); // older Safari
      if (b && b.size <= limit) return b;
    }
    scale *= 0.75;
  }
  throw new Error('Could not compress this image enough. Try a smaller photo.');
}
export async function sha256(blob) { const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }
export async function put(bucket, path, blob) {
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error && !/already exists|Duplicate/i.test(error.message)) throw error; // same content hash = already stored, reuse it
}
export async function upload(bucket, folder, file) {
  validImage(file); const p = PROFILE[bucket];
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const main = await encode(bmp, p.max, p.limit);
  const ext = main.type === 'image/webp' ? 'webp' : 'jpg', hash = await sha256(main), path = `${folder}/${hash}.${ext}`;
  await put(bucket, path, main);
  if (p.thumb) { const t = await encode(bmp, p.thumb, 150 * 1024); await put(bucket, thumbPath(path), t); }
  bmp.close?.(); return path;
}
export async function removeFiles(bucket, paths) {
  const all = paths.filter(Boolean).flatMap(p => PROFILE[bucket].thumb ? [p, thumbPath(p)] : [p]);
  for (let i = 0; i < all.length; i += 100) await sb.storage.from(bucket).remove(all.slice(i, i + 100));
}
export const formData = f => Object.fromEntries(new FormData(f).entries());
