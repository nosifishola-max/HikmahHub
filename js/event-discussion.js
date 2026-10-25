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
    sb.from('event_comments').select('id,first_name,body,created_at').eq('event_id', eventId).eq('hidden', false).order('created_at').limit(100)
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
  const draw = rows => {
    if (!live()) return;
    el.querySelector('#event-comments').innerHTML = rows.length ? rows.map(c => `<article class="panel"><b>${esc(c.first_name)}</b><p style="white-space:pre-wrap">${esc(c.body)}</p><button class="btn sm ghost" data-report-comment="${c.id}">Report comment</button></article>`).join('') : '<p class="muted">No comments yet. Start the conversation.</p>';
    el.querySelectorAll('[data-report-comment]').forEach(b => b.onclick = async () => { b.disabled = true; const { error } = await sb.from('reports').insert({ reporter_id: state.user.id, target_type: 'event_comment', target_id: b.dataset.reportComment, reason: 'inappropriate' }); if (live()) { toast(error ? 'Could not send report. Try again.' : 'Report sent for review.'); b.disabled = false; } });
  };
  draw(comments.data);
  el.querySelector('#event-report').onsubmit = async e => { e.preventDefault(); const b = e.submitter; b.disabled = true; const { error } = await sb.from('reports').insert({ reporter_id: state.user.id, target_type: 'event', target_id: eventId, reason: e.target.reason.value }); if (live()) { toast(error ? 'Could not send report.' : 'Report sent for review.'); b.disabled = false; } };
  el.querySelector('#event-comment').onsubmit = async e => {
    e.preventDefault(); const form = e.target, body = form.body.value.trim(), b = e.submitter;
    if (!body) return; b.disabled = true;
    const { error } = await sb.rpc('add_event_comment', { p_event: eventId, p_body: body });
    if (!live()) return;
    el.querySelector('#comment-status').textContent = error ? 'Could not post comment. Please try again.' : 'Comment posted.';
    b.disabled = false;
    if (!error) { form.reset(); const r = await sb.from('event_comments').select('id,first_name,body,created_at').eq('event_id', eventId).eq('hidden', false).order('created_at').limit(100); if (!r.error) draw(r.data); }
  };
}
