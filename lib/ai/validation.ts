import { AI_LIMITS, InterpretationError, OutputSchema, type Claim, type Evidence, type InterpretationOutput, type ProviderSafeContext } from "./contracts";

const classifications: Record<string, string> = { upward: "窗口偏上", downward: "窗口偏下", no_direction: "未形成明显单向结构", higher: "RMS相对参考窗口较高", lower: "RMS相对参考窗口较低；不等于低风险", similar: "与参考接近", stronger: "相对跑赢", underperforming: "相对跑输", mixed: "已有方向维度存在分歧", aligned: "已计算方向维度一致；不等于看涨", neutral: "已计算方向维度未显示一致偏向", changed: "相邻已发生窗口分类改变", unchanged: "相邻窗口分类未改变", up: "向上事件", down: "向下事件", flat: "无明确事件方向" };
/** 第一版封闭描述语言：模型选择已有证据，不自由改写金融结论。 */
export function claimFor(e: Evidence): Claim {
  const kind = e.availability !== "available" ? "limitation" : e.kind === "information" ? "information" : "observation";
  const label = e.id.replace(/^short\./, "短窗口 · ").replace(/^medium\./, "中窗口 · ").replace("direction", "方向").replace("volatility", "RMS").replace("relative", "相对表现").replace(".transition", "变化");
  const text = kind === "limitation" ? `${label} 暂不可判断（${e.availability}）：${e.detail}` : kind === "information" ? `已有官方项目/产品资料：${e.detail}；时间相关不证明价格因果` : `${label}：${e.classification ? classifications[e.classification] ?? e.classification : "已有报价"}`;
  return { kind, text, evidenceRefs: [e.id], metricRefs: e.metrics.map(m => `${e.id}:${m.id}`) };
}
export function requiredClaims(context: ProviderSafeContext) { return context.evidence.filter(e => e.availability !== "available").map(claimFor); }
export function validateOutput(raw: string, context: ProviderSafeContext): InterpretationOutput {
  if (new TextEncoder().encode(raw).length > AI_LIMITS.outputBytes) throw new InterpretationError("output_limit");
  let result: InterpretationOutput;
  try { result = OutputSchema.parse(JSON.parse(raw)); } catch { throw new InterpretationError("invalid_output"); }
  const index = new Map(context.evidence.map(e => [e.id, e]));
  if(index.size!==context.evidence.length)throw new InterpretationError("duplicate_evidence");
  for(const e of context.evidence)for(const m of e.metrics){
    const unit=m.id==="price"||m.id==="path"?context.asset.currency:m.id.endsWith("At")?"UTC_ms":m.id.includes("PercentagePoints")?"percentage_points":m.id.includes("Percent")?"%":"ratio";
    if(m.unit!==unit)throw new InterpretationError("unsupported_claim");
  }
  const claims = [result.summary, result.primaryObservation, ...result.supportingEvidence, ...result.conflictingEvidence, ...result.stateChange, ...result.historicalContext, ...result.informationContext, ...result.limitations];
  for (const claim of claims) {
    if (claim.evidenceRefs.length !== 1) throw new InterpretationError("unsupported_claim");
    const e = index.get(claim.evidenceRefs[0]);
    if (!e) throw new InterpretationError("invalid_evidence_ref");
    if (e.symbol !== context.asset.symbol || e.currency !== context.asset.currency || e.endAt > context.asOf || e.startAt > e.endAt) throw new InterpretationError("evidence_mismatch");
    const expected = claimFor(e);
    if (claim.text !== expected.text || claim.kind !== expected.kind || JSON.stringify(claim.metricRefs) !== JSON.stringify(expected.metricRefs)) throw new InterpretationError("unsupported_claim");
  }
  const used = [...new Set(claims.flatMap(c => c.evidenceRefs))].sort();
  if (JSON.stringify([...new Set(result.evidenceRefs)].sort()) !== JSON.stringify(used)) throw new InterpretationError("invalid_evidence_ref");
  for (const mandatory of requiredClaims(context)) if (!result.limitations.some(c => c.evidenceRefs[0] === mandatory.evidenceRefs[0])) throw new InterpretationError("missing_limitation");
  for(const [list,kind] of [[result.stateChange,"transition"],[result.historicalContext,"history"],[result.informationContext,"information"]] as const)if(list.some(c=>index.get(c.evidenceRefs[0])?.kind!==kind))throw new InterpretationError("category_mismatch");
  if(result.limitations.some(c=>c.kind!=="limitation")||result.conflictingEvidence.some(c=>index.get(c.evidenceRefs[0])?.kind!=="alignment"))throw new InterpretationError("category_mismatch");
  const mixed = context.evidence.find(e => e.kind === "alignment" && e.classification === "mixed" && e.availability === "available");
  if (mixed && !result.conflictingEvidence.some(c => c.evidenceRefs.includes(mixed.id))) throw new InterpretationError("missing_conflict");
  return result;
}
