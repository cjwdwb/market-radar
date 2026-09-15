import { assetFor, percent, type Point, type Quote } from "../market";
import type { RadarCoverage, RadarHistory, RadarSignal, RadarSignalType, RadarSnapshot, RadarStore } from "./types";

const MINUTE = 60_000;
const COOLDOWN = 30 * MINUTE;
const LIFETIME = 45 * MINUTE;
const MAX_SIGNALS = 120;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
const rms = (values: number[]) => Math.sqrt(mean(values.map(value => value * value)));
type Evaluation = { signal: RadarSignal; strength: number };
type Prepared = { quote: Quote; history: RadarHistory; bars: Point[] };

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
    return { symbol, eligible: typeof data !== "string", reason: typeof data === "string" ? data : "基线可用" };
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
    const push = (type: RadarSignalType, window: string, strength: number, title: string, metric: string, description: string, direction: RadarSignal["direction"], metrics: RadarSignal["metrics"]) => {
      if (!Number.isFinite(strength)) return;
      const fingerprint = `${symbol}:${type}:${window}:${history.source}:${history.intervalMs}${type === "price_move" ? `:${direction}` : ""}`;
      const evidenceAt = latest.time + history.intervalMs;
      evaluations.push({ strength, signal: {
        id: `${fingerprint}:${evidenceAt}`, fingerprint, symbol, market, type, title, metric, description, direction,
        severity: strength >= 3 ? "critical" : strength >= 1.5 ? "high" : "medium", status: "active",
        detectedAt: now, updatedAt: now, quoteAt: quote.timestamp, evidenceAt, expiresAt: evidenceAt + LIFETIME,
        source: history.source, currency: quote.currency,
        metrics: { intervalMinutes: history.intervalMs / MINUTE, baselineBars: 20, close: latest.close, window, ...metrics },
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
        push("price_move", `${minutes}m`, (direction === "up" ? move : -move) / threshold, "价格异动", `${minutes} 分钟 ${percent(move)}`, `完整 K 线变化；近期同周期绝对变化中位数 ${baseline.toFixed(2)}%，触发线 ${threshold.toFixed(2)}%。`, direction, { movePercent: move, baselinePercent: baseline, thresholdPercent: threshold, referenceWindows: references.length });
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
      push("breakout", "recent", up / bufferPercent, "区间突破", `高于区间上沿 ${percent(up)}`, context, "up", { rangeHigh: high, rangeLow: low, bufferPercent });
      push("breakdown", "recent", down / bufferPercent, "区间跌破", `低于区间下沿 ${percent(-down)}`, context, "down", { rangeHigh: high, rangeLow: low, bufferPercent });
    }
    const baselineVolatility = rms(baselineReturns), currentVolatility = rms(returns.slice(-4));
    const volatilityThreshold = Math.max(market === "crypto" ? .25 : .15, baselineVolatility * 3);
    push("volatility_spike", "4bars", currentVolatility / volatilityThreshold, "波动放大", `短周期波动 ${currentVolatility.toFixed(2)}%`, `最近 4 根收益率均方根，之前 16 根基线 ${baselineVolatility.toFixed(2)}%；非年化波动率。`, "neutral", { baselineVolatility, currentVolatility, thresholdPercent: volatilityThreshold, baselineBars: 16 });
    // Only OKX completed candles: quote volume is rolling quote-currency turnover, not candle volume.
    const volumeBars = bars.slice(-21);
    if (symbol.endsWith("-USDT") && volumeBars.every(p => p.volume !== undefined && Number.isFinite(p.volume) && p.volume >= 0)) {
      const baselineVolume = mean(volumeBars.slice(0, -1).map(p => p.volume!));
      if (baselineVolume > 0) {
        const multiple = latest.volume! / baselineVolume;
        push("volume_spike", "15m", multiple / 2.5, "成交量异常", `15 分钟成交量 ${multiple.toFixed(2)}×`, "相对前 20 根完整 K 线平均基础币成交量；不使用滚动 24 小时成交额。", "neutral", { volume: latest.volume!, baselineVolume, multiple, thresholdMultiple: 2.5 });
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
    if (gate && item.strength < .7 && item.signal.evidenceAt > gate.evidenceAt) gates[item.signal.fingerprint] = { ...gate, recovered: true };
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
  return { signals: signals.sort((a, b) => b.detectedAt - a.detectedAt || a.id.localeCompare(b.id)).slice(0, MAX_SIGNALS), gates };
}
