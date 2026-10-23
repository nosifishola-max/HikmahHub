// Like button state machine. The server stays the source of truth: taps are applied instantly on screen, then ONE request at a time is sent
// (set_product_like is idempotent), so rapid taps, retries and slow networks can never double-count.
export const likeLabel = n => n <= 0 ? 'Like' : n === 1 ? '1 like' : `${Number(n).toLocaleString('en-NG')} likes`;
export function createLikes({ setLike, onChange }, init = { count: 0, liked: false }) {
  let server = { count: Number(init.count) || 0, liked: !!init.liked }, want = server.liked, busy = false;
  const view = () => ({ liked: want, count: Math.max(0, server.count + (want ? 1 : 0) - (server.liked ? 1 : 0)) });
  const emit = extra => onChange({ ...view(), busy, ...extra });
  async function pump() {
    if (busy) return; busy = true;
    while (want !== server.liked) {
      const target = want; emit();
      try { const r = await setLike(target); server = { count: Number(r.like_count), liked: !!r.liked }; }
      catch (error) { want = server.liked; busy = false; emit({ error }); return; }   // failed: go back to what the server says
    }
    busy = false; emit();
  }
  return { set(v) { want = !!v; emit(); pump(); }, toggle() { this.set(!want); }, reset(s) { server = { count: Number(s.count) || 0, liked: !!s.liked }; want = server.liked; emit(); }, get state() { return view(); } };
}
