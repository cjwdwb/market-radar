import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ProductBudget } from '../lib/ai/product-budget.mjs';
import { REAL_AI, DEEPSEEK_AI, ACTIVE_PRODUCT_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';
import { fixtureContext } from '../lib/ai/fixture.ts';
import { projectProviderContext } from '../lib/ai/context.ts';
import { SYNTHESIS_JSON_SCHEMA, SYNTHESIS_PROMPT, synthesisCatalog, validateSynthesis } from '../lib/ai/real-output.ts';
import { buildDeepSeekRequest, parseDeepSeekResponse, createDeepSeekProvider, DEEPSEEK_SYNTHESIS_INSTRUCTIONS } from '../lib/ai/deepseek-provider.ts';
import { createRealPilotService } from '../lib/ai/real-service.ts';
import { parsePilotArgs } from '../scripts/ai30b-pilot.mjs';

const NOW = Date.UTC(2026, 9, 12, 12), ctx = () => fixtureContext('upward', 'BTC-USDT', NOW);
function selection(c = projectProviderContext(ctx())) {
  const catalog = synthesisCatalog(c), summary = [catalog.find(s => s.evidenceRefs.includes('short.direction'))];
  return { summary, primaryEvidenceRefs: summary[0].evidenceRefs, conflictRefs: [], limitationRefs: c.evidence.filter(e => e.availability !== 'available').map(e => e.id) };
}
function response(changes = {}) {
  return { object: 'response', id: 'deepseek.opaque:id-1', created_at: NOW / 1000, model: 'deepseek-flash', status: 'completed', reasoning: { effort: 'none' },
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(selection()) }] }],
    usage: { input_tokens: 1500, output_tokens: 300, total_tokens: 1800, input_tokens_details: { cached_tokens: 500 }, output_tokens_details: { reasoning_tokens: 0 } }, ...changes };
}
function database(t, migrate = true) {
  const path = join(mkdtempSync(join(tmpdir(), 'mr-deepseek-mock-')), 'budget.sqlite');
  const budget = new ProductBudget(path, { initialize: true });
  if (migrate) budget.enableProviderProfiles();
  t.after(() => budget.close());
  t.mock.method(globalThis, 'fetch', () => { throw new Error('TEST_FORBIDS_NETWORK'); });
  return { path, budget };
}
const reserve = (budget, provider, maximumNano = 20000000) => budget.reserve({ now: NOW, pilot: SYNTHETIC_PILOT_ID, maximumNano,
  provider, model: provider === 'deepseek' ? DEEPSEEK_AI.model : REAL_AI.model });

test('DeepSeek fixed request uses trusted instructions, schema and peak non-cached full-payload reserve', () => {
  assert.equal(ACTIVE_PRODUCT_AI, DEEPSEEK_AI);
  const request = buildDeepSeekRequest(projectProviderContext(ctx())), body = JSON.parse(request.body);
  assert.equal(body.model, 'deepseek-flash'); assert.equal(body.instructions, DEEPSEEK_SYNTHESIS_INSTRUCTIONS);
  assert.ok(body.instructions.startsWith(SYNTHESIS_PROMPT));
  assert.ok(body.instructions.includes('没有符合项时输出空数组[]'));
  assert.equal(DEEPSEEK_AI.prompt, 'bounded-synthesis-v2-deepseek-instructions-v2');
  assert.equal(body.input.length, 1); assert.equal(body.input[0].role, 'user'); assert.deepEqual(body.reasoning, { effort: 'none' });
  assert.equal(body.stream, false); assert.equal(body.tool_choice, 'none'); assert.equal(body.max_output_tokens, 2048);
  for (const name of ['tools', 'service_tier', 'store', 'background', 'previous_response_id']) assert.equal(name in body, false);
  assert.deepEqual(body.text.format.schema, SYNTHESIS_JSON_SCHEMA); assert.equal('strict' in body.text.format, false);
  assert.equal(request.maximumInputTokens, Buffer.byteLength(request.body) + 2048);
  assert.equal(request.maximumBaseNano, request.maximumInputTokens * 300 + 2048 * 1200);
  assert.equal(REAL_AI.model, 'gpt-6-luna'); assert.equal(REAL_AI.endpoint, 'https://api.openai.com/v1/responses');
});

test('DeepSeek first real failure remains rejected: unavailable alignment is a limitation, not a conflict', () => {
  const c = projectProviderContext(ctx()), output = selection(c);
  const alignment = c.evidence.find(e => e.id === 'alignment');
  assert.equal(alignment.availability, 'insufficient');
  assert.ok(output.limitationRefs.includes('alignment'));
  assert.doesNotThrow(() => validateSynthesis(JSON.stringify(output), c));
  assert.throws(() => validateSynthesis(JSON.stringify({ ...output, conflictRefs: ['alignment'] }), c), e => e.code === 'missing_conflict');
});

test('DeepSeek prompt clarification does not remove an available mixed conflict or a missing-data limitation', () => {
  const c = projectProviderContext(fixtureContext('mixed', 'BTC-USDT', NOW));
  const alignment = c.evidence.find(e => e.id === 'alignment');
  assert.equal(alignment.availability, 'available'); assert.equal(alignment.classification, 'mixed');
  const summary = [synthesisCatalog(c).find(s => s.evidenceRefs.includes('short.direction') && s.evidenceRefs.includes('medium.direction'))];
  assert.ok(summary[0]);
  const output = { summary, primaryEvidenceRefs: summary[0].evidenceRefs, conflictRefs: ['alignment'], limitationRefs: c.evidence.filter(e => e.availability !== 'available').map(e => e.id) };
  assert.ok(output.limitationRefs.length > 0);
  assert.doesNotThrow(() => validateSynthesis(JSON.stringify(output), c));
  assert.throws(() => validateSynthesis(JSON.stringify({ ...output, conflictRefs: [] }), c), e => e.code === 'missing_conflict');
  assert.throws(() => validateSynthesis(JSON.stringify({ ...output, limitationRefs: [] }), c), e => e.code === 'missing_limitation');
});

test('DeepSeek result identity does not require or trust OpenAI service tier', () => {
  const reply = parseDeepSeekResponse(response());
  assert.equal(reply.status, 'completed'); assert.equal(reply.responseId, 'deepseek.opaque:id-1');
  assert.equal(reply.returnedServiceTier, null); assert.equal(reply.provider, 'deepseek');
  assert.equal(reply.billingProfile, DEEPSEEK_AI.billingProfile); assert.equal(reply.usage.cachedTokens, 500);
  assert.equal(parseDeepSeekResponse(response({ service_tier: 'premium' })).returnedServiceTier, null);
  assert.equal(parseDeepSeekResponse(response({ model: 'deepseek-v4-pro' })).status, 'model_mismatch');
  assert.equal(parseDeepSeekResponse(response({ model: 'gpt-6-luna' })).status, 'model_mismatch');
  assert.equal(parseDeepSeekResponse(response({ object: 'chat.completion' })).status, 'invalid_response');
  assert.equal(parseDeepSeekResponse(response({ id: 'x\nsecret' })).status, 'invalid_response');
  assert.equal(parseDeepSeekResponse(response({ reasoning: { effort: 'high' } })).status, 'configuration_mismatch');
  assert.equal(parseDeepSeekResponse(response({ usage: { input_tokens: 2, output_tokens: 3, output_tokens_details: { reasoning_tokens: 1 } } })).status, 'configuration_mismatch');
});

test('DeepSeek parses refusal/filter, incomplete, failure and malformed output without salvage', () => {
  assert.equal(parseDeepSeekResponse(response({ status: 'incomplete', incomplete_details: { reason: 'content_filter' } })).status, 'refusal');
  assert.equal(parseDeepSeekResponse(response({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })).status, 'incomplete');
  assert.equal(parseDeepSeekResponse(response({ status: 'failed', error: { code: 'mock', message: 'not logged' } })).status, 'failed');
  assert.equal(parseDeepSeekResponse(response({ status: 'in_progress' })).status, 'invalid_response');
  for (const output of [[], [response().output[0], response().output[0]], [{ type: 'function_call' }]]) assert.equal(parseDeepSeekResponse(response({ output })).status, 'invalid_response');
  for (const usage of [null, {}, { input_tokens: -1, output_tokens: 1 }, { input_tokens: 1, output_tokens: 2, total_tokens: 9 },
    { input_tokens: 1, output_tokens: 2, input_tokens_details: { cached_tokens: 2 } }]) assert.equal(parseDeepSeekResponse(response({ usage })).usage, null);
});

test('DeepSeek HTTP/size/abort behavior has zero retry, no redirect or sensitive error-body logging', async () => {
  for (const status of [400, 401, 402, 403, 422, 429, 500, 503]) {
    let calls = 0;
    const provider = createDeepSeekProvider('mock-product-key', async (url, init) => {
      calls++; assert.equal(url, 'https://api.deepseek.com/responses'); assert.equal(init.redirect, 'error');
      return new Response('DO_NOT_LOG_mock_product_key', { status });
    });
    await assert.rejects(provider.generate('{}', new AbortController().signal), e => !e.message.includes('DO_NOT_LOG') && (status !== 402 || e.code === 'provider_credit_unavailable'));
    assert.equal(calls, 1);
  }
  const oversized = createDeepSeekProvider('mock', async () => new Response(' '.repeat(65537)));
  await assert.rejects(oversized.generate('{}', new AbortController().signal), /response_limit/);
  const controller = new AbortController(); controller.abort(); let sent = 0;
  const cancelled = createDeepSeekProvider('mock', async () => { sent++; return new Response('{}'); });
  await assert.rejects(cancelled.generate('{}', controller.signal), /cancelled/); assert.equal(sent, 0);
});

test('v1 inspection is read-only; explicit migration preserves every old request and cumulative occupancy', t => {
  const { path, budget } = database(t, false);
  const first = reserve(budget, 'openai');
  budget.settle(first.id, { now: NOW, usageCostNano: 337500, usage: { inputTokens: 1500, outputTokens: 300 }, outcome: 'completed' });
  const second = reserve(budget, 'openai'); budget.unknown(second.id, NOW, 'timeout');
  const original = budget.db.prepare('SELECT * FROM requests ORDER BY id').all(), before = budget.inspect(NOW, SYNTHETIC_PILOT_ID);
  budget.inspect(NOW, SYNTHETIC_PILOT_ID);
  assert.equal(budget.db.prepare('SELECT identity FROM metadata').get().identity, 'market-radar-product-budget-v1');
  assert.throws(() => reserve(budget, 'deepseek'), /budget_profile_migration_required/);
  budget.enableProviderProfiles(); budget.enableProviderProfiles();
  assert.deepEqual(budget.db.prepare('SELECT * FROM requests ORDER BY id').all(), original);
  assert.deepEqual(budget.inspect(NOW, SYNTHETIC_PILOT_ID), before);
  assert.equal(budget.db.prepare('SELECT COUNT(*) AS n FROM request_profiles').get().n, 2);
  const profile = budget.db.prepare('SELECT * FROM request_profiles WHERE request_id=?').get(first.id);
  assert.equal(profile.provider, 'openai'); assert.equal(profile.input_nano, 125); assert.equal(profile.output_nano, 500);
  assert.equal(profile.price_version, REAL_AI.priceVersion);
  const reopened = new ProductBudget(path); assert.deepEqual(reopened.inspect(NOW, SYNTHETIC_PILOT_ID), before); reopened.close();
  const third = reserve(budget, 'deepseek');
  assert.equal(budget.db.prepare('SELECT provider FROM request_profiles WHERE request_id=?').get(third.id).provider, 'deepseek');
  assert.equal(budget.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.calls, 3);
});

test('profile migration blocks active reservations and rolls back partial schema without resetting money', t => {
  const { budget } = database(t, false), r = reserve(budget, 'openai');
  assert.throws(() => budget.enableProviderProfiles(), /budget_recovery_required/);
  assert.equal(budget.inspect(NOW, SYNTHETIC_PILOT_ID).active, 1);
  budget.unknown(r.id, NOW, 'timeout');
  // 隔离库故意制造命名冲突，让事务在CREATE TABLE之后失败。
  budget.db.exec("CREATE TRIGGER require_request_profile BEFORE UPDATE ON requests BEGIN SELECT 1; END;");
  assert.throws(() => budget.enableProviderProfiles(), /already exists/);
  assert.equal(budget.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='request_profiles'").get().n, 0);
  assert.equal(budget.db.prepare('SELECT identity FROM metadata').get().identity, 'market-radar-product-budget-v1');
  assert.equal(budget.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.occupied, 20000000);
});

test('old already-open v1 writer cannot insert unprofiled requests after migration', t => {
  const { path, budget } = database(t, false), old = new DatabaseSync(path);
  t.after(() => old.close());
  budget.enableProviderProfiles();
  assert.throws(() => old.prepare("INSERT INTO requests(id,month,pilot,reserved,state,created_at,model) VALUES('old','2026-10',?,1000,'reserved',?,?)").run(SYNTHETIC_PILOT_ID, NOW, REAL_AI.model), /budget_profile_required/);
  assert.equal(old.prepare('SELECT identity FROM metadata').get().identity, 'market-radar-product-budget-v2');
  assert.notEqual(old.prepare('SELECT identity FROM metadata').get().identity, 'market-radar-product-budget-v1');
  assert.equal(budget.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.calls, 0);
});

test('v2 settlement uses persisted prices, rejects low recalculation, and pools both providers', t => {
  const { budget } = database(t), usage = { inputTokens: 1500, outputTokens: 300 };
  const a = reserve(budget, 'openai'); budget.settle(a.id, { now: NOW, usageCostNano: 337500, usage, outcome: 'completed' });
  const b = reserve(budget, 'deepseek');
  assert.throws(() => budget.settle(b.id, { now: NOW, usageCostNano: 337500, usage, outcome: 'completed' }), /invalid_usage/);
  assert.equal(budget.settle(b.id, { now: NOW, usageCostNano: 810000, usage, outcome: 'completed' }), 1620000);
  assert.equal(budget.settle(b.id, { now: NOW, usageCostNano: 810000, usage, outcome: 'completed' }), 1620000);
  assert.equal(budget.inspect(NOW, SYNTHETIC_PILOT_ID).monthly.occupied, 2295000);
  for (let i = 2; i < 20; i++) { const r = reserve(budget, i % 2 ? 'deepseek' : 'openai', 10000); budget.unknown(r.id, NOW, 'timeout'); }
  assert.throws(() => reserve(budget, 'deepseek'), /budget_exhausted/);
  assert.throws(() => reserve(budget, 'openai'), /budget_exhausted/);
});

test('v2 tampered or missing profile fails closed and never recreates original budget', t => {
  const { path, budget } = database(t), r = reserve(budget, 'deepseek'); budget.unknown(r.id, NOW, 'timeout');
  budget.db.prepare('UPDATE request_profiles SET input_nano=1 WHERE request_id=?').run(r.id);
  assert.throws(() => new ProductBudget(path), /budget_unavailable/);
  assert.throws(() => reserve(budget, 'deepseek'), /budget_unavailable/);
});

test('DeepSeek validated service reuses strict evidence/cache and settles at peak without claiming billed cost', async t => {
  const { budget } = database(t); let calls = 0;
  const provider = createDeepSeekProvider('mock-product-only', async () => { calls++; return new Response(JSON.stringify(response())); });
  const service = createRealPilotService(provider, budget, { now: () => NOW, profile: DEEPSEEK_AI }), c = ctx();
  const result = await service.interpret(c), cached = await service.interpret(c);
  assert.equal(calls, 1); assert.equal(cached.cacheHit, true); assert.equal(result.provider, 'deepseek');
  assert.equal(result.returnedServiceTier, null); assert.equal(result.priceVersion, DEEPSEEK_AI.priceVersion);
  assert.equal(result.usageCalculatedNano, 810000); assert.equal(result.budgetChargedBoundNano, 1620000);
  assert.equal(result.billedCost, null); assert.equal(result.usage.cachedTokens, 500); service.stop();
});

test('DeepSeek semantic rejection still charges known usage; identity or usage failure keeps full reserve', async t => {
  for (const [code, changes, settled] of [
    ['invalid_output', { output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"invented":true}' }] }] }, true],
    ['model_mismatch', { model: 'deepseek-v4-pro' }, false], ['invalid_usage', { usage: null }, false],
    ['configuration_mismatch', { reasoning: { effort: 'high' } }, false],
    ['refusal', { status: 'incomplete', incomplete_details: { reason: 'content_filter' } }, true],
  ]) await t.test(code, async t => {
    const { budget } = database(t);
    const service = createRealPilotService(createDeepSeekProvider('mock', async () => new Response(JSON.stringify(response(changes)))), budget, { now: () => NOW, profile: DEEPSEEK_AI });
    await assert.rejects(service.interpret(ctx()), e => e.code === code);
    assert.equal(budget.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.settled > 0, settled);
    assert.equal(budget.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.reserved > 0, !settled); service.stop();
  });
});

test('DeepSeek cancellation preserves unknown occupancy and emits no fallback request', async t => {
  const { budget } = database(t); let requests = 0;
  const provider = createDeepSeekProvider('mock', async (_url, init) => {
    requests++; return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  const service = createRealPilotService(provider, budget, { now: () => NOW, profile: DEEPSEEK_AI });
  const control = new AbortController(), pending = service.interpret(ctx(), control.signal);
  await Promise.resolve(); control.abort(); await assert.rejects(pending, /cancelled/);
  await new Promise(r => setTimeout(r, 1));
  assert.equal(requests, 1); assert.ok(budget.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.reserved > 0); service.stop();
});

test('DeepSeek CLI rejects old billing attestation and never reads generic DS/OpenAI environment variables', () => {
  assert.throws(() => parsePilotArgs(['--run', '--case', 'aligned', '--billing-bound-confirmed']), /unknown_pilot_option/);
  const script = readFileSync(new URL('../scripts/ai30b-pilot.mjs', import.meta.url), 'utf8');
  assert.ok(script.includes('process.env.MARKET_RADAR_DEEPSEEK_API_KEY'));
  assert.equal(script.includes('process.env.DEEPSEEK_API_KEY'), false); assert.equal(script.includes('process.env.OPENAI_API_KEY'), false);
  assert.equal(parsePilotArgs(['--migrate-budget-profiles']).mode, 'migrate-budget-profiles');
});

test('v2 snapshot can reopen with exact profile and amounts; no reset on copy', t => {
  const { path, budget } = database(t), r = reserve(budget, 'deepseek'); budget.unknown(r.id, NOW, 'timeout');
  const copy = join(mkdtempSync(join(tmpdir(), 'mr-ds-budget-copy-')), 'copy.sqlite');
  budget.db.prepare('VACUUM INTO ?').run(copy);
  writeFileSync(`${copy}.initialized`, readFileSync(`${path}.initialized`), { flag: 'wx' });
  const restored = new ProductBudget(copy);
  assert.deepEqual(restored.inspect(NOW, SYNTHETIC_PILOT_ID), budget.inspect(NOW, SYNTHETIC_PILOT_ID));
  assert.deepEqual(restored.db.prepare('SELECT * FROM request_profiles').all(), budget.db.prepare('SELECT * FROM request_profiles').all());
  restored.close();
});
