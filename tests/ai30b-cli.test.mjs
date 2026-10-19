import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ProductBudget } from '../lib/ai/product-budget.mjs';
import { ACTIVE_PRODUCT_AI as REAL_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';
import { fixtureContext } from '../lib/ai/fixture.ts';
import { projectProviderContext } from '../lib/ai/context.ts';
import { claimFor } from '../lib/ai/validation.ts';
import { createSelectionCatalog } from '../lib/ai/claim-selection.ts';
import { executePilot, parsePilotArgs, inspectPilotBudget, pilotExitCode } from '../scripts/ai30b-pilot.mjs';
globalThis.fetch = () => { throw new Error('TEST_FORBIDS_NETWORK'); };

const NOW = Date.UTC(2026, 9, 12, 12), json = path => JSON.parse(readFileSync(path, 'utf8'));
// manifest按JSON持久化，原对象的undefined可选字段不会落盘；不改变fixture内容。
const persisted = value => JSON.parse(JSON.stringify(value));
const run = id => parsePilotArgs(['--run', '--case', id, '--deepseek-billing-bound-confirmed']);
function setup(t) {
  // 所有测试账本均在新临时目录；无正式路径、Key或默认fetch回退。
  const root = mkdtempSync(join(tmpdir(), 'mr-ai30b-cli-')), path = join(root, 'mock-budget.sqlite');
  const ledger = new ProductBudget(path, { initialize: true });
  ledger.enableProviderProfiles();
  t.after(() => ledger.close());
  t.mock.method(globalThis, 'fetch', () => { throw new Error('TEST_FORBIDS_NETWORK'); });
  return { root, path, ledger, outputRoot: join(root, 'output'), key: 'mock-only', transport: mockTransport(), now: () => NOW,
    provenance: { candidateSha: 'mock-only', cliDiffSha256: 'mock-only', caseDefinitionVersion: 'synthetic-cases-v1' } };
}
function selected(context) {
  const catalog = createSelectionCatalog(context);
  const pair = catalog.entries.find(e => e.evidenceRefs.includes('short.direction') && e.evidenceRefs.includes('medium.direction'));
  return { selectedClaimIds: [pair?.claimId ?? catalog.entries.find(e => e.primaryEligible).claimId] };
}
function mockTransport(changes = {}) {
  return async (url, init) => {
    assert.equal(url, REAL_AI.endpoint); assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    const context = JSON.parse(body.input[0].content).context;
    return new Response(JSON.stringify({ id: 'resp_mock_only', object: 'response', model: REAL_AI.model, service_tier: 'default', status: 'completed',
      output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(selected(context)) }] }],
      usage: { input_tokens: 1500, output_tokens: 300, total_tokens: 1800, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
      ...changes }));
  };
}

test('pilot CLI rejects batch/init/unknown/duplicate options before reservation or transport', async t => {
  const opts = setup(t);
  for (const args of [['--run'], ['--freeze'], ['--initialize-budget'], ['--run', '--case', 'unknown'],
    ['--run', '--freeze', '--case', 'aligned'], ['--run', '--case', 'aligned', '--case', 'mixed'], ['--inspect', '--case', 'aligned']]) {
    assert.throws(() => parsePilotArgs(args));
  }
  await assert.rejects(executePilot({ mode: 'run', caseId: 'unknown', billingConfirmed: true }, opts), /unknown_pilot_case/);
  assert.equal(inspectPilotBudget(opts.ledger, NOW).pilot.calls, 0);
  assert.deepEqual(readdirSync(opts.root).filter(n => n === 'output'), []);
});

test('pilot CLI runs one case then stops, with exact original fixture/template and separate cumulative counters', async t => {
  const opts = setup(t), old = opts.ledger.reserve({ now: NOW, pilot: SYNTHETIC_PILOT_ID, maximumNano: 1000 });
  opts.ledger.settle(old.id, { now: NOW, usageCostNano: 125, usage: { inputTokens: 1, outputTokens: 0 }, outcome: 'completed' });
  const report = await executePilot(run('aligned'), opts), frozen = json(join(dirname(report.report), 'frozen.json'));
  assert.equal(report.results.length, 1); assert.equal(report.results[0].status, 'validated');
  assert.equal(pilotExitCode(report), 0);
  assert.equal(report.counters.actualHttpAttempts, 1); assert.equal(report.counters.httpResponses, 1);
  assert.equal(report.counters.validProviderResponses, 1); assert.equal(report.counters.success, 1);
  assert.equal(report.counters.cumulativeReservationsStart, 1); assert.equal(report.counters.cumulativeReservationsEnd, 2);
  assert.equal(report.counters.reservationDelta, 1); assert.equal(report.counters.ownReservations, 1);
  assert.equal(report.nextAction, 'STOP_FOR_GPT_REVIEW'); assert.equal(report.quality, 'PENDING_GPT_REVIEW');
  assert.equal(report.billedCost, null); assert.equal(report.budgetAfter.pilot.settled, 1620250);
  assert.equal(frozen.pilot, SYNTHETIC_PILOT_ID); assert.deepEqual(frozen.configuration, REAL_AI);
  const context = fixtureContext('upward', 'BTC-USDT', NOW);
  assert.deepEqual(frozen.case.context, persisted(context));
  assert.deepEqual(frozen.case.deterministicTemplate, projectProviderContext(context).evidence.map(claimFor));
  assert.equal(frozen.case.requestSha256.length, 64); assert.equal(frozen.case.contextSha256.length, 64);
  assert.equal(json(join(dirname(report.report), 'reply.json')).responseId, 'resp_mock_only');
  assert.equal(readdirSync(opts.outputRoot).length, 1); assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('pilot CLI fresh materialization after manual delay preserves old immutable manifests', async t => {
  const opts = setup(t), first = await executePilot(run('aligned'), opts);
  const oldPath = join(dirname(first.report), 'frozen.json'), oldBytes = readFileSync(oldPath, 'utf8');
  const second = await executePilot(run('mixed'), { ...opts, now: () => NOW + 120000 });
  assert.equal(second.results[0].status, 'validated'); assert.notEqual(second.runId, first.runId);
  const fresh = json(join(dirname(second.report), 'frozen.json'));
  assert.equal(fresh.case.context.capturedAt, NOW + 120000);
  assert.deepEqual(fresh.case.context, persisted(fixtureContext('mixed', 'BTC-USDT', NOW + 120000)));
  assert.notEqual(fresh.case.contextSha256, JSON.parse(oldBytes).case.contextSha256);
  assert.equal(readFileSync(oldPath, 'utf8'), oldBytes);
  // 同毫秒也不会覆盖；freeze不调用模型或占用预算。
  const frozen = await executePilot(parsePilotArgs(['--freeze', '--case', 'mixed']), { ...opts, now: () => NOW + 120000 });
  assert.notEqual(frozen.runId, second.runId); assert.equal(frozen.actualHttpAttempts, 0);
  assert.equal(pilotExitCode(frozen), 0);
  assert.equal(inspectPilotBudget(opts.ledger, NOW).pilot.calls, 2);
});

test('pilot CLI intentional stale stays insufficient, without HTTP or reservation', async t => {
  const opts = setup(t), report = await executePilot(run('stale'), opts);
  assert.equal(report.results[0].code, 'insufficient_context'); assert.equal(report.results[0].status, 'not_dispatched');
  assert.equal(pilotExitCode(report), 0);
  assert.equal(report.counters.preDispatchRejections, 1); assert.equal(report.counters.actualHttpAttempts, 0);
  assert.equal(report.counters.reservationDelta, 0); assert.equal(report.diagnosticStatus, 'no_reply');
  const frozen = json(join(dirname(report.report), 'frozen.json'));
  assert.deepEqual(frozen.case.context, persisted(fixtureContext('stale', 'BTC-USDT', NOW)));
});

test('pilot CLI semantic failure keeps bounded reply evidence and original settled cost, then stops', async t => {
  const opts = setup(t);
  opts.transport = mockTransport({ output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"invented":true}' }] }] });
  const report = await executePilot(run('aligned'), opts), reply = json(join(dirname(report.report), 'reply.json'));
  assert.equal(report.results[0].status, 'failed'); assert.equal(report.counters.validationFailures, 1);
  assert.equal(pilotExitCode(report), 1);
  assert.equal(report.counters.actualHttpAttempts, 1); assert.equal(report.budgetAfter.pilot.settled, 1620000);
  assert.equal(report.budgetAfter.pilot.reserved, 0); assert.equal(reply.json, '{"invented":true}');
  assert.equal(report.accounting.at(-1).outcome, 'validation_failed');
});

test('pilot CLI preserves duplicate selection and ineligible primary diagnostics without fallback', async t => {
  const context = projectProviderContext(fixtureContext('upward', 'BTC-USDT', NOW));
  const original = selected(context), catalog = createSelectionCatalog(context);
  for (const [expected, output] of [
    ['duplicate_selection', { selectedClaimIds: [...original.selectedClaimIds, ...original.selectedClaimIds] }],
    ['ineligible_primary', { selectedClaimIds: [catalog.entries.find(e => e.selectable && !e.primaryEligible).claimId] }],
  ]) await t.test(expected, async t => {
    const opts = setup(t);
    opts.transport = mockTransport({ output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
    const report = await executePilot(run('aligned'), opts);
    assert.equal(report.results[0].code, expected); assert.equal(report.counters.validationFailures, 1);
    assert.equal(report.budgetAfter.pilot.settled, 1620000); assert.equal(report.counters.actualHttpAttempts, 1);
    assert.deepEqual(JSON.parse(json(join(dirname(report.report), 'reply.json')).json), output);
  });
});

test('pilot CLI refusal/incomplete/unknown identity retain distinct status and accounting', async t => {
  for (const [expected, changes, knownUsage] of [
    ['refusal', { output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'mock-only' }] }] }, true],
    ['incomplete', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }, true],
    ['model_mismatch', { model: 'other-model' }, false],
    ['configuration_mismatch', { reasoning: { effort: 'high' } }, false],
    ['invalid_usage', { usage: null }, false],
  ]) await t.test(expected, async t => {
    const opts = setup(t), report = await executePilot(run('aligned'), { ...opts, transport: mockTransport(changes) });
    assert.equal(report.results[0].code, expected); assert.equal(report.counters.actualHttpAttempts, 1);
    assert.equal(report.budgetAfter.pilot.settled > 0, knownUsage);
    assert.equal(report.budgetAfter.unsettled.unknownCount, knownUsage ? 0 : 1);
    if (['refusal', 'incomplete'].includes(expected)) assert.equal(report.counters[expected], 1);
    else assert.equal(report.counters.validProviderResponses, 0);
  });
});

test('pilot CLI timeout and HTTP failure preserve unknown cost without copying error body or headers', async t => {
  for (const mode of ['timeout', 'http403']) await t.test(mode, async t => {
    const opts = setup(t);
    opts.transport = mode === 'timeout' ? () => new Promise(() => {}) : async () => new Response('DO_NOT_LOG_mock_secret', { status: 403, headers: { 'X-Debug': 'DO_NOT_LOG_mock_secret' } });
    const report = await executePilot(run('aligned'), { ...opts, timeoutMs: 5 });
    assert.equal(report.counters.actualHttpAttempts, 1); assert.equal(report.budgetAfter.unsettled.unknownCount, 1);
    assert.equal(report.counters.timeout, mode === 'timeout' ? 1 : 0); assert.equal(report.diagnosticStatus, 'no_reply');
    assert.equal(readFileSync(report.report, 'utf8').includes('DO_NOT_LOG'), false);
    assert.equal(report.budgetAfter.pilot.reserved, json(join(dirname(report.report), 'frozen.json')).case.maximumNano);
  });
});

test('pilot CLI no init/reset; unresolved reservation blocks and pre-send expiry differs from HTTP', async t => {
  const opts = setup(t), reservation = opts.ledger.reserve({ now: NOW, pilot: SYNTHETIC_PILOT_ID, maximumNano: 1000 });
  await assert.rejects(executePilot(run('aligned'), opts), /budget_recovery_required/);
  assert.equal(inspectPilotBudget(opts.ledger, NOW).unsettled.reservedNano, 1000);
  opts.ledger.unknown(reservation.id, NOW, 'mock_failure');
  let reads = 0;
  const report = await executePilot(run('aligned'), { ...opts, now: () => ++reads <= 4 ? NOW : NOW + 60000 });
  assert.equal(report.counters.actualHttpAttempts, 0); assert.equal(report.counters.reservationDelta, 1);
  assert.equal(report.results[0].code, 'context_expired'); assert.equal(report.budgetAfter.unsettled.unknownCount, 2);
  assert.equal(pilotExitCode(report), 1);
  assert.equal(report.budgetAfter.pilot.calls, 2);
});

test('pilot CLI diagnostics failure does not change original usage settlement or semantic outcome', async t => {
  const opts = setup(t), transport = mockTransport();
  opts.transport = async (...args) => {
    const runPath = join(opts.outputRoot, readdirSync(opts.outputRoot)[0]);
    mkdirSync(join(runPath, 'reply.json')); // 仅隔离目录制造诊断写入失败。
    return transport(...args);
  };
  const report = await executePilot(run('aligned'), opts);
  assert.equal(report.results[0].status, 'validated'); assert.equal(report.budgetAfter.pilot.settled, 1620000);
  assert.equal(report.diagnosticStatus, 'write_failed'); assert.equal(report.nextAction, 'STOP_FOR_GPT_REVIEW');
  assert.equal(pilotExitCode(report), 1);
});

test('pilot CLI budget rejection exits unsuccessfully with no HTTP or new reservation', async t => {
  const opts = setup(t);
  for (let i = 0; i < REAL_AI.pilotCalls; i++) {
    const old = opts.ledger.reserve({ now: NOW, pilot: SYNTHETIC_PILOT_ID, maximumNano: 1000 });
    opts.ledger.settle(old.id, { now: NOW, usageCostNano: 125, usage: { inputTokens: 1, outputTokens: 0 }, outcome: 'completed' });
  }
  const report = await executePilot(run('aligned'), opts);
  assert.equal(report.results[0].status, 'not_dispatched'); assert.equal(report.results[0].code, 'budget_exhausted');
  assert.equal(pilotExitCode(report), 1); assert.equal(report.counters.preDispatchRejections, 1);
  assert.equal(report.counters.actualHttpAttempts, 0); assert.equal(report.counters.reservationDelta, 0);
});

test('pilot CLI safe import under a populated environment has no main side effects or network fallback', () => {
  const script = `globalThis.fetch=()=>{throw new Error('TEST_FORBIDS_NETWORK')}; await import('./scripts/ai30b-pilot.mjs'); console.log('IMPORT_ONLY');`;
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--import', './tests/register-types.mjs', '--input-type=module', '-e', script], {
    cwd: resolve('.'), env: { ...process.env, OPENAI_API_KEY: 'mock-environment-only' }, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout.trim(), 'IMPORT_ONLY');
});
