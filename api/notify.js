// Vercel serverless function: emails a vendor when an admin approves or rejects their application.
// Security: the caller must be a signed-in ADMIN. The caller's own token is used to claim the notification
// through database functions that check is_admin(), so no service-role key exists anywhere.
// Env (Vercel -> Settings -> Environment Variables, then REDEPLOY): SUPABASE_ANON_KEY, SMTP_USER, SMTP_PASS (Gmail app password),
// optional: SUPABASE_URL, SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), MAIL_FROM, SITE_URL.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function template(kind, store, reason, site) {
  const btn = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#d19a0e;color:#241a00;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:10px">${esc(label)}</a>`;
  const approved = kind === 'approved';
  const subject = approved ? 'Your HikmahHub store has been approved' : 'Update on your HikmahHub vendor application';
  const body = approved
    ? `<h2 style="margin:0 0 12px;color:#0f4a2c">Congratulations, ${esc(store)} is approved! 🎉</h2><p>Your vendor application has been approved. You can now list your products and services on HikmahHub.</p>
       <ol style="line-height:1.7"><li>Sign in at HikmahHub.</li><li>Open <b>Account → Vendor dashboard</b> (or the <b>My store</b> tab).</li><li>Tap <b>Add listing</b>, fill in the details, add clear photos and tap <b>Submit for review</b>.</li></ol><p>Listings go live once they are approved.</p><p style="margin:20px 0">${btn(site + '/vendor', 'Open my vendor dashboard')}</p>`
    : `<h2 style="margin:0 0 12px;color:#0f4a2c">About your application for ${esc(store)}</h2><p>Thank you for applying. Your application was <b>not approved</b> this time.</p>
       <p style="background:#fde7e5;border-radius:8px;padding:12px"><b>Reason:</b> ${esc(reason || 'No reason was provided.')}</p>
       <p>You can correct this and apply again:</p><ol style="line-height:1.7"><li>Sign in at HikmahHub.</li><li>Open <b>Account → Vendor dashboard</b>. Your application opens with the details filled in.</li><li>Update the details and tap <b>Resubmit application</b>.</li></ol><p style="margin:20px 0">${btn(site + '/vendor', 'Update my application')}</p>`;
  const html = `<div style="background:#f6f7f2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dfe5da">
    <tr><td style="background:#0f4a2c;padding:18px;text-align:center"><img src="${esc(site)}/assets/logo.png" alt="HikmahHub" width="160" style="background:#fff;padding:8px 12px;border-radius:8px"></td></tr>
    <tr><td style="padding:24px;color:#16231b;font-size:16px;line-height:1.5">${body}</td></tr>
    <tr><td style="border-top:1px solid #dfe5da;padding:14px;color:#5d6b62;font-size:12px;text-align:center">HikmahHub · The campus marketplace and discovery platform</td></tr></table></div>`;
  const text = approved ? `Congratulations! ${store} is approved on HikmahHub.\nSign in, open Account > Vendor dashboard, tap Add listing and Submit for review.\n${site}/vendor`
    : `Your HikmahHub vendor application for ${store} was not approved.\nReason: ${reason || 'No reason was provided.'}\nSign in, open Account > Vendor dashboard, update the details and tap Resubmit application.\n${site}/vendor`;
  return { subject, html, text };
}

// Accept the documented names plus common aliases, so a slightly different variable name does not silently break email. Spaces in a Gmail app password are removed.
const pick = names => { for (const n of names) { const v = (process.env[n] || '').trim(); if (v) return v; } return ''; };
const USER_NAMES = ['SMTP_USER', 'GMAIL_USER', 'EMAIL_USER'], PASS_NAMES = ['SMTP_PASS', 'SMTP_PASSWORD', 'GMAIL_APP_PASSWORD', 'EMAIL_PASS'];
const smtp = () => ({ user: pick(USER_NAMES), pass: pick(PASS_NAMES).replace(/\s+/g, '') });
const mask = e => e.replace(/^(.).*(@.*)$/, '$1***$2');
const classify = e => { const c = String(e && e.code || ''); if (c === 'EAUTH' || /535|Invalid login|Username and Password/i.test(String(e && e.message))) return 'SMTP_AUTH'; if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'EDNS'].includes(c)) return 'SMTP_CONNECT'; return 'SEND_FAILED'; };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const base = process.env.SUPABASE_URL || 'https://tqfgrugtgjnxlbqffmgy.supabase.co', key = process.env.SUPABASE_ANON_KEY;
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Not allowed' });
  if (!key) return res.status(500).json({ ok: false, code: 'not_configured', error: 'SUPABASE_ANON_KEY is missing on the server' });
  if (!token) return res.status(401).json({ ok: false, error: 'Sign in again' });
  const rpc = (fn, body) => fetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const adm = await rpc('is_admin', {}).then(r => r.ok ? r.json() : false).catch(() => false);           // only signed-in admins may use this endpoint at all
  if (adm !== true) return res.status(403).json({ ok: false, error: 'Not allowed' });
  const { user, pass } = smtp();

  if (req.method === 'GET') {                                    // configuration check for the admin screen: names only, never values
    const missing = [!user && 'SMTP_USER', !pass && 'SMTP_PASS'].filter(Boolean);
    return res.status(200).json({ ok: true, configured: !missing.length, missing, sender: user ? mask(user) : null });
  }

  const id = req.body && req.body.notification_id;
  if (!UUID.test(String(id))) return res.status(400).json({ ok: false, error: 'Bad request' });
  if (!user || !pass) {                                          // checked BEFORE claiming, so a missing setting never burns the notification
    console.error('[notify] email not configured; missing:', [!user && 'SMTP_USER', !pass && 'SMTP_PASS'].filter(Boolean).join(', '));
    return res.status(503).json({ ok: false, code: 'not_configured', error: 'Email is not set up on the server yet. Add SMTP_USER and SMTP_PASS in Vercel, then redeploy.' });
  }
  const claim = await rpc('admin_claim_notification', { p_id: id });
  if (!claim.ok) return res.status(403).json({ ok: false, error: 'Not allowed' });
  const row = (await claim.json())[0];
  if (!row) return res.status(200).json({ ok: true, skipped: true });          // already sent or being sent: never duplicate
  const finish = (ok, error) => rpc('admin_finish_notification', { p_id: id, p_ok: ok, p_error: error || null }).catch(() => { });
  const site = (process.env.SITE_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');
  try {
    const nodemailer = require('nodemailer'), m = template(row.kind, row.store_name, row.reason, site);
    const t = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, secure: (Number(process.env.SMTP_PORT) || 465) === 465, auth: { user, pass } });
    await t.sendMail({ from: process.env.MAIL_FROM || `HikmahHub <${user}>`, to: row.to_email, subject: m.subject, text: m.text, html: m.html });
    await finish(true); return res.status(200).json({ ok: true });
  } catch (e) {
    const code = classify(e), detail = String(e && e.message || e).split(pass).join('***').slice(0, 160);
    console.error('[notify] send failed:', code, detail);                                   // technical detail stays in Vercel logs; the browser only gets a code
    await finish(false, `${code}: ${code === 'SMTP_AUTH' ? 'login rejected' : code === 'SMTP_CONNECT' ? 'could not reach mail server' : 'send failed'}`);
    return res.status(502).json({ ok: false, code: code.toLowerCase(), error: 'The email could not be sent' });
  }
};
module.exports._template = template;
