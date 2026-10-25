import { sb } from '../supabase.js';
import { normalizeMatric } from '../vendor-identity.js';
import { state, loadSession, signOut, isAdmin } from '../auth.js';
import { $, esc, toast, formData, setMeta } from '../util.js';
import { passwordField, bindPasswordToggles, cooldown, setMsg, openDialog } from '../ui.js';
import { validatePassword, authErrorMessage, safeNext } from '../validate.js';
import { normalizePhone } from '../phone.js';
import { friendlyError } from '../validate.js';
import { go } from '../router.js';
import { refreshNav } from '../nav.js';

function confirmDialog(email, done) {   // shown only after a successful sign-up that actually needs email confirmation
  let resends = 0;
  openDialog({ title: 'Check your email', bodyHtml: `<p>Your HikmahHub account has been created.</p><p>We've sent a confirmation link to <b>${esc(email)}</b>. Open the email and confirm your account before signing in.</p><p class="muted small">If you cannot find the email, check your spam or junk folder.</p>`,
    actions: [
      { label: "I've confirmed my email", kind: 'primary', onClick: async (e, api) => {
        e.target.disabled = true; const { data: { session } } = await sb.auth.getSession();   // proof comes from a real session, not from the click
        if (session) { await loadSession(); refreshNav(); api.close(); toast('Email confirmed. Welcome!'); go(state.profile?.phone ? '/' : '/account'); return; }
        e.target.disabled = false; api.close(); done('We could not confirm your email on this device yet. Open the link in the email, then sign in with your email and password.'); } },
      { label: 'Resend confirmation email', onClick: async (e, api) => {
        if (resends >= 3) return api.setMsg('You have requested several emails. Please wait a few minutes and check your spam folder.');
        const b = e.target; b.disabled = true; resends++;
        const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${location.origin}/` } });
        if (error) { api.setMsg(authErrorMessage(error)); cooldown(b, 60); return; }   // never claim success when Supabase reports a failure
        api.setMsg(`Confirmation email requested again for ${email}. It can take a minute to arrive.`, 'ok'); cooldown(b, 60); } },
      { label: 'Close', onClick: (e, api) => api.close() }] });
}

export async function login(app, _, qs) {
  setMeta('Sign in', 'Sign in or create your HikmahHub student account.');
  const next = safeNext(qs.get('next'));
  if (state.user) return go(next || '/account');
  let mode = ['signup', 'forgot'].includes(qs.get('mode')) ? qs.get('mode') : 'signin';
  const draw = () => {
    const title = { signin: 'Sign in', signup: 'Create your student account', forgot: 'Reset your password' }[mode];
    const fields = mode === 'signup' ? `<label for="fn">Full name</label><input id="fn" name="full_name" required autocomplete="name"><label for="em">Email</label><input id="em" name="email" type="email" required autocomplete="email" inputmode="email">${passwordField('password', 'Password', { auto: 'new-password', hint: 'At least 8 characters.' })}${passwordField('confirm', 'Confirm password', { auto: 'new-password' })}`
      : mode === 'forgot' ? `<p class="muted small">Enter the email you registered with and we'll send you a reset link.</p><label for="em">Email</label><input id="em" name="email" type="email" required autocomplete="email" inputmode="email">`
      : `<label for="em">Email</label><input id="em" name="email" type="email" required autocomplete="email" inputmode="email">${passwordField('password', 'Password')}`;
    const btn = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link' }[mode];
    app.innerHTML = `<div class="wrap pad" style="max-width:460px"><h1>${title}</h1><form id="f" class="panel" novalidate>${fields}
      <button class="btn" id="go" style="width:100%;margin-top:14px">${btn}</button><p id="msg" class="small" role="alert" aria-live="polite"></p></form>
      ${mode === 'signin' ? '<p><a href="#" id="fg">Forgot password?</a></p>' : ''}
      <p>${mode === 'signup' ? 'Already have an account? <a href="#" id="sw">Sign in</a>' : mode === 'forgot' ? '<a href="#" id="sw">Back to sign in</a>' : 'New to HikmahHub? <a href="#" id="sw2">Create an account</a>'}</p>
      ${mode === 'signup' ? '<p class="small muted">Every student has an account. Vendors apply for store access from their account after joining.</p>' : ''}</div>`;
    bindPasswordToggles(app);
    const to = m => e => { e.preventDefault(); mode = m; draw(); };
    $('#sw') && ($('#sw').onclick = to('signin')); $('#sw2') && ($('#sw2').onclick = to('signup')); $('#fg') && ($('#fg').onclick = to('forgot'));
    $('#f').onsubmit = async e => {
      e.preventDefault(); const d = formData(e.target), b = $('#go'); setMsg('#msg', '');
      if (!d.email || !/^\S+@\S+\.\S+$/.test(d.email.trim())) return setMsg('#msg', 'Enter a valid email address.');
      b.disabled = true;
      try {
        if (mode === 'forgot') {
          const { error } = await sb.auth.resetPasswordForEmail(d.email.trim(), { redirectTo: `${location.origin}/reset-password` });
          if (error && /rate limit|after \d+ seconds|too many/i.test(error.message)) { setMsg('#msg', authErrorMessage(error)); cooldown(b, 60); return; }
          // same message whether or not the email exists (no account enumeration)
          setMsg('#msg', "If that email has a HikmahHub account, we've sent a reset link. Check your inbox and Spam folder. The link expires after a while.", 'ok'); cooldown(b, 60); return;
        }
        if (mode === 'signup') {
          const pe = validatePassword(d.password, d.confirm); if (pe) { setMsg('#msg', pe); b.disabled = false; return; }
          if (!d.full_name || d.full_name.trim().length < 2) { setMsg('#msg', 'Enter your full name.'); b.disabled = false; return; }
          const { data, error } = await sb.auth.signUp({ email: d.email.trim(), password: d.password, options: { data: { full_name: d.full_name.trim() }, emailRedirectTo: `${location.origin}/` } }); // only the password is sent, never the confirmation
          if (error) { setMsg('#msg', authErrorMessage(error)); if (/rate limit|after \d+ seconds|too many/i.test(error.message)) cooldown(b, 60); else b.disabled = false; return; }
          if (data.user && data.user.identities && data.user.identities.length === 0) { setMsg('#msg', "If this email is new, we've sent a confirmation link. If you already have an account, sign in or use Forgot password.", 'ok'); cooldown(b, 60); return; }
          if (!data.session) { cooldown(b, 60); confirmDialog(d.email.trim(), note => { mode = 'signin'; draw(); $('#em').value = d.email.trim(); setMsg('#msg', note, 'ok'); }); return; }
          await loadSession(); refreshNav(); toast('Welcome to HikmahHub'); go(next || '/account'); return;
        }
        const { error } = await sb.auth.signInWithPassword({ email: d.email.trim(), password: d.password });
        if (error) { setMsg('#msg', authErrorMessage(error)); b.disabled = false; return; }
        await loadSession(); await state.ready; refreshNav(); toast('Welcome back'); go(next || (state.profile?.phone ? '/' : '/account'));
      } catch (err) { setMsg('#msg', authErrorMessage(err)); b.disabled = false; }
    };
  };
  draw();
}

export async function resetPassword(app) {
  setMeta('Reset password', 'Choose a new HikmahHub password.');
  const hp = new URLSearchParams(String(window.__authHash || location.hash).replace(/^#/, ''));
  const urlErr = hp.get('error_code') || hp.get('error');
  app.innerHTML = '<div class="wrap pad" style="max-width:460px"><p class="muted">Checking your reset link…</p></div>';
  let session = null;
  for (let i = 0; i < 12 && !session && !urlErr; i++) { session = (await sb.auth.getSession()).data.session; if (!session) await new Promise(r => setTimeout(r, 250)); }
  history.replaceState({}, '', '/reset-password'); window.__authHash = '';  // remove tokens from the address bar
  if (!session) {
    app.innerHTML = `<div class="wrap pad" style="max-width:460px"><h1>Link not valid</h1><p>${urlErr === 'otp_expired' || urlErr === 'access_denied' ? 'This reset link has expired or was already used.' : 'This reset link is not valid.'} Request a new one below.</p><a class="btn" href="/login?mode=forgot" data-link>Request a new link</a></div>`; return;
  }
  app.innerHTML = `<div class="wrap pad" style="max-width:460px"><h1>Choose a new password</h1><form id="f" class="panel" novalidate>${passwordField('password', 'New password', { auto: 'new-password', hint: 'At least 8 characters.' })}${passwordField('confirm', 'Confirm new password', { auto: 'new-password' })}
    <button class="btn" id="go" style="width:100%;margin-top:14px">Update password</button><p id="msg" class="small" role="alert" aria-live="polite"></p></form></div>`;
  bindPasswordToggles(app);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const d = formData(e.target), b = $('#go'); const pe = validatePassword(d.password, d.confirm); if (pe) return setMsg('#msg', pe);   // nothing is sent until validation passes
    b.disabled = true; const { error } = await sb.auth.updateUser({ password: d.password });
    if (error) { setMsg('#msg', authErrorMessage(error)); b.disabled = false; return; }
    await sb.auth.signOut(); await loadSession(); refreshNav();
    app.innerHTML = `<div class="wrap pad" style="max-width:460px"><div class="panel"><h1>Password updated</h1><p>Your password has been changed. Sign in with your new password.</p><a class="btn" href="/login" data-link>Go to sign in</a></div></div>`;
  };
}

export async function account(app) {
  if (!state.user) return go('/login');
  setMeta('Account', 'Manage your HikmahHub profile');
  const p = state.profile || {};
  app.innerHTML = `<div class="wrap pad" style="max-width:640px"><h1>Your account</h1><p class="muted">${esc(state.user.email)} · ${esc(p.role || 'student')}</p>
  <div class="row" style="margin-bottom:12px"><a class="btn ghost sm" href="/saved" data-link>Liked products</a><a class="btn ghost sm" href="/request" data-link>My requests</a><a class="btn ghost sm" href="/vendor" data-link>${state.vendor ? 'Vendor dashboard' : 'Become a vendor'}</a>${isAdmin() ? '<a class="btn gold sm" href="/admin" data-link>Admin</a>' : ''}</div>
  <form id="f" class="panel"><label>Full name<input name="full_name" value="${esc(p.full_name)}" required></label><label>Phone<input name="phone" value="${esc(p.phone)}" inputmode="tel"></label>
  <label>Matric number<input name="matric_number" value="${esc(p.matric_number)}"></label><label>Faculty<input name="faculty" value="${esc(p.faculty)}"></label>
  <label>Department<input name="department" value="${esc(p.department)}"></label><label>Level<select name="level"><option value="">Select</option>${['100', '200', '300', '400', '500', '600'].map(l => `<option ${p.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <button class="btn" style="margin-top:14px">Save profile</button></form><button id="out" class="btn ghost">Sign out</button></div>`;
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); d.matric_number = normalizeMatric(d.matric_number) || null; if (d.phone) { const ph = normalizePhone(d.phone); if (!ph.ok) return toast(ph.error); d.phone = ph.value; } else d.phone = null; const { error } = await sb.from('profiles').update(d).eq('id', state.user.id); if (error) return toast(friendlyError(error)); await loadSession(); toast('Profile saved'); };
  $('#out').onclick = async () => { await signOut(); refreshNav(); go('/'); };
}

