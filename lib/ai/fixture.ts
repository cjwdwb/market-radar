import { z } from "zod";
import { assetFor, type Quote } from "../market";
import { buildAssetStateV2 } from "../radar/asset-state-v2";
import { scanRadar, radarCoverage } from "../radar/engine";
import { buildRadarIntelligence } from "../radar/intelligence";
import { buildAssetIntelligenceContext } from "../radar/workflow";
import type { RadarSnapshot } from "../radar/types";
import { buildMarketContext } from "./context";
import { ContextSchema, factId, type MarketIntelligenceContext } from "./contracts";

export const FixtureScenarioSchema = z.enum(["upward", "downward", "mixed", "relative_stronger", "relative_weak", "relative_unavailable", "rms_higher", "rms_lower", "transition_available", "transition_unavailable", "signals_active", "no_signals", "information_present", "information_absent", "stale", "partial", "insufficient", "minute_unavailable"]);
export type FixtureScenario = z.infer<typeof FixtureScenarioSchema>;
export const FIXTURE_SYMBOLS = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "NVDA", "AAPL", "TSLA", "600519.SS", "0700.HK"] as const;
/** 只构造有标识的合成输入；不读取真实源、配置、用户偏好或网络。 */
export function fixtureContext(scenario: FixtureScenario, symbol: string, now: number): MarketIntelligenceContext {
  const market = assetFor(symbol).market, interval = (market === "crypto" ? 15 : 5) * 60000, end = Math.floor(now / interval) * interval;
  const currency = market === "crypto" ? "USDT" : market === "hk" ? "HKD" : market === "cn" ? "CNY" : "USD";
  const count = scenario === "insufficient" ? 10 : scenario === "partial" || scenario === "transition_unavailable" ? 22 : 80;
  function series(s: string, reference = false) {
    const points = Array.from({ length: count }, (_, i) => {
      let close = 100 + i * (reference ? scenario === "relative_weak" ? .2 : .01 : scenario === "relative_stronger" ? .2 : scenario === "downward" ? -.1 : .1);
      if (scenario === "mixed" && !reference) close = i <= 73 ? 100 + i * .8 : 158.4 - (i - 73) * .1;
      if (["rms_higher", "rms_lower"].includes(scenario) && !reference) close = i >= count - 2 ? 100.1 + (i % 2 === 0 ? scenario === "rms_higher" ? .5 : .01 : 0) : 100 + i % 2 * .1;
      if (scenario === "signals_active" && !reference && i === count - 1) close *= 1.08;
      return { time: end - (count - i) * interval, open: close, high: close, low: close, close, volume: 100, confirmed: true };
    });
    const source = market === "crypto" ? "OKX 欧易" : "Yahoo Finance";
    const q: Quote = { symbol: s, name: s, currency, source, price: points.at(-1)!.close, change: null, changePercent: null, previousClose: null, high: null, low: null, volume: null, timestamp: now, fetchedAt: now, points, timezone: "UTC", session: "open", delayMinutes: 0 };
    return { q, h: { points, intervalMs: interval, source, currency, fetchedAt: now } };
  }
  const a = series(symbol), snapshot: RadarSnapshot = { symbols: [symbol], quotes: { [symbol]: a.q }, histories: { [symbol]: a.h } };
  // 仅使用已映射的基准；BTC绝不自比，未知资产不猜。Relative专用评估选ETH。
  if (symbol === "ETH-USDT" && scenario !== "relative_unavailable") { const b = series("BTC-USDT", true); snapshot.quotes["BTC-USDT"] = b.q; snapshot.histories["BTC-USDT"] = b.h; }
  if (scenario === "stale") a.q.fetchedAt = now - 3600000;
  const state = buildAssetStateV2({ symbol, snapshot, now, online: true, enabled: true });
  const raw = scanRadar({ signals: [], gates: {} }, snapshot, now), intelligence = buildRadarIntelligence(raw.signals, [], now);
  const radar = buildAssetIntelligenceContext({ symbol, events: intelligence.events, coverage: radarCoverage(snapshot, now), now, enabled: true, online: true, isWatched: false, enabledAlertCount: 0 });
  const context = buildMarketContext({ symbol, quote: a.q, state, radar, now, online: true, enabled: true,
    information: scenario === "information_present" ? [{ id: "release-example", symbol, title: "合成项目版本说明（不是财报或新闻原因）", source: "fixture:official-product", publishedAt: end - interval, receivedAt: now, version: "fixture-information-v1" }] : [] });
  const body = { ...context, trust: "fixture" as const, evidence: context.evidence.map(e => ({ ...e, source: `fixture:${e.source}`, dataVersion: `fixture:${e.dataVersion}` })) };
  return ContextSchema.parse({ ...body, contextId: `fixture-context:${factId(body)}` });
}
