/** Reviewed source decision, not a client-supplied allowed flag or a production switch. */
export const REAL_CONTEXT_SERIES = Object.freeze({ source: "OKX 欧易", exchange: "OKX" as const, instrument: "BTC-USDT" as const, marketType: "SPOT" as const, base: "BTC" as const, quote: "USDT" as const, intervalMs: 900000 as const, timezone: "UTC" as const });
export const REAL_CONTEXT_POLICY = Object.freeze({
  version: "okx-private-context-review-2026-10-19", reviewedAt: "2026-10-19", termsUpdatedAt: "2026-07-28",
  evidence: "https://www.okx.com/help/okx-api-agreement", clause: "9.4(c)",
  acquisitionForThisEvaluation: "DENIED", thirdPartyInferenceForThisEvaluation: "DENIED", evidenceRetention: "UNKNOWN", privateDisplay: "UNKNOWN", publicMarketDataDisplay: "DENIED",
  reason: "现行条款限制使用行情评估拟向第三方提供的AI系统；本产品试点尚未取得适用例外许可。",
  retentionDaysProposed: 30,
});
export type RealContextGrant = Readonly<{ authorizationId: string; policyVersion: string; sourceEvidence: string; userAuthorizationEvidence: string; retentionDays: 30; approvedAt: number; revoked: boolean }>;
// No browser, environment variable, uploaded package or generic development Key can override this decision.
// Replace only after source-use evidence AND specific user authorization have been reviewed in this task.
export function approvedRealContextGrant(): RealContextGrant | null { return null; }
