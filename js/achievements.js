// Vendor achievements: computed from real, server-side ranking data (get_top_vendors, last 7 days). Nothing is invented.
import { sb } from './supabase.js';
import { esc, toast, waLink } from './util.js';

const MIN_VIEWS = 10, MIN_SAVES = 3; // transparent minimums so tiny numbers cannot win a "most" badge
export const period = () => { const to = new Date(), from = new Date(Date.now() - 7 * 864e5), f = d => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }); return `${f(from)} – ${f(to)} ${to.getFullYear()}`; };

export async function computeAchievements(vendor) {
  const { data, error } = await sb.rpc('get_top_vendors', { p_days: 7, p_limit: 50 });
  if (error) throw error;
  const list = data || [], idx = list.findIndex(v => v.vendor_id === vendor.id), me = list[idx], out = [];
  if (!me) return { out, total: list.length, me: null };
  const rank = idx + 1, max = k => Math.max(...list.map(v => Number(v[k]) || 0));
  if (rank <= 5) out.push({ key: 'top5', title: 'Top 5 Trending Vendor', headline: `ranking among HikmahHub's Top 5 Trending Vendors this week`, detail: `Ranked #${rank} of ${list.length} active stores (views, saves and WhatsApp enquiries, last 7 days).` });
  if (Number(me.store_views) >= MIN_VIEWS && Number(me.store_views) === max('store_views')) out.push({ key: 'views', title: 'Most Viewed Store', headline: `being HikmahHub's Most Viewed Store this week`, detail: `${me.store_views} store views in the last 7 days, the highest on HikmahHub.` });
  if (Number(me.saves) >= MIN_SAVES && Number(me.saves) === max('saves')) out.push({ key: 'saves', title: 'Most Saved Products', headline: `having HikmahHub's Most Saved Products this week`, detail: `${me.saves} product saves in the last 7 days, the highest on HikmahHub.` });
  if (rank <= 10 && vendor.created_at && Date.now() - new Date(vendor.created_at).getTime() < 30 * 864e5) out.push({ key: 'new', title: 'Popular New Store', headline: `being one of HikmahHub's Popular New Stores`, detail: `Opened in the last 30 days and ranked #${rank} this week.` });
  return { out, total: list.length, me, rank };
}

export const shareText = (a, vendor) => `Congratulations to ${vendor.store_name} for ${a.headline}!\n\nDiscover products, stores and campus deals on HikmahHub.\n${location.origin}/shop/${vendor.slug}`;

export async function achievementImage(a, vendor) {
  const W = 1080, c = document.createElement('canvas'); c.width = W; c.height = W; const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, W, W); grad.addColorStop(0, '#0f4a2c'); grad.addColorStop(1, '#16663a'); g.fillStyle = grad; g.fillRect(0, 0, W, W);
  g.fillStyle = '#d19a0e'; g.fillRect(0, 0, W, 16);
  const logo = await createImageBitmap(await (await fetch('/assets/logo.png')).blob());
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(60, 60, 460, 130, 24); g.fill(); g.drawImage(logo, 80, 80, 420, 420 * logo.height / logo.width);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#d19a0e'; g.font = '800 64px system-ui, sans-serif'; wrap(g, a.title.toUpperCase(), W / 2, 420, 900, 74);
  let size = 96; const name = vendor.store_name; g.fillStyle = '#fff'; do { g.font = `800 ${size}px system-ui, sans-serif`; size -= 4; } while (g.measureText(name).width > 900 && size > 40);
  g.fillText(name, W / 2, 640);
  g.font = '600 38px system-ui, sans-serif'; g.fillStyle = '#d6e8dc'; g.fillText(`Week of ${period()}`, W / 2, 730);
  g.font = '700 44px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('HikmahHub · Al-Hikmah University', W / 2, 900);
  g.font = '500 34px system-ui, sans-serif'; g.fillStyle = '#d6e8dc'; g.fillText(`${location.host}/shop/${vendor.slug}`, W / 2, 960);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
}
function wrap(g, text, x, y, max, lh) { const words = text.split(' '); let line = ''; const lines = []; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; } lines.push(line); lines.forEach((l, i) => g.fillText(l, x, y + (i - (lines.length - 1)) * lh)); }

export async function shareAchievement(a, vendor, mode) {
  const text = shareText(a, vendor);
  if (mode === 'text') { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); return; }
  const blob = await achievementImage(a, vendor), file = new File([blob], 'hikmahhub-achievement.jpg', { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'hikmahhub-achievement.jpg'; l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 5000); toast('Image downloaded. Attach it in WhatsApp.');
}
