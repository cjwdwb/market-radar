import type { RadarConfidence, RadarEventKind, RadarIntelligence, RadarIntelligenceEvent, RadarSignal } from "./types";

export const CLUSTER_WINDOW_MS = 15 * 60_000;
const severityRank = { medium: 1, high: 2, critical: 3 } as const;
const confidenceRank = { low: 1, medium: 2, high: 3 } as const;

function confidenceFor(signal: RadarSignal, supported: boolean): RadarConfidence {
  const evidence = signal.evidence;
  if (!evidence) return { level: "low", reasons: ["旧版事件缺少完整结构化证据"] };
  const reasons: string[] = [];
  let score = 0;
  if (evidence.freshnessRatio <= .5) { score++; reasons.push("报价和证据位于有效新鲜度窗口前半"); }
  else reasons.push("报价接近允许的新鲜度边界");
  if (evidence.sampleSize >= Math.ceil(evidence.minimumSamples * 1.5)) { score++; reasons.push(`历史样本充足（${evidence.sampleSize}）`); }
  else reasons.push(`历史样本满足最低要求（${evidence.sampleSize}/${evidence.minimumSamples}）`);
  if (evidence.strength >= 1.5) { score++; reasons.push("事件显著超过触发阈值"); }
  else if (supported) { score++; reasons.push("有独立的同期信号支持"); }
  else reasons.push("事件刚超过触发阈值");
  return { level: score === 3 ? "high" : score === 2 ? "medium" : "low", reasons };
}

function compatible(a: RadarSignal, b: RadarSignal) {
  if (a.symbol !== b.symbol || a.status !== "active" || b.status !== "active" || Math.abs(a.evidenceAt - b.evidenceAt) > CLUSTER_WINDOW_MS) return false;
  return a.direction === "neutral" || b.direction === "neutral" || a.direction === b.direction;
}

function classify(signals: RadarSignal[]): Exclude<RadarEventKind, "signal"> | undefined {
  const types = new Set(signals.map(signal => signal.type));
  const hasUp = signals.some(signal => signal.direction === "up"), hasDown = signals.some(signal => signal.direction === "down");
  if (types.has("relative_weakness") && (types.has("price_move") || types.has("breakdown")) && hasDown) return "relative_weakness_event";
  if (types.has("relative_strength") && (types.has("price_move") || types.has("breakout")) && hasUp) return "relative_strength_event";
  if (types.has("breakdown") && types.has("price_move") && hasDown && (types.has("volume_spike") || types.has("volatility_spike"))) return "selling_pressure";
  if (types.has("breakout") && (types.has("price_move") || types.has("volume_spike")) && hasUp) return "breakout_confirmation";
  if (types.has("price_move") && (types.has("volume_spike") || types.has("volatility_spike"))) return "momentum_expansion";
}

function membersFor(kind: Exclude<RadarEventKind, "signal">, signals: RadarSignal[]) {
  const allowed: Record<typeof kind, Set<RadarSignal["type"]>> = {
    momentum_expansion: new Set(["price_move", "volatility_spike", "volume_spike", "breakout", "breakdown"]),
    breakout_confirmation: new Set(["breakout", "price_move", "volume_spike"]),
    selling_pressure: new Set(["breakdown", "price_move", "volume_spike", "volatility_spike"]),
    relative_strength_event: new Set(["relative_strength", "price_move", "breakout"]),
    relative_weakness_event: new Set(["relative_weakness", "price_move", "breakdown"]),
  };
  return signals.filter(signal => allowed[kind].has(signal.type));
}

const clusterLabels: Record<Exclude<RadarEventKind, "signal">, string> = {
  momentum_expansion: "动能扩张", breakout_confirmation: "突破确认", selling_pressure: "卖压增强",
  relative_strength_event: "相对强势事件", relative_weakness_event: "相对弱势事件",
};

function eventFrom(signals: RadarSignal[], kind: RadarEventKind, watchlist: Set<string>): RadarIntelligenceEvent {
  const preferred: Partial<Record<RadarEventKind, RadarSignal["type"]>> = { momentum_expansion: "price_move", breakout_confirmation: "breakout", selling_pressure: "breakdown", relative_strength_event: "relative_strength", relative_weakness_event: "relative_weakness" };
  const ranked = [...signals].sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || (b.evidence?.strength ?? 0) - (a.evidence?.strength ?? 0) || b.detectedAt - a.detectedAt);
  const primary = signals.find(signal => signal.type === preferred[kind]) ?? ranked[0];
  const supported = signals.length > 1;
  const confidence = confidenceFor(primary, supported);
  const severity = [...signals].sort((a, b) => severityRank[b.severity] - severityRank[a.severity])[0].severity;
  const title = kind === "signal" ? primary.title : clusterLabels[kind];
  const related = signals.filter(signal => signal !== primary).map(signal => `${signal.title}：${signal.metric}`);
  const relative = signals.find(signal => signal.evidence?.benchmark);
  const context = [relative ? `相对基准 ${relative.evidence.benchmark!.symbol}：${relative.description}` : "", ...related].filter(Boolean);
  const rank = [primary.status === "active" ? "持续中" : "历史", watchlist.has(primary.symbol) ? "My Radar" : "市场", kind === "signal" ? "单一信号" : "组合事件", `${severity} severity`, `${confidence.level} confidence`];
  return {
    id: kind === "signal" ? primary.id : `${primary.symbol}:${kind}:${Math.max(...signals.map(signal => signal.evidenceAt))}`,
    kind, symbol: primary.symbol, market: primary.market, title, metric: primary.metric, direction: primary.direction,
    severity, status: primary.status, detectedAt: Math.min(...signals.map(signal => signal.detectedAt)), updatedAt: Math.max(...signals.map(signal => signal.updatedAt)),
    confidence, signals: [primary, ...signals.filter(signal => signal !== primary).sort((a, b) => b.detectedAt - a.detectedAt || a.id.localeCompare(b.id))], context, rankingReason: rank.join(" · "),
  };
}

/** Pure presentation intelligence. Raw signals are referenced, never removed or rewritten. */
export function buildRadarIntelligence(rawSignals: RadarSignal[], watchlistSymbols: string[], now: number): RadarIntelligence {
  const watchlist = new Set(watchlistSymbols), used = new Set<string>(), events: RadarIntelligenceEvent[] = [];
  const active = rawSignals.filter(signal => signal.status === "active").sort((a, b) => b.evidenceAt - a.evidenceAt || a.id.localeCompare(b.id));
  for (const anchor of active) {
    if (used.has(anchor.id)) continue;
    const compatibleSignals = active.filter(signal => !used.has(signal.id) && compatible(anchor, signal));
    const cohorts = anchor.direction === "neutral" ? (["up", "down"] as const).map(direction => compatibleSignals.filter(signal => signal.direction === direction || signal.direction === "neutral")) : [compatibleSignals];
    const selected = cohorts.map(signals => ({ signals, kind: classify(signals) })).filter((item): item is { signals: RadarSignal[]; kind: Exclude<RadarEventKind, "signal"> } => !!item.kind).sort((a, b) => membersFor(b.kind, b.signals).length - membersFor(a.kind, a.signals).length)[0];
    if (selected) {
      const kind = selected.kind, members = membersFor(kind, selected.signals);
      members.forEach(signal => used.add(signal.id));events.push(eventFrom(members, kind, watchlist));
    } else { used.add(anchor.id);events.push(eventFrom([anchor], "signal", watchlist)); }
  }
  for (const signal of rawSignals.filter(signal => signal.status !== "active")) events.push(eventFrom([signal], "signal", watchlist));
  events.sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || Number(watchlist.has(b.symbol)) - Number(watchlist.has(a.symbol)) || Number(b.kind !== "signal") - Number(a.kind !== "signal") || severityRank[b.severity] - severityRank[a.severity] || confidenceRank[b.confidence.level] - confidenceRank[a.confidence.level] || b.detectedAt - a.detectedAt || a.id.localeCompare(b.id));
  const recent = events.filter(event => event.status === "active" && now - event.detectedAt <= 60 * 60_000);
  return { events, summary: { windowMinutes: 60, activeEvents: recent.length, watchlistAssets: new Set(recent.filter(event => watchlist.has(event.symbol)).map(event => event.symbol)).size, priorityEvents: recent.filter(event => severityRank[event.severity] >= severityRank.high).length, highlights: recent.slice(0, 3) } };
}
