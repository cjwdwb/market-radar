import { assetFor, type Point, type Quote } from "../market";
import type { RadarHistory, RadarSnapshot } from "./types";

export const MINUTE = 60_000;
export const FETCH_MAX_AGE = 2 * MINUTE;
export const QUOTE_MAX_AGE = 3 * MINUTE;
export const CANDLE_LAG_ALLOWANCE = MINUTE;
export type PreparedMarketInput = { quote: Quote; history: RadarHistory; bars: Point[] };
export type PreparedPair = { time: number; asset: number; benchmark: number };
/** Exact legacy join only; callers own compatibility, tail, sample and window rules. */
export function pairPreparedInputs(asset: PreparedMarketInput, benchmark: PreparedMarketInput): PreparedPair[] {
  const byTime = new Map(benchmark.bars.map(point => [point.time, point]));
  return asset.bars.flatMap(point => { const reference = byTime.get(point.time); return reference ? [{ time: point.time, asset: point.close, benchmark: reference.close }] : []; });
}
export type InputReason = "awaiting_quote" | "quote_failed" | "invalid_quote" | "stale_quote" | "session_unavailable" | "awaiting_history" | "source_currency_mismatch" | "stale_history" | "unsupported_interval" | "insufficient_contiguous_bars" | "invalid_history" | "stale_evidence";
type RejectedInput = { reason: InputReason; message: string };
export type MarketInputResult = { ok: true; data: PreparedMarketInput } | { ok: false; failure: RejectedInput };
const reject = (reason: InputReason, message: string): MarketInputResult => ({ ok: false, failure: { reason, message } });

export const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
export const rms = (values: number[]) => Math.sqrt(mean(values.map(value => value * value)));
export const simpleReturns = (bars: Point[]) => bars.slice(1).map((point, i) => (point.close / bars[i].close - 1) * 100);

/** Shared legacy preparation, preserving Engine condition order and continuous-suffix semantics.
 * Quote clock skew is intentionally unchanged; consumers requiring strict now-completion add that gate.
 */
export function prepareMarketInput(snapshot: RadarSnapshot, symbol: string, now: number): MarketInputResult {
  const quote = snapshot.quotes[symbol];
  if (!quote) return reject("awaiting_quote", "等待报价");
  if (quote.symbol !== symbol || quote.error) return reject("quote_failed", "报价更新失败");
  if (!Number.isFinite(quote.price) || quote.price <= 0) return reject("invalid_quote", "报价无效");
  if (![quote.timestamp, quote.fetchedAt].every(Number.isFinite) || quote.timestamp > now + MINUTE || quote.fetchedAt > now + MINUTE || now - quote.fetchedAt > FETCH_MAX_AGE || now - quote.timestamp > QUOTE_MAX_AGE) return reject("stale_quote", "报价过期或延迟");
  const market = assetFor(symbol).market;
  if (market !== "crypto" && (quote.session !== "open" || (quote.delayMinutes ?? 0) > 2)) return reject("session_unavailable", "休市或延迟行情");
  const history = symbol.endsWith("-USDT") ? snapshot.histories[symbol] : { points: quote.points, intervalMs: 5 * MINUTE, source: quote.source, currency: quote.currency, fetchedAt: quote.fetchedAt };
  if (!history || !Array.isArray(history.points)) return reject("awaiting_history", "等待历史基线");
  if (history.source !== quote.source || history.currency !== quote.currency) return reject("source_currency_mismatch", "历史来源或币种不匹配");
  if (!Number.isFinite(history.fetchedAt) || now - history.fetchedAt > FETCH_MAX_AGE || history.fetchedAt > now + MINUTE) return reject("stale_history", "历史数据过期");
  if (history.intervalMs !== (symbol.endsWith("-USDT") ? 15 : 5) * MINUTE) return reject("unsupported_interval", "历史周期不支持");
  // Yahoo confirmed assumes 15m; preserve completion from its actual 5m period.
  let bars = history.points.filter(point => point.time + history.intervalMs <= quote.timestamp && (!symbol.endsWith("-USDT") || point.confirmed === true)).slice(-80);
  for (let i = bars.length - 1; i > 0; i--) {
    if (bars[i].time - bars[i - 1].time !== history.intervalMs) { bars = bars.slice(i); break; }
  }
  if (bars.length < 22) return reject("insufficient_contiguous_bars", "历史基线不足（至少 22 根连续完整 K 线）");
  for (let i = 0; i < bars.length; i++) {
    const point = bars[i];
    if (!Number.isFinite(point.time) || !Number.isFinite(point.close) || point.close <= 0) return reject("invalid_history", "历史价格无效");
    if (i && point.time - bars[i - 1].time !== history.intervalMs) return reject("insufficient_contiguous_bars", "历史不连续，等待同一交易时段基线");
  }
  if (quote.timestamp - (bars.at(-1)!.time + history.intervalMs) > history.intervalMs + CANDLE_LAG_ALLOWANCE) return reject("stale_evidence", "最近完整 K 线缺失");
  return { ok: true, data: { quote, history, bars } };
}
