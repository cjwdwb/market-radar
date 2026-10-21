import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createCurrentContextLoader } from '../lib/ai/real-context-loader.ts';
import { approvedRealContextGrant, REAL_CONTEXT_POLICY } from '../lib/ai/real-context-policy.ts';
import { controlledAdmission, createRealContextSnapshots } from '../lib/ai/snapshot.ts';
import { prepareControlledRequest, createRealPilotService } from '../lib/ai/real-service.ts';
import { createPrivateContextRuntime } from '../lib/ai/private-runtime.ts';
import { parsePrivateInterpretation } from '../lib/ai/private-contract.ts';
import { DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';
import { ProductBudget, REAL_CONTEXT_BATCH_ID } from '../lib/ai/product-budget.mjs';
import { createSelectionCatalog } from '../lib/ai/claim-selection.ts';
import { accessGate, accessCodeHash } from '../worker/access-gate.ts';
import { startPrivatePreview } from '../scripts/ai30b-private.mjs';
import { PRIVATE_FIXTURE_NOW as NOW, PRIVATE_FIXTURE_SYMBOL as SYMBOL, privateFixtureGrant, privateFixtureSnapshot,
  privateFixtureReply, createPrivateFixture, privateInterpretationFixture } from './fixtures/ai30b-private.mjs';

// Only node:http to explicit 127.0.0.1 test servers below is permitted. No provider,
// market source, environment Key or canonical budget can be used by this suite.
globalThis.fetch = () => { throw Error('TEST_FORBIDS_NETWORK'); };
const signal = () => new AbortController().signal;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function marketSource(data = privateFixtureSnapshot(), calls = []) {
  return { quote: async (...args) => { calls.push(['quote', ...args]); return data.quotes[SYMBOL]; },
    history: async (...args) => { calls.push(['history', ...args]); return { ...data.histories[SYMBOL], symbol: SYMBOL, range: '15m', timezone: 'UTC' }; } };
}
async function fixture(t, options) { const value = await createPrivateFixture(options); t.after(() => value.close()); return value; }
async function snapshot(f, owner = 'owner') { return f.runtime.snapshot(owner, SYMBOL, signal()); }
const interpret = (f, snap, owner = 'owner', abort = signal()) => f.runtime.interpret(owner, SYMBOL, snap.snapshotId, abort);

test('private source decision stays denied and default runtime rejects before loading, budget or provider', async () => {
  assert.equal(approvedRealContextGrant(), null); assert.equal(REAL_CONTEXT_POLICY.thirdPartyInferenceForThisEvaluation, 'DENIED');
  let calls = 0; const runtime = createPrivateContextRuntime({ loader: async () => { calls++; throw Error('unexpected_source'); } });
  assert.deepEqual(runtime.status().gate, { admission: 'blocked', reason: 'data_permission_unavailable' });
  await assert.rejects(runtime.snapshot('owner', SYMBOL, signal()), /data_permission_unavailable/);
  await assert.rejects(runtime.interpret('owner', SYMBOL, 'forged', signal()), /data_permission_unavailable/);
  assert.equal(calls, 0); runtime.close();
});

test('private loader requests only one approved quote without points and native 15m history', async () => {
  const data = privateFixtureSnapshot(), calls = [], load = createCurrentContextLoader(marketSource(data, calls));
  const result = await load(SYMBOL, signal());
  assert.deepEqual(calls, [['quote', SYMBOL, false], ['history', SYMBOL, '15m']]);
  assert.deepEqual(result.symbols, [SYMBOL]); assert.deepEqual(result.quotes[SYMBOL].points, []);
  assert.equal(result.histories[SYMBOL].intervalMs, 900000); assert.equal(result.histories[SYMBOL].points.length, 80);
  assert.deepEqual(result.histories[SYMBOL].points, data.histories[SYMBOL].points);
  calls.length = 0; await assert.rejects(load('ETH-USDT', signal()), /asset_not_approved/);
  const abort = new AbortController(); abort.abort(); await assert.rejects(load(SYMBOL, abort.signal), /cancelled/); assert.equal(calls.length, 0);
});

test('private loader rejects mismatched identity, unproven intervals and source failures', async () => {
  for (const modify of [d => { d.quotes[SYMBOL].symbol = 'ETH-USDT'; }, d => { d.quotes[SYMBOL].currency = 'USD'; },
    d => { d.histories[SYMBOL].source = 'Yahoo Finance'; }, d => { d.quotes[SYMBOL].timezone = 'Asia/Shanghai'; }, d => { d.quotes[SYMBOL].session = 'closed'; }]) {
    const data = privateFixtureSnapshot(); modify(data); await assert.rejects(createCurrentContextLoader(marketSource(data))(SYMBOL, signal()), /source_identity_mismatch/);
  }
  for (const modify of [d => { d.histories[SYMBOL].points[0].time++; }, d => { delete d.histories[SYMBOL].points[0].confirmed; },
    d => { d.histories[SYMBOL].points.push(...d.histories[SYMBOL].points.slice(0, 17)); }]) {
    const data = privateFixtureSnapshot(); modify(data); await assert.rejects(createCurrentContextLoader(marketSource(data))(SYMBOL, signal()), /interval_mismatch/);
  }
  const source = marketSource(); source.quote = async () => { throw Error('isolated_source_failure'); };
  await assert.rejects(createCurrentContextLoader(source)(SYMBOL, signal()), /isolated_source_failure/);
});

test('private loader cancels one waiter immediately without killing shared source promises or adopting late data', async () => {
  const quote = deferred(), history = deferred(), data = privateFixtureSnapshot();
  const load = createCurrentContextLoader({ quote: () => quote.promise, history: () => history.promise });
  const first = new AbortController(), second = new AbortController();
  const cancelled = load(SYMBOL, first.signal), surviving = load(SYMBOL, second.signal);
  first.abort(); await assert.rejects(cancelled, /cancelled/);
  quote.resolve(data.quotes[SYMBOL]); history.resolve({ ...data.histories[SYMBOL], symbol: SYMBOL, range: '15m', timezone: 'UTC' });
  assert.equal((await surviving).histories[SYMBOL].points.length, 80); assert.equal(second.signal.aborted, false);
});

test('private registry owns cloned four-dimension facts and denies other scopes, assets, raw handles and record reassignment', async () => {
  const data = privateFixtureSnapshot(), grant = privateFixtureGrant();
  const registry = createRealContextSnapshots(async () => data, grant, { now: () => NOW, id: () => 'owned-snapshot' });
  const snap = await registry.create('owner', SYMBOL, signal()), admission = registry.get('owner', SYMBOL, snap.snapshotId), record = controlledAdmission(admission);
  assert.deepEqual(record.context.evidence.map(e => e.id), ['short.direction', 'short.volatility', 'medium.direction', 'medium.volatility']);
  assert.ok(record.context.evidence.every(e => ['direction', 'rms'].includes(e.kind) && !e.provenance?.benchmark));
  assert.ok(record.context.limitations.some(l => l.includes('Relative、Alignment、Transition未纳入')));
  assert.equal(record.context.minuteHistoricalResearch.availability, 'unsupported'); assert.equal(record.context.dailyPosition, 'not_computed');
  const before = JSON.stringify(record.context); data.histories[SYMBOL].points[0].close = 999;
  assert.equal(JSON.stringify(controlledAdmission(admission).context), before);
  assert.throws(() => { record.context.evidence[0].source = 'fake'; }, TypeError);
  for (const key of ['context', 'metadata', 'assertAccess', 'assertCurrent']) assert.throws(() => { record[key] = key.startsWith('assert') ? () => {} : {}; }, TypeError);
  for (const args of [['visitor', SYMBOL, snap.snapshotId], ['owner', 'ETH-USDT', snap.snapshotId], ['owner', SYMBOL, 'forged']]) assert.throws(() => registry.get(...args), /snapshot_not_found/);
  assert.throws(() => controlledAdmission({ kind: 'registry-admission-v1' }), /snapshot_admission_invalid/);
  assert.throws(() => prepareControlledRequest(structuredClone(admission)), /snapshot_admission_invalid/);
  grant.revoked = true; assert.throws(() => controlledAdmission(admission), /permission_revoked/);
  assert.throws(() => registry.evidence('owner', SYMBOL, snap.snapshotId), /permission_revoked/);
});

test('private registry enforces grant identity/review lifetime, snapshot TTL and sole underlying dependency freshness', async () => {
  for (const mode of ['ttl', 'freshness', 'grant_identity', 'review']) {
    let now = NOW; const data = privateFixtureSnapshot(), grant = privateFixtureGrant();
    if (mode === 'freshness') data.quotes[SYMBOL].fetchedAt = NOW - 119000;
    const registry = createRealContextSnapshots(async () => data, grant, { now: () => now }), snap = await registry.create('owner', SYMBOL, signal());
    if (mode === 'grant_identity') grant.policyVersion = 'replacement-policy'; else now += mode === 'ttl' ? 60000 : mode === 'review' ? 20 * 60000 : 2000;
    assert.throws(() => registry.get('owner', SYMBOL, snap.snapshotId), mode === 'grant_identity' || mode === 'review' ? /permission_revoked/ : /context_expired/);
    if (mode === 'ttl' || mode === 'freshness') assert.equal(registry.evidence('owner', SYMBOL, snap.snapshotId).oldSnapshot, true);
    registry.revoke();
  }
  const extra = privateFixtureSnapshot(); extra.quotes['ETH-USDT'] = { ...extra.quotes[SYMBOL], symbol: 'ETH-USDT' };
  await assert.rejects(createRealContextSnapshots(async () => extra, privateFixtureGrant(), { now: () => NOW }).create('owner', SYMBOL, signal()), /source_identity_mismatch/);
  const stale = privateFixtureSnapshot(); stale.quotes[SYMBOL].fetchedAt -= 3600000;
  await assert.rejects(createRealContextSnapshots(async () => stale, privateFixtureGrant(), { now: () => NOW }).create('owner', SYMBOL, signal()), /insufficient_context/);
});

test('private runtime preserves same-snapshot baseline/model/system attribution, original metric refs, cache and shared budget', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 11; i++) { const r = f.ledger.reserve({ now: NOW, pilot: SYNTHETIC_PILOT_ID, maximumNano: 10000, model: DEEPSEEK_AI.model, provider: 'deepseek' });
    f.ledger.settle(r.id, { now: NOW, usageCostNano: 1500, usage: { inputTokens: 1, outputTokens: 1 }, outcome: 'completed' }); }
  const old = f.ledger.db.prepare('SELECT * FROM requests ORDER BY id').all(), snap = await snapshot(f), result = await interpret(f, snap);
  assert.deepEqual(parsePrivateInterpretation(result), result); assert.equal(result.inputIdentity, 'approved_real'); assert.equal(result.snapshot.id, snap.snapshotId);
  assert.deepEqual(result.modelSelection, { selectedClaimIds: result.baseline.selectedClaimIds, sentences: result.baseline.sentences });
  assert.equal(result.modelValue, 'UNPROVEN'); assert.equal(result.baseline.sentences[1].metricRefs.length, 13);
  assert.ok(result.baseline.sentences.every(s => s.metricRefs.every(ref => s.evidenceRefs.some(eid => ref.startsWith(eid + ':')))));
  assert.deepEqual(result.systemAdded, result.systemRequired); assert.equal(result.systemRequired.length, 9);
  const frozen = f.events.find(e => e.event === 'frozen').value;
  assert.deepEqual(frozen.context, result.context); assert.equal(frozen.catalog.catalogId, result.catalogId); assert.equal(f.bodies[0], frozen.request);
  assert.deepEqual(f.events.map(e => e.event), ['frozen', 'reply', 'validated']);
  const validated = f.events.find(e => e.event === 'validated').value;
  assert.equal(validated.accounting, 'reservation_still_held'); assert.equal(validated.outcome, 'completed');
  assert.deepEqual(validated.output.renderedResult.summary, result.modelSelection.sentences);
  const cached = await interpret(f, snap); assert.equal(cached.cacheHit, true); assert.equal(cached.requestId, result.requestId); assert.equal(f.bodies.length, 1);
  assert.equal(f.ledger.inspectRealContextBatch().calls, 1); assert.equal(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.calls, 12);
  for (const row of old) assert.deepEqual(f.ledger.db.prepare('SELECT * FROM requests WHERE id=?').get(row.id), row);
  assert.equal(result.usage.billedCost, null); assert.equal(result.usage.budgetChargedBoundNano, 2 * result.usage.usageCalculatedNano);
});

test('private DTO rejects wrong catalog/source/reference/identity and preserves complete large fixed metrics', async () => {
  const original = await privateInterpretationFixture();
  for (const mutate of [v => { v.catalogId = 'b'.repeat(64); }, v => { v.modelSelection.selectedClaimIds[0] = 'b'.repeat(64) + ':c0'; v.modelSelection.sentences[0].claimId = v.modelSelection.selectedClaimIds[0]; },
    v => { v.snapshot.series.source = 'Yahoo'; }, v => { v.context.evidence[0].source = 'fixture:forged'; }, v => { v.contextId = 'replacement'; },
    v => { v.context.asset.symbol = 'ETH-USDT'; }, v => { v.modelSelection.sentences[0].metricRefs[0] = 'short.direction.netPercent'; },
    v => { v.modelSelection.sentences[0].evidenceRefs[0] = 'missing'; }, v => { v.systemAdded[0].text = 'replacement'; }, v => { v.inputIdentity = 'synthetic'; },
    v => { v.authorization = 'browser-grant'; }]) { const value = structuredClone(original); mutate(value); assert.throws(() => parsePrivateInterpretation(value)); }
});

test('private admission cannot be laundered through original fixture entry or injected projector', async t => {
  const f = await fixture(t), registry = createRealContextSnapshots(async () => privateFixtureSnapshot(), privateFixtureGrant(), { now: () => NOW });
  const snap = await registry.create('owner', SYMBOL, signal()), record = controlledAdmission(registry.get('owner', SYMBOL, snap.snapshotId));
  let calls = 0; const service = createRealPilotService({ kind: 'deepseek', async generate() { calls++; throw Error('unexpected_dispatch'); } }, f.ledger,
    { profile: DEEPSEEK_AI, now: () => NOW, admit: () => record.context });
  await assert.rejects(service.interpret(record.context), /data_permission_unavailable/); assert.equal(calls, 0); assert.equal(f.ledger.inspectRealContextBatch().calls, 0);
  service.stop(); registry.revoke();
});

test('private runtime failures retain usage/unknown occupancy and durably stop without returning or caching a result', async t => {
  for (const mode of ['invalid_output', 'organization_failed', 'model_mismatch', 'transport_error', 'record_failure']) await t.test(mode, async t => {
    const f = await fixture(t, { reply: async body => {
      if (mode === 'transport_error') throw Error('isolated_transport_failure');
      if (mode === 'model_mismatch') return privateFixtureReply(body, { status: 'model_mismatch', returnedModel: 'wrong-model' });
      if (mode === 'invalid_output') return privateFixtureReply(body, { json: '{"selectedClaimIds":["forged"]}' });
      if (mode === 'organization_failed') {
        const input = JSON.parse(JSON.parse(body).input[0].content), catalog = createSelectionCatalog(input.context);
        return privateFixtureReply(body, { json: JSON.stringify({ selectedClaimIds: [catalog.entries.find(e => e.primaryEligible && e.evidenceRefs.length === 1).claimId] }) });
      }
      return privateFixtureReply(body);
    }, record: (_id, event) => { if (mode === 'record_failure' && event === 'frozen') throw Error('isolated_record_failure'); } });
    const snap = await snapshot(f); await assert.rejects(interpret(f, snap)); await tick();
    assert.equal(f.ledger.inspectRealContextBatch().calls, 1); assert.equal(f.ledger.inspectRealContextBatch().stopped, true);
    assert.equal(f.bodies.length, mode === 'record_failure' ? 0 : 1);
    assert.equal(f.events.filter(e => e.event === 'validated').length, ['invalid_output', 'organization_failed'].includes(mode) ? 1 : 0);
    const row = f.ledger.db.prepare('SELECT * FROM requests').get();
    assert.equal(row.state, ['invalid_output', 'organization_failed'].includes(mode) ? 'settled' : 'unknown');
    if (row.state === 'unknown') assert.equal(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.reserved, row.reserved);
    await assert.rejects(interpret(f, snap), /batch_stopped/); assert.equal(f.ledger.inspectRealContextBatch().calls, 1);
  });
});

test('private validated-record failure holds global busy until unknown occupancy and durable stop commit together', async t => {
  let concurrentOutcome;
  const f = await fixture(t, { record: (_id, event, value) => {
    if (event !== 'validated') return;
    assert.equal(value.accounting, 'reservation_still_held');
    const other = new ProductBudget(f.ledger.path);
    try {
      try { other.reserve({ now: NOW, pilot: SYNTHETIC_PILOT_ID, maximumNano: 10000, provider: 'deepseek', model: DEEPSEEK_AI.model,
        batch: { id: REAL_CONTEXT_BATCH_ID, authorizationId: f.grant.authorizationId, policyVersion: f.grant.policyVersion, snapshotId: 'racing-next', scopeHash: 'a'.repeat(64) } }); concurrentOutcome = 'incorrectly_reserved'; }
      catch (error) { concurrentOutcome = error.message; }
    } finally { other.close(); }
    throw Error('isolated_validated_write_failure');
  } });
  const snap = await snapshot(f); await assert.rejects(interpret(f, snap), /provider_error/);
  assert.equal(concurrentOutcome, 'busy'); assert.equal(f.ledger.inspectRealContextBatch().calls, 1); assert.equal(f.ledger.inspectRealContextBatch().stopped, true);
  const row = f.ledger.db.prepare('SELECT * FROM requests').get(); assert.equal(row.state, 'unknown'); assert.equal(row.charged, null);
  assert.equal(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.reserved, row.reserved);
  await assert.rejects(interpret(f, snap), /batch_stopped/); assert.equal(f.bodies.length, 1);
});

test('private frozen recording cannot authorize dispatch after snapshot expiry or grant revocation', async t => {
  for (const mode of ['expired', 'revoked']) await t.test(mode, async t => {
    const f = await fixture(t, { record: (_id, event) => {
      if (event !== 'frozen') return;
      if (mode === 'expired') f.setNow(NOW + 60000); else f.grant.revoked = true;
    } });
    const snap = await snapshot(f); await assert.rejects(interpret(f, snap), mode === 'expired' ? /context_expired/ : /permission_revoked/);
    assert.equal(f.bodies.length, 0); assert.deepEqual(f.events.map(e => e.event), ['frozen']);
    const row = f.ledger.db.prepare('SELECT * FROM requests').get(); assert.equal(row.state, 'unknown'); assert.equal(row.charged, null);
    assert.equal(row.outcome, mode === 'expired' ? 'context_expired' : 'permission_revoked');
    assert.equal(f.ledger.inspect(f.now(), SYNTHETIC_PILOT_ID).pilot.reserved, row.reserved);
    assert.equal(f.ledger.inspectRealContextBatch().calls, 1); assert.equal(f.ledger.inspectRealContextBatch().stopped, true);
  });
});

test('private validated recording cannot release a completed reservation after grant revocation or review expiry', async t => {
  for (const mode of ['revoked', 'review_expired']) await t.test(mode, async t => {
    const f = await fixture(t, { record: (_id, event) => {
      if (event !== 'validated') return;
      if (mode === 'revoked') f.grant.revoked = true; else f.setNow(NOW + 20 * 60000);
    } });
    const snap = await snapshot(f); await assert.rejects(interpret(f, snap), /permission_revoked/);
    assert.equal(f.bodies.length, 1); assert.deepEqual(f.events.map(e => e.event), ['frozen', 'reply', 'validated']);
    const row = f.ledger.db.prepare('SELECT * FROM requests').get(); assert.equal(row.state, 'settled'); assert.equal(row.outcome, 'permission_revoked');
    assert.equal(row.charged, 840000); assert.equal(f.ledger.inspectRealContextBatch().calls, 1); assert.equal(f.ledger.inspectRealContextBatch().stopped, true);
    assert.equal(f.ledger.inspect(f.now(), SYNTHETIC_PILOT_ID).pilot.reserved, 0);
  });
});

test('private runtime drops cancelled and revoked late replies while preserving consumed reservation', async t => {
  for (const mode of ['cancelled', 'revoked']) await t.test(mode, async t => {
    const wait = deferred(), entered = deferred(); const f = await fixture(t, { reply: async body => { entered.resolve(body); await wait.promise; return privateFixtureReply(body); } });
    const snap = await snapshot(f), abort = new AbortController(), pending = interpret(f, snap, 'owner', abort.signal); await entered.promise;
    if (mode === 'cancelled') abort.abort(); else f.grant.revoked = true;
    if (mode === 'cancelled') await assert.rejects(pending, /cancelled/);
    wait.resolve(); if (mode === 'revoked') await assert.rejects(pending, /permission_revoked/); await tick();
    assert.equal(f.events.filter(e => e.event === 'validated').length, mode === 'revoked' ? 1 : 0);
    assert.equal(f.ledger.db.prepare('SELECT outcome FROM requests').get().outcome, mode === 'revoked' ? 'permission_revoked' : 'cancelled');
    assert.equal(f.ledger.inspectRealContextBatch().calls, 1); assert.equal(f.ledger.inspectRealContextBatch().stopped, true);
    assert.ok(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.occupied > 0);
    if (mode === 'revoked') assert.throws(() => f.runtime.evidence('owner', SYMBOL, snap.snapshotId), /permission_revoked/);
    else assert.equal(f.runtime.evidence('owner', SYMBOL, snap.snapshotId).snapshot.id, snap.snapshotId);
  });
});

test('private in-flight duplicate consumers cancel independently and expired completion is explicitly old', async t => {
  const wait = deferred(), entered = deferred(); const f = await fixture(t, { reply: async body => { entered.resolve(); await wait.promise; return privateFixtureReply(body); } });
  const snap = await snapshot(f), abort = new AbortController(), first = interpret(f, snap, 'owner', abort.signal), second = interpret(f, snap);
  await entered.promise; abort.abort(); await assert.rejects(first, /cancelled/); assert.equal(f.signals[0].aborted, false);
  f.setNow(NOW + 60001); wait.resolve(); const result = await second;
  assert.equal(result.oldSnapshot, true); assert.equal(f.bodies.length, 1); assert.equal(f.ledger.inspectRealContextBatch().calls, 1);
  assert.equal(f.runtime.evidence('owner', SYMBOL, snap.snapshotId).oldSnapshot, true);
  await assert.rejects(interpret(f, snap), /context_expired/); assert.equal(f.bodies.length, 1);
});

async function sparePort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
const raw = (url, path, headers = {}, method = 'POST', body = '{}') => new Promise((resolve, reject) => {
  const req = request(url, { path, method, headers, agent: false }, res => { let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => {
    let data = null; try { data = JSON.parse(text); } catch {} resolve({ status: res.statusCode, headers: res.headers, text, data }); }); });
  req.on('error', reject); req.end(body);
});
async function preview(t, runtime, onUpstream = (_req, res) => res.end('isolated-page')) {
  const upstream = createServer(onUpstream); await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const token = 'fixture-only-private-session-00000000001', session = await startPrivatePreview({ upstream: `http://127.0.0.1:${upstream.address().port}`, port: await sparePort(), token, runtime });
  t.after(async () => { await session.close(); await new Promise(resolve => upstream.close(resolve)); });
  const headers = { Origin: session.url, 'X-AI-Pilot-Session': token, 'Content-Type': 'application/json' };
  return { ...session, token, headers, api: (path, body = {}) => raw(session.url, '/__ai-pilot/' + path, headers, 'POST', JSON.stringify(body)) };
}

test('private HTTP requires exact loopback host, origin, ASCII session, body schema and limits before any loader', async t => {
  let calls = 0; const runtime = { status: () => ({ gate: { admission: 'ready' }, allowedSymbol: SYMBOL }), snapshot: async () => { calls++; return { snapshotId: 'test-snapshot' }; }, close() {} };
  let forwarded; const p = await preview(t, runtime, (req, res) => { forwarded = req.headers; res.end('isolated-page'); });
  assert.equal((await raw(p.url, '/api/interpretation', {}, 'GET', '')).data.mode, 'private_real');
  for (const override of [{ Origin: 'https://evil.invalid' }, { Host: 'evil.invalid' }, { 'X-AI-Pilot-Session': 'wrong' },
    { 'X-AI-Pilot-Session': 'é'.repeat(p.token.length) }, { 'Content-Type': 'text/plain' }]) assert.equal((await raw(p.url, '/__ai-pilot/snapshot', { ...p.headers, ...override }, 'POST', JSON.stringify({ symbol: SYMBOL }))).status, 403);
  assert.equal((await raw(p.url, '/__ai-pilot/status', {}, 'POST')).status, 403);
  assert.equal((await raw(p.url, '/__ai-pilot/status', p.headers, 'GET')).status, 403);
  assert.equal((await raw(p.url, '/__ai-pilot/status?x=1', p.headers)).status, 403);
  for (const body of [{ symbol: 'ETH-USDT' }, { symbol: SYMBOL, context: {} }, { symbol: SYMBOL, policy: 'allowed' }, { symbol: SYMBOL, scope: 'another-owner' }, { symbol: SYMBOL, model: 'arbitrary' }, []]) assert.equal((await p.api('snapshot', body)).status, 400);
  assert.equal((await raw(p.url, '/__ai-pilot/status', p.headers, 'POST', 'x'.repeat(2049))).status, 400);
  assert.equal((await p.api('unknown', {})).status, 400); assert.equal(calls, 0);
  const ready = await p.api('status'); assert.equal(ready.status, 200); assert.equal(ready.headers['access-control-allow-origin'], undefined); assert.match(ready.headers['cache-control'], /private, no-store/);
  assert.equal((await p.api('snapshot', { symbol: SYMBOL })).status, 200); assert.equal(calls, 1);
  assert.equal((await raw(p.url, '/', { ...p.headers, Authorization: 'fixture-only-secret' }, 'GET', '')).status, 200);
  assert.equal(forwarded['x-ai-pilot-session'], undefined); assert.equal(forwarded.authorization, undefined);
  await assert.rejects(startPrivatePreview({ upstream: 'https://example.invalid', port: await sparePort(), token: p.token, runtime }), /loopback_preview_required/);
});

test('private HTTP proxy preserves access-gate login/logout and rejects foreign origin without forwarding session credentials', async t => {
  const env = { ACCESS_CODE_HASH: accessCodeHash('fixture-test-code'), ACCESS_SESSION_SECRET: 'fixture-only-access-session-secret-00000000000000' }, seen = [];
  const p = await preview(t, createPrivateContextRuntime(), async (req, res) => {
    seen.push(req.headers); const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8'), upstreamRequest = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, ...(body ? { body } : {}) });
    const response = await accessGate(upstreamRequest, env) ?? new Response('isolated-app');
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
  });
  const headers = { Origin: p.url, 'Content-Type': 'application/x-www-form-urlencoded', 'X-AI-Pilot-Session': p.token };
  const login = await raw(p.url, '/api/access', headers, 'POST', 'code=fixture-test-code'); assert.equal(login.status, 303); assert.equal(login.headers.location, '/');
  const before = seen.length; assert.equal((await raw(p.url, '/api/access', { ...headers, Origin: 'https://evil.invalid' }, 'POST', 'code=fixture-test-code')).status, 403); assert.equal(seen.length, before);
  assert.equal((await raw(p.url, '/api/access/logout', headers, 'POST', '')).status, 303);
  assert.ok(seen.every(h => h['x-ai-pilot-session'] === undefined && h.origin === `http://${h.host}`));
});

test('private HTTP valid snapshot/result/evidence chain shares the mock runtime and never serializes raw bars or grants', async t => {
  const f = await createPrivateFixture(), p = await preview(t, f.runtime); t.after(() => f.close());
  const snap = await p.api('snapshot', { symbol: SYMBOL }); assert.equal(snap.status, 200);
  const result = await p.api('interpret', { symbol: SYMBOL, snapshotId: snap.data.snapshotId }); assert.equal(result.status, 200); parsePrivateInterpretation(result.data);
  const evidence = await p.api('evidence', { symbol: SYMBOL, snapshotId: snap.data.snapshotId }); assert.equal(evidence.status, 200); assert.deepEqual(evidence.data.context, result.data.context);
  assert.equal((await p.api('interpret', { symbol: SYMBOL, snapshotId: 'foreign-snapshot' })).status, 403);
  assert.doesNotMatch(result.text, /fixture-only:no-source-permission|fixture-only:no-user-real-authorization|"points"|"request_profiles"/);
  assert.equal(f.bodies.length, 1); assert.equal(f.ledger.inspectRealContextBatch().calls, 1);
});
