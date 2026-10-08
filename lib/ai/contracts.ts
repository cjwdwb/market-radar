import { z } from "zod";
import { AI_LIMITS } from "./limits";
export { AI_LIMITS } from "./limits";

export const AI_VERSIONS = Object.freeze({ context: "market-context-v1", projection: "inference-projection-v1", output: "interpretation-v1", validation: "evidence-validation-v1", prompt: "explain-facts-v1", generation: "fixture-config-v1" });
const text = z.string().min(1).max(400), id = z.string().min(1).max(180);
const at = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const AvailabilitySchema = z.enum(["available", "waiting", "insufficient", "unsupported", "invalid", "stale", "paused", "offline", "partial"]);
export const MetricSchema = z.object({ id, value: z.number().finite(), unit: z.string().max(40) }).strict();
export const ProvenanceSchema = z.object({
  methodId: id.optional(), configId: id.optional(), quoteAt: at.optional(), fetchedAt: at.optional(), historyFetchedAt: at.optional(),
  intervalMs: at.optional(), pointCount: at.optional(), returnCount: at.optional(), currentStartAt: at.optional(), baselineStartAt: at.optional(), baselineEndAt: at.optional(),
  benchmark: z.object({symbol:id, source:id, currency:text, quoteAt:at, fetchedAt:at, evidenceEndAt:at}).strict().optional(),
  confidence: z.enum(["high","medium","low"]).optional(), signalIds:z.array(id).max(8).optional(),
}).strict();
export const EvidenceSchema = z.object({
  id, symbol: id, kind: z.enum(["quote", "direction", "rms", "relative", "alignment", "transition", "signal", "information", "history", "limitation"]),
  source: id, currency: z.string().min(1).max(12), ruleVersion: id, dataVersion: id,
  startAt: at, endAt: at, availability: AvailabilitySchema, classification: z.enum(["upward", "downward", "no_direction", "higher", "lower", "similar", "stronger", "underperforming", "mixed", "aligned", "neutral", "insufficient", "changed", "unchanged", "unavailable", "up", "down", "flat", "official_product_fact"]).nullable(),
  metrics: z.array(MetricSchema).max(12), detail: text, provenance: ProvenanceSchema.optional(),
}).strict();
export const ContextSchema = z.object({
  schemaVersion: z.literal(AI_VERSIONS.context), contextId: id, capturedAt: at, asOf: at,
  asset: z.object({ symbol: id, market: z.enum(["crypto", "us", "cn", "hk"]), currency: z.string().min(1).max(12) }).strict(),
  trust: z.enum(["client_declared", "controlled", "fixture"]), ruleVersion: id,
  evidence: z.array(EvidenceSchema).max(40), limitations: z.array(text).min(1).max(24), clipped: z.number().int().min(0).max(10000),
  minuteHistoricalResearch: z.object({ availability: z.literal("unsupported"), reason: z.literal("real_minute_research_not_verified") }).strict(),
  dailyPosition: z.literal("not_computed"),
}).strict();
export type MarketIntelligenceContext = z.infer<typeof ContextSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type ProviderSafeContext = MarketIntelligenceContext & { projectionVersion: typeof AI_VERSIONS.projection };

export const ClaimSchema = z.object({ kind: z.enum(["observation", "limitation", "information"]), text: z.string().min(1).max(600), evidenceRefs: z.array(id).min(1).max(4), metricRefs: z.array(id).max(12) }).strict();
export type Claim = z.infer<typeof ClaimSchema>;
export const OutputSchema = z.object({
  summary: ClaimSchema, primaryObservation: ClaimSchema,
  supportingEvidence: z.array(ClaimSchema).max(12), conflictingEvidence: z.array(ClaimSchema).max(12),
  stateChange: z.array(ClaimSchema).max(5), historicalContext: z.array(ClaimSchema).max(3), informationContext: z.array(ClaimSchema).max(4),
  limitations: z.array(ClaimSchema).min(1).max(24), confidenceLanguage: z.literal("仅解释所列证据，不提供资产置信分数或预测"), evidenceRefs: z.array(id).min(1).max(40),
}).strict();
export type InterpretationOutput = z.infer<typeof OutputSchema>;
export const ResultSchema = z.object({
  requestId: id, contextId: id, asOf: at, generatedAt: at, provider: z.literal("fixture"), model: z.literal("deterministic-fixture-v1"),
  promptVersion: z.literal(AI_VERSIONS.prompt), outputVersion: z.literal(AI_VERSIONS.output), validationVersion: z.literal(AI_VERSIONS.validation),
  demonstration: z.literal(true), cacheHit: z.boolean(), status: z.enum(["success", "partial"]),
  usage: z.object({inputTokens: at.nullable(), outputTokens: at.nullable(), simulated: z.literal(true), billedCost: z.null()}).strict(),
  context: ContextSchema.extend({projectionVersion:z.literal(AI_VERSIONS.projection)}), output: OutputSchema,
}).strict();
export type InterpretationResult = z.infer<typeof ResultSchema>;
export class InterpretationError extends Error {
  code: string;
  constructor(code: string) { super(code); this.name = "InterpretationError"; this.code = code; }
}
export function boundedJson(value: unknown, max: number = AI_LIMITS.inputBytes) {
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).length > max) throw new InterpretationError("input_limit");
  return serialized;
}
// 摘要只作缓存身份，绝不充当来源认证；缓存还绑定完整规范事实，避免摘要碰撞升权。
export function factId(value: unknown) {
  const serialized = JSON.stringify(value); let a = 2166136261, b = 5381;
  for (let i = 0; i < serialized.length; i++) { a = Math.imul(a ^ serialized.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ serialized.charCodeAt(i); }
  return `${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
}
