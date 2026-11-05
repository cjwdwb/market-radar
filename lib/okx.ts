import { assetFor, type MarketHistory, type Point, type Quote, type Range } from "./market";
import { finiteNumber, historyMetadata, normalizePoints, okxRanges } from "./market-history";
import { checkScope, marketError, marketJson, marketScope, mayFallback, MarketRequestError, SharedMarketRequests, type MarketRequestOptions, type MarketScope } from "./market-request";

const histories = new SharedMarketRequests<MarketHistory>();
const requests = new SharedMarketRequests<{ rows: unknown[]; fetchedAt: number }>();
let retryAt = 0;
export function rememberOKXRateLimit(until: number) { retryAt = Math.max(retryAt, until); }
export function checkCooldown(scope: MarketScope) {
  checkScope(scope);
  if (retryAt > Date.now()) throw marketError("rate_limited", scope, { upstreamStatus: 429, retryAt });
}
function decodeCandles(rows: unknown, intervalMs: number | null, now: number) {
  if (!Array.isArray(rows)) throw marketError("invalid_data", undefined, { stage: "parse" });
  const candidates: Point[] = []; let malformed = 0;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 9) { malformed++; continue; }
    const numbers = row.slice(0, 6).map(finiteNumber);
    if (numbers.some(number => number === null)) { malformed++; continue; }
    const [time, open, high, low, close, volume] = numbers as number[];
    candidates.push({ time, open, high, low, close, volume, ...(row[8] === "1" ? { confirmed: true } : row[8] === "0" ? { confirmed: false } : {}) });
  }
  const result = normalizePoints(candidates, { now, intervalMs, requireOHLC: true });
  return { ...result, invalidRows: result.invalidRows + malformed };
}
export function parseCandles(rows: unknown): Point[] { return decodeCandles(rows, null, Date.now()).points; }
async function requestOnce(path: string, params: Record<string, string>, scope: MarketScope) {
  let failure: unknown = marketError("upstream_unavailable", scope);
  for (const origin of ["https://openapi.okx.com", "https://www.okx.com"]) {
    checkCooldown(scope);
    if (scope.budget.remaining <= 0) break;
    try {
      const url = new URL(path, origin);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      const body = await marketJson<{ code?: unknown; data?: unknown }>(url, { ...scope, timeoutMs: 8_000, onRateLimit: rememberOKXRateLimit });
      if (!body || typeof body !== "object") throw marketError("invalid_data", scope, { stage: "parse" });
      if (body.code === "50011") throw marketError("rate_limited", scope, { upstreamStatus: 429, retryAt: Date.now() + 60_000, businessCode: "50011" });
      if (body.code !== "0") throw marketError("upstream_business_error", scope, { businessCode: typeof body.code === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(body.code) ? body.code : undefined });
      if (!Array.isArray(body.data)) throw marketError("invalid_data", scope, { stage: "parse" });
      checkScope(scope); return { rows: body.data, fetchedAt: Date.now() };
    } catch (error) {
      if (error instanceof MarketRequestError && error.code === "rate_limited") rememberOKXRateLimit(error.retryAt ?? Date.now() + 60_000);
      if (!mayFallback(error)) throw error;
      failure = error;
    }
  }
  throw failure;
}
export async function getOKXHistory(symbol: string, range: Range, options: MarketRequestOptions = {}): Promise<MarketHistory> {
  const scope = marketScope(options); checkCooldown(scope); const config = okxRanges[range];
  const history = await histories.run(`OKX:spot:${symbol}:USDT:candles:${config.bar}:${config.limit}:UTC:base`, scope, async shared => {
    let result: { rows: unknown[]; fetchedAt: number }; let path: "candles" | "history-candles" = "candles";
    const params = { instId: symbol, bar: config.bar, limit: String(config.limit) };
    try { result = await requestOnce("/api/v5/market/candles", params, shared); }
    catch (error) {
      if (!mayFallback(error)) throw error;
      checkCooldown(shared); if (!shared.budget.remaining) throw error;
      path = "history-candles"; result = await requestOnce("/api/v5/market/history-candles", params, shared);
    }
    if (result.rows.length > config.limit) throw marketError("invalid_data", shared, { stage: "admission" });
    const parsed = decodeCandles(result.rows, config.intervalMs, result.fetchedAt);
    if (parsed.points.length < 2) throw marketError(parsed.points.length ? "insufficient" : parsed.invalidRows ? "invalid_data" : "empty", shared, { stage: "admission" });
    const limitations = [...(parsed.invalidRows ? ["invalid_rows"] : []), ...(parsed.duplicateRows ? ["duplicate_rows"] : []), ...(parsed.points.some(point => point.confirmed === undefined) ? ["unknown_confirmation"] : []), ...(path === "history-candles" ? ["historical_endpoint"] : [])];
    const metadata = historyMetadata(parsed.points, { intervalMs: config.intervalMs, bar: config.bar, exchange: "OKX", instrument: symbol, marketType: "spot", volumeUnit: "base", bucketTimezone: "UTC", completion: "source", invalidRows: parsed.invalidRows, duplicateRows: parsed.duplicateRows, path, limitations });
    if (metadata.gapCount) metadata.limitations.push("gaps");
    checkScope(shared);
    return { symbol, range, points: parsed.points, currency: "USDT", timezone: "UTC", source: "OKX 欧易", fetchedAt: result.fetchedAt, metadata };
  });
  return { ...history, range, readAt: Date.now(), cache: { hit: false, ageMs: Math.max(0, Date.now() - history.fetchedAt) }, traceId: scope.traceId };
}
type Ticker = Record<string, string>;
export type OKXTickers = Record<string, Ticker>;
const tickerAcquiredAt = new WeakMap<object, number>();
export async function getOKXTickers(options: MarketRequestOptions = {}): Promise<OKXTickers> {
  const scope = marketScope(options, 16_000, 2); checkCooldown(scope);
  const result = await requests.run("OKX:spot:tickers:USDT", scope, shared => requestOnce("/api/v5/market/tickers", { instType: "SPOT" }, shared));
  const tickers: OKXTickers = {};
  for (const row of result.rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const ticker = row as Ticker;
    if (typeof ticker.instId === "string") { tickers[ticker.instId] = ticker; tickerAcquiredAt.set(ticker, result.fetchedAt); }
  }
  return tickers;
}
export async function getOKXQuote(symbol: string, includePoints = true, suppliedTicker?: Ticker, options: MarketRequestOptions = {}): Promise<Quote> {
  const scope = marketScope(options, 16_000, includePoints ? 6 : 2); checkScope(scope); if (!suppliedTicker) checkCooldown(scope);
  let ticker = suppliedTicker; let fetchedAt = suppliedTicker ? tickerAcquiredAt.get(suppliedTicker) : undefined;
  if (!ticker) {
    const result = await requests.run(`OKX:spot:ticker:${symbol}:USDT`, scope, shared => requestOnce("/api/v5/market/ticker", { instId: symbol }, shared));
    ticker = result.rows[0] as Ticker | undefined; fetchedAt = result.fetchedAt;
  }
  if (!ticker || ticker.instId !== symbol) throw marketError("unsupported_asset", scope);
  const price = finiteNumber(ticker.last), previous = finiteNumber(ticker.open24h), timestamp = finiteNumber(ticker.ts);
  if (price === null || previous === null || timestamp === null || price <= 0 || previous <= 0 || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > Date.now() + 30_000) throw marketError("invalid_data", scope, { stage: "admission" });
  let points: Point[] = []; let history: MarketHistory | undefined;
  if (includePoints) {
    try { history = await getOKXHistory(symbol, "1d", scope); points = history.points; }
    catch (error) { if (error instanceof MarketRequestError && ["caller_cancelled", "superseded", "timeout"].includes(error.code)) throw error; }
  }
  checkScope(scope);
  const acquired = fetchedAt ?? Date.now();
  return { symbol, name: assetFor(symbol).name, currency: "USDT", price, previousClose: previous,
    change: price - previous, changePercent: (price - previous) / previous * 100,
    high: finiteNumber(ticker.high24h), low: finiteNumber(ticker.low24h), volume: finiteNumber(ticker.volCcy24h),
    timestamp, fetchedAt: acquired, readAt: Date.now(), cache: { hit: false, ageMs: Math.max(0, Date.now() - acquired) }, source: "OKX 欧易", timezone: "UTC", session: "open", delayMinutes: 0, points, ...(history ? { historyMetadata: history.metadata } : {}) };
}
