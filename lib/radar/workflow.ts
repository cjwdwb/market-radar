import type { AssetIntelligenceContext, RadarCoverage, RadarIntelligenceEvent } from "./types";
import type { PriceAlert } from "../market";

/** Navigation identity only: facts are always read from the current intelligence. */
export type RadarEventReference = { symbol: string; eventId: string };

export function assetRadarContext(events: RadarIntelligenceEvent[], symbol: string) {
  const activeEvents = events.filter(event => event.symbol === symbol && event.status === "active");
  // Input order is the intelligence ranking. Never introduce a Classic score.
  return { symbol, activeEvents, primaryEvent: activeEvents[0] };
}

/** Selected-asset aggregation only. Event references and their existing order are retained. */
export function buildAssetIntelligenceContext({ events, coverage, symbol, now, enabled, online, isWatched, enabledAlertCount }: {
  events: RadarIntelligenceEvent[]; coverage: RadarCoverage[]; symbol: string; now: number | undefined;
  enabled: boolean; online: boolean; isWatched: boolean; enabledAlertCount: number;
}): AssetIntelligenceContext {
  const row = coverage.find(item => item.symbol === symbol);
  const relativeReady = row?.relativeEligible === true;
  const state: AssetIntelligenceContext["coverage"]["state"] = !row ? "waiting" : row.eligible ? relativeReady ? "healthy" : "partial"
    : row.readiness && row.readiness !== "ready" ? row.readiness : "insufficient";
  const reason = row?.reason ?? "等待报价与历史基线";
  const relativeReason = row?.relativeReason ?? "等待可靠基准";
  const candidates = assetRadarContext(events, symbol).activeEvents;
  const running = enabled && online && now !== undefined && Number.isFinite(now);
  // Guard the render before the existing reducer effect expires invalid events.
  // Expiry is supplied by Engine; no new age limits, market rules, or signal calculations.
  const activeEvents = running && row?.eligible ? candidates.filter(event => event.signals.length > 0 && event.signals.every(signal =>
    signal.symbol === symbol && signal.status === "active" && Number.isFinite(signal.expiresAt) && signal.expiresAt > now!
    && Number.isFinite(signal.evidenceAt) && signal.evidenceAt <= now!
    && (!(signal.type === "relative_strength" || signal.type === "relative_weakness") || relativeReady)
  )) : [];
  const excluded = candidates.length > activeEvents.length;
  const freshness: AssetIntelligenceContext["freshness"] = !online ? { state: "unavailable", reason: "网络已断开，当前情报暂不可用" }
    : !enabled ? { state: "unavailable", reason: "扫描暂不可用" }
    : state === "stale" ? { state: "stale", reason }
    : !running || !row?.eligible ? { state: "insufficient", reason }
    : state === "partial" ? { state: "degraded", reason: `基础检测可用；${relativeReason}` }
    : excluded ? { state: "stale", reason: "部分事件证据已失效，等待扫描更新" }
    : { state: "current", reason: "当前检测数据可用" };
  const directional = activeEvents.filter(event => event.direction !== "neutral");
  const up = directional.some(event => event.direction === "up"), down = directional.some(event => event.direction === "down");
  const relationship: AssetIntelligenceContext["relationship"] = {
    state: up && down ? "mixed" : directional.length >= 2 ? "aligned" : !directional.length && activeEvents.length ? "neutral" : "insufficient",
    events: directional.length ? directional : activeEvents,
  };
  const evidenceTimes = activeEvents.flatMap(event => event.signals.map(signal => signal.evidenceAt));
  return { symbol, coverage: { state, reason, relativeReady, relativeReason, source: row }, freshness,
    activeEvents, primaryEvent: activeEvents[0], eventCount: activeEvents.length,
    latestEvidenceAt: evidenceTimes.length ? Math.max(...evidenceTimes) : undefined,
    relationship, relativeSignals: activeEvents.flatMap(event => event.signals.filter(signal =>
      (signal.type === "relative_strength" || signal.type === "relative_weakness") && !!signal.evidence?.benchmark)),
    user: { isWatched, enabledAlertCount },
  };
}

export function resolveRadarEvent(events: RadarIntelligenceEvent[], reference: RadarEventReference | null, selected: string) {
  if (!reference || reference.symbol !== selected) return undefined;
  return events.find(event => event.symbol === selected && event.id === reference.eventId);
}

export function enabledPriceAlertCounts(alerts: PriceAlert[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const alert of alerts) if (alert.enabled) counts.set(alert.symbol, (counts.get(alert.symbol) ?? 0) + 1);
  return counts;
}

export type RadarCoverageState = "ready" | "partial" | "waiting";
export type RadarCoverageSummary = { total: number; ready: number; partial: number; waiting: number; state: RadarCoverageState | "empty" };

/** Summarises only user-visible Watchlist coverage; benchmark rows stay internal. */
export function summarizeWatchlistCoverage(coverage: RadarCoverage[], watchlist: string[]): RadarCoverageSummary {
  const rows = [...new Set(watchlist)].map(symbol => coverage.find(item => item.symbol === symbol));
  const ready = rows.filter(item => item?.eligible && item.relativeEligible !== false).length;
  const partial = rows.filter(item => item?.eligible && item.relativeEligible === false).length;
  const waiting = rows.filter(item => !item?.eligible).length;
  return { total: rows.length, ready, partial, waiting, state: !rows.length ? "empty" : waiting === rows.length ? "waiting" : partial || waiting ? "partial" : "ready" };
}

/** Existing chart ranges are the only supported context targets. */
export function chartRangeForEvent(event: RadarIntelligenceEvent, fallback: "15m" | "1d" | "1w" | "1m" | "3m") {
  const minutes = event.signals.find(signal => Number.isFinite(signal.metrics.intervalMinutes))?.metrics.intervalMinutes;
  if (minutes === 5) return "1d" as const;
  if (minutes === 15) return "15m" as const;
  if (minutes === 60) return "1d" as const;
  return fallback;
}
