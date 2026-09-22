"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { AssetStateV2, HorizonState, StateTransition, TransitionPoint, CloseWindow, AlignmentParticipant } from "@/lib/radar/asset-state-v2";

const number = new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 6 });
const time = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const at = (value: number) => time.format(value);
const windowText = (window: CloseWindow) => `${at(window.closeStartAt)} — ${at(window.closeEndAt)}`;
const horizonName = (horizon: HorizonState) => `${horizon.horizonId === "short" ? "短窗" : "中窗"} · ${horizon.durationMs / 60000} 分钟`;
const participantName: Record<AlignmentParticipant, string> = { "short.direction": "短窗方向", "medium.direction": "中窗方向", "short.relative": "短窗相对表现" };

/** Formats domain facts only; both surfaces receive the same selected-asset result. */
export function AssetStateSummary({ state, onOpen }: { state: AssetStateV2; onOpen?: () => void }) {
  const horizons = [state.horizons.short, state.horizons.medium];
  const end = state.horizons.short.evidence ?? state.horizons.medium.evidence;
  const limits = [...horizons.flatMap(horizon => [horizon.direction, horizon.volatility]), state.relative].filter(dimension => dimension.classification === null);
  return <section className="asset-state-summary" data-symbol={state.symbol} data-rule={state.ruleVersion} aria-label={`${state.symbol} 观测状态`}>
    <div className="asset-state-heading"><span className="context-label">观测状态</span>{onOpen && <button onClick={onOpen} className="state-detail-link">查看依据 <ArrowUpRight size={14} aria-hidden="true"/></button>}</div>
    <dl className="state-horizon-summary">
      {horizons.map(horizon => <div key={horizon.horizonId} data-horizon={horizon.horizonId}><dt>{horizonName(horizon)}</dt><dd>
        <span data-dimension={horizon.horizonId === "short" ? "direction" : "medium-direction"} data-availability={horizon.direction.availability}>{horizon.direction.label}</span>
        <small data-dimension={horizon.horizonId === "short" ? "volatility" : "medium-volatility"} data-availability={horizon.volatility.availability}>RMS · {horizon.volatility.label}</small>
      </dd></div>)}
      <div data-dimension="relative" data-availability={state.relative.availability} data-benchmark={state.relative.benchmarkSymbol ?? ""}><dt>短窗相对表现{state.relative.benchmarkSymbol && <> · {state.relative.benchmarkSymbol}</>}</dt><dd>{state.relative.label}{state.relative.metrics && <small className="numeric">差 {number.format(state.relative.metrics.deltaPercentagePoints)} 个百分点</small>}</dd></div>
    </dl>
    <p className="state-alignment" data-alignment={state.alignment.classification}>{state.alignment.label}</p>
    <p className="state-window">{end ? `${end.intervalMs / 60000} 分钟 K 线 · 截至 ${at(end.evidenceEndAt)} · 固定观测窗口` : "等待有效的连续完整 K 线"}</p>
    {[...new Set(limits.map(dimension => dimension.message))].map(message => <p className="state-limit" key={message}>{message}</p>)}
  </section>;
}

function HorizonReadout({ horizon }: { horizon: HorizonState }) {
  const direction = horizon.direction.metrics, volatility = horizon.volatility.metrics;
  return <div className="state-horizon-readout" data-horizon={horizon.horizonId}>
    <h4>{horizonName(horizon)}</h4><dl className="state-readout">
      <div><dt>方向结构</dt><dd><strong>{horizon.direction.label}</strong>{direction && <p className="numeric">净变化 {number.format(direction.netPercent)}% · 路径效率 {number.format(direction.efficiency)}</p>}{horizon.direction.classification === null && <p>{horizon.direction.message}</p>}</dd></div>
      <div><dt>RMS 波动</dt><dd><strong>{horizon.volatility.label}</strong>{volatility && <p className="numeric">当前 {number.format(volatility.currentRmsPercent)}% · 参考 {number.format(volatility.baselineRmsPercent)}%<br/>{volatility.ratio === null ? "倍数不可用" : `当前 / 基线 ${number.format(volatility.ratio)}×`}</p>}{horizon.volatility.classification === null && <p>{horizon.volatility.message}</p>}</dd></div>
    </dl>
  </div>;
}

function HorizonMethod({ horizon }: { horizon: HorizonState }) {
  const evidence = horizon.evidence, direction = horizon.direction.metrics, volatility = horizon.volatility.metrics;
  return <div className="state-horizon-method"><h4>{horizonName(horizon)} · {horizon.configId}</h4><dl>
    <div><dt>方向 · {horizon.direction.methodId}</dt><dd>{horizon.direction.message}{direction && <p>门槛：绝对净变化 ≥ {direction.minimumNetPercent}% 且路径效率 ≥ {direction.minimumEfficiency}</p>}</dd></div>
    <div><dt>波动 · {horizon.volatility.methodId}</dt><dd>{horizon.volatility.message}{volatility && <p>基线须大于 {volatility.minimumBaselinePercent}%；比值 ≥ {volatility.higherRatio} 为较高、≤ 2/3 为较低，其间为接近。</p>}</dd></div>
    {evidence && <><div><dt>收盘区间与样本</dt><dd>{windowText(evidence)}<br/>{evidence.intervalMs / 60000} 分钟 K 线 · {evidence.pointCount} 个收盘价 / {evidence.returnCount} 个收益率<br/>通过连续性检查 {evidence.validatedPointCount} 根；首根开盘 {at(evidence.firstCandleStartAt)}</dd></div>
      <div><dt>RMS 完整窗口</dt><dd>观测：{at(evidence.currentStartAt)} — {at(evidence.closeEndAt)}（{evidence.currentReturnCount} 段）<br/>参考：{at(evidence.baselineStartAt)} — {at(evidence.baselineEndAt)}（{evidence.baselineReturnCount} 段）<br/>观测与参考的收益段不重叠。</dd></div>
      <div><dt>来源与证据时间</dt><dd>{evidence.source} · {evidence.currency}<br/>完整 K 线截至 {at(evidence.evidenceEndAt)}<br/>报价 {at(evidence.quoteAt)}<br/>报价获取 {at(evidence.quoteFetchedAt)}<br/>历史获取 {at(evidence.historyFetchedAt)}</dd></div></>}
  </dl></div>;
}

function TransitionMetrics({ point }: { point: TransitionPoint }) {
  const m = point.metrics;
  if ("netPercent" in m) return <>净变化 {number.format(m.netPercent)}% · 路径效率 {number.format(m.efficiency)}；门槛 {m.minimumNetPercent}% / {m.minimumEfficiency}</>;
  if ("ratio" in m) return <>RMS 当前 {number.format(m.currentRmsPercent)}% / 参考 {number.format(m.baselineRmsPercent)}% · {m.ratio === null ? "倍数不可用" : `${number.format(m.ratio)}×`}</>;
  return <>资产 {number.format(m.assetReturnPercent)}% / 基准 {number.format(m.benchmarkReturnPercent)}% · 差 {number.format(m.deltaPercentagePoints)} 个百分点；门槛 ±{m.thresholdPercentagePoints} 个百分点</>;
}

function TransitionEvidence({ transition }: { transition: StateTransition }) {
  const title = `${transition.horizonId === "short" ? "短窗" : "中窗"} · ${{ direction: "方向", volatility: "RMS", relative: "相对表现" }[transition.dimension]}`;
  return <li data-transition={`${transition.horizonId}.${transition.dimension}`} data-status={transition.status}>
    <details className="state-transition-item"><summary><span><strong>{title}</strong><small>{transition.label}</small></span><ChevronDown size={16} aria-hidden="true"/></summary>
    <div className="state-transition-body">{transition.status !== "unavailable" && <p>{transition.message}</p>}
    {(["previous", "current"] as const).map(key => { const point = transition[key];return point && <div key={key}><span>{key === "previous" ? "前一窗口" : "当前窗口"}：{windowText(point.windows.observation)}</span><p className="numeric"><TransitionMetrics point={point}/></p>{point.windows.baseline && <p>该窗口参考：{windowText(point.windows.baseline)}</p>}<small>{point.methodId} · {point.configId} · {point.intervalMs / 60000} 分钟 K 线 · {point.source} · {point.currency}</small></div>;})}
    <p>移动步长 {transition.shiftMs / 60000} 分钟。{transition.overlapMessage}</p>
    </div></details>
    {transition.status === "unavailable" && <p className="state-transition-limit">{transition.message}</p>}
  </li>;
}

export function AssetStateEvidence({ state }: { state: AssetStateV2 }) {
  const relative = state.relative, evidence = relative.evidence;
  const transitions = [...Object.values(state.transitions.short), ...Object.values(state.transitions.medium)];
  return <section className="asset-state-evidence" aria-label="观测状态依据">
    <h3>观测状态依据</h3><p>固定观测窗口，不随图表周期改变。仅描述已发生的价格结构；较低波动不等于低风险。</p>
    <HorizonReadout horizon={state.horizons.short}/><HorizonReadout horizon={state.horizons.medium}/>
    <dl className="state-readout"><div><dt>短窗相对表现{relative.benchmarkSymbol && <> · {relative.benchmarkSymbol}</>}</dt><dd><strong>{relative.label}</strong>{relative.metrics && <p className="numeric">资产 {number.format(relative.metrics.assetReturnPercent)}% · 基准 {number.format(relative.metrics.benchmarkReturnPercent)}%<br/>相对差 {number.format(relative.metrics.deltaPercentagePoints)} 个百分点</p>}<p>{relative.message}</p></dd></div>
      <div><dt>状态关系</dt><dd><strong>{state.alignment.label}</strong><p>{state.alignment.message}</p>{state.alignment.missing.length > 0 && <ul className="state-missing-reasons">{state.alignment.missing.map(missing => <li key={missing.participant}><span>{participantName[missing.participant]}：</span>{missing.message}</li>)}</ul>}</dd></div>
    </dl>
    <details className="state-method-details"><summary>计算方法、窗口与来源</summary>
      <HorizonMethod horizon={state.horizons.short}/><HorizonMethod horizon={state.horizons.medium}/>
      <h4>相对窗口 · {relative.methodId}</h4><p>{relative.message}</p>
      {relative.metrics && <p>门槛：差值 ≥ {relative.metrics.thresholdPercentagePoints} 个百分点为跑赢，≤ −{relative.metrics.thresholdPercentagePoints} 为落后，其间为接近。差值不是 alpha 或相对财富比。</p>}
      {evidence && <dl><div><dt>精确配对</dt><dd>{windowText(evidence)}<br/>{evidence.intervalMs / 60000} 分钟 · {evidence.pointCount} 个配对点 / {evidence.returnCount} 段收益 · {evidence.configId}<br/>双方最新完整收盘相同，窗口内部无缺失配对。</dd></div>
        {[evidence.asset, evidence.benchmark].map(side => <div key={side.symbol}><dt>{side.symbol}</dt><dd>{side.source} · {side.currency}<br/>最新完整收盘 {at(side.latestEndAt)}<br/>报价 {at(side.quoteAt)} · 报价获取 {at(side.quoteFetchedAt)}<br/>历史获取 {at(side.historyFetchedAt)}</dd></div>)}
      </dl>}
      <h4>关系参与范围 · {state.alignment.methodId}</h4><ul>{state.alignment.evaluated.map(item => <li key={item.participant}>{participantName[item.participant]}：{windowText(item)} · {item.methodId}</li>)}</ul>
      <p>波动仅提供背景，不参与方向判断。时间窗可共享数据，不是独立统计确认；相对表现仅覆盖短窗。</p>
      <p>规则 {state.ruleVersion} · 描述性门槛，未经预测准确率校准。保留最新连续片段，不拼接午休或隔夜；交易时段与来源仅由现有行情元数据核对，非逐根历史认证。</p>
    </details>
    <details className="state-transition-details"><summary>前后窗口比较</summary><p>基于当前取得的历史数据回看重算，不是当时在线观测记录。不同分类不代表知道精确变化时刻；历史修订也可能改变结果。</p><ul>{transitions.map(transition => <TransitionEvidence key={`${transition.horizonId}.${transition.dimension}`} transition={transition}/>)}</ul></details>
  </section>;
}
