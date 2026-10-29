import { sb } from './supabase.js';
import { state } from './auth.js';
import { esc, toast } from './util.js';
import { current } from './router.js';
import { createLikes, likeLabel } from './likes.js';

export async function mountEventDiscussion(el, eventId) {
  const token = current();
  const live = () => token === current() && el.isConnected;
  el.innerHTML = '<section class="sec"><h2>Join the conversation</h2><p class="muted">Loading discussion…</p></section>';
  const [likes, comments] = await Promise.all([
    sb.rpc('get_event_likes', { p_event: eventId }),
    sb.rpc('get_event_comments', {p_event:eventId,p_offset:0,p_limit:25})
  ]);
  if (!live()) return;
  if (likes.error || comments.error) {
    el.innerHTML = '<p class="notice">Event discussion is currently unavailable. Please try again later.</p>'; return;
  }
  el.innerHTML = `<section class="sec"><h2>Join the conversation</h2><button class="btn ghost" id="event-like" aria-pressed="false">Like</button><details><summary>Report event</summary><form id="event-report"><label>Reason<select name="reason"><option value="inappropriate">Inappropriate content</option><option value="misleading">Misleading information</option><option value="other">Other</option></select></label><button class="btn sm danger">Send report</button></form></details><div id="event-comments"></div><form id="event-comment"><label>Comment (only your first name is shown)<textarea name="body" required maxlength="1000"></textarea></label><button class="btn">Post comment</button><p role="status" id="comment-status"></p></form></section>`;
  const button = el.querySelector('#event-like');
  const ctl = createLikes({
    setLike: async liked => {
      const { data, error } = await sb.rpc('set_event_like', { p_event: eventId, p_like: liked });
      if (error) throw error;
      return data[0];
    },
    onChange: s => { if (!live()) return; button.textContent = likeLabel(s.count); button.setAttribute('aria-pressed', String(s.liked)); if (s.error) toast('Could not update your like. Please try again.'); }
  }, { count: likes.data[0]?.like_count || 0, liked: !!likes.data[0]?.liked });
  ctl.reset(ctl.state); button.onclick = () => ctl.toggle();
  let visible = comments.data || [], offset = visible.length, hasMore = visible.length === 25;
  const draw = rows => {
    if (!live()) return;
    el.querySelector('#event-comments').innerHTML = rows.length ? rows.map(c => `<article class="panel" id="comment-${c.id}"><b>${esc(c.first_name)}</b><p style="white-space:pre-wrap">${esc(c.body)}</p><button class="btn sm ghost" data-report-comment="${c.id}">Report comment</button>${c.is_mine ? `<button class="btn sm ghost" data-edit-comment="${c.id}">Edit my comment</button><button class="btn sm danger" data-remove-comment="${c.id}">Remove my comment</button>` : ''}</article>`).join('') : '<p class="muted">No comments yet. Start the conversation.</p>';
    if (hasMore) el.querySelector('#event-comments').insertAdjacentHTML('beforeend','<button type="button" class="btn ghost" id="more-comments">Load more comments</button>');
    el.querySelector('#more-comments')?.addEventListener('click',async e=>{e.target.disabled=true;const result=await sb.rpc('get_event_comments',{p_event:eventId,p_offset:offset,p_limit:25});if (!live()) return;if(result.error){toast('Could not load comments. Try again.');e.target.disabled=false;return;}offset+=result.data.length;hasMore=result.data.length===25;const seen=new Set(visible.map(c=>c.id));visible.push(...result.data.filter(c=>!seen.has(c.id)));draw(visible);});
    for (const button of el.querySelectorAll('[data-edit-comment],[data-remove-comment]')) button.onclick=async()=>{
      const id=button.dataset.editComment||button.dataset.removeComment, c=visible.find(c=>c.id===id);let result;
      if(button.dataset.editComment){const body=prompt('Edit your comment (1–1000 characters)',c.body);if(body===null)return;if(!body.trim()||body.trim().length>1000){toast('Write 1–1000 characters.');return;}button.disabled=true;result=await sb.rpc('edit_event_comment',{p_comment:id,p_body:body.trim(),p_expected:c.updated_at});}
      else{if(!confirm('Remove your comment? Existing reports may retain a restricted snapshot for review.'))return;button.disabled=true;result=await sb.rpc('remove_event_comment',{p_comment:id,p_expected:c.updated_at});}
      if(!live())return;if(result.error){toast('Could not change this comment. It may have changed; reload and try again.');button.disabled=false;return;}await reload();
    };
    el.querySelectorAll('[data-report-comment]').forEach(b => b.onclick = async () => { b.disabled = true; const { error } = await sb.from('reports').insert({ reporter_id: state.user.id, target_type: 'event_comment', target_id: b.dataset.reportComment, reason: 'inappropriate' }); if (live()) { toast(error ? 'Could not send report. Try again.' : 'Report sent for review.'); b.disabled = false; } });
  };
  const reload=async()=>{const r=await sb.rpc('get_event_comments',{p_event:eventId,p_offset:0,p_limit:25});if(!live())return;if(r.error){toast('Could not refresh comments. Reload this page.');return;}visible=r.data;offset=visible.length;hasMore=visible.length===25;draw(visible);};
  draw(visible);
  el.querySelector('#event-report').onsubmit = async e => { e.preventDefault(); const b = e.submitter; b.disabled = true; const { error } = await sb.from('reports').insert({ reporter_id: state.user.id, target_type: 'event', target_id: eventId, reason: e.target.reason.value }); if (live()) { toast(error ? 'Could not send report.' : 'Report sent for review.'); b.disabled = false; } };
  el.querySelector('#event-comment').onsubmit = async e => {
    e.preventDefault(); const form = e.target, body = form.body.value.trim(), b = e.submitter;
    if (!body) return; b.disabled = true;
    const { error } = await sb.rpc('add_event_comment', { p_event: eventId, p_body: body });
    if (!live()) return;
    el.querySelector('#comment-status').textContent = error ? 'Could not post comment. Check your connection and wait 30 seconds between posts.' : 'Comment posted.';
    b.disabled = false;
    if (!error) { form.reset(); await reload(); }
  };
}
