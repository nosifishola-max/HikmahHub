// Autosave engine (no DOM, no Supabase: fully unit-testable).
// - debounced (default 1.5 s after the last edit), never one request per keystroke
// - saves are SERIALIZED and always send the LATEST snapshot, so an older request can never overwrite newer edits
// - edits made while a save is running trigger exactly one follow-up save
// - failures retry with backoff (3s, 6s, 12s ... max 60s), at most 6 times; offline waits for the 'online' event
// - a write that throws {conflict:true} pauses autosave so nothing newer is silently overwritten
export function createAutosaver(o) {
  const delay = o.delay ?? 1500, maxFails = o.maxFails ?? 6, st = o.setTimer ?? setTimeout, ct = o.clearTimer ?? clearTimeout;
  let timer = null, localT = null, retryT = null, saving = false, again = false, paused = false, stopped = false, fails = 0, lastKey = o.initialKey ?? null, running = null;
  const key = s => JSON.stringify(s);
  async function once(force) {
    const snap = o.read(), k = key(snap);
    if (!force && k === lastKey) return;
    if (!force && o.canSave && !o.canSave(snap)) return;           // e.g. do not create an empty draft
    if (o.isOnline && !o.isOnline()) { o.setStatus('offline'); retrySoon(); return; }
    o.setStatus('saving');
    try { await o.write(snap); lastKey = k; fails = 0; ct(retryT); if (key(o.read()) === k) o.clearLocal(); o.setStatus('saved'); }
    catch (e) {
      if (e && e.conflict) { paused = true; o.setStatus('conflict'); return; }
      fails++; if (fails >= maxFails) { o.setStatus('failed'); return; }   // bounded: stop retrying, local copy is kept
      o.setStatus('retry'); retrySoon();
    }
  }
  function flush(force) {
    ct(timer); if (paused) return Promise.resolve();
    if (saving) { again = true; return running; }
    saving = true;
    running = (async () => { try { let f = force; do { again = false; await once(f); f = false; } while (again && !stopped && !paused); } finally { saving = false; } })();
    return running;
  }
  function retrySoon() { if (stopped) return; ct(retryT); retryT = st(() => flush(), Math.min(60000, 3000 * 2 ** Math.max(0, fails - 1))); }
  return {
    schedule() { if (stopped || paused) { if (!stopped) o.saveLocal(o.read()); return; } ct(localT); localT = st(() => o.saveLocal(o.read()), 250); ct(timer); timer = st(() => flush(), delay); if (saving) again = true; o.setStatus('pending'); },
    flush: force => flush(force), checkpoint() { o.saveLocal(o.read()); return flush(); },              // page hidden / tab switch: local copy first, then try the server
    online() { fails = 0; return flush(); },
    markSaved(snap) { lastKey = key(snap); }, pause() { paused = true; }, resume() { paused = false; },
    leaving() { o.saveLocal(o.read()); const p = flush(); stopped = true; ct(timer); ct(retryT); ct(localT); return p; },
    stop() { stopped = true; ct(timer); ct(retryT); ct(localT); }, get state() { return { saving, paused, stopped, fails }; },
  };
}
// 3-way merge of a restored (unsaved) draft with what is on the server now. Only a field that BOTH sides changed differently is a conflict.
export function mergeDraft(server, base, mine, fields) {
  const vals = { ...server }, conflicts = [];
  for (const f of fields) {
    if (mine[f] === base[f]) continue;                       // user did not touch it: keep server value
    if (server[f] === base[f] || server[f] === mine[f]) vals[f] = mine[f]; else conflicts.push({ f, mine: mine[f], theirs: server[f] });
  }
  return { vals, conflicts };
}
