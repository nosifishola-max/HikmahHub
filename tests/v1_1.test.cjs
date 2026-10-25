const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const vm = require('node:vm');
const path = require('node:path');

// Load the actual browser modules with explicit offline boundaries. No production traffic.
async function load(relative, mocks = {}) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, URLSearchParams, URL });
  const modules = new Map();
  async function moduleFor(file) {
    if (modules.has(file)) return modules.get(file);
    if (mocks[file]) {
      const values = mocks[file], mod = new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context }); modules.set(file, mod); return mod;
    }
    const mod = new vm.SourceTextModule(await fs.readFile(file, 'utf8'), { context, identifier: file });
    modules.set(file, mod);
    return mod;
  }
  const mod = await moduleFor(path.resolve(relative)); await mod.link((specifier, parent) => moduleFor(path.resolve(path.dirname(parent.identifier), specifier))); await mod.evaluate(); return mod.namespace;
}
const sbPath = path.resolve('js/supabase.js');
const routerPath = path.resolve('js/router.js');
const sb = { storage: { from: () => ({ getPublicUrl: p => ({ data: { publicUrl: '/image/' + p } }) }) } };

test('real product card renders arrays without numeric suffixes and escapes content', async () => {
  const mod = await load('js/pages/public.js', {
    [sbPath]: { sb },
    [path.resolve('js/live.js')]: { watch() {}, onResume() {} },
    [routerPath]: { go() {}, current: () => 0, onLeave() {} }
  });
  const product = { title: '<script>bad</script>', price: 0, slug: 'p', store_slug: 's', store_name: 'Store', availability: 'out_of_stock' };
  const html = [product, product].map(mod.card).join('');
  assert.equal((html.match(/<div class="card">/g) || []).length, 2);
  assert.ok(!html.includes('</a>0') && !html.includes('</a>1'));
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(html.includes('out of stock'));
  assert.ok(!html.includes('disc'));
  assert.ok(mod.card({ ...product, price: 80, was: 100 }).includes('-20%'));
  assert.ok(mod.card(product, '<footer>Ends tomorrow</footer>').includes('<footer>Ends tomorrow</footer>'));
});

test('tracking consumes a lazy Supabase builder exactly once for every analytics RPC', async () => {
  const { recordAnalytics } = await load('js/analytics.js');
  for (const event of ['record_product_view', 'record_store_view', 'record_search', 'record_whatsapp_click']) {
    let sent = 0;
    const client = { rpc(name, args) { assert.equal(name, event); assert.equal(args.id, 'fixture'); return { then(resolve) { sent++; resolve({ error: null }); } }; } };
    assert.equal(await recordAnalytics(client, event, { id: 'fixture' }), true);
    assert.equal(sent, 1);
  }
});

test('tracking errors never prevent contact/navigation and omit sensitive parameters', async () => {
  const { recordAnalytics } = await load('js/analytics.js'); const logs = [];
  assert.equal(await recordAnalytics({ rpc: async () => ({ error: { code: '42501', message: 'private data' } }) }, 'record_search', { p_query: 'secret' }, (...args) => logs.push(args)), false);
  assert.equal(await recordAnalytics({ rpc: () => { throw Error('network'); } }, 'record_store_view', {}, (...args) => logs.push(args)), false);
  assert.ok(!JSON.stringify(logs).includes('secret') && !JSON.stringify(logs).includes('private data'));
});

test('matric normalization preserves identifiers and strips whitespace consistently', async () => {
  const { normalizeMatric } = await load('js/vendor-identity.js');
  assert.equal(normalizeMatric(' ahu / 24\t/ 001\n'), 'AHU/24/001');
  assert.equal(normalizeMatric(null), '');
  assert.equal(normalizeMatric('a-12'), 'A-12');
});

test('like controller serializes rapid taps and rolls back failures', async () => {
  const { createLikes } = await load('js/likes.js'); let resolve, calls = 0;
  const ctl = createLikes({ setLike: liked => { calls++; return new Promise(r => { resolve = () => r({ liked, like_count: liked ? 1 : 0 }); }); }, onChange() {} });
  ctl.toggle(); ctl.toggle(); assert.equal(calls, 1); resolve(); await new Promise(setImmediate);
  assert.equal(calls, 2); resolve(); await new Promise(setImmediate);
  assert.equal(ctl.state.liked, false); assert.equal(ctl.state.count, 0);
  const bad = createLikes({ setLike: async () => { throw Error('offline'); }, onChange() {} });
  bad.toggle(); await new Promise(setImmediate); assert.equal(bad.state.liked, false);
});
