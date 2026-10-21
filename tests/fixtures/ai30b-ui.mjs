// Offline browser fixture only: no keys, network, permission grant or Provider invocation.
export function privateInterpretationFixture(now = 1789372800000, sequence = 1) {
  const identity = `fixture-private-${sequence}`, catalogId = sequence.toString(16).padStart(64, '0');
  const evidence = [
    ['short.direction', 'direction', 'upward', 90, [{ id: 'netPercent', value: .4, unit: '%' }, { id: 'efficiency', value: .7, unit: 'ratio' }], '短窗方向偏上（合成资料）。'],
    ['medium.direction', 'direction', 'downward', 180, [{ id: 'netPercent', value: -.6, unit: '%' }, { id: 'efficiency', value: .6, unit: 'ratio' }], '中窗方向偏下（合成资料）。'],
    ['short.volatility', 'rms', 'lower', 90, [{ id: 'currentRmsPercent', value: .1, unit: '%' }, { id: 'baselineRmsPercent', value: .2, unit: '%' }, { id: 'ratio', value: .5, unit: 'ratio' }], '短窗 RMS 较低；不等于低风险。'],
    ['medium.volatility', 'rms', 'similar', 180, [{ id: 'currentRmsPercent', value: .2, unit: '%' }, { id: 'baselineRmsPercent', value: .2, unit: '%' }, { id: 'ratio', value: 1, unit: 'ratio' }], '中窗 RMS 接近参考窗口。'],
  ].map(([id, kind, classification, minutes, metrics, detail]) => ({ id, symbol: 'BTC-USDT', kind, classification, metrics, detail,
    source: 'OKX 欧易', currency: 'USDT', ruleVersion: 'fixture-state-v2', dataVersion: `${identity}-data`, startAt: now - minutes * 60000, endAt: now, availability: 'available',
    provenance: { intervalMs: 900000, pointCount: minutes / 15 + 1, returnCount: minutes / 15, methodId: 'fixture-method', configId: 'fixture-config', currentStartAt: now - minutes * 60000 } }));
  const context = { schemaVersion: 'market-context-v1', contextId: `${identity}-context`, capturedAt: now, asOf: now, asset: { symbol: 'BTC-USDT', market: 'crypto', currency: 'USDT' }, trust: 'controlled',
    ruleVersion: 'fixture-state-v2', projectionVersion: 'inference-projection-v1', evidence, limitations: ['仅用于隔离页面测试，不是真实市场验收。', '不支持真实分钟历史研究，不提供预测。'], clipped: 0,
    minuteHistoricalResearch: { availability: 'unsupported', reason: 'real_minute_research_not_verified' }, dailyPosition: 'not_computed' };
  const baseline = { claimId: `${catalogId}:c0`, text: '短窗方向偏上，观察限于固定的 90 分钟窗口。', evidenceRefs: ['short.direction'], metricRefs: ['short.direction:netPercent'] };
  const selected = [
    { claimId: `${catalogId}:c1`, text: '短窗偏上、中窗偏下，两个窗口存在分歧。', evidenceRefs: ['short.direction', 'medium.direction'], metricRefs: ['short.direction:netPercent', 'medium.direction:netPercent'] },
    { claimId: `${catalogId}:c2`, text: '短窗 RMS 较低，不等于低风险。', evidenceRefs: ['short.volatility'], metricRefs: ['short.volatility:ratio'] },
  ];
  const disclosures = [
    { disclosureId: `${catalogId}:d0`, text: '短窗偏上、中窗偏下，两个窗口存在分歧。', evidenceRefs: ['short.direction', 'medium.direction'], metricRefs: [], category: 'conflict', origin: 'relationship:short-medium-direction' },
    ...context.limitations.map((text, index) => ({ disclosureId: `${catalogId}:d${index + 1}`, text, evidenceRefs: [], metricRefs: [], category: 'limitation', origin: `Context.limitations[${index}]` })),
  ];
  return { format: 'private-interpretation-v1', provider: 'deepseek', model: 'deepseek-flash', inputIdentity: 'approved_real', inputTrust: 'controlled', deploymentMode: 'local_pilot',
    contextId: context.contextId, requestId: `${identity}-request`, asOf: now, generatedAt: now, cacheHit: false, oldSnapshot: false,
    snapshot: { id: `${identity}-snapshot`, capturedAt: now, expiresAt: now + 60000, policyVersion: 'fixture-policy', authorizationId: 'fixture-authorization', dataVersion: `${identity}-data`,
      series: { source: 'OKX 欧易', exchange: 'OKX', instrument: 'BTC-USDT', marketType: 'SPOT', base: 'BTC', quote: 'USDT', intervalMs: 900000, timezone: 'UTC' } },
    context, catalogId, versions: { output: 'claim-selection-v1', catalog: 'scoped-catalog-v1', selection: 'strict-claim-ids-v1', prompt: 'bounded-id-selection-v1', validation: 'claim-selection-validation-v1', restoration: 'fixed-claim-restoration-v1', quality: 'fact-organization-v1', baseline: 'deterministic-catalog-v1' },
    baseline: { selectedClaimIds: [baseline.claimId], sentences: [baseline], rationale: '固定模板按既定顺序展示同目录事实。' }, modelSelection: { selectedClaimIds: selected.map(c => c.claimId), sentences: selected },
    systemRequired: disclosures, systemAdded: disclosures.slice(1), selectionValidity: 'PASS', modelOrganizationQuality: 'PASS', disclosureCompleteness: 'PASS', modelValue: 'UNPROVEN', status: 'success',
    usage: { inputTokens: 1, outputTokens: 1, usageIdentity: 'provider_reported', usageCalculatedNano: 1, budgetChargedBoundNano: 2, billedCost: null } };
}
