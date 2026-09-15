import { assetFor, percent, type Point, type Quote } from "../market";
import type { RadarCoverage, RadarHistory, RadarSignal, RadarSignalEvidence, RadarSignalType, RadarSnapshot, RadarStore } from "./types";

const MINUTE = 60_000;
const COOLDOWN = 30 * MINUTE;
const LIFETIME = 45 * MINUTE;
const MAX_SIGNALS = 120;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
const rms = (values: number[]) => Math.sqrt(mean(values.map(value => value * value)));
type Evaluation = { signal: RadarSignal; strength: number };
type Prepared = { quote: Quote; history: RadarHistory; bars: Point[] };

const BENCHMARKS = new Set(["BTC-USDT", "QQQ", "SPY", "^GSPC", "^IXIC", "000300.SS", "000001.SS", "^HSI"]);
export function benchmarkFor(symbol: string): string | undefined {
  if (BENCHMARKS.has(symbol)) return undefined;
  const market = assetFor(symbol).market;
  return market === "crypto" ? "BTC-USDT" : market === "us" ? "QQQ" : market === "cn" ? "000300.SS" : market === "hk" ? "^HSI" : undefined;
}
export function benchmarkSymbols(symbols: string[]) { return [...new Set(symbols.map(benchmarkFor).filter((symbol): symbol is string => !!symbol))]; }

function relativeReadiness(snapshot: RadarSnapshot, symbol: string, asset: Prepared, now: number): true | string {
  const benchmarkSymbol = benchmarkFor(symbol);
  if (!benchmarkSymbol) return "当前标的是基准，未配置相对信号";
  const benchmark = prepare(snapshot, benchmarkSymbol, now);
  if (typeof benchmark === "string") return `${benchmarkSymbol}：${benchmark}`;
  if (benchmark.quote.session !== asset.quote.session) return "资产与基准交易时段不同";
  if (benchmark.history.source !== asset.history.source) return "资产与基准来源不同";
  if (benchmark.history.currency !== asset.history.currency) return "资产与基准币种不同";
  if (benchmark.history.intervalMs !== asset.history.intervalMs) return "资产与基准 K 线周期不同";
  if (Math.abs(benchmark.quote.timestamp - asset.quote.timestamp) > asset.history.intervalMs) return "资产与基准报价时间未同步";
  if (Math.abs(benchmark.bars.at(-1)!.time - asset.bars.at(-1)!.time) > asset.history.intervalMs) return "资产与基准最新完整 K 线未同步";
  const benchmarkTimes = new Set(benchmark.bars.map(point => point.time));
  const aligned = asset.bars.filter(point => benchmarkTimes.has(point.time)).length;
  const needed = 12 + (asset.history.intervalMs === 5 * MINUTE ? 3 : 1) + 1;
  return aligned >= needed ? true : `同步历史不足（${aligned}/${needed}）`;
}

/** Validate data once for all detectors. No fetch, browser clock, or market-session inference. */
function prepare(snapshot: RadarSnapshot, symbol: string, now: number): Prepared | string {
  const quote = snapshot.quotes[symbol];
  if (!quote) return "等待报价";
  if (quote.symbol !== symbol || quote.error) return "报价更新失败";
  if (!Number.isFinite(quote.price) || quote.price <= 0) return "报价无效";
  if (![quote.timestamp, quote.fetchedAt].every(Number.isFinite) || quote.timestamp > now + MINUTE || quote.fetchedAt > now + MINUTE || now - quote.fetchedAt > 2 * MINUTE || now - quote.timestamp > 3 * MINUTE) return "报价过期或延迟";
  const market = assetFor(symbol).market;
  if (market !== "crypto" && (quote.session !== "open" || (quote.delayMinutes ?? 0) > 2)) return "休市或延迟行情";
  const history = symbol.endsWith("-USDT") ? snapshot.histories[symbol] : { points: quote.points, intervalMs: 5 * MINUTE, source: quote.source, currency: quote.currency, fetchedAt: quote.fetchedAt };
  if (!history || !Array.isArray(history.points)) return "等待历史基线";
  if (history.source !== quote.source || history.currency !== quote.currency) return "历史来源或币种不匹配";
  if (!Number.isFinite(history.fetchedAt) || now - history.fetchedAt > 2 * MINUTE || history.fetchedAt > now + MINUTE) return "历史数据过期";
  if (history.intervalMs !== (symbol.endsWith("-USDT") ? 15 : 5) * MINUTE) return "历史周期不支持";
  // Yahoo's shared confirmed field assumes 15m. Compute completion from the actual 5m period.
  let bars = history.points.filter(point => point.time + history.intervalMs <= quote.timestamp && (!symbol.endsWith("-USDT") || point.confirmed === true)).slice(-80);
  // Never compare across overnight, lunch breaks, or missing bars. Use only the latest continuous segment.
  for (let i = bars.length - 1; i > 0; i--) {
    if (bars[i].time - bars[i - 1].time !== history.intervalMs) { bars = bars.slice(i); break; }
  }
  if (bars.length < 22) return "历史基线不足（至少 22 根连续完整 K 线）";
  for (let i = 0; i < bars.length; i++) {
    const point = bars[i];
    if (!Number.isFinite(point.time) || !Number.isFinite(point.close) || point.close <= 0) return "历史价格无效";
    if (i && point.time - bars[i - 1].time !== history.intervalMs) return "历史不连续，等待同一交易时段基线";
  }
  if (quote.timestamp - (bars.at(-1)!.time + history.intervalMs) > history.intervalMs + MINUTE) return "最近完整 K 线缺失";
  return { quote, history, bars };
}

export function radarCoverage(snapshot: RadarSnapshot, now: number): RadarCoverage[] {
  return [...new Set(snapshot.symbols)].map(symbol => {
    const data = prepare(snapshot, symbol, now);
    if (typeof data === "string") return { symbol, eligible: false, reason: data, relativeEligible: false, relativeReason: data };
    const relative = relativeReadiness(snapshot, symbol, data, now);
    return { symbol, eligible: true, reason: "基线可用", relativeEligible: relative === true, relativeReason: relative === true ? "同步基准可用" : relative };
  });
}

function evaluate(snapshot: RadarSnapshot, now: number): Evaluation[] {
  const evaluations: Evaluation[] = [];
  for (const symbol of new Set(snapshot.symbols)) {
    const data = prepare(snapshot, symbol, now);
    if (typeof data === "string") continue;
    const { quote, history, bars } = data;
    const market = assetFor(symbol).market;
    const latest = bars.at(-1)!;
    const returns = bars.slice(1).map((point, i) => (point.close / bars[i].close - 1) * 100);
    const freshnessRatio = Math.max(0, Math.min(1, Math.max(now - quote.fetchedAt, now - quote.timestamp) / (2 * MINUTE)));
    const push = (type: RadarSignalType, window: string, strength: number, title: string, metric: string, description: string, direction: RadarSignal["direction"], metrics: RadarSignal["metrics"], evidence: Omit<RadarSignalEvidence, "strength" | "freshnessRatio">) => {
      if (!Number.isFinite(strength)) return;
      const relativeKey = typeof metrics.benchmarkSymbol === "string" ? `:${metrics.benchmarkSymbol}` : "";
      const fingerprint = `${symbol}:${type}:${window}:${history.source}:${history.intervalMs}${type === "price_move" ? `:${direction}` : ""}${relativeKey}`;
      const evidenceAt = latest.time + history.intervalMs;
      evaluations.push({ strength, signal: {
        id: `${fingerprint}:${evidenceAt}`, fingerprint, symbol, market, type, title, metric, description, direction,
        severity: strength >= 3 ? "critical" : strength >= 1.5 ? "high" : "medium", status: "active",
        detectedAt: now, updatedAt: now, quoteAt: quote.timestamp, fetchedAt: quote.fetchedAt, evidenceAt, expiresAt: evidenceAt + LIFETIME,
        source: history.source, currency: quote.currency,
        metrics: { intervalMinutes: history.intervalMs / MINUTE, baselineBars: 20, close: latest.close, window, ...metrics },
        evidence: { ...evidence, strength, freshnessRatio },
      } });
    };
    // Same-length non-overlapping reference windows. Absolute noise floor prevents flat-price division artifacts.
    for (const minutes of history.intervalMs === 5 * MINUTE ? [5, 15, 60] : [15, 60]) {
      const steps = minutes * MINUTE / history.intervalMs;
      const references: number[] = [];
      for (let end = bars.length - 1 - steps; end >= steps && references.length < 20; end -= steps) references.push(Math.abs((bars[end].close / bars[end - steps].close - 1) * 100));
      if (references.length < 5) continue;
      const move = (latest.close / bars[bars.length - 1 - steps].close - 1) * 100;
      const baseline = median(references);
      const threshold = Math.max(market === "crypto" ? .6 : .3, baseline * 3);
      for (const direction of ["up", "down"] as const) {
        push("price_move", `${minutes}m`, (direction === "up" ? move : -move) / threshold, "价格异动", `${minutes} 分钟 ${percent(move)}`, `完整 K 线变化；近期同周期绝对变化中位数 ${baseline.toFixed(2)}%，触发线 ${threshold.toFixed(2)}%。`, direction, { movePercent: move, baselinePercent: baseline, thresholdPercent: threshold, referenceWindows: references.length }, { reason: `最近完整 ${minutes} 分钟窗口变化超过近期同周期基线。`, items: [{ label: "资产变化", value: move, unit: "%", baseline, threshold }], sampleSize: references.length, minimumSamples: 5 });
      }
    }
    const baselineReturns = returns.slice(-20, -4);
    const bufferPercent = Math.max(.1, median(baselineReturns.map(Math.abs)));
    const rangeBars = bars.slice(-21, -1);
    const hasRange = rangeBars.every(p => Number.isFinite(p.high) && Number.isFinite(p.low) && p.low! > 0 && p.high! >= p.close && p.low! <= p.close);
    if (hasRange) {
      const high = Math.max(...rangeBars.map(p => p.high!)), low = Math.min(...rangeBars.map(p => p.low!));
      const up = (latest.close / high - 1) * 100, down = (1 - latest.close / low) * 100;
      const context = `收盘价相对之前 20 根完整 K 线范围；确认缓冲 ${bufferPercent.toFixed(2)}%。`;
      push("breakout", "recent", up / bufferPercent, "区间突破", `高于区间上沿 ${percent(up)}`, context, "up", { rangeHigh: high, rangeLow: low, bufferPercent }, { reason: "最新完整 K 线收盘价越过之前 20 根 K 线区间和波动缓冲。", items: [{ label: "高于区间上沿", value: up, unit: "%", baseline: high, threshold: bufferPercent }], sampleSize: rangeBars.length, minimumSamples: 20 });
      push("breakdown", "recent", down / bufferPercent, "区间跌破", `低于区间下沿 ${percent(-down)}`, context, "down", { rangeHigh: high, rangeLow: low, bufferPercent }, { reason: "最新完整 K 线收盘价跌破之前 20 根 K 线区间和波动缓冲。", items: [{ label: "低于区间下沿", value: down, unit: "%", baseline: low, threshold: bufferPercent }], sampleSize: rangeBars.length, minimumSamples: 20 });
    }
    const baselineVolatility = rms(baselineReturns), currentVolatility = rms(returns.slice(-4));
    const volatilityThreshold = Math.max(market === "crypto" ? .25 : .15, baselineVolatility * 3);
    push("volatility_spike", "4bars", currentVolatility / volatilityThreshold, "波动放大", `短周期波动 ${currentVolatility.toFixed(2)}%`, `最近 4 根收益率均方根，之前 16 根基线 ${baselineVolatility.toFixed(2)}%；非年化波动率。`, "neutral", { baselineVolatility, currentVolatility, thresholdPercent: volatilityThreshold, baselineBars: 16 }, { reason: "最近 4 根完整 K 线的非年化波动率超过此前 16 根基线。", items: [{ label: "当前波动", value: currentVolatility, unit: "%", baseline: baselineVolatility, threshold: volatilityThreshold }], sampleSize: baselineReturns.length, minimumSamples: 16 });
    // Only OKX completed candles: quote volume is rolling quote-currency turnover, not candle volume.
    const volumeBars = bars.slice(-21);
    if (symbol.endsWith("-USDT") && volumeBars.every(p => p.volume !== undefined && Number.isFinite(p.volume) && p.volume >= 0)) {
      const baselineVolume = mean(volumeBars.slice(0, -1).map(p => p.volume!));
      if (baselineVolume > 0) {
        const multiple = latest.volume! / baselineVolume;
        push("volume_spike", "15m", multiple / 2.5, "成交量异常", `15 分钟成交量 ${multiple.toFixed(2)}×`, "相对前 20 根完整 K 线平均基础币成交量；不使用滚动 24 小时成交额。", "neutral", { volume: latest.volume!, baselineVolume, multiple, thresholdMultiple: 2.5 }, { reason: "最新完整 15 分钟 K 线成交量超过此前 20 根平均量的 2.5 倍。", items: [{ label: "成交量倍数", value: multiple, unit: "×", baseline: baselineVolume, threshold: 2.5 }], sampleSize: 20, minimumSamples: 20 });
      }
    }

    const benchmarkSymbol = benchmarkFor(symbol);
    if (benchmarkSymbol) {
      const benchmark = prepare(snapshot, benchmarkSymbol, now);
      if (typeof benchmark !== "string" && benchmark.quote.session === quote.session && benchmark.history.source === history.source && benchmark.history.currency === history.currency && benchmark.history.intervalMs === history.intervalMs && Math.abs(benchmark.quote.timestamp - quote.timestamp) <= history.intervalMs) {
        const byTime = new Map(benchmark.bars.map(point => [point.time, point]));
        const pairs = bars.flatMap(point => { const reference = byTime.get(point.time); return reference ? [{ time: point.time, asset: point.close, benchmark: reference.close }] : []; });
        const steps = market === "crypto" ? 1 : 3;
        const minimum = 12;
        const latestPair = pairs.at(-1);
        const referencePair = pairs[pairs.length - 1 - steps];
        if (latestPair && referencePair && Math.abs((latestPair.time + history.intervalMs) - (benchmark.bars.at(-1)!.time + history.intervalMs)) <= history.intervalMs) {
          const references: number[] = [];
          for (let end = pairs.length - 1 - steps; end >= steps && references.length < 20; end--) {
            const assetReturn = (pairs[end].asset / pairs[end - steps].asset - 1) * 100;
            const benchmarkReturn = (pairs[end].benchmark / pairs[end - steps].benchmark - 1) * 100;
            references.push(Math.abs(assetReturn - benchmarkReturn));
          }
          if (references.length >= minimum) {
            const assetReturn = (latestPair.asset / referencePair.asset - 1) * 100;
            const benchmarkReturn = (latestPair.benchmark / referencePair.benchmark - 1) * 100;
            const delta = assetReturn - benchmarkReturn;
            const baseline = median(references);
            const threshold = Math.max(market === "crypto" ? .6 : .35, baseline * 3);
            const evidenceAt = latestPair.time + history.intervalMs;
            for (const direction of ["up", "down"] as const) {
              const type = direction === "up" ? "relative_strength" : "relative_weakness";
              push(type, "15m", (direction === "up" ? delta : -delta) / threshold, direction === "up" ? "相对强势" : "相对弱势", `相对 ${benchmarkSymbol} ${percent(delta)}`, `资产 15 分钟变化 ${percent(assetReturn)}；${benchmarkSymbol} ${percent(benchmarkReturn)}；相对差 ${percent(delta)}。`, direction, { assetReturnPercent: assetReturn, benchmarkReturnPercent: benchmarkReturn, relativeDeltaPercent: delta, relativeBaselinePercent: baseline, thresholdPercent: threshold, referenceWindows: references.length, benchmarkSymbol, benchmarkQuoteAt: benchmark.quote.timestamp, benchmarkFetchedAt: benchmark.quote.fetchedAt, benchmarkEvidenceAt: evidenceAt }, { reason: `资产与 ${benchmarkSymbol} 的同步 15 分钟相对变化超过自身近期相对差基线。`, items: [{ label: "资产变化", value: assetReturn, unit: "%" }, { label: `${benchmarkSymbol} 变化`, value: benchmarkReturn, unit: "%" }, { label: "相对差", value: delta, unit: "%", baseline, threshold }], sampleSize: references.length, minimumSamples: minimum, benchmark: { symbol: benchmarkSymbol, returnPercent: benchmarkReturn, quoteAt: benchmark.quote.timestamp, fetchedAt: benchmark.quote.fetchedAt, evidenceAt } });
            }
          }
        }
      }
    }
  }
  return evaluations;
}

/** Bounded session store; fingerprint merges polling updates, 70% recovery hysteresis and 30m cooldown rearm episodes. */
export function scanRadar(previous: RadarStore, snapshot: RadarSnapshot, now: number, enabled = true): RadarStore {
  const evaluations = enabled ? evaluate(snapshot, now) : [];
  const byKey = new Map(evaluations.map(item => [item.signal.fingerprint, item]));
  const monitored = new Set(snapshot.symbols);
  const monitoredGates = Object.entries(previous.gates).filter(([key]) => monitored.has(key.split(":")[0]));
  const recentGates = Object.entries(previous.gates).filter(([key, gate]) => !monitored.has(key.split(":")[0]) && now - gate.lastTriggeredAt < 24 * 60 * MINUTE).sort((a, b) => b[1].lastTriggeredAt - a[1].lastTriggeredAt).slice(0, 128);
  // An ongoing monitored episode must survive retention; only detached gates are evicted.
  const gates = Object.fromEntries([...monitoredGates, ...recentGates]);
  for (const item of evaluations) {
    const gate = gates[item.signal.fingerprint];
    if (gate && !gate.recovered && item.strength < .7 && item.signal.evidenceAt > gate.evidenceAt) gates[item.signal.fingerprint] = { ...gate, recovered: true };
  }
  const signals = previous.signals.map(signal => {
    if (signal.status !== "active") return signal;
    const next = byKey.get(signal.fingerprint);
    if (now >= signal.expiresAt || !next) return { ...signal, status: "expired" as const, updatedAt: now };
    if (next.strength < .7) return { ...signal, status: "resolved" as const, updatedAt: now };
    return signal;
  });
  for (const { signal, strength } of evaluations) {
    if (strength < 1 || signals.some(item => item.fingerprint === signal.fingerprint && item.status === "active")) continue;
    const gate = gates[signal.fingerprint];
    if (gate && (!gate.recovered || signal.evidenceAt <= gate.evidenceAt || now - gate.lastTriggeredAt < COOLDOWN)) continue;
    signals.push(signal);
    gates[signal.fingerprint] = { lastTriggeredAt: now, evidenceAt: signal.evidenceAt, recovered: false };
  }
  const sorted = signals.sort((a, b) => b.detectedAt - a.detectedAt || a.id.localeCompare(b.id)).slice(0, MAX_SIGNALS);
  const sameSignals = sorted.length === previous.signals.length && sorted.every((signal, i) => signal === previous.signals[i]);
  const entries = Object.entries(gates);
  const sameGates = entries.length === Object.keys(previous.gates).length && entries.every(([key, gate]) => gate === previous.gates[key]);
  if (sameSignals && sameGates) return previous;
  return { signals: sameSignals ? previous.signals : sorted, gates: sameGates ? previous.gates : gates };
}
