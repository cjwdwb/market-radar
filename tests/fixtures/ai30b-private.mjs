// Explicit offline test support. OKX labels exercise the production identity checks;
// all prices, grants, usage and replies below are invented and authorize no real source.
import '../../scripts/register-types.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';

export const PRIVATE_FIXTURE_NOW = Date.UTC(2026, 9, 19, 12);
export const PRIVATE_FIXTURE_SYMBOL = 'BTC-USDT';
export function privateFixtureGrant(now = PRIVATE_FIXTURE_NOW) {
  return { authorizationId: 'fixture-only-private-authorization', policyVersion: 'fixture-only-private-policy-v1', sourceEvidence: 'fixture-only:no-source-permission',
    userAuthorizationEvidence: 'fixture-only:no-user-real-authorization', retentionDays: 30, approvedAt: now - 1000, revoked: false };
}
export function privateFixtureSnapshot(now = PRIVATE_FIXTURE_NOW) {
  const symbol = PRIVATE_FIXTURE_SYMBOL, intervalMs = 900000;
  const points = Array.from({ length: 80 }, (_, i) => { const close = 100 + i * 0.1; return { time: now - (80 - i) * intervalMs, open: close, high: close, low: close, close, volume: 1, confirmed: true }; });
  return { symbols: [symbol], quotes: { [symbol]: { symbol, name: symbol, currency: 'USDT', source: 'OKX 欧易', price: points.at(-1).close,
    change: null, changePercent: null, previousClose: null, high: null, low: null, volume: null, timestamp: now, fetchedAt: now, points: [], timezone: 'UTC', session: 'open', delayMinutes: 0 } },
  histories: { [symbol]: { points, intervalMs, source: 'OKX 欧易', currency: 'USDT', fetchedAt: now } } };
}
export async function privateFixtureReply(body, changes = {}) {
  const [{ createSelectionCatalog }, { DEEPSEEK_AI }] = await Promise.all([import('../../lib/ai/claim-selection.ts'), import('../../lib/ai/real-config.ts')]);
  const input = JSON.parse(JSON.parse(body).input[0].content), catalog = createSelectionCatalog(input.context);
  assert.deepEqual(input.catalog.map(e => e.claimId), catalog.entries.map(e => e.claimId));
  return { status: 'completed', json: JSON.stringify({ selectedClaimIds: catalog.deterministicBaseline.selectedClaimIds }),
    usage: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100, cachedTokens: 0, reasoningTokens: 0 },
    provider: 'deepseek', returnedModel: DEEPSEEK_AI.model, returnedServiceTier: null, responseId: 'fixture-private-response',
    adapterVersion: DEEPSEEK_AI.adapterVersion, billingProfile: DEEPSEEK_AI.billingProfile, ...changes };
}
export async function createPrivateFixture(options = {}) {
  const [{ ProductBudget }, { createPrivateContextRuntime }] = await Promise.all([import('../../lib/ai/product-budget.mjs'), import('../../lib/ai/private-runtime.ts')]);
  let time = options.now ?? PRIVATE_FIXTURE_NOW, closed = false;
  const grant = options.grant ?? privateFixtureGrant(time), data = options.data ?? privateFixtureSnapshot(time), events = [], bodies = [], signals = [];
  const root = mkdtempSync(join(tmpdir(), 'mr-private-fixture-')), ledger = new ProductBudget(join(root, 'budget.sqlite'), { initialize: true });
  ledger.enableProviderProfiles(); ledger.enableRealContextBatch({ authorizationId: grant.authorizationId, policyVersion: grant.policyVersion, activatedAt: time });
  const provider = { kind: 'deepseek', async generate(body, signal) { bodies.push(body); signals.push(signal); return options.reply ? options.reply(body, signal) : privateFixtureReply(body); } };
  const record = (requestId, event, value) => { events.push({ requestId, event, value: structuredClone(value) }); options.record?.(requestId, event, value); };
  const runtime = createPrivateContextRuntime({ grant, loader: options.loader ?? (async () => data), now: () => time, provider, ledger, record });
  return { root, ledger, runtime, grant, data, events, bodies, signals, now: () => time, setNow(value) { time = value; },
    async result(scope = 'fixture-owner') { const snapshot = await runtime.snapshot(scope, PRIVATE_FIXTURE_SYMBOL, new AbortController().signal);
      return runtime.interpret(scope, PRIVATE_FIXTURE_SYMBOL, snapshot.snapshotId, new AbortController().signal); },
    close() { if (closed) return; closed = true; runtime.close(); ledger.close();
      const resolvedRoot = realpathSync(root);
      if (dirname(resolvedRoot) !== realpathSync(tmpdir()) || !basename(resolvedRoot).startsWith('mr-private-fixture-')) throw Error('unsafe_fixture_cleanup');
      rmSync(resolvedRoot, { recursive: true, force: true }); } };
}

/** Browser harness gets a real-schema DTO generated through only mocked dependencies. */
export async function privateInterpretationFixture(options = {}) {
  const fixture = await createPrivateFixture(options);
  try { return await fixture.result(); } finally { fixture.close(); }
}
