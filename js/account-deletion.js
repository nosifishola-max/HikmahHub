import { releaseFeatures } from './release.js';
import { sb } from './supabase.js';
import { state } from './auth.js';
import { esc } from './util.js';
import { passwordField, bindPasswordToggles } from './ui.js';
export const deletionExplanation = 'Request a review of your account and related data. Submitting a request does not delete or suspend your account. Support will review listings, disputes and records before any future erasure.';
export async function submitDeletionRequest(client, user, password, confirmation, accepted) {
 if (!accepted || confirmation !== 'DELETE MY ACCOUNT' || !password) throw Error('confirmation');
 const {data,error}=await client.auth.signInWithPassword({email:user.email,password});
 if(error || data?.user?.id!==user.id) throw Error('reauthentication');
 const result=await client.rpc('request_account_deletion',{p_confirmation:confirmation});
 const row=Array.isArray(result.data)?result.data[0]:result.data;
 if(result.error || !row?.id) throw Error('request');
 return row;
}
export async function mountDeletion(el) {
 if (!el?.isConnected) return;
 if (!releaseFeatures.privacyRequests) { el.innerHTML = '<h2>Privacy &amp; Account</h2><h3>Delete My Account</h3><p>Contact support to request an account and data review. This does not immediately delete or suspend your account. Do not send your password.</p><p><a href="mailto:nosifdigitalsolutions@gmail.com?subject=HikmahHub%20account%20deletion%20request">Request deletion by email</a></p><a href="/privacy" data-link>Privacy Policy</a> · <a href="/terms" data-link>Terms &amp; Conditions</a>'; return; }

 el.innerHTML=`<div class="privacy-top"><h2>Privacy &amp; Account</h2><p class="privacy-subtitle">Manage your information and account requests.</p><div class="privacy-links"><a href="/privacy" data-link>Privacy Policy</a><a href="/terms" data-link>Terms &amp; Conditions</a></div></div><div class="deletion-panel"><h3>Delete My Account</h3><p class="deletion-explainer">${deletionExplanation}</p><p class="deletion-support">Need help? <a href="mailto:nosifdigitalsolutions@gmail.com">Email support</a> or <a href="https://wa.me/2349154645161" rel="noopener noreferrer" target="_blank">WhatsApp</a>. Never share your password.</p><div id="deletion-state" role="status"></div><details class="deletion-details"><summary>Request account deletion</summary><form id="deletion-form">${passwordField('deletion_password','Confirm your current password',{auto:'current-password'}).replace(/ minlength="8"| maxlength="72"/g,'')}<label>Type DELETE MY ACCOUNT<input name="confirmation" autocomplete="off" required></label><label class="consent"><input type="checkbox" name="accepted" required> I understand this is a reviewed request, not instant deletion.</label><button class="btn danger">Submit deletion request</button><p role="alert" id="deletion-error"></p></form></details></div>`;
 bindPasswordToggles(el);
 const message=el.querySelector('#deletion-state'),form=el.querySelector('#deletion-form');
 const show=request=>{message.textContent=`Request ${request.id} — ${request.status.replaceAll('_',' ')}. ${request.public_message}`;
 if(['pending_review','in_review','on_hold'].includes(request.status)){const withdraw=document.createElement('button');withdraw.type='button';withdraw.className='btn ghost';withdraw.textContent='Withdraw this request';message.appendChild(withdraw);withdraw.onclick=async()=>{const error=el.querySelector('#deletion-error');withdraw.disabled=true;try{const auth=await sb.auth.signInWithPassword({email:state.user.email,password:form.elements.deletion_password.value});if(auth.error||auth.data?.user?.id!==state.user.id)throw Error('auth');const r=await sb.rpc('withdraw_account_deletion',{p_request:request.id});if(r.error)throw Error('request');message.textContent='Request withdrawn. Your account and data were not deleted.';}catch{error.textContent='Enter your current password in the form, then try withdrawing again. If review has progressed, contact support.';withdraw.disabled=false;}finally{form.elements.deletion_password.value='';}};}};
 try {const r=await sb.from('account_deletion_requests').select('id,status,public_message').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(1);if(r.data?.[0])show(r.data[0]);else if(r.error)message.textContent='';}catch{message.textContent='';}
 form.onsubmit=async e=>{
  e.preventDefault();const button=e.submitter,error=el.querySelector('#deletion-error');button.disabled=true;error.textContent='';
  const user={id:state.user.id,email:state.user.email};
  try {const r=await submitDeletionRequest(sb,user,form.elements.deletion_password.value,form.elements.confirmation.value,form.elements.accepted.checked);show(r);form.reset();error.textContent='Request recorded for review. Your account and data have not been deleted. Retrying after a connection problem returns the same open request.';}
  catch(err){error.textContent=err.message==='confirmation'?'Type the exact confirmation and confirm that you understand the review process.':err.message==='reauthentication'?'Password confirmation failed. Try again, or use account recovery before requesting deletion.':'Could not confirm that the request was recorded. Reload to check its status, or retry safely. Your account has not been deleted.';}
  finally{form.elements.deletion_password.value='';button.disabled=false;}
 };
}

