// Pure validation + friendly error messages (no DOM, no network).
export function validatePassword(pw, confirm) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 72) return 'Password can be at most 72 characters.';
  if (confirm !== undefined && pw !== confirm) return 'Passwords do not match.';
  return null;
}
// level: 'draft' needs only a title; 'submit' (submit for review / saving a live listing) also needs category and price
export function validateListing(d, level) {
  const t = String(d.title ?? '').trim();
  if (t.length < 2) return 'Enter a title (at least 2 characters).';
  if (t.length > 120) return 'Title is too long (max 120 characters).';
  const hasPrice = d.price !== '' && d.price != null;
  if (hasPrice) { const n = Number(d.price); if (!Number.isFinite(n) || n < 0) return 'Price must be a number, 0 or more.'; if (n > 1e9) return 'Price is too large.'; }
  if (level === 'submit') { if (!d.category_id) return 'Choose a category before submitting.'; if (!hasPrice) return 'Enter a price before submitting.'; }
  if (String(d.description ?? '').length > 5000) return 'Description is too long (max 5000 characters).';
  return null;
}
export function authErrorMessage(err) {
  const m = String(err?.message || err || ''), code = String(err?.code || '');
  const wait = m.match(/after (\d+) seconds?/i);
  if (wait) return `Please wait ${wait[1]} seconds before trying again.`;
  if (/rate limit|too many|over_email_send_rate_limit|over_request_rate_limit/i.test(m + ' ' + code)) return 'Too many email requests right now. Please wait a few minutes and try again.';
  if (/invalid login credentials/i.test(m)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox and Spam folder.';
  if (/different from the old password|same password/i.test(m)) return 'Choose a password that is different from your old one.';
  if (/password should be|weak password|at least \d+ characters/i.test(m)) return 'That password is too weak. Use at least 8 characters.';
  if (/valid email|invalid email/i.test(m)) return 'Enter a valid email address.';
  if (/network|failed to fetch|load failed/i.test(m)) return 'Network problem. Check your connection and try again.';
  if (/expired|invalid.*(token|link)|otp/i.test(m)) return 'This link has expired or was already used. Request a new one.';
  return 'Something went wrong. Please try again.';
}
export function friendlyError(err) {
  const m = String(err?.message || err || ''), code = String(err?.code || '');
  if (/^(Choose a category|Enter a product name|Add at least one product image|A listing under review|Enter a price|Enter a valid WhatsApp|Please give a reason|Image files must|A listing can have|Store listing limit|This (application|listing) is already|Cannot change|Only approved)/.test(m)) return m;
  if (code === '23505' && /owner/i.test(m)) return 'You already have a store application.';
  if (code === '23505') return 'That already exists.';
  if (/row-level security|permission denied|not allowed/i.test(m)) return "You don't have permission to do that.";
  if (/invalid input syntax|violates check constraint/i.test(m)) return 'Please check the values you entered and try again.';
  if (/network|failed to fetch|load failed/i.test(m)) return 'Network problem. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
export const safeNext = n => (typeof n === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(n)) ? n : null; // internal paths only (no open redirect)

// All problems at once (the form shows them as a list). level 'draft' only checks format; 'submit' also needs title, category, price and an image.
export function listingErrors(d, level, { images = 0, busy = 0 } = {}) {
  const e = [], t = String(d.title ?? '').trim(), hasPrice = d.price !== '' && d.price != null;
  if (t.length > 120) e.push('Title is too long (max 120 characters).');
  if (hasPrice) { const n = Number(d.price); if (!Number.isFinite(n) || n < 0) e.push('Price must be a number, 0 or more.'); else if (n > 1e9) e.push('Price is too large.'); }
  if (String(d.description ?? '').length > 5000) e.push('Description is too long (max 5000 characters).');
  if (level === 'submit') {
    if (!t) e.push('Enter a product name.'); else if (t.length < 2) e.push('Product name must be at least 2 characters.');
    if (!d.category_id) e.push('Choose a category.');
    if (!hasPrice) e.push('Enter a price.');
    if (images < 1) e.push('Add at least one product image.');
    if (busy > 0) e.push('Wait for your images to finish uploading.');
  }
  return e;
}
