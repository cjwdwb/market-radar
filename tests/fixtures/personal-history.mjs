// Synthetic display-only fixture; no private record, real Provider or data fetch.
import { privateInterpretationFixture } from './ai30b-ui.mjs';
export function personalHistoryFixture(now = 1789372800000) {
  const original = privateInterpretationFixture(now), context = original.context;
  context.asset.symbol = 'BINANCE:SPOT:BTC-USDT';
  for (const e of context.evidence) { e.symbol = context.asset.symbol; e.source = 'Binance Vision / SPOT / BTCUSDT / 15m'; }
  const { provider, model, catalogId, baseline, modelSelection, systemRequired, systemAdded, versions, modelValue, selectionValidity, modelOrganizationQuality, disclosureCompleteness } = original;
  return { format: 'personal-history-interpretation-v1', inputIdentity: 'approved_real_historical', reconstruction: 'historical_simulation', vintage: 'current_vintage', provider, model, context, catalogId, generatedAt: now, retentionReviewAt: now + 30 * 86400000, baseline, modelSelection, systemRequired, systemAdded, versions, modelValue, selectionValidity, modelOrganizationQuality, disclosureCompleteness };
}
