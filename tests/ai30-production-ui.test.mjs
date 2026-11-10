import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { AI_LIMITS } from '../lib/ai/limits.ts';
import * as siteContract from '../lib/ai/site-contract.ts';
import * as privateContract from '../lib/ai/private-contract.ts';
import { siteCapabilityFixture, siteInterpretationFixture } from './fixtures/ai30-site-ui.mjs';

// All capabilities, grants, quotes and provider outputs in this suite are synthetic.
// Route mocks exercise the browser contract, never Worker authorization or paid execution.
globalThis.fetch = () => { throw new Error('TEST_FORBIDS_NETWORK'); };
const NOW = Date.UTC(2026, 9, 22, 12);
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const compiled = compile('../components/radar/use-interpretation.ts');
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const postBody = call => call.options.body ? JSON.parse(call.options.body) : undefined;

// Same bounded hook runner as ai30b-private-ui, with explicit site module/HTTP routing.
function harness() {
  const result = siteInterpretationFixture(NOW), calls = [], slots = [], timers = new Map(), effects = [];
  let cursor = 0, dirty = false, selected = 'BTC-USDT', handler, delayedModule;
  const react = {
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, next => { slots[i].value = next; dirty = true; }]; },
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useCallback(fn) { return fn; },
    useLayoutEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) { slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const require = name => {
    if (name === 'react') return react;
    if (name.endsWith('/limits')) return { AI_LIMITS };
    if (name.endsWith('/private-contract')) return privateContract;
    if (name.endsWith('/site-contract')) return delayedModule && calls.some(c => postBody(c)?.action === 'interpret') ? delayedModule.promise.then(() => siteContract) : siteContract;
    throw new Error(`unexpected module ${name}`);
  };
  const fallback = (url, options = {}) => {
    if (url.startsWith('/api/interpretation/result?')) return json({ ...result, cacheHit: true, oldSnapshot: true });
    if (url !== '/api/interpretation') throw new Error(`unexpected route ${url}`);
    if (options.method !== 'POST') return json(siteCapabilityFixture());
    const body = JSON.parse(options.body);
    if (body.action === 'snapshot') return json({ snapshotId: result.snapshot.id, expiresAt: result.snapshot.expiresAt });
    if (body.action === 'interpret') return json(result);
    throw new Error(`unexpected action ${body.action}`);
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'setTimeout', 'clearTimeout', compiled)(require, mod, mod.exports,
    async (url, options = {}) => { calls.push({ url, options }); return handler ? handler(url, options, fallback) : fallback(url, options); },
    (fn, ms) => { timers.set(fn, ms); return fn; }, fn => timers.delete(fn));
  const render = (symbol = selected) => { selected = symbol; let controller; do { dirty = false; cursor = 0; controller = mod.exports.useInterpretation(symbol); while (effects.length) effects.shift()(); } while (dirty); return controller; };
  return { get controller() { return render(); }, render, result, calls, timers, exports: mod.exports, setHandler(fn) { handler = fn; },
    delayModule() { delayedModule = deferred(); return delayedModule; }, deadline() { for (const fn of [...timers.keys()]) fn(); } };
}

function uiHarness() {
  let id = 0; const targets = new Map(), focused = [], frames = [];
  const jsx = (type, props) => ({ type, props });
  const document = { getElementById: key => targets.get(key) }, navigation = { exports: {} };
  new Function('require', 'module', 'exports', 'document', 'window', 'CustomEvent', 'requestAnimationFrame', compile('../components/radar/evidence-navigation.ts'))(
    name => { assert.ok(name.endsWith('/motion-preference')); return { isMotionReduced: () => true }; }, navigation, navigation.exports,
    document, { scrollY: 100, scrollTo() {} }, class { constructor(type, options) { this.type = type; Object.assign(this, options); } }, fn => frames.push(fn));
  const require = name => {
    if (name === 'react') return { useId: () => `:mock-${++id}:`, useState: initial => [initial, () => {}] };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name.endsWith('/private-contract')) return privateContract;
    if (name === './use-interpretation') return { interpretationErrors: harness().exports.interpretationErrors };
    if (name === './evidence-navigation') return navigation.exports;
    throw Error(`unexpected UI module ${name}`);
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compile('../components/radar/ai-interpretation.tsx'))(require, mod, mod.exports);
  const expand = node => {
    if (Array.isArray(node)) return node.flatMap(expand);
    if (node == null || typeof node !== 'object') return [node];
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return [{ ...node, children: expand(node.props?.children) }];
  };
  const flatten = nodes => nodes.flatMap(n => n && typeof n === 'object' ? [n, ...flatten(n.children)] : []);
  return { render(controller) { const nodes = flatten(expand(mod.exports.AIInterpretation({ controller, context: null, onChart() {} }))); for (const n of nodes) if (n.props?.id) { const detail = { tagName: 'DETAILS', open: false, parentElement: null }; targets.set(n.props.id, { tagName: String(n.type).toUpperCase(), isConnected: true, parentElement: detail, closest: () => null, dispatchEvent() {}, scrollIntoView() {}, focus: () => focused.push(n.props.id), detail }); } return nodes; }, focused, targets, flushFrames() { const pending = frames.splice(0); for (const fn of pending) fn(); }, get frameCount() { return frames.length; } };
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : (node?.children ?? []).map(text).join(' ');
const content = nodes => nodes.flatMap(n => (n.children ?? []).filter(x => typeof x === 'string' || typeof x === 'number')).join(' ');

test('site capability discovery is manual, blocked capability sends no snapshot or interpretation and has no private credential form', async () => {
  const h = harness(); h.render(); h.render(); assert.equal(h.calls.length, 0);
  h.setHandler(() => json(siteCapabilityFixture({ admission: 'blocked' })));
  await h.controller.generate(); assert.equal(h.controller.mode, 'site_controlled'); assert.equal(h.controller.gate, 'blocked');
  assert.equal(h.controller.error, 'data_permission_unavailable'); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.method, undefined); assert.equal(h.controller.result, null);
  const nodes = uiHarness().render(h.controller);
  assert.equal(nodes.some(n => n.type === 'input' && n.props.type === 'password'), false);
  assert.equal(nodes.some(n => n.type === 'select'), false); assert.match(content(nodes), /来源用途许可/);
  assert.doesNotMatch(content(nodes), /演示结果|本机服务提供的会话凭据/);
});

test('fresh read-only capability discovery shows the read grant without offering generation or an unknown record', async () => {
  const h = harness();
  h.setHandler(() => json(siteCapabilityFixture({ admission: 'blocked', reason: 'read_only', allowedSymbols: ['BTC-USDT'] })));
  await h.controller.discover();
  assert.equal(h.controller.error, ''); assert.equal(h.controller.canRestore, false);
  const nodes = uiHarness().render(h.controller);
  assert.match(content(nodes), /仅可读取/);
  assert.ok(!nodes.some(n => n.type === 'button' && /解释新快照|解释当前状态|读取原快照/.test(text(n))));
  await h.controller.connectSession('unexpected-private-session');
  assert.deepEqual(h.calls.map(c => c.options.method ?? 'GET'), ['GET']);
});

test('site generation strictly sends snapshot then interpret with only action, asset and opaque snapshot identity', async () => {
  const h = harness(); await h.controller.generate('information_present');
  assert.equal(h.controller.phase, 'ready'); assert.equal(h.controller.resultKind, 'site_controlled'); assert.deepEqual(h.controller.result, h.result);
  assert.deepEqual(h.calls.map(c => [c.url, c.options.method ?? 'GET']), [['/api/interpretation', 'GET'], ['/api/interpretation', 'POST'], ['/api/interpretation', 'POST']]);
  assert.deepEqual(h.calls.slice(1).map(postBody), [{ action: 'snapshot', symbol: 'BTC-USDT' }, { action: 'interpret', symbol: 'BTC-USDT', snapshotId: h.result.snapshot.id }]);
  for (const c of h.calls) { assert.equal(c.options.credentials, 'same-origin'); assert.equal(c.options.cache, 'no-store'); assert.ok(c.options.signal instanceof AbortSignal); }
  for (const c of h.calls.slice(1)) assert.deepEqual(c.options.headers, { 'Content-Type': 'application/json' });
  assert.equal(h.controller.connected, false); assert.equal(h.controller.canRestore, true); assert.equal(h.timers.size, 0);
  const before = h.calls.length; h.render(); uiHarness().render(h.controller); h.render(); assert.equal(h.calls.length, before);
});

test('site restore is an explicit same-asset GET and preserves original timestamps without a second dispatch', async () => {
  const h = harness(); await h.controller.generate(); h.calls.length = 0; await h.controller.restoreOriginal();
  assert.equal(h.controller.phase, 'ready'); assert.equal(h.controller.result.cacheHit, true); assert.equal(h.controller.result.oldSnapshot, true);
  assert.deepEqual(h.calls.map(c => c.options.method ?? 'GET'), ['GET', 'GET']);
  const restored = new URL(h.calls[1].url, 'http://localhost'); assert.equal(restored.pathname, '/api/interpretation/result');
  assert.deepEqual([...restored.searchParams], [['symbol', 'BTC-USDT'], ['snapshotId', h.result.snapshot.id]]);
  assert.equal(h.calls[1].options.body, undefined);
  for (const key of ['asOf', 'generatedAt']) assert.equal(h.controller.result[key], h.result[key]);
  assert.deepEqual(h.controller.result.snapshot, h.result.snapshot);
  const rendered = content(uiHarness().render(h.controller)); assert.match(rendered, /读取已保存的原快照结果/); assert.match(rendered, /服务端标记为旧快照/); assert.match(rendered, /2026-10-22 12:00:00 UTC/);
});

test('read-authorized original result can be restored while new spending is disabled', async () => {
  for (const reason of ['read_only', 'disabled', 'provider_not_configured']) {
    const h = harness(); await h.controller.generate(); h.calls.length = 0;
    h.setHandler((url, options, fallback) => url === '/api/interpretation' ? json(siteCapabilityFixture({ admission: 'blocked', reason, allowedSymbols: ['BTC-USDT'] })) : fallback(url, options));
    await h.controller.restoreOriginal(); assert.equal(h.controller.phase, 'ready'); assert.equal(h.controller.gate, 'blocked'); assert.equal(h.controller.result.cacheHit, true);
    assert.deepEqual(h.calls.map(c => c.options.method ?? 'GET'), ['GET', 'GET']);
    if (reason === 'read_only') {
      const nodes = uiHarness().render(h.controller);
      assert.match(content(nodes), /仅可读取/);
      assert.ok(nodes.some(n => n.type === 'button' && text(n) === '读取原快照'));
      assert.ok(!nodes.some(n => n.type === 'button' && /^解释(新快照|当前状态)$/.test(text(n))));
    }
    h.calls.length = 0; await h.controller.generate(); assert.equal(h.controller.error, reason); assert.equal(h.calls.length, 1);
  }
});

test('settled result missing from storage reports unavailable and never re-dispatches on restore', async () => {
  const h = harness();
  h.setHandler((url, options, fallback) => postBody({ options })?.action === 'interpret' ? json({ error: 'budget_unavailable' }, 503) : fallback(url, options));
  await h.controller.generate(); assert.equal(h.controller.result, null); assert.equal(h.controller.canRestore, true); h.calls.length = 0;
  h.setHandler((url, options, fallback) => url.includes('/result?') ? json({ error: 'result_unavailable' }, 404) : fallback(url, options));
  await h.controller.restoreOriginal(); assert.equal(h.controller.error, 'result_unavailable'); assert.equal(h.controller.result, null);
  assert.deepEqual(h.calls.map(c => c.options.method ?? 'GET'), ['GET', 'GET']); assert.match(h.exports.interpretationErrors.result_unavailable, /未重新派发模型/);
});

test('site grant, source or identity revocation clears sensitive previous result and restore identity', async () => {
  for (const code of ['authentication_required', 'access_denied', 'permission_revoked', 'authorization_unavailable', 'data_permission_unavailable', 'real_authorization_required', 'record_unavailable']) {
    const h = harness(); await h.controller.generate(); h.calls.length = 0;
    h.setHandler((url, options, fallback) => url.includes('/result?') ? json({ error: code }, 403) : fallback(url, options));
    await h.controller.restoreOriginal(); assert.equal(h.controller.error, code); assert.equal(h.controller.result, null); assert.equal(h.controller.canRestore, false);
    assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
  }
});

test('revoked capability prevents restoration and removes prior authorized content', async () => {
  const h = harness(); await h.controller.generate(); h.calls.length = 0;
  h.setHandler(() => json({ error: 'access_denied' }, 403)); await h.controller.restoreOriginal();
  assert.equal(h.calls.length, 1); assert.equal(h.controller.error, 'access_denied'); assert.equal(h.controller.result, null); assert.equal(h.controller.canRestore, false);
});

test('full-site session expiry clears an existing result at capability, snapshot, interpretation and restore', async () => {
  for (const stage of ['capability', 'snapshot', 'interpret', 'restore']) {
    const h = harness(); await h.controller.generate(); h.calls.length = 0;
    const denied = deferred();
    h.setHandler((url, options, fallback) => {
      const current = url.includes('/result?') ? 'restore' : options.method === 'POST' ? postBody({ options }).action : 'capability';
      return current === stage ? denied.promise : fallback(url, options);
    });
    const pending = stage === 'restore' ? h.controller.restoreOriginal() : h.controller.generate();
    await tick(); const beforeDenial = h.calls.length;
    denied.resolve(json({ error: '请先输入访问码', code: 'ACCESS_REQUIRED' }, 401));
    await pending;
    assert.equal(h.controller.error, 'authentication_required', stage);
    assert.equal(h.controller.result, null); assert.equal(h.controller.canRestore, false);
    assert.equal(h.controller.gate, 'blocked'); assert.deepEqual(h.controller.allowedSymbols, []);
    assert.equal(h.calls.length, beforeDenial);
    assert.ok(!uiHarness().render(h.controller).some(n => n.props.className === 'ai-result'));
  }
});

test('late successful interpretation cannot restore old evidence after a new request detects session expiry', async () => {
  const h = harness(); await h.controller.generate();
  const held = deferred();
  h.setHandler((url, options, fallback) => postBody({ options })?.action === 'interpret' ? held.promise : fallback(url, options));
  const pending = h.controller.generate(); await tick(); h.controller.cancel(); await pending;
  for (const response of [new Response('session expired', { status: 401 }), json({ code: 'ACCESS_REQUIRED', error: '请先输入访问码' }, 403)]) {
    h.setHandler(() => response);
    await h.controller.discover();
    assert.equal(h.controller.error, 'authentication_required'); assert.equal(h.controller.canRestore, false);
  }
  held.resolve(json(h.result)); await tick();
  assert.equal(h.controller.result, null); assert.equal(h.controller.error, 'authentication_required');
});

test('source or grant revocation in a blocked capability clears original content before result GET', async () => {
  for (const reason of ['data_permission_unavailable', 'permission_revoked', 'access_denied']) {
    const h = harness(); await h.controller.generate(); h.calls.length = 0;
    h.setHandler(() => json(siteCapabilityFixture({ admission: 'blocked', reason })));
    await h.controller.restoreOriginal(); assert.equal(h.controller.error, reason); assert.equal(h.controller.result, null); assert.equal(h.controller.canRestore, false);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url, '/api/interpretation');
  }
});

test('site identity versions, allowed asset and snapshot identity fail closed before interpret', async () => {
  for (const capability of [{ ...siteCapabilityFixture(), format: 'site-ai-capability-v2' }, { ...siteCapabilityFixture(), auth: 'private_session' }, { ...siteCapabilityFixture(), deploymentMode: 'local_pilot' }, { ...siteCapabilityFixture(), allowedSymbols: ['ETH-USDT'] }, { ...siteCapabilityFixture(), context: {} }]) {
    const h = harness(); h.setHandler(() => json(capability)); await h.controller.generate(); assert.equal(h.controller.error, 'invalid_output'); assert.equal(h.calls.length, 1); assert.equal(h.controller.result, null);
  }
  const unsupported = harness(); unsupported.render('NVDA'); await unsupported.controller.generate(); assert.equal(unsupported.controller.error, 'unsupported_asset'); assert.equal(unsupported.calls.length, 1);
  for (const snapshot of [{ snapshotId: '../unsafe', expiresAt: NOW }, { snapshotId: 'a'.repeat(161), expiresAt: NOW }, { snapshotId: 'fixture-site-ui-snapshot', expiresAt: 0 }, { snapshotId: 'fixture-site-ui-snapshot', expiresAt: NOW, context: {} }]) {
    const h = harness(); h.setHandler((url, options, fallback) => postBody({ options })?.action === 'snapshot' ? json(snapshot) : fallback(url, options));
    await h.controller.generate(); assert.equal(h.controller.error, 'invalid_output'); assert.equal(h.calls.some(c => postBody(c)?.action === 'interpret'), false);
  }
});

test('site DTO rejects local identity, wrong snapshot/time, oversized body and corrupt frozen references', async () => {
  const mutations = [
    r => { r.format = 'private-interpretation-v1'; r.deploymentMode = 'local_pilot'; },
    r => { r.context.asset.symbol = 'ETH-USDT'; }, r => { r.snapshot.id = 'different-site-snapshot'; },
    r => { r.snapshot.expiresAt += 1; }, r => { r.modelSelection.sentences[0].evidenceRefs = ['missing.direction']; },
    r => { r.modelSelection.sentences[0].metricRefs = ['short.direction:nonexistent']; },
    r => { r.modelSelection.selectedClaimIds = ['other-catalog:c1']; }, r => { r.context.bars = []; },
  ];
  for (const mutate of mutations) {
    const h = harness(); await h.controller.generate(); const prior = h.controller.result, invalid = structuredClone(h.result); mutate(invalid);
    h.setHandler((url, options, fallback) => postBody({ options })?.action === 'interpret' ? json(invalid) : fallback(url, options));
    await h.controller.generate(); assert.equal(h.controller.error, 'invalid_output'); assert.equal(h.controller.result, prior);
  }
  const h = harness(); h.setHandler((url, options, fallback) => postBody({ options })?.action === 'interpret' ? new Response(' '.repeat(65537)) : fallback(url, options));
  await h.controller.generate(); assert.equal(h.controller.error, 'invalid_output'); assert.equal(h.controller.result, null);
});

test('site cancellation and asset changes abort pending requests and discard late snapshot/interpret/restore replies', async () => {
  for (const stage of ['snapshot', 'interpret', 'restore']) for (const stop of ['cancel', 'asset']) {
    const h = harness(); if (stage === 'restore') await h.controller.generate(); const prior = h.controller.result, held = deferred(); h.calls.length = 0;
    h.setHandler((url, options, fallback) => (stage === 'restore' ? url.includes('/result?') : postBody({ options })?.action === stage) ? held.promise : fallback(url, options));
    const pending = stage === 'restore' ? h.controller.restoreOriginal() : h.controller.generate(); await tick(); const request = h.calls.at(-1);
    if (stop === 'cancel') h.controller.cancel(); else h.render('NVDA'); await pending;
    assert.equal(request.options.signal.aborted, true); const count = h.calls.length;
    held.resolve(stage === 'snapshot' ? json({ snapshotId: h.result.snapshot.id, expiresAt: h.result.snapshot.expiresAt }) : json(h.result)); await tick();
    assert.equal(h.calls.length, count); assert.equal(h.controller.phase, stop === 'cancel' ? 'cancelled' : 'idle'); assert.equal(h.controller.result, stop === 'cancel' ? prior : null);
    if (stop === 'asset') assert.equal(h.controller.canRestore, false);
  }
});

test('site deadlines bound discovery and full snapshot chain without starting a late interpretation', async () => {
  for (const stage of ['discovery', 'snapshot']) {
    const h = harness(), held = deferred();
    h.setHandler((url, options, fallback) => (stage === 'discovery' ? !options.method : postBody({ options })?.action === 'snapshot') ? held.promise : fallback(url, options));
    const pending = h.controller.generate(); await tick(); assert.deepEqual([...h.timers.values()], [stage === 'discovery' ? 6000 : 60_000]);
    h.deadline(); await pending; assert.equal(h.controller.error, 'timeout'); assert.equal(h.controller.phase, 'error'); assert.equal(h.timers.size, 0);
    held.resolve(stage === 'discovery' ? json(siteCapabilityFixture()) : json({ snapshotId: h.result.snapshot.id, expiresAt: h.result.snapshot.expiresAt })); await tick();
    assert.equal(h.calls.some(c => postBody(c)?.action === 'interpret'), false); assert.equal(h.controller.result, null);
  }
});

test('a late cancelled result cannot replace a newer same-asset result after manual retry', async () => {
  const h = harness(), held = deferred();
  h.setHandler((url, options, fallback) => postBody({ options })?.action === 'interpret' ? held.promise : fallback(url, options));
  const pending = h.controller.generate(); await tick(); h.controller.cancel(); await pending;
  const newer = siteInterpretationFixture(NOW + 60_000, 2);
  h.setHandler((url, options, fallback) => postBody({ options })?.action === 'snapshot' ? json({ snapshotId: newer.snapshot.id, expiresAt: newer.snapshot.expiresAt }) : postBody({ options })?.action === 'interpret' ? json(newer) : fallback(url, options));
  await h.controller.generate(); assert.equal(h.controller.result.snapshot.id, newer.snapshot.id);
  held.resolve(json(h.result)); await tick(); assert.deepEqual(h.controller.result, newer); assert.equal(h.controller.phase, 'ready');
});

test('a delayed site validation module cannot commit after cancel and a manual retry still works', async () => {
  const h = harness(), delayed = h.delayModule(); const pending = h.controller.generate(); await tick();
  assert.equal(h.calls.some(c => postBody(c)?.action === 'interpret'), true); h.controller.cancel(); await pending; delayed.resolve(); await tick();
  assert.equal(h.controller.result, null); assert.equal(h.controller.phase, 'cancelled'); await h.controller.generate(); assert.equal(h.controller.phase, 'ready');
});

test('site rendering keeps A/B/C, original time, complete disclosure identities and panel-local evidence', async () => {
  const h = harness(); await h.controller.generate(); const ui = uiHarness(), panels = [ui.render(h.controller), ui.render(h.controller)];
  const ids = panels.flatMap(nodes => nodes.filter(n => n.props.id).map(n => n.props.id)); assert.equal(new Set(ids).size, ids.length);
  for (const nodes of panels) {
    const body = content(nodes); assert.match(body, /站点受控试点/); assert.match(body, /UNPROVEN/); assert.match(body, /不计入模型贡献/); assert.match(body, /取消后已派发请求仍可能产生费用/);
    assert.doesNotMatch(body, /演示结果|本机私有试点/); assert.equal(nodes.some(n => n.type === 'input' && n.props.type === 'password'), false);
    const groups = nodes.filter(n => n.type === 'section' && n.props.className === 'ai-comparison'); assert.equal(groups.length, 3);
    const primary = nodes.find(n => n.props.className === 'ai-primary');
    assert.equal(text(groups[1].children.find(n => n?.type === 'ul')), text(primary.children.find(n => n?.type === 'ul')));
    assert.match(text(groups[2]), /页面上方的主要观察/);
    for (const d of h.result.systemRequired) { assert.ok(body.includes(d.disclosureId)); assert.ok(body.includes(d.origin)); }
    const reference = nodes.find(n => n.type === 'button' && /^查看.+依据$/.test(n.props['aria-label'] ?? ''));
    reference.props.onClick({ currentTarget: { isConnected: true } }); ui.flushFrames();
    const target = ui.focused.at(-1); assert.ok(nodes.some(n => n.props.id === target)); assert.equal(ui.targets.get(target).detail.open, true);
    assert.ok(target.includes(h.result.snapshot.id)); assert.ok(target.includes(h.result.contextId));
  }
  assert.notEqual(ui.focused[0], ui.focused[1]);
  const partial = siteContract.parseSiteInterpretation({ ...h.result, status: 'partial' });
  assert.match(content(ui.render({ ...h.controller, result: partial })), /部分依据可用/);
});

test('failed new generation retains only the original same-asset result with explicit failure copy', async () => {
  const h = harness(); await h.controller.generate(); const prior = h.controller.result;
  h.setHandler((url, options, fallback) => postBody({ options })?.action === 'interpret' ? json({ error: 'organization_failed' }, 422) : fallback(url, options));
  await h.controller.generate(); assert.equal(h.controller.gate, 'blocked'); assert.equal(h.controller.result, prior);
  const body = content(uiHarness().render(h.controller)); assert.match(body, /不是本次请求成功/); assert.ok(body.includes(prior.snapshot.id));
  h.render('NVDA'); assert.equal(h.controller.result, null); assert.equal(h.controller.canRestore, false);
});

test('standalone site browser mocks conform to strict contracts and contain only explicit synthetic provenance', () => {
  for (const sequence of [1, 2]) {
    const body = siteInterpretationFixture(NOW, sequence); assert.deepEqual(siteContract.parseSiteInterpretation(body), body);
    assert.match(body.context.limitations[0], /隔离页面测试/); assert.match(body.snapshot.id, /^fixture-site-ui-/);
    assert.throws(() => privateContract.parsePrivateInterpretation(body));
  }
  assert.deepEqual(siteContract.parseSiteCapability(siteCapabilityFixture()), siteCapabilityFixture());
  assert.deepEqual(siteContract.parseSiteCapability(siteCapabilityFixture({ admission: 'blocked' })), siteCapabilityFixture({ admission: 'blocked' }));
});
