// Phone normalization: SAME rules as the database function public.normalize_phone (the database is the final authority).
// Returns digits in international format without "+", e.g. 08012345678 -> 2348012345678. Pure function, no dependencies.
const BAD = { ok: false, error: 'Enter a valid number, e.g. 08012345678 or +2348012345678. For another country, start with + and the country code.' };
export function normalizePhone(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter your WhatsApp number.' };
  if (!/^[+0-9 ()\-.]+$/.test(raw)) return { ok: false, error: 'Use digits only. Spaces, dashes and brackets are fine.' };
  const intl = /^(\+|00)/.test(raw); let d = raw.replace(/\D/g, ''); if (/^00/.test(raw)) d = d.slice(2);
  const ok = v => ({ ok: true, value: v });
  if (/^234[789][01]\d{8}$/.test(d)) return ok(d);                    // 2348012345678, +234 801 234 5678
  if (/^2340[789][01]\d{8}$/.test(d)) return ok('234' + d.slice(4));   // +234 (0)801 234 5678
  if (intl) { if (/^234/.test(d)) return BAD; return /^[1-9]\d{7,14}$/.test(d) ? ok(d) : BAD; }
  if (/^0[789][01]\d{8}$/.test(d)) return ok('234' + d.slice(1));      // 08012345678
  if (/^[789][01]\d{8}$/.test(d)) return ok('234' + d);                // 8012345678
  if (/^0\d+$/.test(d)) return { ok: false, error: 'Nigerian numbers have 11 digits, e.g. 08012345678.' };
  return BAD;
}
export const waDigits = n => { const r = normalizePhone(n); return r.ok ? r.value : String(n ?? '').replace(/\D/g, ''); };
