import { assetFor, type Point, type Quote, type Range } from "./market";

export function parseCandles(rows: unknown): Point[] {
  if (!Array.isArray(rows)) throw new Error("欧易行情格式异常");
  const points = new Map<number, Point>();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 9) continue;
    const [time, open, high, low, close, volume] = row.slice(0, 6).map(Number);
    if (![time, open, high, low, close, volume].every(Number.isFinite) || time <= 0 || low <= 0 || volume < 0 || high < Math.max(open, close) || low > Math.min(open, close)) continue;
    points.set(time, { time, open, high, low, close, volume, confirmed: row[8] === "1" });
  }
  return [...points.values()].sort((a, b) => a.time - b.time);
}

async function request(path: string, params: Record<string, string>) {
  let failure: unknown;
  for (const origin of ["https://openapi.okx.com", "https://www.okx.com"]) {
    try {
      const url = new URL(path, origin);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(response.status === 429 ? "欧易行情限流，请稍后重试" : "欧易行情暂时不可用");
      const body = await response.json() as { code: string; data: unknown[] };
      if (body.code !== "0" || !Array.isArray(body.data)) throw new Error("欧易暂无该交易对行情，请检查代码");
      return body.data;
    } catch (error) { failure = error; }
  }
  throw failure;
}

export async function getOKXHistory(symbol: string, range: Range) {
  const bar = ({ "15m": "15m", "1d": "15m", "1w": "1H", "1m": "4H", "3m": "1Dutc" })[range];
  const limit = ({ "15m": "96", "1d": "96", "1w": "168", "1m": "180", "3m": "90" })[range];
  const points = parseCandles(await request("/api/v5/market/candles", { instId: symbol, bar, limit }));
  if (points.length < 2) throw new Error("欧易暂无足够走势数据");
  return { symbol, range, points, currency: "USDT", timezone: "UTC", source: "OKX 欧易", fetchedAt: Date.now() };
}

export async function getOKXTickers(): Promise<Record<string, Record<string,string>>> {
  const rows = await request("/api/v5/market/tickers", { instType: "SPOT" });
  return Object.fromEntries((rows as Record<string,string>[]).filter(row => row && typeof row.instId === "string").map(row => [row.instId, row]));
}
export async function getOKXQuote(symbol: string, includePoints = true, suppliedTicker?: Record<string,string>): Promise<Quote> {
  const ticker = suppliedTicker ?? (await request("/api/v5/market/ticker", { instId: symbol }))[0] as Record<string, string> | undefined;
  if (!ticker || ticker.instId !== symbol) throw new Error("欧易暂无该交易对行情");
  const price = Number(ticker.last), previous = Number(ticker.open24h), timestamp = Number(ticker.ts);
  if (![price, previous, timestamp].every(Number.isFinite) || price <= 0 || previous <= 0 || timestamp <= 0) throw new Error("欧易报价无效");
  let points: Point[] = [];
  if (includePoints) { try { points = (await getOKXHistory(symbol, "1d")).points; } catch { /* The ticker remains useful when candles fail. */ } }
  return { symbol, name: assetFor(symbol).name, currency: "USDT", price, previousClose: previous,
    change: price - previous, changePercent: (price - previous) / previous * 100,
    high: Number(ticker.high24h), low: Number(ticker.low24h), volume: Number(ticker.volCcy24h),
    timestamp, fetchedAt: Date.now(), source: "OKX 欧易", timezone: "UTC", session: "open", delayMinutes: 0, points };
}
