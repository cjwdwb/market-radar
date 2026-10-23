"use client";
import { useId, useState } from "react";
import type { Claim, MarketIntelligenceContext } from "@/lib/ai/contracts";
import { isPrivateInterpretation, type PrivateInterpretation } from "@/lib/ai/private-contract";
import type { InterpretationController } from "./use-interpretation";
import { interpretationErrors } from "./use-interpretation";
import { evidenceId, evidenceLabel, visitEvidence, returnToCitation } from "./evidence-navigation";

const time = (at: number) => new Date(at).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const metricLabels: Record<string, string> = { netPercent: "窗口净变化", efficiency: "路径效率", path: "价格路径", minimumNetPercent: "净变化门槛", minimumEfficiency: "效率门槛", currentRmsPercent: "当前RMS", baselineRmsPercent: "参考RMS", ratio: "RMS倍数", minimumBaselinePercent: "最小参考RMS", lowerRatio: "较低倍数边界", higherRatio: "较高倍数边界", price: "报价", deltaPercentagePoints: "相对差", assetReturnPercent: "资产收益", benchmarkReturnPercent: "基准收益", thresholdPercentagePoints: "相对边界" };
export function ClaimText({ claim, scope }: { claim: Pick<Claim, "text" | "evidenceRefs">; scope: string }) {
  const [open, setOpen] = useState(false), instance = useId();
  const refs = [...new Set(claim.evidenceRefs)];
  return <>{claim.text}{refs.length > 0 && <span className="ai-citation"><button type="button" className="ai-reference" aria-expanded={open} aria-controls={instance} onClick={() => setOpen(value => !value)}>查看依据 · {refs.length}</button><span className="ai-reference-list" id={instance} hidden={!open} role="group" aria-label="此项观察的依据">{refs.map(id => <button type="button" key={id} onClick={event => visitEvidence(scope, id, event.currentTarget)} aria-label={`查看${evidenceLabel(id)}依据`}>{evidenceLabel(id)}<span aria-hidden="true"> ↗</span></button>)}</span></span>}</>;
}
export function Evidence({ context, scope }: { context: MarketIntelligenceContext; scope: string }) {
  return <details className="ai-evidence"><summary>核对窗口、指标与版本</summary>{context.evidence.map(e => <section tabIndex={-1} key={e.id} id={evidenceId(scope, e.id)}><h4>{evidenceLabel(e.id)} · {e.availability === "available" ? "依据可用" : "依据受限"}</h4><p>{e.detail}</p><p>{time(e.startAt)} → {time(e.endAt)}</p><dl>{e.metrics.filter(m => !m.id.endsWith("At")).map(m => <div key={m.id}><dt>{metricLabels[m.id] ?? m.id}</dt><dd>{new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 10 }).format(m.value)} {m.unit}</dd></div>)}</dl>{e.provenance?.methodId && <p>计算方法 {e.provenance.methodId}</p>}{e.provenance?.configId && <p>计算配置 {e.provenance.configId}</p>}{e.provenance?.quoteAt !== undefined && <p>报价时间 {time(e.provenance.quoteAt)}</p>}{e.provenance?.fetchedAt !== undefined && <p>报价取得时间 {time(e.provenance.fetchedAt)}</p>}{e.provenance?.historyFetchedAt !== undefined && <p>历史取得时间 {time(e.provenance.historyFetchedAt)}</p>}{e.provenance?.intervalMs && <p>原生周期 {e.provenance.intervalMs / 60000} 分钟 · {e.provenance.pointCount} 点 / {e.provenance.returnCount} 个收益</p>}{e.provenance?.baselineStartAt && e.provenance.baselineEndAt && <p>参考窗口 {time(e.provenance.baselineStartAt)} → {time(e.provenance.baselineEndAt)}</p>}{e.provenance?.benchmark && <p>同步基准 {e.provenance.benchmark.symbol} · {e.provenance.benchmark.source} · {e.provenance.benchmark.currency} · {time(e.provenance.benchmark.evidenceEndAt)}</p>}<small>{e.source} · {e.currency} · {e.ruleVersion} · 数据版本 {e.dataVersion}</small><details className="ai-evidence-identity"><summary>证据标识与可用性</summary><p>{e.id} · {e.availability}</p></details><button type="button" className="btn ai-evidence-return" onClick={() => returnToCitation(scope, e.id)}>返回引用</button></section>)}</details>;
}
export function Disclosures({ result, scope }: { result: Pick<PrivateInterpretation, "systemRequired" | "systemAdded">; scope: string }) {
  return <>
    {(["conflict", "limitation"] as const).map(category => {
      const rows = result.systemRequired.filter(d => d.category === category);
      const groups = [...new Set(rows.map(d => d.text))].map(text => ({ text, evidenceRefs: [...new Set(rows.filter(d => d.text === text).flatMap(d => d.evidenceRefs))] }));
      return groups.length > 0 && <div key={category}><h4>{category === "conflict" ? "冲突与分歧" : "理解前请注意"}</h4><ul>{groups.map((d, i) => <li key={i}><ClaimText claim={d} scope={scope} /></li>)}</ul></div>;
    })}
    <p className="ai-contribution">系统补齐 {result.systemAdded.length} 条说明，不计入模型贡献。模型价值尚未证明。</p>
    <details><summary>完整披露与系统补充（{result.systemRequired.length} 条）</summary><ul>{result.systemRequired.map(d => <li key={d.disclosureId}><strong>{d.disclosureId}</strong> · {d.category} · origin: {d.origin}{result.systemAdded.some(a => a.disclosureId === d.disclosureId) ? " · 系统补齐" : " · 系统必要披露"}<p><ClaimText claim={d} scope={scope} /></p><small>evidenceRefs: {d.evidenceRefs.join(", ") || "无"} · metricRefs: {d.metricRefs.join(", ") || "无"}</small></li>)}</ul></details>
  </>;
}
function PrivateResult({ result, scope }: { result: PrivateInterpretation; scope: string }) {
  return <section className="ai-result" data-evidence-scope={scope} aria-label="同快照解释对照" data-context-id={result.contextId} data-snapshot-id={result.snapshot.id}>
    <div className="ai-result-heading"><strong id={scope+"-heading"} tabIndex={-1}>原快照解读 · 本机私有试点</strong><small>{result.cacheHit ? "使用原快照缓存" : "DeepSeek · deepseek-flash · 已校验"}</small></div>
    <p className="ai-basis">{result.context.asset.symbol} · 原快照数据截至 {time(result.asOf)} · {result.status === "partial" ? "部分依据可用" : "依据可用"}</p>
    <p className="ai-basis">{result.oldSnapshot ? "服务端标记为旧快照；" : ""}仅解释这一份快照，不随页面行情更新。</p>
    <section className="ai-primary" aria-label="主要观察"><h4>主要观察</h4><ul>{result.modelSelection.sentences.map(c => <li key={c.claimId}><ClaimText claim={c} scope={scope} /></li>)}</ul></section><Disclosures result={result} scope={scope} /><details className="ai-evaluation"><summary>比较程序摘要与模型选择</summary><p>同一快照、同一事实目录。模型价值尚未证明（UNPROVEN）。</p>
    <section className="ai-comparison" aria-label="A 固定模板"><h4>程序摘要</h4><ul>{result.baseline.sentences.map(c => <li key={c.claimId}><ClaimText claim={c} scope={scope} /></li>)}</ul><p>{result.baseline.rationale}</p></section>
    <section className="ai-comparison" aria-label="B 模型选择"><h4>模型选择与顺序</h4><ul>{result.modelSelection.sentences.map(c => <li key={c.claimId}><ClaimText claim={c} scope={scope} /></li>)}</ul><p>仅展示模型选择的事实及顺序。</p></section>
    <section className="ai-comparison" aria-label="C 最终完整呈现"><h4>系统补齐后的最终呈现</h4><p>页面上方的主要观察，加上全部冲突与限制；系统补充不计作模型识别能力。</p></section></details>
    <details><summary>快照身份与校验记录</summary><p>快照取得于 {time(result.snapshot.capturedAt)}；有效期至 {time(result.snapshot.expiresAt)}。</p><p>snapshot: {result.snapshot.id} · context: {result.contextId} · catalog: {result.catalogId}</p><p>{result.snapshot.series.source} · {result.snapshot.series.exchange} · {result.snapshot.series.instrument} · {result.snapshot.series.marketType} · {result.snapshot.series.quote} · 原生 15 分钟 · UTC</p><p>inputIdentity: {result.inputIdentity} · inputTrust: {result.inputTrust} · deploymentMode: {result.deploymentMode}</p><p>事实选择 {result.selectionValidity} · 组织校验 {result.modelOrganizationQuality} · 披露完整性 {result.disclosureCompleteness} · 模型价值 {result.modelValue}</p><p>A 编号：{result.baseline.selectedClaimIds.join(", ")}<br />B/C 编号：{result.modelSelection.selectedClaimIds.join(", ")}</p><p>数据版本 {result.snapshot.dataVersion} · 政策版本 {result.snapshot.policyVersion} · 授权记录 {result.snapshot.authorizationId}</p></details>
    <Evidence context={result.context} scope={scope} />
  </section>;
}
export function AIInterpretation({ controller, context, onChart }: { controller: InterpretationController; context: MarketIntelligenceContext | null; onChart: () => void }) {
  const [scenario, setScenario] = useState("upward"), instance = useId(), { result, phase } = controller;
  const busy = phase === "loading", privateMode = controller.mode === "private_real", privateResult = result && isPrivateInterpretation(result) ? result : null;
  const fixtureResult = result && !isPrivateInterpretation(result) ? result : null;
  const scope = `${instance}-${encodeURIComponent(result?.contextId ?? "empty")}-${privateResult?.catalogId ?? "fixture"}-${result?.requestId ?? "empty"}`;
  const canGenerate = privateMode ? controller.connected && controller.gate === "ready" && controller.symbol === controller.allowedSymbol : controller.mode !== "fixture" || Boolean(context);
  return <details className="ai-interpretation" data-ai-symbol={controller.symbol} onToggle={event => { if (event.target === event.currentTarget && event.currentTarget.open && controller.mode === "unknown") void controller.discover(); }}><summary>AI 解读 <span>{privateResult ? "原快照解释" : fixtureResult ? "演示结果" : privateMode ? controller.gate === "blocked" ? "私有试点 · 准入受限" : "本机私有试点" : controller.mode === "unknown" ? "服务状态待检查" : controller.mode === "fixture" ? "合成演示" : "实时 AI 尚未启用"}</span></summary>
    <div className="ai-body"><p>{privateMode ? "解释服务端受控快照的事实、冲突与限制。仅手动生成，页面行情不会作为解释输入。" : controller.mode === "unknown" ? "展开后仅检查服务状态，不生成解释。行情与确定性状态继续可用。" : controller.mode === "fixture" ? "合成演示使用独立模拟资料，不解释当前真实行情。" : "实时模型尚未启用；行情与确定性状态继续可用。"}</p>
      {privateMode && <form className="ai-session" onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("session") as HTMLInputElement; const credential = input.value; input.value = ""; void controller.connectSession(credential); }}><label htmlFor={`${instance}-session`}>私有会话凭据</label><input id={`${instance}-session`} name="session" type="password" autoComplete="off" spellCheck={false} required maxLength={256} disabled={busy} aria-describedby={`${instance}-session-help`} /><button className="btn" type="submit" disabled={busy}>{controller.connected ? "重新连接" : "连接私有会话"}</button><small id={`${instance}-session-help`}>{controller.connected ? "会话已验证。" : "请输入本机服务提供的会话凭据。"}凭据仅保存在当前页面内存。</small></form>}
      <div className="ai-actions">{controller.mode !== "unconfigured" && <button className="btn" disabled={busy || !canGenerate} onClick={() => controller.mode === "unknown" ? controller.discover() : controller.generate(scenario)}>{busy ? controller.discovering ? "正在检查服务…" : "正在校验解释…" : privateMode ? result ? "查看新快照解释" : "查看快照解释" : result ? "重新查看演示" : controller.mode === "unknown" ? "检查解释服务" : "查看解释"}</button>}{busy && <button className="btn" onClick={controller.cancel}>取消解释</button>}<button className="btn" onClick={onChart}>返回图表</button></div>
      {controller.mode === "unconfigured" && <p className="ai-disabled-note">实时 AI 尚未启用。你可以查看上方确定性状态，或在历史工作区读取已保存的解释文件。</p>}
      {controller.mode === "fixture" && <label className="ai-scenario">合成场景<select value={scenario} onChange={e => setScenario(e.target.value)} disabled={busy}><option value="upward">窗口偏上</option><option value="downward">窗口偏下</option><option value="mixed">窗口分歧</option><option value="insufficient">样本不足</option><option value="stale">资料过期</option><option value="information_present">官方资料示例</option></select></label>}
      {controller.error && <p className="ai-feedback" role="status">{interpretationErrors[controller.error] ?? "解释未通过校验。"}{result && (privateResult ? ` 下方保留上次同资产结果，仍对应原快照 ${privateResult.snapshot.id}，不是本次请求成功。` : " 下方保留上次演示，不是本次请求成功。")}</p>}
      {privateMode && controller.symbol !== (controller.allowedSymbol || "BTC-USDT") && <p role="status">私有试点仅支持 BTC-USDT，请切换资产。</p>}
      {!privateMode && !context && <p role="status">当前输入无法形成有界上下文，行情与原情报仍可查看。</p>}
      {privateResult && <PrivateResult key={scope} result={privateResult} scope={scope} />}
      {fixtureResult && <section key={scope} className="ai-result" data-evidence-scope={scope} aria-label="解释演示结果" data-context-id={fixtureResult.contextId}><div className="ai-result-heading"><strong id={scope+"-heading"} tabIndex={-1}>演示结果 / 未调用真实模型</strong><small>{fixtureResult.cacheHit ? "使用有效演示缓存" : "合成 Provider · 已校验"}</small></div><p className="ai-summary">{fixtureResult.output.summary.text}</p><p className="ai-basis">{fixtureResult.context.asset.symbol} · {time(fixtureResult.asOf)} · {fixtureResult.status === "partial" ? "部分依据可用" : "依据可用"}；不解释当前实时行情。</p>
        <h4>主要观察</h4><p><ClaimText claim={fixtureResult.output.primaryObservation} scope={scope} /></p>
        {fixtureResult.output.conflictingEvidence.length > 0 && <><h4>冲突与分歧</h4><ul>{fixtureResult.output.conflictingEvidence.map((c, i) => <li key={i}><ClaimText claim={c} scope={scope} /></li>)}</ul></>}
        <details><summary>支持证据与已有变化</summary><ul>{[...fixtureResult.output.supportingEvidence, ...fixtureResult.output.stateChange, ...fixtureResult.output.informationContext].map((c, i) => <li key={i}><ClaimText claim={c} scope={scope} /></li>)}</ul></details>
        <h4>适用限制</h4><ul>{fixtureResult.context.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul><p>{fixtureResult.output.confidenceLanguage}</p>
        <Evidence context={fixtureResult.context} scope={scope} />
      </section>}
      {privateMode ? <details className="ai-local-context"><summary>本机快照与外发限制</summary><p>只由服务端核验来源用途、授权与有效期。浏览器只提交资产和快照编号；未获准时不取数、不外发。范围仅 BTC-USDT / OKX SPOT / USDT / UTC / 原生 15 分钟的方向与波动事实，不含相对表现、信号或资讯。</p></details> : <details className="ai-local-context"><summary>当前确定性上下文与外发限制</summary><p>仅本地组织当前资产数据；浏览器事实标为 client_declared，不作为服务端已验证事实，不外发真实行情。</p><ul>{context?.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul>{context?.evidence.filter(e => e.kind === "information").map(e => <p key={e.id}>{e.detail} · {time(e.endAt)} · {e.source} · {e.dataVersion}</p>)}</details>}
    </div>
  </details>;
}
