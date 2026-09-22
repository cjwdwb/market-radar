import { assetFor, type Quote } from "../market";
import { benchmarkFor } from "./engine";
import { MINUTE, pairPreparedInputs, type PreparedMarketInput, type PreparedPair } from "./market-input";
import { prepareStateInput, directionForWindow, volatilityForWindow, stateUnavailable, type AssetState, type StateInput, type StateReason, type StateAvailability, type DirectionMetrics, type VolatilityMetrics } from "./asset-state";

export type HorizonId = "short" | "medium";
export type HorizonConfigId = "short90-v1" | "medium180-v1";
export type DirectionClassification = "upward" | "downward" | "no_direction";
export type VolatilityClassification = "higher" | "lower" | "similar";
export type RelativeClassification = "stronger" | "underperforming" | "similar";
export type CloseWindow = { closeStartAt: number; closeEndAt: number };
export type HorizonEvidence = NonNullable<AssetState["evidence"]> & {
  horizonId: HorizonId; durationMs: number; configId: HorizonConfigId;
  currentReturnCount: number; baselineReturnCount: number;
  currentStartAt: number; baselineStartAt: number; baselineEndAt: number;
};
export type HorizonState = {
  horizonId: HorizonId; durationMs: number; configId: HorizonConfigId;
  direction: AssetState["direction"]; volatility: AssetState["volatility"];
  evidence: HorizonEvidence | null;
};
export type RelativeReason = StateReason | "no_benchmark" | "self_benchmark" | "benchmark_input_failed" | "market_mismatch" | "source_mismatch" | "currency_mismatch" | "session_mismatch" | "interval_mismatch" | "quote_unsynchronized" | "tail_mismatch" | "pair_grid_mismatch" | "insufficient_pair_window";
export type RelativeMetrics = {
  assetReturnPercent: number; benchmarkReturnPercent: number;
  deltaPercentagePoints: number; thresholdPercentagePoints: number; unit: "percentage_points";
};
export type PairProvenance = {
  symbol: string; source: string; currency: string; session: Quote["session"];
  latestEndAt: number; quoteAt: number; quoteFetchedAt: number; historyFetchedAt: number;
};
export type RelativeEvidence = CloseWindow & {
  symbol: string; benchmarkSymbol: string; horizonId: "short";
  methodId: "relative-window-v1"; configId: "short90-v1"; durationMs: number;
  pointCount: number; returnCount: number; intervalMs: number;
  asset: PairProvenance; benchmark: PairProvenance;
};
export type RelativeState = {
  horizonId: "short"; durationMs: number; configId: "short90-v1"; methodId: "relative-window-v1";
  benchmarkSymbol: string | null; label: string; message: string;
  evidence: RelativeEvidence | null; inputReason: StateReason | null; failedSide: "asset" | "benchmark" | null;
} & (
  { availability: "available"; classification: RelativeClassification; reason: null; metrics: RelativeMetrics } |
  { availability: Exclude<StateAvailability, "available">; classification: null; reason: RelativeReason; metrics: null }
);
export type AlignmentParticipant = "short.direction" | "medium.direction" | "short.relative";
export type AlignmentEvidence = CloseWindow & {
  participant: AlignmentParticipant; classification: DirectionClassification | RelativeClassification;
  horizonId: HorizonId; durationMs: number; methodId: string; configId: HorizonConfigId;
};
export type AlignmentState = {
  methodId: "state-alignment-v1"; classification: "aligned" | "mixed" | "neutral" | "insufficient";
  label: string; message: string; closeEndAt: number | null;
  required: AlignmentParticipant[]; evaluated: AlignmentEvidence[];
  missing: { participant: AlignmentParticipant; reason: StateReason | RelativeReason | "incompatible_evidence"; message: string }[];
};
export type TransitionDimension = "direction" | "volatility" | "relative";
export type TransitionWindows = { dependency: CloseWindow; observation: CloseWindow; baseline: CloseWindow | null };
export type TransitionPoint = {
  ruleVersion: "asset-state-v2"; horizonId: HorizonId; benchmarkSymbol: string | null;
  classification: DirectionClassification | VolatilityClassification | RelativeClassification;
  metrics: DirectionMetrics | VolatilityMetrics | RelativeMetrics;
  methodId: string; configId: HorizonConfigId; intervalMs: number; source: string; currency: string;
  windows: TransitionWindows;
};
export type StateTransition = {
  methodId: "historical-adjacent-v1"; horizonId: HorizonId; dimension: TransitionDimension;
  status: "changed" | "unchanged" | "unavailable"; availability: StateAvailability;
  reason: StateReason | RelativeReason | "current_unavailable" | "insufficient_previous" | "previous_unavailable" | null;
  inputReason: StateReason | RelativeReason | null; label: string; message: string;
  shiftMs: number; returnOverlapMs: 0; baselineOverlapMs: number; overlapMessage: string;
  currentWindow: TransitionWindows | null; previousWindow: TransitionWindows | null;
  current: TransitionPoint | null; previous: TransitionPoint | null;
};
export type AssetStateV2 = {
  symbol: string; ruleVersion: "asset-state-v2"; calculatedAt: number | null;
  horizons: { short: HorizonState; medium: HorizonState };
  relative: RelativeState; alignment: AlignmentState;
  transitions: { short: { direction: StateTransition; volatility: StateTransition; relative: StateTransition }; medium: { direction: StateTransition; volatility: StateTransition } };
};

export const ASSET_STATE_V2_RULES = Object.freeze({
  version: "asset-state-v2" as const, horizonMethodId: "elapsed-v1" as const,
  short: Object.freeze({ durationMs: 90 * MINUTE, configId: "short90-v1" as const, cryptoDirectionFloor: .30, otherDirectionFloor: .15 }),
  medium: Object.freeze({ durationMs: 180 * MINUTE, configId: "medium180-v1" as const, cryptoDirectionFloor: .60, otherDirectionFloor: .30 }),
  cryptoRelativeFloor: .30, otherRelativeFloor: .15,
});

type Failure = { reason: StateReason; message: string };
type RelativeContext = { symbol: string; benchmarkSymbol: string; asset: PreparedMarketInput; benchmark: PreparedMarketInput; pairs: PreparedPair[] };
const lastEnd = (data: PreparedMarketInput) => data.bars.at(-1)!.time + data.history.intervalMs;
const directionMessage = (durationMs: number) => `${durationMs / MINUTE} 分钟内的净变化与路径效率；描述已发生的方向结构，不代表趋势预测或震荡判断。`;
const volatilityMessage = (durationMs: number) => `最近 ${durationMs / (3 * MINUTE)} 分钟简单收益率的 RMS，与此前不重叠的 ${2 * durationMs / (3 * MINUTE)} 分钟比较；不是标准差或年化波动，较低不等于低风险。`;

function horizonState(symbol: string, horizonId: HorizonId, data: PreparedMarketInput | null, failure: Failure | null, shiftSteps = 0): HorizonState {
  const config = ASSET_STATE_V2_RULES[horizonId];
  const base = { horizonId, durationMs: config.durationMs, configId: config.configId };
  const fail = (reason: StateReason, message: string): HorizonState => ({ ...base, evidence: null,
    direction: { ...stateUnavailable<DirectionClassification, DirectionMetrics>(reason, message), methodId: "direction-v1" },
    volatility: { ...stateUnavailable<VolatilityClassification, VolatilityMetrics>(reason, message), methodId: "rms-v1" } });
  if (!data) return fail(failure!.reason, failure!.message);
  const { bars, history, quote } = data;
  const count = config.durationMs / history.intervalMs, currentCount = count / 3, baselineCount = count - currentCount;
  const endIndex = bars.length - 1 - shiftSteps;
  if (endIndex < count) return fail("insufficient_contiguous_bars", `完整 ${config.durationMs / MINUTE} 分钟窗口需要 ${count + 1} 个连续收盘点，当前可用 ${Math.max(0, endIndex + 1)} 个；不跨休市拼接或缩短窗口。`);
  const window = bars.slice(endIndex - count, endIndex + 1);
  const closeEndAt = window.at(-1)!.time + history.intervalMs;
  const evidence: HorizonEvidence = {
    ...base, intervalMs: history.intervalMs, pointCount: window.length, returnCount: count, validatedPointCount: bars.length,
    firstCandleStartAt: window[0].time, closeStartAt: window[0].time + history.intervalMs, closeEndAt, evidenceEndAt: closeEndAt,
    source: history.source, currency: history.currency, quoteAt: quote.timestamp, quoteFetchedAt: quote.fetchedAt, historyFetchedAt: history.fetchedAt,
    currentReturnCount: currentCount, baselineReturnCount: baselineCount, currentStartAt: closeEndAt - config.durationMs / 3,
    baselineStartAt: closeEndAt - config.durationMs, baselineEndAt: closeEndAt - config.durationMs / 3,
  };
  const floor = assetFor(symbol).market === "crypto" ? config.cryptoDirectionFloor : config.otherDirectionFloor;
  return { ...base, evidence,
    direction: { ...directionForWindow(window, floor, directionMessage(config.durationMs)), methodId: "direction-v1" },
    volatility: { ...volatilityForWindow(window, history.intervalMs, currentCount, baselineCount, volatilityMessage(config.durationMs)), methodId: "rms-v1" } };
}

function relativeFailure(benchmarkSymbol: string | null, reason: RelativeReason, availability: Exclude<StateAvailability, "available">, message: string, inputReason: StateReason | null = null, failedSide: "asset" | "benchmark" | null = null): RelativeState {
  return { horizonId: "short", durationMs: ASSET_STATE_V2_RULES.short.durationMs, configId: "short90-v1", methodId: "relative-window-v1", benchmarkSymbol,
    availability, classification: null, reason, label: "暂不可判断", message, metrics: null, evidence: null, inputReason, failedSide };
}

function provenance(symbol: string, data: PreparedMarketInput): PairProvenance {
  return { symbol, source: data.history.source, currency: data.history.currency, session: data.quote.session,
    latestEndAt: lastEnd(data), quoteAt: data.quote.timestamp, quoteFetchedAt: data.quote.fetchedAt, historyFetchedAt: data.history.fetchedAt };
}

function relativeForWindow(context: RelativeContext, shiftSteps = 0): RelativeState {
  const { symbol, benchmarkSymbol, asset, benchmark, pairs } = context;
  const durationMs = ASSET_STATE_V2_RULES.short.durationMs, intervalMs = asset.history.intervalMs;
  const count = durationMs / intervalMs, endIndex = pairs.length - 1 - shiftSteps;
  if (endIndex < count) return relativeFailure(benchmarkSymbol, "insufficient_pair_window", "insufficient", `相对表现需要同一完整 ${durationMs / MINUTE} 分钟的 ${count + 1} 个配对收盘点。`);
  const window = pairs.slice(endIndex - count, endIndex + 1);
  const expectedEnd = lastEnd(asset) - shiftSteps * intervalMs;
  if (window.some((point, index) => point.time + intervalMs !== expectedEnd - (count - index) * intervalMs)) return relativeFailure(benchmarkSymbol, "pair_grid_mismatch", "invalid", "资产与基准未覆盖完全相同的收盘时间网格");
  const assetReturnPercent = (window.at(-1)!.asset / window[0].asset - 1) * 100;
  const benchmarkReturnPercent = (window.at(-1)!.benchmark / window[0].benchmark - 1) * 100;
  const deltaPercentagePoints = assetReturnPercent - benchmarkReturnPercent;
  if (![assetReturnPercent, benchmarkReturnPercent, deltaPercentagePoints].every(Number.isFinite)) return relativeFailure(benchmarkSymbol, "invalid_numeric", "invalid", "相对收益无法形成有限数值");
  const thresholdPercentagePoints = assetFor(symbol).market === "crypto" ? ASSET_STATE_V2_RULES.cryptoRelativeFloor : ASSET_STATE_V2_RULES.otherRelativeFloor;
  const classification = deltaPercentagePoints >= thresholdPercentagePoints ? "stronger" : deltaPercentagePoints <= -thresholdPercentagePoints ? "underperforming" : "similar";
  const metrics: RelativeMetrics = { assetReturnPercent, benchmarkReturnPercent, deltaPercentagePoints, thresholdPercentagePoints, unit: "percentage_points" };
  return { horizonId: "short", durationMs, configId: "short90-v1", methodId: "relative-window-v1", benchmarkSymbol,
    availability: "available", classification, reason: null, inputReason: null, failedSide: null,
    label: { stronger: "相对跑赢", underperforming: "相对跑输", similar: "相对接近" }[classification],
    message: `同一 ${durationMs / MINUTE} 分钟窗口与 ${benchmarkSymbol} 的收益差，单位为百分点；是历史相对表现，不代表超额收益预测。`, metrics,
    evidence: { symbol, benchmarkSymbol, horizonId: "short", methodId: "relative-window-v1", configId: "short90-v1", durationMs,
      pointCount: window.length, returnCount: count, intervalMs, closeStartAt: window[0].time + intervalMs, closeEndAt: expectedEnd,
      asset: provenance(symbol, asset), benchmark: provenance(benchmarkSymbol, benchmark) } };
}

function prepareRelative(input: StateInput, at: number | null, asset: PreparedMarketInput | null, failure: Failure | null): { state: RelativeState; context: RelativeContext | null } {
  const mapped = benchmarkFor(input.symbol), benchmarkSymbol = typeof mapped === "string" ? mapped : null;
  const reject = (reason: RelativeReason, availability: Exclude<StateAvailability, "available">, message: string, inputReason: StateReason | null = null, failedSide: "asset" | "benchmark" | null = null) => ({ state: relativeFailure(benchmarkSymbol, reason, availability, message, inputReason, failedSide), context: null });
  if (!asset) {
    const dimension = stateUnavailable(failure!.reason, failure!.message);
    return reject(failure!.reason, dimension.availability as Exclude<StateAvailability, "available">, failure!.message, failure!.reason, "asset");
  }
  if (!benchmarkSymbol) return reject("no_benchmark", "unsupported", "当前标的暂未配置可靠基准");
  if (benchmarkSymbol === input.symbol) return reject("self_benchmark", "unsupported", "基准不能与当前资产相同");
  const prepared = prepareStateInput(input.snapshot, benchmarkSymbol, at!);
  if (!prepared.ok) {
    const dimension = stateUnavailable(prepared.failure.reason, prepared.failure.message);
    return reject("benchmark_input_failed", dimension.availability as Exclude<StateAvailability, "available">, `${benchmarkSymbol}：${prepared.failure.message}`, prepared.failure.reason, "benchmark");
  }
  const benchmark = prepared.data;
  if (assetFor(input.symbol).market !== assetFor(benchmarkSymbol).market) return reject("market_mismatch", "invalid", "资产与基准市场不同");
  if (asset.history.source !== benchmark.history.source) return reject("source_mismatch", "invalid", "资产与基准来源不同");
  if (asset.history.currency !== benchmark.history.currency) return reject("currency_mismatch", "invalid", "资产与基准币种不同");
  if (asset.quote.session !== benchmark.quote.session) return reject("session_mismatch", "invalid", "资产与基准交易时段不同");
  if (asset.history.intervalMs !== benchmark.history.intervalMs) return reject("interval_mismatch", "invalid", "资产与基准 K 线周期不同");
  if (Math.abs(asset.quote.timestamp - benchmark.quote.timestamp) > asset.history.intervalMs) return reject("quote_unsynchronized", "invalid", "资产与基准报价时间未同步");
  const tailDifference = lastEnd(asset) - lastEnd(benchmark);
  if (tailDifference % asset.history.intervalMs !== 0) return reject("pair_grid_mismatch", "invalid", "资产与基准收盘时间网格不同，无法精确配对");
  if (tailDifference !== 0) return reject("tail_mismatch", "insufficient", "资产与基准最新完整收盘尚未对齐，等待同一结束点");
  const context = { symbol: input.symbol, benchmarkSymbol, asset, benchmark, pairs: pairPreparedInputs(asset, benchmark) };
  return { state: relativeForWindow(context), context };
}

/** Describes available relationships; RMS has no directional vote. */
export function buildStateAlignment(horizons: AssetStateV2["horizons"], relative: RelativeState): AlignmentState {
  const required: AlignmentParticipant[] = ["short.direction", "medium.direction", "short.relative"];
  const candidates = [
    { participant: required[0], dimension: horizons.short.direction, evidence: horizons.short.evidence, horizonId: "short" as const, durationMs: horizons.short.durationMs, configId: horizons.short.configId },
    { participant: required[1], dimension: horizons.medium.direction, evidence: horizons.medium.evidence, horizonId: "medium" as const, durationMs: horizons.medium.durationMs, configId: horizons.medium.configId },
    { participant: required[2], dimension: relative, evidence: relative.evidence, horizonId: "short" as const, durationMs: relative.durationMs, configId: relative.configId },
  ];
  const closeEndAt = candidates.find(candidate => candidate.dimension.availability === "available" && candidate.evidence)?.evidence?.closeEndAt ?? null;
  const evaluated: AlignmentEvidence[] = [], missing: AlignmentState["missing"] = [];
  for (const candidate of candidates) {
    if (candidate.dimension.availability !== "available") missing.push({ participant: candidate.participant, reason: candidate.dimension.reason, message: candidate.dimension.message });
    else if (!candidate.evidence || candidate.evidence.closeEndAt !== closeEndAt) missing.push({ participant: candidate.participant, reason: "incompatible_evidence", message: "证据结束点不同，不能作为同一时点的关系比较" });
    else evaluated.push({ participant: candidate.participant, classification: candidate.dimension.classification, horizonId: candidate.horizonId, durationMs: candidate.durationMs,
      methodId: candidate.dimension.methodId, configId: candidate.configId, closeStartAt: candidate.evidence.closeStartAt, closeEndAt: candidate.evidence.closeEndAt });
  }
  const short = evaluated.find(item => item.participant === "short.direction")?.classification;
  const medium = evaluated.find(item => item.participant === "medium.direction")?.classification;
  const compared = evaluated.find(item => item.participant === "short.relative")?.classification;
  const directionDiffers = !!short && !!medium && short !== medium;
  const referenceDiffers = short === "upward" && compared === "underperforming" || short === "downward" && compared === "stronger";
  const aligned = short === "upward" && medium === "upward" && compared === "stronger" || short === "downward" && medium === "downward" && compared === "underperforming";
  const classification = directionDiffers || referenceDiffers ? "mixed" : missing.length ? "insufficient" : aligned ? "aligned" : "neutral";
  const label = { aligned: "方向关系一致", mixed: "已知关系不同", neutral: "暂无共同方向确认", insufficient: "关系证据不足" }[classification];
  const message = { aligned: "短中方向与短窗相对参照取向一致；这些结果共享数据，不是独立确认，也不代表预测。", mixed: "已计算的窗口结构或绝对与相对参照存在不同；并不表示数据互相矛盾，缺失项仍单独披露。", neutral: "参与项均已计算，但没有共同方向确认；不表示震荡或低风险。", insufficient: "没有已知分歧，但部分方向或短窗相对参照缺失，暂不能形成完整关系。" }[classification];
  return { methodId: "state-alignment-v1", classification, label, message, closeEndAt, required, evaluated, missing };
}

function transitionBase(horizonId: HorizonId, dimension: TransitionDimension): StateTransition {
  const durationMs = ASSET_STATE_V2_RULES[horizonId].durationMs, rms = dimension === "volatility";
  return { methodId: "historical-adjacent-v1", horizonId, dimension, status: "unavailable", availability: "insufficient", reason: "insufficient_previous", inputReason: null,
    label: "暂无法比较前窗", message: "前一完整历史窗口尚未形成", shiftMs: rms ? durationMs / 3 : durationMs, returnOverlapMs: 0,
    baselineOverlapMs: rms ? durationMs / 3 : 0, overlapMessage: rms ? "相邻观测收益不重叠；两次基线共享一个观测时长，且新基线包含前次观测。类别变化可能来自当前值与滚动基线，不是独立样本确认。" : "相邻窗口仅共享分界收盘点，收益区间不重叠。",
    currentWindow: null, previousWindow: null, current: null, previous: null };
}

function transitionWindows(evidence: CloseWindow, dimension: TransitionDimension): TransitionWindows {
  const dependency = { closeStartAt: evidence.closeStartAt, closeEndAt: evidence.closeEndAt };
  const durationMs = dependency.closeEndAt - dependency.closeStartAt;
  return { dependency,
    observation: { closeStartAt: dimension === "volatility" ? dependency.closeEndAt - durationMs / 3 : dependency.closeStartAt, closeEndAt: dependency.closeEndAt },
    baseline: dimension === "volatility" ? { closeStartAt: dependency.closeStartAt, closeEndAt: dependency.closeEndAt - durationMs / 3 } : null };
}

function shiftedWindows(windows: TransitionWindows, shiftMs: number): TransitionWindows {
  const shift = (window: CloseWindow): CloseWindow => ({ closeStartAt: window.closeStartAt - shiftMs, closeEndAt: window.closeEndAt - shiftMs });
  return { dependency: shift(windows.dependency), observation: shift(windows.observation), baseline: windows.baseline ? shift(windows.baseline) : null };
}

function horizonPoint(horizon: HorizonState, dimension: "direction" | "volatility"): TransitionPoint | null {
  const current = horizon[dimension], evidence = horizon.evidence;
  if (current.availability !== "available" || !evidence) return null;
  return { ruleVersion: "asset-state-v2", horizonId: horizon.horizonId, benchmarkSymbol: null,
    classification: current.classification, metrics: current.metrics, methodId: current.methodId, configId: horizon.configId,
    intervalMs: evidence.intervalMs, source: evidence.source, currency: evidence.currency, windows: transitionWindows(evidence, dimension) };
}

function relativePoint(relative: RelativeState): TransitionPoint | null {
  if (relative.availability !== "available" || !relative.evidence) return null;
  return { ruleVersion: "asset-state-v2", horizonId: "short", benchmarkSymbol: relative.benchmarkSymbol,
    classification: relative.classification, metrics: relative.metrics, methodId: relative.methodId, configId: relative.configId,
    intervalMs: relative.evidence.intervalMs, source: relative.evidence.asset.source, currency: relative.evidence.asset.currency, windows: transitionWindows(relative.evidence, "relative") };
}

function completedTransition(base: StateTransition, current: TransitionPoint, previous: TransitionPoint, currentLabel: string, previousLabel: string): StateTransition {
  const status = current.classification === previous.classification ? "unchanged" : "changed";
  return { ...base, status, availability: "available", reason: null, inputReason: null, current, previous,
    label: status === "changed" ? "相邻窗口类别不同" : "相邻窗口类别相同",
    message: `前窗「${previousLabel}」→本窗「${currentLabel}」；按同一方法重算历史相邻窗口，不是精确变化时刻、实时事件或反转预测。` };
}

/** Historical anchors only slice already validated bars; the live clock is never replaced. */
function horizonTransition(symbol: string, horizon: HorizonState, dimension: "direction" | "volatility", data: PreparedMarketInput | null): StateTransition {
  const base = transitionBase(horizon.horizonId, dimension), current = horizon[dimension];
  const currentPoint = horizonPoint(horizon, dimension);
  const currentWindow = horizon.evidence ? transitionWindows(horizon.evidence, dimension) : null;
  const prepared = { ...base, current: currentPoint, currentWindow, previousWindow: currentWindow ? shiftedWindows(currentWindow, base.shiftMs) : null };
  if (current.availability !== "available" || !currentPoint || !data) return { ...prepared, reason: "current_unavailable", inputReason: current.reason, availability: current.availability === "available" ? "insufficient" : current.availability, message: `本窗暂不可判断：${current.message}` };
  const previousHorizon = horizonState(symbol, horizon.horizonId, data, null, base.shiftMs / data.history.intervalMs);
  const previous = previousHorizon[dimension], previousPoint = horizonPoint(previousHorizon, dimension);
  if (previous.availability !== "available" || !previousPoint) return { ...prepared,
    reason: previous.reason === "insufficient_contiguous_bars" ? "insufficient_previous" : "previous_unavailable", inputReason: previous.reason,
    availability: previous.availability === "available" ? "insufficient" : previous.availability, message: `本窗仍有效；前窗暂无法比较：${previous.message}` };
  return completedTransition(prepared, currentPoint, previousPoint, current.label, previous.label);
}

function relativeTransition(relative: RelativeState, context: RelativeContext | null): StateTransition {
  const base = transitionBase("short", "relative"), current = relativePoint(relative);
  const currentWindow = relative.evidence ? transitionWindows(relative.evidence, "relative") : null;
  const prepared = { ...base, current, currentWindow, previousWindow: currentWindow ? shiftedWindows(currentWindow, base.shiftMs) : null };
  if (relative.availability !== "available" || !current || !context) return { ...prepared, reason: "current_unavailable", inputReason: relative.reason,
    availability: relative.availability === "available" ? "insufficient" : relative.availability, message: `本窗暂不可判断：${relative.message}` };
  const previousState = relativeForWindow(context, base.shiftMs / context.asset.history.intervalMs), previous = relativePoint(previousState);
  if (previousState.availability !== "available" || !previous) return { ...prepared,
    reason: previousState.reason === "insufficient_pair_window" ? "insufficient_previous" : "previous_unavailable", inputReason: previousState.reason,
    availability: previousState.availability === "available" ? "insufficient" : previousState.availability, message: `本窗仍有效；前窗暂无法比较：${previousState.message}` };
  return completedTransition(prepared, current, previous, relative.label, previousState.label);
}

/** One selected asset, one existing benchmark, one explicit live preparation per side. */
export function buildAssetStateV2(input: StateInput): AssetStateV2 {
  const calculatedAt = typeof input.now === "number" && Number.isFinite(input.now) && input.now > 0 ? input.now : null;
  let failure: Failure | null = !input.online ? { reason: "offline", message: "网络已断开，恢复后重新核对状态" } : !input.enabled ? { reason: "paused", message: "监控已暂停，状态不作为当前结论" } : calculatedAt === null ? { reason: "awaiting_clock", message: "等待时钟与市场数据" } : null;
  let data: PreparedMarketInput | null = null;
  if (!failure) {
    const prepared = prepareStateInput(input.snapshot, input.symbol, calculatedAt!);
    if (prepared.ok) data = prepared.data;
    else failure = prepared.failure;
  }
  const horizons = { short: horizonState(input.symbol, "short", data, failure), medium: horizonState(input.symbol, "medium", data, failure) };
  const relative = prepareRelative(input, calculatedAt, data, failure);
  return { symbol: input.symbol, ruleVersion: "asset-state-v2", calculatedAt, horizons, relative: relative.state, alignment: buildStateAlignment(horizons, relative.state),
    transitions: {
      short: { direction: horizonTransition(input.symbol, horizons.short, "direction", data), volatility: horizonTransition(input.symbol, horizons.short, "volatility", data), relative: relativeTransition(relative.state, relative.context) },
      medium: { direction: horizonTransition(input.symbol, horizons.medium, "direction", data), volatility: horizonTransition(input.symbol, horizons.medium, "volatility", data) },
    } };
}
