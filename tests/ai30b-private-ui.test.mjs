import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as contracts from '../lib/ai/contracts.ts';
import * as privateContract from '../lib/ai/private-contract.ts';
import { fixtureContext } from '../lib/ai/fixture.ts';
import { fixtureProvider } from '../lib/ai/provider.ts';
import { createInterpretationService } from '../lib/ai/service.ts';
import { privateInterpretationFixture } from './fixtures/ai30b-ui.mjs';

// 离线合成 DTO，只验证页面接线；禁止真实网络、产品 Key 或 Provider。
globalThis.fetch = () => { throw new Error('TEST_FORBIDS_NETWORK'); };
const NOW = Date.UTC(2026, 9, 19, 12);
function privateFixture() {
  const fixture = fixtureContext('mixed', 'BTC-USDT', NOW), catalogId = 'a'.repeat(64);
  const context = { ...fixture, trust: 'controlled', contextId: 'mock-controlled-context', projectionVersion: contracts.AI_VERSIONS.projection,
    evidence: fixture.evidence.filter(e => ['direction', 'rms'].includes(e.kind)).map(e => ({ ...e, source: 'OKX 欧易' })) };
  const first = context.evidence[0], second = context.evidence[1];
  const a = { claimId: `${catalogId}:c0`, text: '固定模板离线测试事实。', evidenceRefs: [first.id], metricRefs: [] };
  const b = { claimId: `${catalogId}:c1`, text: '模型选择离线测试事实。', evidenceRefs: [second.id], metricRefs: [] };
  const required = [
    { disclosureId: `${catalogId}:d0`, text: '两个窗口存在分歧。', evidenceRefs: [first.id, second.id], metricRefs: [], category: 'conflict', origin: 'relationship:short-medium-direction' },
    { disclosureId: `${catalogId}:d1`, text: '不提供预测。', evidenceRefs: [], metricRefs: [], category: 'limitation', origin: 'Context.limitations[0]' },
    { disclosureId: `${catalogId}:d2`, text: '不提供预测。', evidenceRefs: [], metricRefs: [], category: 'limitation', origin: 'Context.limitations[1]' },
  ];
  return privateContract.parsePrivateInterpretation({
    format: 'private-interpretation-v1', provider: 'deepseek', model: 'deepseek-flash', inputIdentity: 'approved_real', inputTrust: 'controlled', deploymentMode: 'local_pilot',
    contextId: context.contextId, requestId: 'mock-request', asOf: context.asOf, generatedAt: NOW, cacheHit: false, oldSnapshot: false,
    snapshot: { id: 'mock-snapshot', capturedAt: NOW, expiresAt: NOW + 60_000, policyVersion: 'mock-policy', authorizationId: 'mock-authorization', dataVersion: 'mock-version',
      series: { source: 'OKX 欧易', exchange: 'OKX', instrument: 'BTC-USDT', marketType: 'SPOT', base: 'BTC', quote: 'USDT', intervalMs: 900000, timezone: 'UTC' } },
    context, catalogId, versions: { output: 'claim-selection-v1', catalog: 'scoped-catalog-v1', selection: 'strict-claim-ids-v1', prompt: 'bounded-id-selection-v1', validation: 'claim-selection-validation-v1', restoration: 'fixed-claim-restoration-v1', quality: 'fact-organization-v1', baseline: 'deterministic-catalog-v1' },
    baseline: { selectedClaimIds: [a.claimId], sentences: [a], rationale: '固定次序。' }, modelSelection: { selectedClaimIds: [b.claimId], sentences: [b] }, systemRequired: required, systemAdded: required.slice(1),
    selectionValidity: 'PASS', modelOrganizationQuality: 'PASS', disclosureCompleteness: 'PASS', modelValue: 'UNPROVEN', status: 'success',
    usage: { inputTokens: 1, outputTokens: 1, usageIdentity: 'provider_reported', usageCalculatedNano: 1, budgetChargedBoundNano: 2, billedCost: null },
  });
}
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const compiled = compile('../components/radar/use-interpretation.ts');
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
function harness() {
  const result = privateFixture(), calls = [], slots = [], timers = new Map(), effects = [];
  let cursor = 0, dirty = false, selected = 'BTC-USDT', handler, delayedModule;
  const react = {
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, next => { slots[i].value = next; dirty = true; }]; },
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useCallback(fn) { return fn; },
    useLayoutEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) { slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const require = name => {
    if (name === 'react') return react;
    if (name.endsWith('/limits')) return { AI_LIMITS: contracts.AI_LIMITS };
    if (name.endsWith('/private-contract')) return delayedModule ? delayedModule.promise.then(() => privateContract) : privateContract;
    throw new Error(`unexpected module ${name}`);
  };
  const defaultReply = (url) => url === '/api/interpretation' ? json({ mode: 'private_real', realProviderEnabled: true, admission: 'ready' }) : url.endsWith('/status') ? json({ gate: { admission: 'ready' }, allowedSymbol: 'BTC-USDT' }) : url.endsWith('/snapshot') ? json({ snapshotId: result.snapshot.id, expiresAt: result.snapshot.expiresAt }) : json(result);
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'setTimeout', 'clearTimeout', compiled)(require, mod, mod.exports,
    async (url, options = {}) => { calls.push({ url, options }); return handler ? handler(url, options, defaultReply) : defaultReply(url); },
    (fn, ms) => { timers.set(fn, ms); return fn; }, fn => timers.delete(fn));
  const render = (symbol = selected) => { selected = symbol; let controller; do { dirty = false; cursor = 0; controller = mod.exports.useInterpretation(symbol); while (effects.length) effects.shift()(); } while (dirty); return controller; };
  return { get controller() { return render(); }, render, result, calls, timers, exports: mod.exports, setHandler(fn) { handler = fn; },
    delayModule() { delayedModule = deferred(); return delayedModule; }, deadline() { for (const fn of [...timers.keys()]) fn(); },
    async connect() { await render().generate(); await render().connectSession('mock-session-token'); return render(); } };
}

test('private discovery and blocked status preserve the source restriction, never create a snapshot', async () => {
  const h = harness();
  h.setHandler(url => url === '/api/interpretation' ? json({ mode: 'private_real', realProviderEnabled: false, admission: 'blocked', reason: 'data_permission_unavailable' }) : json({ gate: { admission: 'blocked', reason: 'data_permission_unavailable' }, allowedSymbol: 'BTC-USDT' }));
  await h.controller.generate(); assert.equal(h.controller.mode, 'private_real'); assert.equal(h.controller.error, 'data_permission_unavailable'); assert.equal(h.calls.length, 1);
  await h.controller.connectSession('mock-session-token'); assert.equal(h.controller.connected, true); assert.equal(h.controller.gate, 'blocked'); assert.equal(h.controller.error, 'data_permission_unavailable');
  await h.controller.generate(); assert.equal(h.calls.filter(c => c.url.endsWith('/snapshot') || c.url.endsWith('/interpret')).length, 0);
});

test('private chain binds server snapshot and credential without sending browser context or scenario', async () => {
  const h = harness(); await h.connect(); h.calls.length = 0; await h.controller.generate('information_present');
  assert.equal(h.controller.phase, 'ready'); assert.equal(h.controller.resultKind, 'private_real'); assert.deepEqual(h.controller.result, h.result);
  assert.deepEqual(h.calls.map(c => c.url), ['/api/interpretation', '/__ai-pilot/status', '/__ai-pilot/snapshot', '/__ai-pilot/interpret']);
  const posts = h.calls.slice(1); assert.deepEqual(posts.map(c => JSON.parse(c.options.body)), [{}, { symbol: 'BTC-USDT' }, { symbol: 'BTC-USDT', snapshotId: 'mock-snapshot' }]);
  for (const c of posts) { assert.equal(c.options.headers['x-ai-pilot-session'], 'mock-session-token'); assert.equal(c.options.headers['Content-Type'], 'application/json'); assert.equal(c.options.credentials, 'same-origin'); }
  assert.equal(h.calls[0].options.headers, undefined); assert.equal(JSON.stringify(h.controller).includes('mock-session-token'), false);
});

test('invalid session is cleared and requires reconnect; unsupported asset never creates a snapshot', async () => {
  const h = harness(); await h.connect();
  h.setHandler((url, _options, fallback) => url.endsWith('/status') ? json({ error: 'session_required' }, 403) : fallback(url));
  await h.controller.generate(); assert.equal(h.controller.connected, false); assert.equal(h.controller.gate, 'unknown'); assert.equal(h.controller.error, 'session_required');
  h.calls.length = 0; await h.controller.generate(); assert.equal(h.calls.length, 1);
  h.setHandler((_url, _options, fallback) => fallback(_url)); await h.controller.connectSession('mock-session-token'); h.render('ETH-USDT'); h.calls.length = 0;
  await h.controller.generate(); assert.equal(h.controller.error, 'unsupported_asset'); assert.equal(h.calls.some(c => c.url.endsWith('/snapshot')), false);
});

test('actual private service auth and permission revocation codes clear the credential and sensitive old result', async () => {
  for (const code of ['private_session_required', 'permission_revoked']) {
    const h = harness(); await h.connect(); await h.controller.generate(); assert.ok(h.controller.result);
    h.setHandler((url, _options, fallback) => url.endsWith(code === 'private_session_required' ? '/status' : '/interpret') ? json({ error: code }, 403) : fallback(url));
    await h.controller.generate(); assert.equal(h.controller.error, code); assert.equal(h.controller.result, null); assert.equal(h.controller.connected, false);
    assert.equal(h.controller.gate, code === 'permission_revoked' ? 'blocked' : 'unknown');
    h.calls.length = 0; await h.controller.generate(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url, '/api/interpretation');
  }
});

test('a replacement session clears old scope immediately, throughout slow status and after success or failure', async () => {
  for (const outcome of ['ready', 'failure']) {
    const h = harness(); await h.connect(); await h.controller.generate(); assert.ok(h.controller.result);
    assert.equal(h.controller.connected, true); assert.equal(h.controller.allowedSymbol, 'BTC-USDT'); assert.equal(h.controller.gate, 'ready');
    const response = deferred(); h.setHandler((url, _options, fallback) => url.endsWith('/status') ? response.promise : fallback(url));
    const pending = h.controller.connectSession('replacement-session-token');
    const cleared = h.controller; assert.equal(cleared.result, null); assert.equal(cleared.connected, false); assert.equal(cleared.allowedSymbol, ''); assert.equal(cleared.gate, 'unknown');
    await tick(); assert.equal(h.controller.phase, 'loading'); assert.equal(h.controller.result, null);
    assert.equal(h.calls.at(-1).options.headers['x-ai-pilot-session'], 'replacement-session-token');
    response.resolve(outcome === 'ready' ? json({ gate: { admission: 'ready' }, allowedSymbol: 'BTC-USDT' }) : json({ error: 'private_session_required' }, 403));
    await pending; assert.equal(h.controller.result, null); assert.equal(h.controller.connected, outcome === 'ready');
    assert.equal(h.controller.phase, outcome === 'ready' ? 'idle' : 'error'); assert.equal(h.controller.allowedSymbol, outcome === 'ready' ? 'BTC-USDT' : '');
  }
});

test('actual expiry, batch, loader and budget codes remain explicit and preserve the prior permitted result', async () => {
  for (const [code, text] of [['context_expired', /快照已到期/], ['batch_exhausted', /试点次数已用完/], ['loader_timeout', /快照取数超时/], ['budget_exhausted', /预算已用完/]]) {
    const h = harness(); await h.connect(); await h.controller.generate(); const prior = h.controller.result;
    h.setHandler((url, _options, fallback) => url.endsWith('/interpret') ? json({ error: code }, 409) : fallback(url));
    await h.controller.generate(); assert.equal(h.controller.error, code); assert.equal(h.controller.result, prior); assert.equal(h.controller.connected, true);
    assert.match(h.exports.interpretationErrors[code], text); if (code === 'batch_exhausted') assert.equal(h.controller.gate, 'blocked');
  }
});

test('paid organization failure stops the pilot, preserves only the prior valid result and disables generation', async () => {
  const h = harness(); await h.connect(); await h.controller.generate(); const prior = h.controller.result;
  h.setHandler((url, _options, fallback) => url.endsWith('/interpret') ? json({ error: 'organization_failed' }, 422) : fallback(url));
  await h.controller.generate(); assert.equal(h.controller.error, 'organization_failed'); assert.equal(h.controller.gate, 'blocked');
  assert.equal(h.controller.connected, true); assert.equal(h.controller.result, prior); assert.equal(h.controller.result.snapshot.id, prior.snapshot.id);
  const nodes = uiHarness().render(h.controller); assert.match(content(nodes), /模型组织质量未达标/); assert.match(content(nodes), /本轮试点已停止/);
  assert.match(content(nodes), /不是本次请求成功/); assert.equal(nodes.find(n => n.type === 'button' && subtreeText(n) === '查看新快照解释').props.disabled, true);
});

test('standalone browser mock conforms to the current catalog/source/metric reference DTO without real input', () => {
  for (const sequence of [1, 2]) { const body = privateInterpretationFixture(NOW, sequence); assert.deepEqual(privateContract.parsePrivateInterpretation(body), body); assert.match(body.context.limitations[0], /隔离页面测试/); }
});

test('private 60 second deadline covers the entire chain, releases loading and drops delayed snapshot', async () => {
  const h = harness(); await h.connect(); const pendingReply = deferred();
  h.setHandler((url, _options, fallback) => url.endsWith('/snapshot') ? pendingReply.promise : fallback(url));
  const pending = h.controller.generate(); await tick(); assert.deepEqual([...h.timers.values()], [60_000]);
  h.deadline(); await pending; assert.equal(h.controller.phase, 'error'); assert.equal(h.controller.error, 'timeout'); assert.equal(h.timers.size, 0);
  pendingReply.resolve(json({ snapshotId: h.result.snapshot.id, expiresAt: h.result.snapshot.expiresAt })); await tick();
  assert.equal(h.calls.some(c => c.url.endsWith('/interpret')), false); assert.equal(h.controller.result, null);
});

test('private capability lookup keeps the six second deadline and never dispatches late', async () => {
  const h = harness(), reply = deferred(); h.setHandler(() => reply.promise);
  const pending = h.controller.generate(); assert.deepEqual([...h.timers.values()], [6000]); h.deadline(); await pending;
  reply.resolve(json({ mode: 'private_real', admission: 'ready' })); await tick(); assert.equal(h.controller.error, 'timeout'); assert.equal(h.controller.mode, 'unknown'); assert.equal(h.calls.length, 1);
});

test('revocation after ready status blocks the UI and never dispatches the interpretation', async () => {
  const h = harness(); await h.connect();
  h.setHandler((url, _options, fallback) => url.endsWith('/snapshot') ? json({ error: 'data_permission_unavailable' }, 403) : fallback(url));
  await h.controller.generate(); assert.equal(h.controller.gate, 'blocked'); assert.equal(h.controller.error, 'data_permission_unavailable');
  assert.equal(h.calls.some(c => c.url.endsWith('/interpret')), false);
  const nodes = uiHarness().render(h.controller); assert.equal(nodes.find(n => n.type === 'button' && subtreeText(n) === '查看快照解释').props.disabled, true);
});

test('cancel and symbol change both discard delayed private responses before another request', async () => {
  for (const stop of ['cancel', 'symbol']) {
    const h = harness(); await h.connect(); const response = deferred();
    h.setHandler((url, _options, fallback) => url.endsWith('/status') ? response.promise : fallback(url));
    const pending = h.controller.generate(); await tick(); if (stop === 'cancel') h.controller.cancel(); else h.render('ETH-USDT'); await pending;
    response.resolve(json({ gate: { admission: 'ready' }, allowedSymbol: 'BTC-USDT' })); await tick();
    assert.equal(h.controller.phase, stop === 'cancel' ? 'cancelled' : 'idle'); assert.equal(h.controller.result, null); assert.equal(h.calls.some(c => c.url.endsWith('/snapshot')), false);
  }
});

test('late private validation module cannot commit after cancellation and retry still succeeds', async () => {
  const h = harness(); await h.connect(); const delayed = h.delayModule(); const pending = h.controller.generate(); await tick();
  h.controller.cancel(); await pending; delayed.resolve(); await tick(); assert.equal(h.controller.result, null); assert.equal(h.controller.phase, 'cancelled');
  await h.controller.generate(); assert.equal(h.controller.phase, 'ready');
});

test('snapshot mismatch, oversized response and route failure retain only the prior same-asset result', async () => {
  const h = harness(); await h.connect(); await h.controller.generate(); const original = h.controller.result;
  for (const kind of ['snapshot', 'schema', 'oversized', 'error']) {
    h.setHandler((url, _options, fallback) => !url.endsWith('/interpret') ? fallback(url) : kind === 'snapshot' ? json({ ...h.result, snapshot: { ...h.result.snapshot, id: 'other-snapshot' } }) : kind === 'schema' ? json({ ...h.result, modelSelection: {} }) : kind === 'oversized' ? new Response(' '.repeat(65537)) : json({ error: 'budget_unavailable' }, 503));
    await h.controller.generate(); assert.equal(h.controller.phase, 'error'); assert.equal(h.controller.result, original); assert.equal(h.controller.error, kind === 'error' ? 'budget_unavailable' : 'invalid_output');
  }
  h.render('ETH-USDT'); assert.equal(h.controller.result, null);
});

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
const content = nodes => nodes.flatMap(n => (n.children ?? []).filter(x => typeof x === 'string' || typeof x === 'number')).join(' ');
const subtreeText = node => typeof node === 'string' || typeof node === 'number' ? String(node) : (node?.children ?? []).map(subtreeText).join(' ');

test('private UI renders same-snapshot A/B/C, full disclosure identities, expiry and no demo claim', async () => {
  const h = harness(); await h.connect(); await h.controller.generate(); const ui = uiHarness(), nodes = ui.render(h.controller), text = content(nodes).replace(/\s+/g, ' ');
  assert.match(text, /程序摘要/); assert.match(text, /模型选择与顺序/); assert.match(text, /系统补齐后的最终呈现/); assert.match(text, /UNPROVEN/); assert.match(text, /不计入模型贡献/);
  for (const disclosure of h.result.systemRequired) { assert.ok(text.includes(disclosure.disclosureId)); assert.ok(text.includes(disclosure.origin)); }
  assert.match(text, /有效期至/); assert.match(text, /mock-snapshot/); assert.doesNotMatch(text, /演示结果|未调用真实模型/);
  const lists = nodes.filter(n => n.type === 'section' && n.props.className === 'ai-comparison');
  assert.deepEqual(lists.map(n => n.props['aria-label']), ['A 固定模板', 'B 模型选择', 'C 最终完整呈现']);
  const comparison = nodes.find(n => n.type === 'details' && n.props.className === 'ai-evaluation');
  assert.ok(!comparison.props.open); assert.match(subtreeText(comparison), /同一快照、同一事实目录/);
  assert.deepEqual(lists.map(n => subtreeText(n).includes('模型选择离线测试事实。')), [false, true, false]);
  assert.deepEqual(lists.map(n => subtreeText(n).includes('固定模板离线测试事实。')), [true, false, false]);
  assert.deepEqual(lists.map(n => subtreeText(n).includes('两个窗口存在分歧。')), [false, false, false]);
  const primary = nodes.find(n => n.type === 'section' && n.props['aria-label'] === '主要观察');
  assert.match(subtreeText(primary), /模型选择离线测试事实。/); assert.match(subtreeText(lists[2]), /页面上方的主要观察，加上全部冲突与限制/);
  assert.match(text, /两个窗口存在分歧。/); assert.match(text, /系统补齐 2 条说明/);
  const citations = nodes.filter(n => n.type === 'span' && n.props.className === 'ai-citation');
  assert.ok(citations.length > 0);
  for (const citation of citations) {
    const count = citation.children.filter(n => n?.type === 'button'), group = citation.children.find(n => n?.props?.className === 'ai-reference-list');
    assert.equal(count.length, 1); assert.equal(count[0].props['aria-expanded'], false); assert.equal(group.props.hidden, true);
    assert.equal(count[0].props['aria-controls'], group.props.id); assert.match(subtreeText(count[0]).replace(/\s+/g, ' '), new RegExp(`查看依据 · ${group.children.length}$`));
    const labels = group.children.map(n => n.props['aria-label']); assert.equal(new Set(labels).size, labels.length); assert.ok(labels.every(label => /^查看.+依据$/.test(label)));
  }
  assert.equal(nodes.filter(n => n.type === 'input' && n.props.type === 'password').length, 1);
});

test('expanded evidence preserves method, config and distinct supplied acquisition timestamps without filling absent fields', () => {
  const h = harness(), result = privateFixture(), evidence = result.context.evidence;
  evidence[0].provenance = { ...evidence[0].provenance, methodId: 'mock-method-v2', configId: 'mock-config-v3', quoteAt: NOW - 3000, fetchedAt: NOW - 2000, historyFetchedAt: NOW - 1000 };
  delete evidence[1].provenance;
  const controller = { ...h.controller, result, mode: 'private_real', resultKind: 'private_real', phase: 'ready' }, nodes = uiHarness().render(controller);
  const sections = nodes.filter(n => n.type === 'section' && n.props.id?.includes('-evidence-'));
  const supplied = subtreeText(sections.find(n => n.props.id.endsWith(encodeURIComponent(evidence[0].id)))).replace(/\s+/g, ' ');
  const absent = subtreeText(sections.find(n => n.props.id.endsWith(encodeURIComponent(evidence[1].id))));
  assert.match(supplied, /计算方法 mock-method-v2/); assert.match(supplied, /计算配置 mock-config-v3/);
  assert.match(supplied, /报价时间 2026-10-19 11:59:57 UTC/); assert.match(supplied, /报价取得时间 2026-10-19 11:59:58 UTC/); assert.match(supplied, /历史取得时间 2026-10-19 11:59:59 UTC/);
  assert.doesNotMatch(absent, /计算方法|计算配置|报价时间|报价取得时间|历史取得时间/);
});

test('capability discovery works without browser context; session form clears the password after submit', async () => {
  const h = harness(), ui = uiHarness();
  const initial = ui.render(h.controller), discover = initial.find(n => n.type === 'button' && subtreeText(n) === '检查解释服务');
  assert.equal(discover.props.disabled, false);
  await discover.props.onClick(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].options.method, undefined); assert.equal(h.controller.error, '');
  const pending = ui.render(h.controller), password = { value: 'mock-session-token' };
  const form = pending.find(n => n.type === 'form'); form.props.onSubmit({ preventDefault() {}, currentTarget: { elements: { namedItem: () => password } } });
  assert.equal(password.value, ''); await tick(); assert.equal(h.controller.connected, true);
  assert.equal(JSON.stringify(h.controller).includes('mock-session-token'), false);
});

test('each mounted panel and context has unique evidence IDs; buttons focus their own result', async () => {
  const h = harness(); await h.connect(); await h.controller.generate(); const ui = uiHarness();
  const panels = [ui.render(h.controller), ui.render(h.controller)];
  const ids = panels.flatMap(nodes => nodes.filter(n => n.props.id).map(n => n.props.id)); assert.equal(new Set(ids).size, ids.length);
  for (const nodes of panels) {
    const ownIds = nodes.filter(n => n.type === 'section' && n.props.id).map(n => n.props.id);
    const button = nodes.find(n => n.type === 'button' && /^查看.+依据$/.test(n.props['aria-label'] ?? '')); button.props.onClick({ currentTarget: { isConnected: true } });
    assert.equal(ui.frameCount, 1); ui.flushFrames();
    const target = ui.focused.at(-1); assert.ok(ownIds.includes(target)); assert.ok(target.includes(encodeURIComponent(h.result.contextId))); assert.equal(ui.targets.get(target).detail.open, true);
  }
  assert.notEqual(ui.focused[0], ui.focused[1]);
});

test('legacy fixture panels also keep evidence links local and preserve demo wording', async () => {
  const h = harness(), result = await createInterpretationService(fixtureProvider(0), { now: () => NOW }).interpret(fixtureContext('mixed', 'BTC-USDT', NOW), 'ui-fixture');
  const controller = { ...h.controller, result, mode: 'fixture', resultKind: 'fixture', phase: 'ready' }, ui = uiHarness();
  const panels = [ui.render(controller), ui.render(controller)], ids = panels.flatMap(nodes => nodes.filter(n => n.props.id).map(n => n.props.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const nodes of panels) { assert.match(content(nodes), /演示结果/); nodes.find(n => n.type === 'button' && /^查看.+依据$/.test(n.props['aria-label'] ?? '')).props.onClick({ currentTarget: { isConnected: true } }); assert.equal(ui.frameCount, 1); ui.flushFrames(); assert.ok(nodes.some(n => n.props.id === ui.focused.at(-1))); }
  assert.notEqual(ui.focused[0], ui.focused[1]);
});
