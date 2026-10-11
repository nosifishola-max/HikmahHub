import { sb } from '../supabase.js';
import { state, loadSession, signOut, isAdmin } from '../auth.js';
import { $, esc, toast, formData, setMeta } from '../util.js';
import { go } from '../router.js';
import { refreshNav } from '../nav.js';

export async function login(app, _, qs) {
  setMeta('Sign in', 'Sign in or create your HikmahHub student account.');
  if (state.user) return go('/account');
  let signup = qs.get('mode') === 'signup';
  const draw = () => { app.innerHTML = `<div class="wrap pad" style="max-width:460px"><h1>${signup ? 'Create your student account' : 'Sign in'}</h1>
  <form id="f" class="panel">${signup ? `<label>Full name<input name="full_name" required autocomplete="name"></label>` : ''}<label>Email<input name="email" type="email" required autocomplete="email"></label>
  <label>Password<input name="password" type="password" required minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
  <button class="btn" style="width:100%;margin-top:14px">${signup ? 'Create account' : 'Sign in'}</button><p id="msg" class="small" role="alert"></p></form>
  <p>${signup ? 'Already have an account?' : 'New to HikmahHub?'} <a href="#" id="sw">${signup ? 'Sign in' : 'Create an account'}</a></p>
  ${signup ? '<p class="small muted">Every student has an account. Vendors apply for store access from their account after joining.</p>' : ''}</div>`;
    $('#sw').onclick = e => { e.preventDefault(); signup = !signup; draw(); };
    $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); const btn = e.target.querySelector('button'); btn.disabled = true; $('#msg').textContent = '';
      const r = signup ? await sb.auth.signUp({ email: d.email, password: d.password, options: { data: { full_name: d.full_name } } }) : await sb.auth.signInWithPassword({ email: d.email, password: d.password });
      btn.disabled = false;
      if (r.error) { $('#msg').textContent = r.error.message; return; }
      if (signup && !r.data.session) { $('#msg').textContent = 'Check your email to confirm your account, then sign in.'; return; }
      await loadSession(); refreshNav(); toast('Welcome to HikmahHub'); go(state.profile?.phone ? '/' : '/account'); };
  };
  draw();
}

export async function account(app) {
  if (!state.user) return go('/login');
  setMeta('Account', 'Manage your HikmahHub profile');
  const p = state.profile || {};
  app.innerHTML = `<div class="wrap pad" style="max-width:640px"><h1>Your account</h1><p class="muted">${esc(state.user.email)} · ${esc(p.role || 'student')}</p>
  <div class="row" style="margin-bottom:12px"><a class="btn ghost sm" href="/saved" data-link>Saved</a><a class="btn ghost sm" href="/request" data-link>My requests</a><a class="btn ghost sm" href="/vendor" data-link>${state.vendor ? 'Vendor dashboard' : 'Become a vendor'}</a>${isAdmin() ? '<a class="btn gold sm" href="/admin" data-link>Admin</a>' : ''}</div>
  <form id="f" class="panel"><label>Full name<input name="full_name" value="${esc(p.full_name)}" required></label><label>Phone<input name="phone" value="${esc(p.phone)}" inputmode="tel"></label>
  <label>Matric number<input name="matric_number" value="${esc(p.matric_number)}"></label><label>Faculty<input name="faculty" value="${esc(p.faculty)}"></label>
  <label>Department<input name="department" value="${esc(p.department)}"></label><label>Level<select name="level"><option value="">Select</option>${['100', '200', '300', '400', '500', '600'].map(l => `<option ${p.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <button class="btn" style="margin-top:14px">Save profile</button></form><button id="out" class="btn ghost">Sign out</button></div>`;
  $('#f').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); const { error } = await sb.from('profiles').update(d).eq('id', state.user.id); if (error) return toast(error.message); await loadSession(); toast('Profile saved'); };
  $('#out').onclick = async () => { await signOut(); refreshNav(); go('/'); };
}
