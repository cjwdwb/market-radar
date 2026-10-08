"use client";
import { useState } from "react";
import type { Claim, MarketIntelligenceContext } from "@/lib/ai/contracts";
import type { InterpretationController } from "./use-interpretation";
import { interpretationErrors } from "./use-interpretation";

const time = (at: number) => new Date(at).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const metricLabels: Record<string, string> = { netPercent: "窗口净变化", efficiency: "路径效率", path: "价格路径", minimumNetPercent: "净变化门槛", minimumEfficiency: "效率门槛", currentRmsPercent: "当前RMS", baselineRmsPercent: "参考RMS", ratio: "RMS倍数", minimumBaselinePercent: "最小参考RMS", lowerRatio: "较低倍数边界", higherRatio: "较高倍数边界", price: "报价", deltaPercentagePoints: "相对差", assetReturnPercent: "资产收益", benchmarkReturnPercent: "基准收益", thresholdPercentagePoints: "相对边界" };
function ClaimText({claim}:{claim:Claim}){
  return <>{claim.text}{claim.evidenceRefs.map(id=><button className="ai-reference" key={id} aria-label={`核对证据 ${id}`} onClick={()=>{const target=document.getElementById(`ai-evidence-${encodeURIComponent(id)}`);const detail=target?.closest("details");if(detail)detail.open=true;target?.focus();}}>核对依据</button>)}</>;
}
export function AIInterpretation({ controller, context, onChart }: { controller: InterpretationController; context: MarketIntelligenceContext | null; onChart: () => void }) {
  const [scenario, setScenario] = useState("upward"), { result, phase } = controller;
  const busy = phase === "loading";
  return <details className="ai-interpretation" data-ai-symbol={controller.symbol}><summary>AI Interpretation <span>{result ? "演示结果" : "尚未启用真实模型"}</span></summary>
    <div className="ai-body"><p>解释已有事实、冲突与限制。当前真实模型未启用；本地开发演示使用独立合成资料。</p>
      <div className="ai-actions"><button className="btn" disabled={busy || !context} onClick={() => controller.generate(scenario)}>{busy ? "正在校验解释…" : result ? "重新查看演示" : "查看解释"}</button>{busy && <button className="btn" onClick={controller.cancel}>取消解释</button>}<button className="btn" onClick={onChart}>返回图表</button></div>
      {controller.mode === "fixture" && <label className="ai-scenario">合成场景<select value={scenario} onChange={e => setScenario(e.target.value)} disabled={busy}><option value="upward">窗口偏上</option><option value="downward">窗口偏下</option><option value="mixed">窗口分歧</option><option value="insufficient">样本不足</option><option value="stale">资料过期</option><option value="information_present">官方资料示例</option></select></label>}
      {controller.error && <p className="ai-feedback" role="status">{interpretationErrors[controller.error] ?? "解释未通过校验。"}{result && " 下方保留上次演示，不是本次请求成功。"}</p>}
      {!context && <p role="status">当前输入无法形成有界上下文，行情与原情报仍可查看。</p>}
      {result && <section className="ai-result" aria-label="解释演示结果" data-context-id={result.contextId}><div className="ai-result-heading"><strong>演示结果 / 未调用真实模型</strong><small>{result.cacheHit ? "使用有效演示缓存" : "合成 Provider · 已校验"}</small></div><p className="ai-summary">{result.output.summary.text}</p><p className="ai-basis">{result.context.asset.symbol} · {time(result.asOf)} · {result.status === "partial" ? "部分依据可用" : "依据可用"}；不解释当前实时行情。</p>
        <h4>主要观察</h4><p><ClaimText claim={result.output.primaryObservation}/></p>
        {result.output.conflictingEvidence.length > 0 && <><h4>冲突与分歧</h4><ul>{result.output.conflictingEvidence.map((c, i) => <li key={i}><ClaimText claim={c}/></li>)}</ul></>}
        <details><summary>支持证据与已有变化</summary><ul>{[...result.output.supportingEvidence, ...result.output.stateChange, ...result.output.informationContext].map((c, i) => <li key={i}><ClaimText claim={c}/></li>)}</ul></details>
        <h4>适用限制</h4><ul>{result.context.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul><p>{result.output.confidenceLanguage}</p>
        <details className="ai-evidence"><summary>核对窗口、指标与版本</summary>{result.context.evidence.map(e => <section tabIndex={-1} key={e.id} id={`ai-evidence-${encodeURIComponent(e.id)}`}><h4>{e.id} · {e.availability}</h4><p>{e.detail}</p><p>{time(e.startAt)} → {time(e.endAt)}</p><dl>{e.metrics.filter(m => !m.id.endsWith("At")).map(m => <div key={m.id}><dt>{metricLabels[m.id] ?? m.id}</dt><dd>{new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 10 }).format(m.value)} {m.unit}</dd></div>)}</dl>{e.provenance?.intervalMs&&<p>原生周期 {e.provenance.intervalMs/60000} 分钟 · {e.provenance.pointCount} 点 / {e.provenance.returnCount} 个收益</p>}{e.provenance?.baselineStartAt&&e.provenance.baselineEndAt&&<p>参考窗口 {time(e.provenance.baselineStartAt)} → {time(e.provenance.baselineEndAt)}</p>}{e.provenance?.benchmark&&<p>同步基准 {e.provenance.benchmark.symbol} · {e.provenance.benchmark.source} · {e.provenance.benchmark.currency} · {time(e.provenance.benchmark.evidenceEndAt)}</p>}<small>{e.source} · {e.currency} · {e.ruleVersion} · 数据版本 {e.dataVersion}</small></section>)}</details>
      </section>}
      <details className="ai-local-context"><summary>当前确定性上下文与外发限制</summary><p>仅本地组织当前资产数据；浏览器事实标为 client_declared，不作为服务端已验证事实，不外发真实行情。</p><ul>{context?.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul>{context?.evidence.filter(e=>e.kind==="information").map(e=><p key={e.id}>{e.detail} · {time(e.endAt)} · {e.source} · {e.dataVersion}</p>)}</details>
    </div>
  </details>;
}
