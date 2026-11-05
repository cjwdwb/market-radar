import { assetFor, type MarketHistory, type Point, type Quote, type QuoteResult, type Range } from "./market";
import { getOKXHistory, getOKXQuote, getOKXTickers } from "./okx";
import { historyMetadata, normalizePoints } from "./market-history";
import { checkScope, errorInfo, marketError, marketJson, marketScope, MarketRequestError, publicError, SharedMarketRequests, type MarketRequestOptions, type MarketScope } from "./market-request";
export { publicError } from "./market-request";

type YahooMeta = {
  symbol?: string; regularMarketPrice?: number; regularMarketTime?: number; chartPreviousClose?: number; previousClose?: number;
  regularMarketDayHigh?: number; regularMarketDayLow?: number; regularMarketVolume?: number; exchangeDataDelayedBy?: number;
  longName?: string; shortName?: string; currency?: string; exchangeTimezoneName?: string; exchangeName?: string;
  currentTradingPeriod?: { regular?: { start: number; end: number } };
};
type YahooResult = { meta: YahooMeta; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[]; open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; volume?: (number | null)[] }[] } };
type ChartSnapshot = { data: YahooResult; fetchedAt: number; expires: number };
const cache = new Map<string, ChartSnapshot>();
const inFlight = new SharedMarketRequests<ChartSnapshot>();
let upstreamRetryAt = 0;
function checkYahooCooldown(scope: MarketScope) {
  if (Date.now() < upstreamRetryAt) throw marketError("rate_limited", scope, { upstreamStatus: 429, retryAt: upstreamRetryAt });
}
export const yahooRanges: Record<Range, { range: string; interval: string; intervalMs: number | null }> = {
  "15m": { range: "5d", interval: "15m", intervalMs: 900_000 }, "1d": { range: "1d", interval: "5m", intervalMs: 300_000 },
  "1w": { range: "5d", interval: "60m", intervalMs: 3_600_000 }, "1m": { range: "1mo", interval: "1d", intervalMs: null }, "3m": { range: "3mo", interval: "1d", intervalMs: null },
};
export function numeric(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function decodePoints(data: YahooResult, intervalMs: number | null, now: number) {
  const series = data.indicators?.quote?.[0]; const candidates: Point[] = []; let malformed = 0;
  for (const [i, timestamp] of (data.timestamp ?? []).entries()) {
    const close = numeric(series?.close?.[i]); const volume = numeric(series?.volume?.[i]);
    if (close === null || !Number.isSafeInteger(timestamp) || timestamp <= 0) { malformed++; continue; }
    const time = timestamp * 1000;
    candidates.push({ time, close, ...(volume === null ? {} : { volume }), open: numeric(series?.open?.[i]) ?? undefined, high: numeric(series?.high?.[i]) ?? undefined, low: numeric(series?.low?.[i]) ?? undefined, ...(intervalMs ? { windowEnded: time + intervalMs <= now } : {}) });
  }
  // Exchange sessions do not necessarily begin on UTC hour boundaries.
  const result = normalizePoints(candidates, { now, intervalMs, grid: false });
  return { ...result, invalidRows: result.invalidRows + malformed };
}
export function parsePoints(data: YahooResult, intervalMs: number | null = 300_000, now = Date.now()): Point[] { return decodePoints(data, intervalMs, now).points; }
function yahooMetadata(symbol: string, range: Range, data: YahooResult, parsed: ReturnType<typeof decodePoints>) {
  const config = yahooRanges[range]; const market = assetFor(symbol).market;
  const metadata = historyMetadata(parsed.points, {
    intervalMs: config.intervalMs, bar: config.interval, exchange: data.meta.exchangeName ?? "unknown", instrument: symbol,
    marketType: market === "crypto" ? "spot" : symbol.startsWith("^") ? "index" : "equity", volumeUnit: market === "crypto" || symbol.startsWith("^") ? "unknown" : "shares",
    bucketTimezone: data.meta.exchangeTimezoneName ?? "UTC", completion: config.intervalMs ? "time_window" : "unknown", invalidRows: parsed.invalidRows, duplicateRows: parsed.duplicateRows,
    path: "yahoo-chart", limitations: ["source_confirmation_unavailable", ...(config.intervalMs ? [] : ["daily_session_end_unknown"]), ...(parsed.invalidRows ? ["invalid_rows"] : []), ...(parsed.duplicateRows ? ["duplicate_rows"] : [])],
  });
  if (metadata.gapCount) metadata.limitations.push("session_or_data_gaps");
  return metadata;
}
export function parseQuote(symbol: string, data: YahooResult, now = Date.now(), fetchedAt = now): Quote {
  const m = data.meta; const parsed = decodePoints(data, yahooRanges["1d"].intervalMs, fetchedAt);
  const current = numeric(m.regularMarketPrice); const timestamp = numeric(m.regularMarketTime);
  if (current === null || current <= 0 || timestamp === null || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp * 1000 > fetchedAt + 30_000) throw marketError("invalid_data", undefined, { stage: "admission" });
  const previous = numeric(m.chartPreviousClose) ?? numeric(m.previousClose); const change = previous !== null && previous > 0 ? current - previous : null;
  const regular = m.currentTradingPeriod?.regular; let session: Quote["session"] = "unknown";
  if (assetFor(symbol).market === "crypto") session = "open";
  else if (regular && Number.isFinite(regular.start) && Number.isFinite(regular.end)) session = now / 1000 >= regular.start && now / 1000 < regular.end ? "open" : "closed";
  return { symbol, name: m.longName ?? m.shortName ?? assetFor(symbol).name, currency: m.currency ?? "USD", price: current, previousClose: previous, change, changePercent: change !== null && previous ? change / previous * 100 : null,
    high: numeric(m.regularMarketDayHigh), low: numeric(m.regularMarketDayLow), volume: numeric(m.regularMarketVolume), timestamp: timestamp * 1000, fetchedAt, source: "Yahoo Finance", timezone: m.exchangeTimezoneName ?? "UTC", session,
    delayMinutes: numeric(m.exchangeDataDelayedBy), points: parsed.points, historyMetadata: yahooMetadata(symbol, "1d", data, parsed) };
}
async function fetchChart(symbol: string, range: Range, options: MarketRequestOptions = {}) {
  const scope = marketScope(options, 12_000, 2); checkScope(scope);
  const config = yahooRanges[range];
  const key = `Yahoo:${assetFor(symbol).market}:${symbol}:chart:${config.range}:${config.interval}:regular:unadjusted`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return { ...cached, cacheHit: true };
  checkYahooCooldown(scope);
  const snapshot = await inFlight.run(key, scope, async shared => {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set("interval", config.interval); url.searchParams.set("range", assetFor(symbol).market === "crypto" && range === "1w" ? "7d" : config.range); url.searchParams.set("includePrePost", "false");
    let body: { chart?: { result?: YahooResult[]; error?: unknown } };
    try { body = await marketJson<typeof body>(url, { ...shared, headers: { "User-Agent": "MarketRadar/1.0", Accept: "application/json" }, timeoutMs: 12_000, attempts: 2, beforeAttempt: checkYahooCooldown }); }
    catch (error) { if (error instanceof MarketRequestError && error.retryAt) upstreamRetryAt = Math.max(upstreamRetryAt, error.retryAt); throw error; }
    if (!body || typeof body !== "object" || body.chart?.error) throw marketError("upstream_business_error", shared);
    const data = body.chart?.result?.[0];
    if (!data?.meta || data.meta.symbol !== symbol || typeof data.meta.currency !== "string" || !/^[A-Z]{3,5}$/.test(data.meta.currency) || (data.timestamp !== undefined && !Array.isArray(data.timestamp))) throw marketError("invalid_data", shared, { stage: "admission" });
    const fetchedAt = Date.now(); checkScope(shared);
    const result = { data, fetchedAt, expires: fetchedAt + ((range === "1d" || range === "15m") ? 10_000 : 240_000) };
    if (cache.size >= 180) cache.delete(cache.keys().next().value!);
    cache.set(key, result); return result;
  });
  return { ...snapshot, cacheHit: false };
}
export async function getQuote(symbol: string, includePoints = true, options: MarketRequestOptions = {}): Promise<Quote> {
  if (symbol.endsWith("-USDT")) return getOKXQuote(symbol, includePoints, undefined, options);
  const snapshot = await fetchChart(symbol, "1d", options); const readAt = Date.now();
  return { ...parseQuote(symbol, snapshot.data, readAt, snapshot.fetchedAt), readAt, cache: { hit: snapshot.cacheHit, ageMs: Math.max(0, readAt - snapshot.fetchedAt) } };
}
export async function getQuotes(symbols: string[], includePoints = true, options: MarketRequestOptions = {}): Promise<QuoteResult[]> {
  const crypto = symbols.filter(symbol => symbol.endsWith("-USDT")); const stocks = symbols.filter(symbol => !symbol.endsWith("-USDT"));
  const scope = marketScope(options, 16_000, stocks.length * 2 + (crypto.length ? 2 : 0));
  const results = new Map<string, QuoteResult>();
  const failed = (symbol: string, error: unknown) => results.set(symbol, { symbol, error: publicError(error), errorInfo: errorInfo(error, scope) });
  const tickerTask = crypto.length ? (async () => {
    try {
      checkScope(scope); const tickers = await getOKXTickers(scope);
      await Promise.all(crypto.map(async symbol => {
        try { checkScope(scope); if (!tickers[symbol]) throw marketError("unsupported_asset", scope); results.set(symbol, { symbol, quote: await getOKXQuote(symbol, includePoints, tickers[symbol], scope) }); }
        catch (error) { failed(symbol, error); }
      }));
    } catch (error) { for (const symbol of crypto) failed(symbol, error); }
  })() : Promise.resolve();
  let index = 0;
  const workers = Array.from({ length: Math.min(4, stocks.length) }, async () => {
    while (index < stocks.length) {
      const symbol = stocks[index++];
      try { checkScope(scope); results.set(symbol, { symbol, quote: await getQuote(symbol, includePoints, scope) }); }
      catch (error) { failed(symbol, error); }
    }
  });
  await Promise.all([tickerTask, ...workers]);
  return symbols.map(symbol => results.get(symbol) ?? { symbol, error: publicError(marketError("invalid_data", scope)), errorInfo: errorInfo(marketError("invalid_data", scope)) });
}
export async function getHistory(symbol: string, range: Range, options: MarketRequestOptions = {}): Promise<MarketHistory> {
  if (symbol.endsWith("-USDT")) return getOKXHistory(symbol, range, options);
  const scope = marketScope(options); const snapshot = await fetchChart(symbol, range, scope); const readAt = Date.now();
  const parsed = decodePoints(snapshot.data, yahooRanges[range].intervalMs, snapshot.fetchedAt);
  if (parsed.points.length < 2) throw marketError(parsed.points.length ? "insufficient" : parsed.invalidRows ? "invalid_data" : "empty", scope, { stage: "admission" });
  checkScope(scope);
  return { symbol, range, points: parsed.points, currency: snapshot.data.meta.currency!, timezone: snapshot.data.meta.exchangeTimezoneName ?? "UTC", source: "Yahoo Finance", fetchedAt: snapshot.fetchedAt, readAt, cache: { hit: snapshot.cacheHit, ageMs: Math.max(0, readAt - snapshot.fetchedAt) }, metadata: yahooMetadata(symbol, range, snapshot.data, parsed), traceId: scope.traceId };
}
