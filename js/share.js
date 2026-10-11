import { esc, money, toast, waLink, $ } from './util.js';
const SITE = () => location.origin;
async function fetchBlob(url) { const r = await fetch(url); if (!r.ok) throw new Error('Image not available'); return r.blob(); }

// Promo card 1080x1350: product photo, name, price, store, HikmahHub logo. Plain canvas, no dependencies.
export async function promoImage({ title, price, store, imageUrl, url }) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#0f4a2c'; g.fillRect(0, 0, W, 14);
  const photo = await createImageBitmap(await fetchBlob(imageUrl)), logo = await createImageBitmap(await fetchBlob('/assets/logo.png'));
  const box = 960, s = Math.min(box / photo.width, box / photo.height), pw = photo.width * s, ph = photo.height * s;
  g.fillStyle = '#f1f4ee'; g.beginPath(); g.roundRect(60, 50, box, box, 28); g.fill(); g.drawImage(photo, 60 + (box - pw) / 2, 50 + (box - ph) / 2, pw, ph);
  g.fillStyle = '#16231b'; g.textBaseline = 'top'; g.font = '700 54px system-ui, sans-serif';
  let t = title; while (t.length > 1 && g.measureText(t).width > 960) t = t.slice(0, -1); if (t !== title) t = t.trimEnd() + '…'; g.fillText(t, 60, 1040);
  g.fillStyle = '#0f4a2c'; g.font = '800 72px system-ui, sans-serif'; g.fillText(money(price), 60, 1110);
  g.fillStyle = '#5d6b62'; g.font = '600 36px system-ui, sans-serif'; let st = store; while (st.length > 1 && g.measureText('Sold by ' + st).width > 520) st = st.slice(0, -1); g.fillText('Sold by ' + st + (st !== store ? '…' : ''), 60, 1210);
  const lh = 64; g.drawImage(logo, W - 60 - lh * logo.width / logo.height, 1200, lh * logo.width / logo.height, lh);
  g.fillStyle = '#5d6b62'; g.font = '500 28px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText(url.replace(/^https?:\/\//, ''), W - 60, 1280);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
}
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
const fileShare = async (blob, name, text, url) => { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], text, url }); return true; } catch (e) { if (e.name === 'AbortError') return true; } } return false; };

export function openShareSheet({ title, price, store, path, imageUrl }) {
  const url = SITE() + path, text = `${title} – ${money(price)} at ${store} on HikmahHub\n${url}`;
  $('#sheet')?.remove();
  const el = document.createElement('div'); el.id = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Share product');
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:60;display:flex;align-items:flex-end;justify-content:center';
  el.innerHTML = `<div class="panel" style="width:100%;max-width:480px;margin:0;border-radius:16px 16px 0 0;padding-bottom:calc(16px + env(safe-area-inset-bottom))"><div class="row"><h3 class="grow">Share this product</h3><button class="btn sm ghost" id="x" aria-label="Close">Close</button></div>
  <div class="row" style="flex-direction:column;align-items:stretch;gap:8px"><a class="btn wa" target="_blank" rel="noopener" href="${waLink('', text).replace('wa.me/', 'wa.me/')}" id="wa">Share on WhatsApp</a>
  <button class="btn ghost" id="cp">Copy link</button>${imageUrl ? '<button class="btn ghost" id="dl">Download product image</button><button class="btn gold" id="pr">Create promo image</button>' : ''}</div><div id="out" style="margin-top:12px"></div></div>`;
  document.body.appendChild(el); const close = () => el.remove();
  $('#x', el).onclick = close; el.onclick = e => { if (e.target === el) close(); }; addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', k); } });
  $('#wa', el).href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  $('#cp', el).onclick = async () => { await navigator.clipboard.writeText(url).catch(() => {}); toast('Link copied'); };
  if (!imageUrl) return;
  $('#dl', el).onclick = async () => { try { const b = await fetchBlob(imageUrl); if (!(await fileShare(b, 'hikmahhub-product.' + (b.type.includes('webp') ? 'webp' : 'jpg'), text, url))) save(b, 'hikmahhub-product.' + (b.type.includes('webp') ? 'webp' : 'jpg')); } catch (e) { toast(e.message); } };
  $('#pr', el).onclick = async () => { const o = $('#out', el); o.textContent = 'Creating image…';
    try { const b = await promoImage({ title, price, store, imageUrl, url }); const u = URL.createObjectURL(b);
      o.innerHTML = `<img src="${u}" alt="Promo image for ${esc(title)}" style="max-height:46vh;margin:0 auto;border-radius:10px"><div class="row" style="margin-top:8px"><button class="btn grow" id="ps">Share image</button><button class="btn ghost" id="pd">Download</button></div>`;
      $('#ps', el).onclick = async () => { if (!(await fileShare(b, 'hikmahhub-promo.jpg', text, url))) save(b, 'hikmahhub-promo.jpg'); }; $('#pd', el).onclick = () => save(b, 'hikmahhub-promo.jpg');
    } catch (e) { o.textContent = 'Could not create the image: ' + e.message; } };
}
