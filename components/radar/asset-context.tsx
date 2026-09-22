"use client";

import { ArrowUpRight, X } from "lucide-react";
import { displaySymbol } from "@/lib/market";
import type { AssetIntelligenceContext, RadarIntelligenceEvent } from "@/lib/radar/types";
import type { AssetState } from "@/lib/radar/asset-state";

const confidence = { high: "高可信", medium: "中可信", low: "低可信" };
const lifecycle = { active: "异常持续", resolved: "已恢复", expired: "已过期" };

export function assetIntelligenceSummary(context: AssetIntelligenceContext) {
  if (context.primaryEvent) return `${context.eventCount} 个活跃事件 · ${context.primaryEvent.title}`;
  return context.freshness.state === "current" ? "暂无活跃事件" : context.freshness.reason;
}

export function AssetRadarAwareness({ context, onOpen }: {
  context: AssetIntelligenceContext; onOpen: () => void;
}) {
  const summary = assetIntelligenceSummary(context);
  return <button className="asset-radar-awareness" data-symbol={context.symbol} data-freshness={context.freshness.state} onClick={onOpen} aria-label={`查看 ${context.symbol} Radar 上下文：${summary}`}>
    <span className="context-label">RADAR</span><span>{summary}{context.primaryEvent && context.freshness.state !== "current" && <small className="asset-intelligence-hint">{context.freshness.reason}</small>}</span><ArrowUpRight size={16} aria-hidden="true"/>
  </button>;
}

const coverageLabels = { healthy: "覆盖完整", partial: "部分覆盖", waiting: "等待数据", stale: "数据已过期", unsupported: "暂不支持", insufficient: "数据不足" };
const relationshipLabels = { aligned: "事件方向一致", mixed: "事件方向存在分歧", neutral: "当前事件无明确方向", insufficient: "方向证据不足" };
const stateNumber = new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 6 });
const stateTime = (at: number) => new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(at);

export function AssetStateSummary({ state, onOpen }: { state: AssetState; onOpen?: () => void }) {
  const unavailable = [state.direction, state.volatility].filter(dimension => dimension.classification === null);
  return <section className="asset-state-summary" data-symbol={state.symbol} aria-label={`${state.symbol} 观测状态`}>
    <div className="asset-state-heading"><span className="context-label">观测状态</span>{onOpen && <button onClick={onOpen} className="state-detail-link">查看依据 <ArrowUpRight size={14} aria-hidden="true"/></button>}</div>
    <dl><div data-dimension="direction" data-availability={state.direction.availability}><dt>方向结构</dt><dd>{state.direction.label}</dd></div><div data-dimension="volatility" data-availability={state.volatility.availability}><dt>RMS 波动</dt><dd>{state.volatility.label}</dd></div></dl>
    <p className="state-window">{state.evidence ? `${state.evidence.intervalMs / 60000} 分钟 K 线 · 20 个收盘间隔 · 截至 ${stateTime(state.evidence.evidenceEndAt)}` : "等待有效的连续完整 K 线"}</p>
    {[...new Set(unavailable.map(dimension => dimension.message))].map(message => <p className="state-limit" key={message}>{message}</p>)}
  </section>;
}

function AssetStateEvidence({ state }: { state: AssetState }) {
  const evidence = state.evidence, direction = state.direction.metrics, volatility = state.volatility.metrics;
  return <section className="asset-state-evidence" aria-label="观测状态依据">
    <h3>观测状态依据</h3><p>固定观测窗口，不随图表周期改变。仅描述已发生的价格结构；较低波动不等于低风险。</p>
    <dl className="state-readout">
      <div><dt>方向结构</dt><dd><strong>{state.direction.label}</strong>{direction && <p className="numeric">净变化 {stateNumber.format(direction.netPercent)}% · 路径效率 {stateNumber.format(direction.efficiency)}</p>}{state.direction.classification === null && <p>{state.direction.message}</p>}</dd></div>
      <div><dt>RMS 波动</dt><dd><strong>{state.volatility.label}</strong>{volatility && <p className="numeric">最近 4 段 {stateNumber.format(volatility.currentRmsPercent)}% · 此前 16 段 {stateNumber.format(volatility.baselineRmsPercent)}%<br/>{volatility.ratio === null ? "倍数不可用" : `当前 / 基线 ${stateNumber.format(volatility.ratio)}×`}</p>}{state.volatility.classification === null && <p>{state.volatility.message}</p>}</dd></div>
    </dl>
    <details className="state-method-details"><summary>计算方法、窗口与来源</summary><dl>
      <div><dt>方向方法 · {state.direction.methodId}</dt><dd>{state.direction.message}{direction && <p>门槛：绝对净变化 ≥ {direction.minimumNetPercent}% 且路径效率 ≥ {direction.minimumEfficiency}</p>}</dd></div>
      <div><dt>波动方法 · {state.volatility.methodId}</dt><dd>{state.volatility.message}{volatility && <p>基线须大于 {volatility.minimumBaselinePercent}%；比值 ≥ {volatility.higherRatio} 为较高、≤ 2/3 为较低，其间为接近。</p>}</dd></div>
      {evidence && <>
        <div><dt>区间与样本</dt><dd>{stateTime(evidence.closeStartAt)} — {stateTime(evidence.closeEndAt)}<br/>{evidence.intervalMs / 60000} 分钟 K 线 · {evidence.pointCount} 个收盘价 / {evidence.returnCount} 个收益率<br/>通过连续性检查 {evidence.validatedPointCount} 根{volatility && <><br/>波动参考区间结束 / 观测开始：{stateTime(volatility.currentStartAt)}</>}</dd></div>
        <div><dt>来源与证据时间</dt><dd>{state.symbol} · {evidence.source} · {evidence.currency}<br/>完整 K 线截至 {stateTime(evidence.evidenceEndAt)}<br/>报价 {stateTime(evidence.quoteAt)}<br/>报价获取 {stateTime(evidence.quoteFetchedAt)}<br/>历史获取 {stateTime(evidence.historyFetchedAt)}</dd></div>
      </>}
    </dl>
    <p>规则 {state.ruleVersion} · 描述性门槛，未经预测准确率校准。连续相对表现本版暂未启用；下方相对异常检测保留独立含义。</p>
    </details>
  </section>;
}

/** Both surfaces present the parent's same context; this component computes no intelligence. */
export function AssetIntelligenceDetails({ context, state }: { context: AssetIntelligenceContext; state?: AssetState }) {
  return <details className="asset-intelligence-details"><summary>资产情报详情 · {coverageLabels[context.coverage.state]}</summary>
    {context.primaryEvent && <div className="intelligence-primary"><span className="context-label">主事件</span><strong>{context.primaryEvent.title}</strong><span>{context.primaryEvent.metric} · {confidence[context.primaryEvent.confidence.level]}</span></div>}
    {state?.symbol === context.symbol && <AssetStateEvidence state={state}/>}
    <dl className="intelligence-facts">
      <div><dt>事件关系</dt><dd>{relationshipLabels[context.relationship.state]}
        {context.relationship.events.length > 0 && <ul aria-label="事件关系依据">{context.relationship.events.map(event => <li key={event.id}>{event.title} · {event.direction === "up" ? "向上" : event.direction === "down" ? "向下" : "无明确方向"}</li>)}</ul>}
      </dd></div>
      <div><dt>相对检测</dt><dd>{context.coverage.relativeReason}{context.relativeSignals.map(signal => <p key={signal.id}>{signal.title} · {signal.metric} · 基准 {signal.evidence.benchmark!.symbol}</p>)}</dd></div>
      <div><dt>检测覆盖</dt><dd>{coverageLabels[context.coverage.state]} · {context.coverage.reason}</dd></div>
      <div><dt>当前可用性</dt><dd>{context.freshness.reason}</dd></div>
    </dl>
    <div className="intelligence-footer">
      {context.latestEvidenceAt !== undefined && <p>最近有效证据 <time dateTime={new Date(context.latestEvidenceAt).toISOString()}>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(context.latestEvidenceAt)}</time> · K 线结束时间</p>}
      <p>{context.user.isWatched ? "已加入自选" : "未加入自选"} · {context.user.enabledAlertCount} 条启用的价格提醒（用户条件）</p>
    </div>
  </details>;
}

export function RadarOriginContext({ symbol, event, onReturn, onDismiss }: {
  symbol: string; event?: RadarIntelligenceEvent; onReturn: () => void; onDismiss: () => void;
}) {
  return <section className="radar-context-banner" aria-label="来自 Radar 的市场上下文">
    <div><span>FROM RADAR{event ? ` · ${lifecycle[event.status]} · ${confidence[event.confidence.level]}` : ""}</span>
      <strong>{displaySymbol(symbol)} · {event?.title ?? "原事件已结束或不再可用"}</strong>
      {event && <small>{event.metric} · 检测于 <time dateTime={new Date(event.detectedAt).toISOString()}>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(event.detectedAt)}</time></small>}
    </div><div className="context-actions"><button className="btn" onClick={onReturn}>返回 Radar</button><button className="icon-btn" aria-label="关闭来源上下文" onClick={onDismiss}><X size={16}/></button></div>
  </section>;
}
