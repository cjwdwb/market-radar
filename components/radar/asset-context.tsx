"use client";

import { ArrowUpRight, X } from "lucide-react";
import { displaySymbol } from "@/lib/market";
import type { AssetIntelligenceContext, RadarIntelligenceEvent } from "@/lib/radar/types";
import type { AssetStateV2 as AssetState } from "@/lib/radar/asset-state-v2";
import { AssetStateEvidence } from "./asset-state";
export { AssetStateSummary } from "./asset-state";

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
/** Both surfaces present the parent's same context; this component computes no intelligence. */
export function AssetIntelligenceDetails({ context, state, onReturn }: { context: AssetIntelligenceContext; state?: AssetState; onReturn?: () => void }) {
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
      {onReturn && <div className="context-actions intelligence-return"><button className="btn" onClick={onReturn}>返回 {displaySymbol(context.symbol)} 图表 <ArrowUpRight size={14} aria-hidden="true"/></button></div>}
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
