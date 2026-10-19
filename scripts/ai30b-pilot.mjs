import { constants, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ProductBudget } from '../lib/ai/product-budget.mjs';
import { ACTIVE_PRODUCT_AI as REAL_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';
import { fixtureContext } from '../lib/ai/fixture.ts';
import { claimFor } from '../lib/ai/validation.ts';
import { createDeepSeekProvider } from '../lib/ai/deepseek-provider.ts';
import { createRealPilotService, preparePilotRequest } from '../lib/ai/real-service.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const CASES = Object.freeze([
  ['aligned', 'upward', 'BTC-USDT'], ['mixed', 'mixed', 'BTC-USDT'], ['relative_missing', 'relative_unavailable', 'ETH-USDT'],
  ['rms_not_direction', 'rms_lower', 'BTC-USDT'], ['transition', 'transition_available', 'BTC-USDT'],
  ['no_events', 'no_signals', 'BTC-USDT'], ['information_missing', 'information_absent', 'BTC-USDT'],
  ['stale', 'stale', 'BTC-USDT'], ['partial', 'partial', 'NVDA'], ['minute_unsupported', 'minute_unavailable', 'BTC-USDT'],
].map(row => Object.freeze(row)));

// 先解析白名单，再打开账本。旧整批执行和初始化入口均不可用。
export function parsePilotArgs(args) {
  let mode = 'inspect', caseId = null, billingConfirmed = false;
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error('duplicate_pilot_option');
    seen.add(arg);
    if (['--inspect', '--freeze', '--run', '--migrate-budget-profiles'].includes(arg)) {
      if ([...seen].filter(a => ['--inspect', '--freeze', '--run', '--migrate-budget-profiles'].includes(a)).length > 1) throw new Error('conflicting_pilot_modes');
      mode = arg.slice(2);
    } else if (arg === '--case') caseId = args[++i];
    else if (arg === '--deepseek-billing-bound-confirmed') billingConfirmed = true;
    else throw new Error('unknown_pilot_option');
  }
  if (['inspect', 'migrate-budget-profiles'].includes(mode) && (caseId !== null || billingConfirmed)) throw new Error('inspect_options_invalid');
  if (['freeze', 'run'].includes(mode) && !CASES.some(c => c[0] === caseId)) throw new Error('unknown_pilot_case');
  if (mode !== 'run' && billingConfirmed) throw new Error('billing_option_requires_run');
  return { mode, caseId, billingConfirmed };
}

export function inspectPilotBudget(ledger, now) {
  // 独立列明reserved与unknown；不清理、不退款、不更改原预算算法。
  const unsettled = ledger.db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN state='reserved' THEN 1 ELSE 0 END),0) AS reservedCount,
    COALESCE(SUM(CASE WHEN state='reserved' THEN reserved ELSE 0 END),0) AS reservedNano,
    COALESCE(SUM(CASE WHEN state='unknown' THEN 1 ELSE 0 END),0) AS unknownCount,
    COALESCE(SUM(CASE WHEN state='unknown' THEN reserved ELSE 0 END),0) AS unknownNano
    FROM requests`).get();
  return { ...ledger.inspect(now, SYNTHETIC_PILOT_ID), unsettled };
}

function sourceIdentity() {
  const git = args => execFileSync('git', args, { cwd: repository, windowsHide: true, maxBuffer: 512 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  return {
    candidateSha: git(['rev-parse', 'HEAD']).toString().trim(),
    cliSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    cliDiffSha256: sha256(git(['diff', 'HEAD', '--', 'scripts/ai30b-pilot.mjs'])),
    fixtureSha256: sha256(readFileSync(resolve(repository, 'lib/ai/fixture.ts'))),
    providerFiles: ['real-config.ts', 'deepseek-provider.ts', 'responses-transport.ts', 'real-service.ts', 'real-output.ts', 'claim-selection.ts', 'product-budget.mjs']
      .map(path => ({ path: `lib/ai/${path}`, sha256: sha256(readFileSync(resolve(repository, 'lib/ai', path))) })),
    caseDefinitionVersion: 'synthetic-cases-v1', caseDefinitionSha256: sha256(JSON.stringify(CASES)),
  };
}

const SAFE_CODES = new Set(['insufficient_context', 'context_expired', 'data_permission_unavailable', 'input_limit',
  'busy', 'budget_exhausted', 'budget_unavailable', 'disabled', 'cancelled', 'timeout', 'provider_error',
  'provider_access_denied', 'provider_http_error', 'rate_limited', 'transport_error', 'response_limit',
  'invalid_response', 'model_mismatch', 'billing_identity_unknown', 'invalid_usage', 'invalid_output', 'output_limit',
  'unsupported_claim', 'invalid_evidence_ref', 'duplicate_evidence', 'evidence_mismatch', 'missing_limitation',
  'missing_conflict', 'duplicate_claim', 'missing_primary', 'category_mismatch', 'refusal', 'incomplete', 'completed', 'failed',
  'configuration_mismatch', 'provider_credit_unavailable', 'budget_profile_migration_required', 'catalog_invalid',
  'invalid_selection_schema', 'duplicate_selection', 'unknown_selection', 'selection_not_applicable', 'ineligible_primary']);
const errorCode = e => SAFE_CODES.has(e?.code) ? e.code : 'pilot_error';

function writeEvidence(path, value, limit = 256 * 1024) {
  const serialized = JSON.stringify(value, null, 2);
  if (Buffer.byteLength(serialized) > limit) throw new Error('diagnostic_limit');
  // 每例新目录、每份文件只写一次；失败不改写以前的manifest/回复。
  writeFileSync(path, serialized, { flag: 'wx', mode: 0o600 });
}

/** 单次只解释一个原始场景。测试必须显式传入mock transport和隔离账本。 */
export async function executePilot(options, { ledger, outputRoot, key, transport, provenance, now = Date.now, timeoutMs = REAL_AI.timeoutMs }) {
  const definition = CASES.find(c => c[0] === options.caseId);
  if (!definition || !['run', 'freeze'].includes(options.mode)) throw new Error('unknown_pilot_case');
  if (options.mode === 'run') {
    if (!options.billingConfirmed) throw new Error('billing_bound_confirmation_required');
    if (!key) throw new Error('provider_not_configured');
    if (typeof transport !== 'function') throw new Error('transport_required');
  }
  const startedAt = now(), budgetBefore = inspectPilotBudget(ledger, startedAt);
  if (options.mode === 'run' && budgetBefore.active) throw new Error('budget_recovery_required');
  const [id, scenario, symbol] = definition;
  // 调用原fixture生成器，故意stale仍由原场景制造；不延长TTL或改旧Context时间。
  const context = fixtureContext(scenario, symbol, now()), prepared = preparePilotRequest(context, REAL_AI), { safe, request } = prepared;
  mkdirSync(outputRoot, { recursive: true });
  const output = mkdtempSync(resolve(outputRoot, `synthetic-${startedAt}-${id}-`)), runId = basename(output);
  const frozen = {
    runId, frozenAt: now(), pilot: SYNTHETIC_PILOT_ID, inputIdentity: 'synthetic', configuration: REAL_AI, provenance,
    billingBound: { feeMultiplier: ledger.feeMultiplier, profile: REAL_AI.billingProfile,
      confirmation: options.billingConfirmed ? 'deepseek_usd_peak_total_lte_2x_operator_attestation' : 'NOT_CONFIRMED', billedCost: null },
    budgetBefore, case: { id, scenario, symbol, context, contextSha256: sha256(JSON.stringify(context)), requestSha256: sha256(request.body),
      expected: safe.evidence.map(e => ({ id: e.id, availability: e.availability, classification: e.classification })),
      mandatoryLimitations: safe.limitations, forbidden: ['new_values', 'causality', 'forecast', 'trade_advice', 'history_win_rate'],
      maximumNano: Math.ceil(request.maximumBaseNano * ledger.feeMultiplier), maximumInputTokens: request.maximumInputTokens,
      catalog: request.selection, deterministicTemplate: safe.evidence.map(claimFor) },
  };
  writeEvidence(resolve(output, 'frozen.json'), frozen);
  if (options.mode === 'freeze') return { mode: 'offline_frozen', runId, manifest: resolve(output, 'frozen.json'), cases: 1, actualHttpAttempts: 0, budget: budgetBefore };

  const counters = { actualHttpAttempts: 0, httpResponses: 0, parsedProviderReplies: 0, validProviderResponses: 0,
    preDispatchRejections: 0, cacheHits: 0, success: 0, refusal: 0, incomplete: 0, timeout: 0, validationFailures: 0,
    selectionValidityPass: 0, illegalSelections: 0, organizationQualityFailures: 0, disclosureCompletenessPass: 0, disclosureFailures: 0 };
  const httpStatuses = [], accounting = [];
  let diagnosticStatus = 'no_reply';
  const observedLedger = {
    feeMultiplier: ledger.feeMultiplier,
    inspect: (...args) => ledger.inspect(...args),
    reserve: input => {
      const reservation = ledger.reserve(input);
      accounting.push({ operation: 'reserve', ...reservation });
      return reservation;
    },
    settle: (reservationId, input) => {
      const chargedBoundNano = ledger.settle(reservationId, input);
      accounting.push({ operation: 'settle', reservationId, usageCalculatedNano: input.usageCostNano, chargedBoundNano, outcome: input.outcome });
      return chargedBoundNano;
    },
    unknown: (reservationId, at, outcome) => { ledger.unknown(reservationId, at, outcome); accounting.push({ operation: 'unknown', reservationId, outcome }); },
  };
  const rawProvider = createDeepSeekProvider(key, async (...args) => {
    counters.actualHttpAttempts++;
    const response = await transport(...args);
    counters.httpResponses++; httpStatuses.push(response.status);
    return response;
  });
  const provider = { kind: rawProvider.kind, generate: async (...args) => {
    // 原HTTP适配器仍负责64KiB/usage/身份边界；不保存HTTP body、headers或异常正文。
    const reply = await rawProvider.generate(...args);
    counters.parsedProviderReplies++;
    if (!['invalid_response', 'model_mismatch', 'billing_identity_unknown', 'configuration_mismatch', 'failed'].includes(reply.status) && reply.responseId && reply.usage
      && reply.usage.inputTokens <= request.maximumInputTokens && reply.usage.outputTokens <= REAL_AI.outputTokens) counters.validProviderResponses++;
    if (reply.status === 'refusal') counters.refusal++;
    if (reply.status === 'incomplete') counters.incomplete++;
    try {
      writeEvidence(resolve(output, 'reply.json'), {
        responseId: reply.responseId, returnedModel: reply.returnedModel, returnedServiceTier: reply.returnedServiceTier,
        provider: reply.provider, billingProfile: reply.billingProfile, adapterVersion: reply.adapterVersion, failureReason: reply.failureReason,
        status: reply.status, usage: reply.usage, json: reply.json, receivedAt: now(), inputIdentity: 'synthetic',
      }, REAL_AI.responseBytes * 2);
      diagnosticStatus = 'saved';
    } catch { diagnosticStatus = 'write_failed'; } // 诊断I/O失败不能改变原服务计费/校验；停止后人工处理。
    return reply;
  } };
  const service = createRealPilotService(provider, observedLedger, { now, timeoutMs, profile: REAL_AI });
  let result;
  try {
    const interpretation = await service.interpretPrepared(prepared);
    const selection = interpretation.output;
    if (selection.selectionValidity === 'PASS') counters.selectionValidityPass++;
    if (selection.disclosureCompleteness === 'PASS') counters.disclosureCompletenessPass++;
    const qualityFailed = selection.modelOrganizationQuality !== 'PASS';
    const disclosureFailed = selection.disclosureCompleteness !== 'PASS';
    if (qualityFailed) counters.organizationQualityFailures++;
    if (disclosureFailed) counters.disclosureFailures++;
    if (!qualityFailed && !disclosureFailed && selection.selectionValidity === 'PASS') counters.success++;
    if (interpretation.cacheHit) counters.cacheHits++;
    result = { caseId: id, status: disclosureFailed ? 'disclosure_failed' : qualityFailed ? 'organization_failed' : 'validated', result: interpretation };
  } catch (e) {
    const code = errorCode(e);
    if (code === 'timeout') counters.timeout++;
    if (accounting.some(entry => entry.outcome === 'validation_failed')) { counters.validationFailures++; counters.illegalSelections++; }
    if (!counters.actualHttpAttempts) counters.preDispatchRejections++;
    result = { caseId: id, status: counters.actualHttpAttempts ? 'failed' : 'not_dispatched', code,
      selectionValidity: accounting.some(entry => entry.outcome === 'validation_failed') ? 'FAIL' : 'NOT RUN',
      modelOrganizationQuality: 'NOT RUN', disclosureCompleteness: 'NOT RUN',
      localDisclosures: !counters.actualHttpAttempts && code === 'insufficient_context' ? request.selection.systemRequired : undefined };
  } finally { service.stop(); }
  const endedAt = now(), budgetAfter = inspectPilotBudget(ledger, endedAt);
  const report = { runId, inputIdentity: 'synthetic', startedAt, endedAt, latencyMs: endedAt - startedAt,
    counters: { ...counters, cumulativeReservationsStart: budgetBefore.pilot.calls, cumulativeReservationsEnd: budgetAfter.pilot.calls,
      reservationDelta: budgetAfter.pilot.calls - budgetBefore.pilot.calls, ownReservations: accounting.filter(a => a.operation === 'reserve').length },
    httpStatuses, accounting, diagnosticStatus, results: [result], budgetBefore, budgetAfter, billedCost: null,
    quality: 'PENDING_GPT_REVIEW', realMarket: 'NOT RUN', production: 'DISABLED', nextAction: 'STOP_FOR_GPT_REVIEW' };
  writeEvidence(resolve(output, 'results.json'), report);
  return { runId, report: resolve(output, 'results.json'), ...report };
}

export function pilotExitCode(report) {
  if (report.diagnosticStatus === 'write_failed') return 1;
  const outcome = report.results?.[0];
  if (!outcome || outcome.status === 'validated') return 0;
  return outcome.caseId === 'stale' && outcome.status === 'not_dispatched' && outcome.code === 'insufficient_context' ? 0 : 1;
}

async function main() {
  const options = parsePilotArgs(process.argv.slice(2));
  // 根目录由脚本位置确定，所有worktree共用原账本；没有初始化/任意路径参数。
  const project = realpathSync(basename(dirname(repository)) === 'worktrees' ? dirname(dirname(repository)) : repository);
  const ledgerPath = resolve(project, 'data/local/ai-product-budget.sqlite');
  const ledger = new ProductBudget(ledgerPath, { feeMultiplier: 2 });
  try {
    if (options.mode === 'inspect') console.log(JSON.stringify({ mode: 'offline', model: REAL_AI.model, project, ledgerPath,
      accountAvailability: 'NOT RUN', budget: inspectPilotBudget(ledger, Date.now()) }));
    else if (options.mode === 'migrate-budget-profiles') {
      const before = inspectPilotBudget(ledger, Date.now());
      if (before.active) throw new Error('budget_recovery_required');
      const backupDir = mkdtempSync(resolve(project, 'data/local/ai-budget-before-profiles-'));
      const backup = resolve(backupDir, 'ai-product-budget.sqlite');
      // SQLite一致快照；保留原库/初始化标记，绝不恢复成零消耗。
      ledger.db.prepare('VACUUM INTO ?').run(backup);
      copyFileSync(`${ledgerPath}.initialized`, `${backup}.initialized`, constants.COPYFILE_EXCL);
      ledger.enableProviderProfiles();
      console.log(JSON.stringify({ mode: 'profiles_migrated', backup, before, after: inspectPilotBudget(ledger, Date.now()), requests: 0 }));
    }
    else {
      const result = await executePilot(options, { ledger, outputRoot: resolve(repository, 'outputs/ai30b'),
        key: options.mode === 'run' ? process.env.MARKET_RADAR_DEEPSEEK_API_KEY : undefined, transport: globalThis.fetch, provenance: sourceIdentity() });
      const outcome = result.results?.[0];
      console.log(JSON.stringify({ runId: result.runId, manifest: result.manifest, report: result.report, counters: result.counters,
        outcome: outcome ? { caseId: outcome.caseId, status: outcome.status, code: outcome.code } : undefined,
        quality: result.quality, budget: result.budgetAfter ?? result.budget, nextAction: result.nextAction }));
      process.exitCode = pilotExitCode(result);
    }
  } finally { ledger.close(); }
}

// 被测试导入时绝不读取Key/打开原账本/发请求；mock依赖由测试显式传入。
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main().catch(e => {
    const prerequisites = new Set(['duplicate_pilot_option', 'conflicting_pilot_modes', 'unknown_pilot_option', 'inspect_options_invalid',
      'unknown_pilot_case', 'billing_option_requires_run', 'billing_bound_confirmation_required', 'provider_not_configured', 'transport_required',
      'budget_recovery_required', 'budget_unavailable', 'budget_path_invalid', 'billing_bound_invalid']);
    console.error(prerequisites.has(e?.message) ? e.message : 'pilot_stopped: check saved local evidence; no automatic retry');
    process.exitCode = 1;
  });
}
