import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ProductBudget } from '../lib/ai/product-budget.mjs';
import { REAL_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';
import { fixtureContext } from '../lib/ai/fixture.ts';
import { projectProviderContext } from '../lib/ai/context.ts';
import { synthesisCatalog } from '../lib/ai/real-output.ts';
import { createOpenAIProvider, buildResponsesRequest } from '../lib/ai/openai-provider.ts';
import { createRealPilotService } from '../lib/ai/real-service.ts';

// 根目录由脚本位置确定；所有worktree共用同一账本，不接受用户/HTTP任意路径。
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = realpathSync(basename(dirname(repository)) === 'worktrees' ? dirname(dirname(repository)) : repository);
const data = resolve(project, 'data/local');
const args = process.argv.slice(2);
if (args.some(a => !['--initialize-budget', '--inspect', '--freeze', '--run', '--billing-bound-confirmed'].includes(a))) throw new Error('Unknown pilot option');
mkdirSync(data, { recursive: true });
const feeMultiplier = 2;
const ledger = new ProductBudget(resolve(data, 'ai-product-budget.sqlite'), { initialize: args.includes('--initialize-budget'), feeMultiplier });
try {
  if (!args.includes('--run') && !args.includes('--freeze')) {
    console.log(JSON.stringify({ mode: 'offline', model: REAL_AI.model, accountAvailability: 'NOT RUN', budget: ledger.inspect(Date.now(), SYNTHETIC_PILOT_ID) }));
  } else {
    // 预算授权不证明税费。操作者先核账户/税费上界；无确认不真实派发。
    if (args.includes('--run') && !args.includes('--billing-bound-confirmed')) throw new Error('billing_bound_confirmation_required');
    if (args.includes('--run') && !process.env.OPENAI_API_KEY) throw new Error('provider_not_configured');
    const now = Date.now(), runId = `synthetic-${now}`;
    const cases = [
      ['aligned', 'upward', 'BTC-USDT'], ['mixed', 'mixed', 'BTC-USDT'], ['relative_missing', 'relative_unavailable', 'ETH-USDT'],
      ['rms_not_direction', 'rms_lower', 'BTC-USDT'], ['transition', 'transition_available', 'BTC-USDT'],
      ['no_events', 'no_signals', 'BTC-USDT'], ['information_missing', 'information_absent', 'BTC-USDT'],
      ['stale', 'stale', 'BTC-USDT'], ['partial', 'partial', 'NVDA'], ['minute_unsupported', 'minute_unavailable', 'BTC-USDT'],
    ].map(([id, scenario, symbol]) => {
      const context = fixtureContext(scenario, symbol, now), safe = projectProviderContext(context), request = buildResponsesRequest(safe);
      return { id, scenario, symbol, context, fingerprint: createHash('sha256').update(request.body).digest('hex'),
        expected: safe.evidence.map(e => ({ id: e.id, availability: e.availability, classification: e.classification })),
        mandatoryLimitations: safe.limitations, forbidden: ['new_values', 'causality', 'forecast', 'trade_advice', 'history_win_rate'],
        maximumNano: Math.ceil(request.maximumBaseNano * feeMultiplier), catalog: synthesisCatalog(safe) };
    });
    const output = resolve(repository, 'outputs/ai30b', runId); mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, 'frozen.json'), JSON.stringify({ runId, frozenAt: now, pilot: SYNTHETIC_PILOT_ID, configuration: REAL_AI, cases }, null, 2));
    if (!args.includes('--run')) {
      console.log(JSON.stringify({ mode: 'offline_frozen', runId, manifest: resolve(output, 'frozen.json'), cases: cases.length, requests: 0, budget: ledger.inspect(Date.now(), SYNTHETIC_PILOT_ID) }));
    } else {
    const provider = createOpenAIProvider(process.env.OPENAI_API_KEY), service = createRealPilotService(provider, ledger);
    const results = [];
    const save = () => writeFileSync(resolve(output, 'results.json'), JSON.stringify({ runId, inputIdentity: 'synthetic', results, budget: ledger.inspect(Date.now(), SYNTHETIC_PILOT_ID), quality: 'PENDING_GPT_REVIEW', realMarket: 'NOT RUN', production: 'DISABLED' }, null, 2));
    // 顺序执行；第一个返回通过传输/计费/语义保护后才继续。失败保留并停止，无自动复测。
    for (const c of cases) {
      const start = Date.now();
      try {
        const result = await service.interpret(c.context);
        results.push({ caseId: c.id, status: 'validated', latencyMs: Date.now() - start, result }); save();
      } catch (e) {
        const code = e?.code ?? 'pilot_error';
        results.push({ caseId: c.id, status: code === 'insufficient_context' ? 'not_dispatched' : 'failed', code, latencyMs: Date.now() - start }); save();
        if (code !== 'insufficient_context') break;
      }
    }
    service.stop(); save();
    console.log(JSON.stringify({ runId, report: resolve(output, 'results.json'), dispatched: ledger.inspect(Date.now(), SYNTHETIC_PILOT_ID).pilot.calls, quality: 'PENDING_GPT_REVIEW', budget: ledger.inspect(Date.now(), SYNTHETIC_PILOT_ID) }));
    }
  }
} finally { ledger.close(); }
