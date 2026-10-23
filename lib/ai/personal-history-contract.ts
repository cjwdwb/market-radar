import { z } from "zod";
import { AI_VERSIONS, ContextSchema } from "./contracts";
import { PrivateInterpretationSchema } from "./private-contract";

const shared = PrivateInterpretationSchema.shape;
const at = z.number().int().nonnegative().max(8640000000000000);
// 仅供已保存历史解释阅读；不扩展实时准入，不携带派发权、密钥或原始请求。
export const PersonalHistorySchema = z.object({
  format: z.literal("personal-history-interpretation-v1"),
  inputIdentity: z.literal("approved_real_historical"), reconstruction: z.literal("historical_simulation"), vintage: z.literal("current_vintage"),
  provider: z.literal("deepseek"), model: z.literal("deepseek-flash"),
  context: ContextSchema.extend({ trust: z.literal("controlled"), projectionVersion: z.literal(AI_VERSIONS.projection) }), catalogId: z.string().regex(/^[a-f0-9]{64}$/),
  generatedAt: at, retentionReviewAt: at,
  baseline: shared.baseline, modelSelection: shared.modelSelection,
  systemRequired: shared.systemRequired, systemAdded: shared.systemAdded,
  versions: shared.versions, modelValue: z.literal("UNPROVEN"),
  selectionValidity: z.literal("PASS"), modelOrganizationQuality: z.literal("PASS"), disclosureCompleteness: z.literal("PASS"),
}).strict();
export type PersonalHistory = z.infer<typeof PersonalHistorySchema>;
export function parsePersonalHistory(input: unknown): PersonalHistory {
  const data = PersonalHistorySchema.parse(input), c = data.context;
  const fail = () => { throw Error("saved_result_invalid"); };
  if (new TextEncoder().encode(JSON.stringify(data)).length > 65536 || c.asset.symbol !== "BINANCE:SPOT:BTC-USDT" || c.asset.currency !== "USDT" || c.asset.market !== "crypto" || c.trust !== "controlled" || c.asOf > c.capturedAt || c.capturedAt > data.generatedAt || data.retentionReviewAt <= data.generatedAt) fail();
  const entries = new Map(c.evidence.map(e => [e.id, e]));
  if (c.evidence.length !== 4 || entries.size !== 4 || ["short.direction", "short.volatility", "medium.direction", "medium.volatility"].some(id => !entries.has(id))) fail();
  if (c.evidence.some(e => e.symbol !== c.asset.symbol || e.currency !== c.asset.currency || e.source !== "Binance Vision / SPOT / BTCUSDT / 15m" || !["direction", "rms"].includes(e.kind) || e.provenance?.intervalMs !== 900000 || e.endAt !== c.asOf || e.startAt > e.endAt || e.provenance?.benchmark)) fail();
  // 文件是用户输入，引用结构可校验，但不据此认证其金融事实/来源声明。
  for (const e of c.evidence) {
    if (e.kind !== (e.id.endsWith(".direction") ? "direction" : "rms") || new Set(e.metrics.map(m => m.id)).size !== e.metrics.length) fail();
    const p = e.provenance;
    for (const t of [e.startAt, e.endAt, p?.quoteAt, p?.fetchedAt, p?.historyFetchedAt, p?.currentStartAt, p?.baselineStartAt, p?.baselineEndAt]) if (t !== undefined && !at.safeParse(t).success) fail();
  }
  if (![c.asOf, c.capturedAt].every(t => at.safeParse(t).success) || !data.systemRequired.some(d => d.category === "limitation")) fail();
  const claim = new RegExp(`^${data.catalogId}:c[0-9]+$`), disclosure = new RegExp(`^${data.catalogId}:d[0-9]+$`);
  for (const section of [data.baseline, data.modelSelection]) {
    if (new Set(section.selectedClaimIds).size !== section.sentences.length || JSON.stringify(section.selectedClaimIds) !== JSON.stringify(section.sentences.map(s => s.claimId)) || section.sentences.some(s => !claim.test(s.claimId) || !s.evidenceRefs.length)) fail();
  }
  const required = new Map(data.systemRequired.map(d => [d.disclosureId, d]));
  if (required.size !== data.systemRequired.length || data.systemRequired.some(d => !disclosure.test(d.disclosureId)) || new Set(data.systemAdded.map(d => d.disclosureId)).size !== data.systemAdded.length || data.systemAdded.some(d => JSON.stringify(d) !== JSON.stringify(required.get(d.disclosureId)))) fail();
  for (const sentence of [...data.baseline.sentences, ...data.modelSelection.sentences, ...data.systemRequired]) {
    if (new Set(sentence.evidenceRefs).size !== sentence.evidenceRefs.length || sentence.evidenceRefs.some(id => !entries.has(id)) || new Set(sentence.metricRefs).size !== sentence.metricRefs.length || sentence.metricRefs.some(ref => !sentence.evidenceRefs.some(id => entries.get(id)?.metrics.some(m => `${id}:${m.id}` === ref)))) fail();
  }
  return data;
}
