import type { HistoryMetadata, MarketHistory, Point, Range } from "./market";
import { marketError, type MarketScope } from "./market-request";

export const okxRanges: Record<Range, { bar: string; limit: number; intervalMs: number }> = {
  "15m": { bar: "15m", limit: 96, intervalMs: 900_000 }, "1d": { bar: "15m", limit: 96, intervalMs: 900_000 },
  "1w": { bar: "1H", limit: 168, intervalMs: 3_600_000 }, "1m": { bar: "4H", limit: 180, intervalMs: 14_400_000 },
  "3m": { bar: "1Dutc", limit: 90, intervalMs: 86_400_000 },
};
export function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  const number = Number(value); return Number.isFinite(number) ? number : null;
}
export function validPoint(point: Point, now: number, intervalMs: number | null, requireOHLC = false) {
  if (!Number.isSafeInteger(point.time) || point.time <= 0 || point.time > now + 30_000 || !Number.isFinite(point.close) || point.close <= 0) return false;
  if (intervalMs && point.time % intervalMs !== 0) return false;
  if (point.volume !== undefined && (!Number.isFinite(point.volume) || point.volume < 0)) return false;
  if (point.confirmed !== undefined && typeof point.confirmed !== "boolean") return false;
  if (point.windowEnded !== undefined && typeof point.windowEnded !== "boolean") return false;
  const ohlc = [point.open, point.high, point.low];
  if (requireOHLC && ohlc.some(value => value === undefined)) return false;
  if (ohlc.some(value => value !== undefined && (!Number.isFinite(value) || value <= 0))) return false;
  if (point.high !== undefined && point.high < Math.max(point.open ?? point.close, point.close, point.low ?? point.close)) return false;
  if (point.low !== undefined && point.low > Math.min(point.open ?? point.close, point.close, point.high ?? point.close)) return false;
  if (point.confirmed === true && intervalMs && point.time + intervalMs > now + 30_000) return false;
  return true;
}
export function samePoint(a: Point, b: Point) {
  return (["time", "open", "high", "low", "close", "volume", "confirmed", "windowEnded"] as const).every(key => a[key] === b[key]);
}
export function normalizePoints(input: Point[], options: { now: number; intervalMs: number | null; requireOHLC?: boolean; grid?: boolean }) {
  const byTime = new Map<number, Point>(); let invalidRows = 0, duplicateRows = 0;
  for (const point of input) {
    if (!validPoint(point, options.now, options.grid === false ? null : options.intervalMs, options.requireOHLC)) { invalidRows++; continue; }
    const previous = byTime.get(point.time);
    if (previous) {
      duplicateRows++;
      if (!samePoint(previous, point)) throw marketError("invalid_data", undefined, { stage: "admission" });
    } else byTime.set(point.time, point);
  }
  return { points: [...byTime.values()].sort((a, b) => a.time - b.time), invalidRows, duplicateRows };
}
export function historyMetadata(points: Point[], base: Omit<HistoryMetadata, "firstAt" | "lastAt" | "lastCompleteAt" | "gapCount">): HistoryMetadata {
  const interval = base.intervalMs;
  let gapCount = 0;
  if (interval) for (let i = 1; i < points.length; i++) if (points[i].time - points[i - 1].time > interval) gapCount++;
  const complete = points.filter(point => base.completion === "source" ? point.confirmed === true : base.completion === "time_window" ? point.windowEnded === true : false).at(-1);
  return { ...base, firstAt: points[0]?.time ?? null, lastAt: points.at(-1)?.time ?? null, lastCompleteAt: complete && interval ? complete.time + interval : null, gapCount };
}
/** A legacy monitor has no trustworthy attempt/cancellation contract. Validate its data, label that limit. */
export function validateProxyHistory(body: unknown, symbol: string, range: Range, scope: MarketScope): MarketHistory {
  const fail = () => marketError("invalid_data", scope, { stage: "proxy" });
  if (!body || typeof body !== "object" || Array.isArray(body)) throw fail();
  const value = body as MarketHistory; const config = okxRanges[range]; const now = Date.now();
  if (value.symbol !== symbol || value.range !== range || value.currency !== "USDT" || value.source !== "OKX 欧易" || value.timezone !== "UTC" || !Number.isFinite(value.fetchedAt) || value.fetchedAt <= 0 || value.fetchedAt > now + 30_000) throw fail();
  if (!Array.isArray(value.points) || value.points.length > config.limit || value.points.length < 2) throw fail();
  if (value.points.some(point => !point || typeof point !== "object")) throw fail();
  const normalized = normalizePoints(value.points, { now: value.fetchedAt, intervalMs: config.intervalMs, requireOHLC: true });
  if (normalized.invalidRows || normalized.duplicateRows) throw fail();
  const base: Omit<HistoryMetadata, "firstAt" | "lastAt" | "lastCompleteAt" | "gapCount"> = {
    intervalMs: config.intervalMs, bar: config.bar, exchange: "OKX", instrument: symbol, marketType: "spot", volumeUnit: "base", bucketTimezone: "UTC", completion: "source",
    invalidRows: 0, duplicateRows: 0, path: "monitor", limitations: ["legacy_proxy_metadata_unverified", "proxy_attempts_and_cancellation_unknown"],
  };
  let metadata = historyMetadata(normalized.points, base);
  if (value.metadata !== undefined) {
    const m = value.metadata;
    if (!m || m.instrument !== symbol || m.exchange !== "OKX" || m.marketType !== "spot" || m.volumeUnit !== "base" || m.bucketTimezone !== "UTC" || m.bar !== config.bar || m.intervalMs !== config.intervalMs || m.completion !== "source" || !["candles", "history-candles", "monitor"].includes(m.path)) throw fail();
    if (![m.invalidRows, m.duplicateRows, m.gapCount].every(n => Number.isSafeInteger(n) && n >= 0) || !Array.isArray(m.limitations) || m.limitations.length > 20 || m.limitations.some(text => typeof text !== "string" || text.length > 100)) throw fail();
    if (m.firstAt !== metadata.firstAt || m.lastAt !== metadata.lastAt || m.lastCompleteAt !== metadata.lastCompleteAt || m.gapCount !== metadata.gapCount) throw fail();
    // Do not display arbitrary remote strings; these are internal stable limitation codes.
    const allowed = ["invalid_rows", "duplicate_rows", "gaps", "unknown_confirmation", "historical_endpoint", "legacy_proxy_metadata_unverified", "proxy_attempts_and_cancellation_unknown"];
    if (m.limitations.some(text => !allowed.includes(text))) throw fail();
    metadata = { ...metadata, path: m.path, invalidRows: m.invalidRows, duplicateRows: m.duplicateRows, limitations: [...new Set([...m.limitations, "proxy_attempts_and_cancellation_unknown"])] };
  }
  return { symbol, range, currency: "USDT", source: "OKX 欧易", timezone: "UTC", points: normalized.points, fetchedAt: value.fetchedAt, readAt: now, cache: { hit: value.cache?.hit === true, ageMs: Math.max(0, now - value.fetchedAt) }, metadata, traceId: scope.traceId };
}
