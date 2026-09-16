import type { RadarCoverage, RadarIntelligenceEvent } from "./types";

export type RadarCoverageState = "ready" | "partial" | "waiting";
export type RadarCoverageSummary = { total: number; ready: number; partial: number; waiting: number; state: RadarCoverageState | "empty" };

/** Summarises only user-visible Watchlist coverage; benchmark rows stay internal. */
export function summarizeWatchlistCoverage(coverage: RadarCoverage[], watchlist: string[]): RadarCoverageSummary {
  const rows = watchlist.map(symbol => coverage.find(item => item.symbol === symbol)).filter((item): item is RadarCoverage => !!item);
  const ready = rows.filter(item => item.eligible && item.relativeEligible !== false).length;
  const partial = rows.filter(item => item.eligible && item.relativeEligible === false).length;
  const waiting = rows.filter(item => !item.eligible).length;
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
