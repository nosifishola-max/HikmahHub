import { sb } from '../supabase.js';
import { state } from '../auth.js';
import { esc, toast } from '../util.js';

export async function mountVendorReviews(el, vendor) {
  if (!el || !vendor?.id) return;
  el.innerHTML = '<div class="panel"><h2>Customer reviews</h2><p class="muted">Loading reviews…</p></div>';
  const { data, error } = await sb.from('vendor_reviews')
    .select('id,reviewer_id,rating,comment,created_at')
    .eq('vendor_id', vendor.id).eq('status', 'published')
    .order('created_at', { ascending: false }).limit(50);
  if (error) {
    el.innerHTML = '<div class="panel"><h2>Customer reviews</h2><p class="muted">Reviews are not available yet.</p></div>';
    return;
  }
  const reviews = data || [];
  const avg = reviews.length ? (reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length).toFixed(1) : null;
  const own = reviews.find(r => r.reviewer_id === state.user?.id);
  const canReview = !!state.user && state.user.id !== vendor.owner_id && !own;
  el.innerHTML = `<section class="panel vendor-reviews"><h2>Customer reviews</h2>
    <p class="muted">${avg ? `★ ${avg} / 5 · ${reviews.length} recent review${reviews.length===1?'':'s'}` : 'No reviews yet'}</p>
    <p class="small muted">Reviews describe customer experiences and are not verified purchases.</p>
    ${canReview ? `<form id="vendor-review-form"><label>Rating<select name="rating" required><option value="">Choose stars</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${'★'.repeat(n)} (${n})</option>`).join('')}</select></label><label>Your experience<textarea name="comment" minlength="15" maxlength="1000" required placeholder="Share what went well or could improve. Avoid personal information."></textarea></label><button class="btn" type="submit">Post review</button></form>` : ''}
    ${!state.user ? '<p class="small muted"><a href="/login" data-link>Sign in</a> to leave a review.</p>' : ''}
    ${reviews.length ? reviews.map(r=>`<article class="review-item"><strong aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</strong> <span class="small muted">${new Date(r.created_at).toLocaleDateString()}</span><p>${esc(r.comment)}</p>${r.reviewer_id===state.user?.id ? `<button type="button" class="btn sm ghost" data-remove-review="${r.id}">Remove my review</button>` : ''}</article>`).join('') : '<p class="muted">Be the first to share a genuine experience.</p>'}
  </section>`;
  const form = el.querySelector('#vendor-review-form');
  if (form) form.onsubmit = async e => {
    e.preventDefault();
    const button = form.querySelector('button'); button.disabled = true;
    const fd = new FormData(form);
    const rating = Number(fd.get('rating')), comment = String(fd.get('comment') || '').trim();
    if (!Number.isInteger(rating) || rating<1 || rating>5 || comment.length<15 || comment.length>1000) { toast('Choose 1–5 stars and write 15–1000 characters.'); button.disabled=false; return; }
    const { error: writeError } = await sb.from('vendor_reviews').insert({vendor_id:vendor.id,reviewer_id:state.user.id,rating,comment});
    if (writeError) { toast('Could not post review. You may already have reviewed this vendor.'); button.disabled=false; return; }
    toast('Review posted'); await mountVendorReviews(el,vendor);
  };
  el.querySelectorAll('[data-remove-review]').forEach(button=>button.onclick=async()=>{
    if (!confirm('Remove your review?')) return;
    button.disabled=true;
    const { error: removeError } = await sb.from('vendor_reviews').delete().eq('id',button.dataset.removeReview).eq('reviewer_id',state.user.id);
    if (removeError) { toast('Could not remove review'); button.disabled=false; return; }
    await mountVendorReviews(el,vendor);
  });
}

