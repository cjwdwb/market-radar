"use client";

import { ArrowUpRight, X } from "lucide-react";
import { displaySymbol } from "@/lib/market";
import type { RadarIntelligenceEvent } from "@/lib/radar/types";
import type { assetRadarContext } from "@/lib/radar/workflow";

const confidence = { high: "高可信", medium: "中可信", low: "低可信" };
const lifecycle = { active: "异常持续", resolved: "已恢复", expired: "已过期" };

export function AssetRadarAwareness({ context, enabled, reason, onOpen }: {
  context: ReturnType<typeof assetRadarContext>; enabled: boolean; reason?: string; onOpen: () => void;
}) {
  const { symbol, activeEvents, primaryEvent } = context;
  const summary = !enabled ? "扫描暂不可用" : primaryEvent ? `${activeEvents.length} 个活跃事件 · ${primaryEvent.title}` : reason || "暂无活跃事件";
  return <button className="asset-radar-awareness" onClick={onOpen} aria-label={`查看 ${symbol} Radar 上下文：${summary}`}>
    <span className="context-label">RADAR</span><span>{summary}</span><ArrowUpRight size={16} aria-hidden="true"/>
  </button>;
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
