import { z } from "zod";
import { AI_VERSIONS, ContextSchema, InterpretationError, type InterpretationResult } from "./contracts";

// Browser-safe display contract: no Node, provider request, raw bars or permission objects.
const id = z.string().min(1).max(180), at = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
// Composite catalog sentences retain every reference: at most 4 evidence × 12 metrics.
const sentence = z.object({ claimId: id, text: z.string().min(1).max(600), evidenceRefs: z.array(id).max(4), metricRefs: z.array(id).max(48) }).strict();
const disclosure = z.object({ disclosureId: id, text: z.string().min(1).max(600), evidenceRefs: z.array(id).max(4), metricRefs: z.array(id).max(48), category: z.enum(["conflict", "limitation"]), origin: z.string().max(240) }).strict();
export const PRIVATE_AI_TIMEOUT_MS = 60_000;
export const PrivateInterpretationSchema = z.object({
  format: z.literal("private-interpretation-v1"), provider: z.literal("deepseek"), model: z.literal("deepseek-flash"),
  inputIdentity: z.literal("approved_real"), inputTrust: z.literal("controlled"), deploymentMode: z.literal("local_pilot"),
  contextId: id, requestId: id, asOf: at, generatedAt: at, cacheHit: z.boolean(), oldSnapshot: z.boolean(),
  snapshot: z.object({ id, capturedAt: at, expiresAt: at, policyVersion: id, authorizationId: id, dataVersion: id,
    series: z.object({ source: z.literal("OKX 欧易"), exchange: z.literal("OKX"), instrument: z.literal("BTC-USDT"), marketType: z.literal("SPOT"), base: z.literal("BTC"), quote: z.literal("USDT"), intervalMs: z.literal(900000), timezone: z.literal("UTC") }).strict() }).strict(),
  context: ContextSchema.extend({ trust: z.literal("controlled"), projectionVersion: z.literal(AI_VERSIONS.projection) }),
  catalogId: id, versions: z.object({ output: z.literal("claim-selection-v1"), catalog: z.literal("scoped-catalog-v1"), selection: z.literal("strict-claim-ids-v1"), prompt: z.literal("bounded-id-selection-v1"), validation: z.literal("claim-selection-validation-v1"), restoration: z.literal("fixed-claim-restoration-v1"), quality: z.literal("fact-organization-v1"), baseline: z.literal("deterministic-catalog-v1") }).strict(),
  baseline: z.object({ selectedClaimIds: z.array(id).min(1).max(3), sentences: z.array(sentence).min(1).max(3), rationale: z.string().max(600) }).strict(),
  modelSelection: z.object({ selectedClaimIds: z.array(id).min(1).max(3), sentences: z.array(sentence).min(1).max(3) }).strict(),
  systemRequired: z.array(disclosure).max(64), systemAdded: z.array(disclosure).max(64),
  selectionValidity: z.literal("PASS"), modelOrganizationQuality: z.literal("PASS"), disclosureCompleteness: z.literal("PASS"),
  modelValue: z.literal("UNPROVEN"), status: z.enum(["success", "partial"]),
  usage: z.object({ inputTokens: at, outputTokens: at, usageIdentity: z.literal("provider_reported"), usageCalculatedNano: at, budgetChargedBoundNano: at, billedCost: z.null() }).strict(),
}).strict();
export type PrivateInterpretation = z.infer<typeof PrivateInterpretationSchema>;
export type DisplayInterpretation = InterpretationResult | PrivateInterpretation;
export function isPrivateInterpretation(value: DisplayInterpretation): value is PrivateInterpretation { return "format" in value && value.format === "private-interpretation-v1"; }

/** Validate bounded transport and references, not regenerate the server-owned claim catalog in a browser. */
export function parsePrivateInterpretation(input: unknown): PrivateInterpretation {
  const result = PrivateInterpretationSchema.parse(input), c = result.context;
  const fail = () => { throw new InterpretationError("invalid_output"); };
  if (result.contextId !== c.contextId || result.asOf !== c.asOf || result.snapshot.capturedAt !== c.capturedAt || c.asset.symbol !== "BTC-USDT" || c.asset.currency !== "USDT" || c.asset.market !== "crypto" || result.snapshot.expiresAt <= c.capturedAt || result.generatedAt < c.capturedAt) fail();
  const index = new Map(c.evidence.map(e => [e.id, e]));
  if (!/^[a-f0-9]{64}$/.test(result.catalogId)) fail();
  const claimIdentity = new RegExp(`^${result.catalogId}:c(?:0|[1-9][0-9]{0,3})$`), disclosureIdentity = new RegExp(`^${result.catalogId}:d(?:0|[1-9][0-9]{0,3})$`);
  if (index.size !== c.evidence.length || c.evidence.some(e => e.symbol !== c.asset.symbol || e.currency !== c.asset.currency || !["direction", "rms"].includes(e.kind) || (e.source !== result.snapshot.series.source && !(e.availability !== "available" && e.source === "unavailable")) || e.provenance?.benchmark || e.endAt > c.asOf || e.startAt > e.endAt)) fail();
  for (const section of [result.baseline, result.modelSelection]) {
    if (new Set(section.selectedClaimIds).size !== section.selectedClaimIds.length || JSON.stringify(section.selectedClaimIds) !== JSON.stringify(section.sentences.map(s => s.claimId))) fail();
    if (section.sentences.some(s => !s.evidenceRefs.length || !claimIdentity.test(s.claimId))) fail();
  }
  const required = new Map(result.systemRequired.map(d => [d.disclosureId, d]));
  if (required.size !== result.systemRequired.length || result.systemRequired.some(d => !disclosureIdentity.test(d.disclosureId)) || new Set(result.systemAdded.map(d => d.disclosureId)).size !== result.systemAdded.length || result.systemAdded.some(d => JSON.stringify(required.get(d.disclosureId)) !== JSON.stringify(d))) fail();
  for (const s of [...result.baseline.sentences, ...result.modelSelection.sentences, ...result.systemRequired]) {
    if (new Set(s.evidenceRefs).size !== s.evidenceRefs.length || s.evidenceRefs.some(ref => !index.has(ref)) || s.metricRefs.some(ref => !s.evidenceRefs.some(eid => index.get(eid)?.metrics.some(m => `${eid}:${m.id}` === ref)))) fail();
  }
  if (new TextEncoder().encode(JSON.stringify(result)).length > 65536) fail();
  return result;
}
