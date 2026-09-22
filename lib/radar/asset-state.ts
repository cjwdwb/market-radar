import { assetFor, type Point } from "../market";
import { CANDLE_LAG_ALLOWANCE, prepareMarketInput, rms, simpleReturns, type InputReason, type PreparedMarketInput } from "./market-input";
import type { RadarSnapshot } from "./types";

export const ASSET_STATE_RULES = Object.freeze({ version: "asset-state-v1", returnCount: 20, currentReturns: 4, baselineReturns: 16, efficiencyFloor: .60, cryptoDirectionFloor: .60, otherDirectionFloor: .30, rmsBaselineFloor: .000001, higherRatio: 1.5, lowerRatio: 2 / 3 });
export type StateAvailability = "available" | "waiting" | "insufficient" | "unsupported" | "invalid" | "stale" | "paused" | "offline";
export type StateReason = InputReason | "awaiting_clock" | "paused" | "offline" | "future_evidence" | "invalid_numeric" | "baseline_too_small";
export type Dimension<T, M> = { label: string; message: string } & (
  { availability: "available"; classification: T; reason: null; metrics: M } |
  { availability: Exclude<StateAvailability, "available">; classification: null; reason: StateReason; metrics: M | null }
);
export type DirectionMetrics = { netPercent: number; efficiency: number; path: number; minimumNetPercent: number; minimumEfficiency: number };
export type VolatilityMetrics = { currentRmsPercent: number; baselineRmsPercent: number; ratio: number | null; minimumBaselinePercent: number; lowerRatio: number; higherRatio: number; currentStartAt: number; baselineEndAt: number };
export type AssetState = {
  symbol: string; ruleVersion: string; calculatedAt: number | null;
  direction: Dimension<"upward" | "downward" | "no_direction", DirectionMetrics> & { methodId: "direction-v1" };
  volatility: Dimension<"higher" | "lower" | "similar", VolatilityMetrics> & { methodId: "rms-v1" };
  evidence: null | {
    intervalMs: number; pointCount: number; returnCount: number; validatedPointCount: number;
    firstCandleStartAt: number; closeStartAt: number; closeEndAt: number; evidenceEndAt: number;
    source: string; currency: string; quoteAt: number; quoteFetchedAt: number; historyFetchedAt: number;
  };
};
const availability: Record<StateReason, Exclude<StateAvailability, "available">> = {
  awaiting_quote: "waiting", awaiting_history: "waiting", awaiting_clock: "waiting", paused: "paused", offline: "offline",
  quote_failed: "invalid", invalid_quote: "invalid", source_currency_mismatch: "invalid", invalid_history: "invalid", invalid_numeric: "invalid", future_evidence: "invalid",
  stale_quote: "stale", stale_history: "stale", stale_evidence: "stale",
  session_unavailable: "insufficient", insufficient_contiguous_bars: "insufficient", baseline_too_small: "insufficient", unsupported_interval: "unsupported",
};
export function stateUnavailable<T, M>(reason: StateReason, message: string, metrics: M | null = null): Dimension<T, M> {
  return { availability: availability[reason], classification: null, label: "暂不可判断", reason, message, metrics };
}
const unavailable = stateUnavailable;
export type StateInput = { snapshot: RadarSnapshot; symbol: string; now: number | undefined; enabled: boolean; online: boolean };

/** Strict State preparation, shared by v1/v2; Engine keeps its original preparation. */
export function prepareStateInput(snapshot: RadarSnapshot, symbol: string, now: number): { ok: true; data: PreparedMarketInput } | { ok: false; failure: { reason: StateReason; message: string } } {
  const prepared = prepareMarketInput(snapshot, symbol, now);
  if (!prepared.ok) return prepared;
  const { bars, history } = prepared.data;
  if (bars.some(point => point.time <= 0)) return { ok: false, failure: { reason: "invalid_history", message: "历史时间无效" } };
  if (bars.some(point => point.time + history.intervalMs > now)) return { ok: false, failure: { reason: "future_evidence", message: "K 线尚未结束，等待完整证据" } };
  if (now - (bars.at(-1)!.time + history.intervalMs) > history.intervalMs + CANDLE_LAG_ALLOWANCE) return { ok: false, failure: { reason: "stale_evidence", message: "最近完整 K 线已过期" } };
  return prepared;
}

export function directionForWindow(window: Point[], floor: number, message: string): Dimension<"upward" | "downward" | "no_direction", DirectionMetrics> {
  const net = window.at(-1)!.close - window[0].close;
  const netPercent = (window.at(-1)!.close / window[0].close - 1) * 100;
  const path = window.slice(1).reduce((sum, point, i) => sum + Math.abs(point.close - window[i].close), 0);
  const efficiency = path === 0 ? 0 : Math.abs(net) / path;
  if (![net, netPercent, path, efficiency].every(Number.isFinite)) return unavailable("invalid_numeric", "方向指标无法形成有限数值");
  const classification = Math.abs(netPercent) >= floor && efficiency >= ASSET_STATE_RULES.efficiencyFloor ? netPercent > 0 ? "upward" : "downward" : "no_direction";
  return { availability: "available", classification, label: { upward: "窗口偏上", downward: "窗口偏下", no_direction: "无明显单向结构" }[classification], reason: null,
    message, metrics: { netPercent, efficiency, path, minimumNetPercent: floor, minimumEfficiency: ASSET_STATE_RULES.efficiencyFloor } };
}

export function volatilityForWindow(window: Point[], intervalMs: number, currentCount: number, baselineCount: number, message: string): Dimension<"higher" | "lower" | "similar", VolatilityMetrics> {
  const returns = simpleReturns(window), current = returns.slice(-currentCount), baseline = returns.slice(0, baselineCount);
  const currentRmsPercent = rms(current), baselineRmsPercent = rms(baseline);
  if (![...returns, currentRmsPercent, baselineRmsPercent].every(Number.isFinite)) return unavailable("invalid_numeric", "RMS 指标无法形成有限数值");
  const metrics: VolatilityMetrics = { currentRmsPercent, baselineRmsPercent, ratio: null, minimumBaselinePercent: ASSET_STATE_RULES.rmsBaselineFloor, lowerRatio: ASSET_STATE_RULES.lowerRatio, higherRatio: ASSET_STATE_RULES.higherRatio, currentStartAt: window[baselineCount].time + intervalMs, baselineEndAt: window[baselineCount].time + intervalMs };
  if (baselineRmsPercent <= ASSET_STATE_RULES.rmsBaselineFloor) return unavailable("baseline_too_small", "此前基线为零或过小，无法可靠比较倍数", metrics);
  const ratio = currentRmsPercent / baselineRmsPercent;
  if (!Number.isFinite(ratio)) return unavailable("invalid_numeric", "RMS 比值无法形成有限数值");
  const classification = ratio >= ASSET_STATE_RULES.higherRatio ? "higher" : ratio <= ASSET_STATE_RULES.lowerRatio ? "lower" : "similar";
  return { availability: "available", classification, label: { higher: "高于此前基线", lower: "低于此前基线", similar: "接近此前基线" }[classification], reason: null, message, metrics: { ...metrics, ratio } };
}

/** Selected asset only. No event/user inputs, hidden clock, mutation, network or runtime ownership. */
export function buildAssetState({ snapshot, symbol, now, enabled, online }: StateInput): AssetState {
  const base = { symbol, ruleVersion: ASSET_STATE_RULES.version, calculatedAt: typeof now === "number" && Number.isFinite(now) && now > 0 ? now : null };
  const fail = (reason: StateReason, message: string): AssetState => ({ ...base, evidence: null, direction: { ...unavailable<"upward" | "downward" | "no_direction", DirectionMetrics>(reason, message), methodId: "direction-v1" }, volatility: { ...unavailable<"higher" | "lower" | "similar", VolatilityMetrics>(reason, message), methodId: "rms-v1" } });
  if (!online) return fail("offline", "网络已断开，恢复后重新核对状态");
  if (!enabled) return fail("paused", "监控已暂停，状态不作为当前结论");
  if (base.calculatedAt === null) return fail("awaiting_clock", "等待时钟与市场数据");
  const at = base.calculatedAt;
  const prepared = prepareStateInput(snapshot, symbol, at);
  if (!prepared.ok) return fail(prepared.failure.reason, prepared.failure.message);
  const { bars, history, quote } = prepared.data;
  const lastEnd = bars.at(-1)!.time + history.intervalMs;
  const window = bars.slice(-ASSET_STATE_RULES.returnCount - 1);
  const evidence: NonNullable<AssetState["evidence"]> = {
    intervalMs: history.intervalMs, pointCount: window.length, returnCount: ASSET_STATE_RULES.returnCount, validatedPointCount: bars.length,
    firstCandleStartAt: window[0].time, closeStartAt: window[0].time + history.intervalMs, closeEndAt: lastEnd, evidenceEndAt: lastEnd,
    source: history.source, currency: history.currency, quoteAt: quote.timestamp, quoteFetchedAt: quote.fetchedAt, historyFetchedAt: history.fetchedAt,
  };
  const floor = assetFor(symbol).market === "crypto" ? ASSET_STATE_RULES.cryptoDirectionFloor : ASSET_STATE_RULES.otherDirectionFloor;
  const direction = directionForWindow(window, floor, "20 个收盘间隔内的净变化与路径效率；描述已发生的方向结构，不代表趋势预测或震荡判断。");
  const volatility = volatilityForWindow(window, history.intervalMs, ASSET_STATE_RULES.currentReturns, ASSET_STATE_RULES.baselineReturns, "最近 4 个简单收益率的 RMS，与此前不重叠的 16 个比较；不是标准差或年化波动，较低不等于低风险。");
  return { ...base, evidence, direction: { ...direction, methodId: "direction-v1" }, volatility: { ...volatility, methodId: "rms-v1" } };
}
