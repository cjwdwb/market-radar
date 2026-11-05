import { type MarketErrorInfo, type MarketHistory, type QuoteResult, type Range } from "./market";
import { reusePoints } from "./refresh-policy";

export class ClientMarketError extends Error {
  readonly info: MarketErrorInfo;
  constructor(message: string, info: MarketErrorInfo) { super(message); this.info = info; }
}
export const clientCancelled = (reason?: unknown) => new ClientMarketError("读取已取消", { code: reason === "superseded" ? "superseded" : "caller_cancelled", stage: "browser" });
export const isClientCancelled = (error: unknown) => error instanceof ClientMarketError && ["caller_cancelled", "superseded"].includes(error.info.code);
export const clientFailure = (error: unknown) => error instanceof ClientMarketError ? error : new ClientMarketError("行情连接暂时中断", { code: "transport_error", stage: "browser" });

/** In-flight sharing is scoped to one mounted workbench, never to another visitor. */
export class ClientRequestPool {
  private entries = new Map<string, { controller: AbortController; promise: Promise<unknown>; waiters: number }>();
  has(key: string) { return this.entries.has(key); }
  request<T>(key: string, start: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(clientCancelled(signal.reason));
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= 48) return Promise.reject(new ClientMarketError("当前读取较多，请稍后重试", { code: "rate_limited", stage: "browser" }));
      const controller = new AbortController();
      entry = { controller, waiters: 0, promise: Promise.resolve().then(() => { if (controller.signal.aborted) throw clientCancelled(controller.signal.reason); return start(controller.signal); }) };
      const owned = entry;
      entry.promise = entry.promise.finally(() => { if (this.entries.get(key) === owned) this.entries.delete(key); });
      this.entries.set(key, entry);
    }
    const owned = entry;
    owned.waiters++;
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const finish = (action: () => void) => {
        if (finished) return; finished = true;
        signal?.removeEventListener("abort", abort); owned.controller.signal.removeEventListener("abort", cancelled); owned.waiters--;
        if (owned.waiters === 0 && this.entries.get(key) === owned) { this.entries.delete(key); owned.controller.abort("no_consumers"); }
        action();
      };
      const abort = () => finish(() => reject(clientCancelled(signal?.reason)));
      const cancelled = () => finish(() => reject(clientCancelled(owned.controller.signal.reason)));
      signal?.addEventListener("abort", abort, { once: true });
      owned.controller.signal.addEventListener("abort", cancelled, { once: true });
      owned.promise.then(value => finish(() => resolve(value as T)), error => finish(() => reject(error)));
      if (signal?.aborted) abort();
    });
  }
  clear() { for (const entry of this.entries.values()) entry.controller.abort("unmounted"); this.entries.clear(); }
}

// Only these two existing OKX views request exactly the same 96 native 15m bars.
export function clientHistoryKey(symbol: string, range: Range) {
  const bars = { "15m": "15m:96", "1d": "15m:96", "1w": "1H:168", "1m": "4H:180", "3m": "1Dutc:90" };
  return symbol.endsWith("-USDT") ? `OKX:SPOT:${symbol}:USDT:UTC:${bars[range]}` : `Yahoo:regular:${symbol}:provider-currency:provider-timezone:${range}`;
}

/** One browser tab shares server-reported provider cooldown across quote/history hooks.
 * No server-rendered path calls observe/check, so there is no cross-visitor state. */
export class ClientCooldown {
  private until = new Map<string, number>();
  check(symbol: string) {
    const retryAt = this.until.get(symbol.endsWith("-USDT") ? "OKX" : "Yahoo") ?? 0;
    if (retryAt > Date.now()) throw new ClientMarketError("行情源请求繁忙，等待恢复后再刷新", { code: "rate_limited", stage: "browser", retryAt });
  }
  observe(symbol: string, error: ClientMarketError) {
    if (error.info.code !== "rate_limited") return;
    const provider = symbol.endsWith("-USDT") ? "OKX" : "Yahoo";
    const retryAt = Number.isFinite(error.info.retryAt) ? error.info.retryAt! : 0;
    this.until.set(provider, Math.max(this.until.get(provider) ?? 0, Date.now() + 60_000, retryAt));
  }
}
export const browserMarketCooldown = new ClientCooldown();

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(clientCancelled(signal.reason));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

export async function clientJson<T>(path: string, signal: AbortSignal, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  let timeout = false;
  const timer = setTimeout(() => { timeout = true; controller.abort("timeout"); }, timeoutMs);
  try {
    if (controller.signal.aborted) throw clientCancelled(signal.reason);
    const response = await abortable(fetch(path, { signal: controller.signal, cache: "no-store" }), controller.signal);
    const fallbackInfo: MarketErrorInfo = { code: response.status === 401 || response.status === 403 ? "access_required" : response.status === 429 ? "rate_limited" : response.status === 504 ? "timeout" : "upstream_unavailable", stage: "site" };
    const retry = response.headers.get("retry-after");
    if (response.status === 429) {
      const advised = retry && /^\d+(\.\d+)?$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry ?? "");
      fallbackInfo.retryAt = Math.max(Date.now() + 60_000, Number.isFinite(advised) ? advised : 0);
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      void response.body?.cancel().catch(() => {});
      throw new ClientMarketError("行情响应格式异常", response.ok ? { code: "unexpected_content_type", stage: "browser" } : fallbackInfo);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ClientMarketError("行情响应为空", { code: "empty", stage: "browser" });
    let bytes = 0, text = ""; const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await abortable(reader.read(), controller.signal); if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2 * 1024 * 1024) { void reader.cancel().catch(() => {}); throw new ClientMarketError("行情响应过大", { code: "invalid_data", stage: "browser" }); }
        text += decoder.decode(chunk.value, { stream: true });
      }
    } finally { if (controller.signal.aborted) void reader.cancel().catch(() => {}); reader.releaseLock(); }
    let body;
    try { body = JSON.parse(text + decoder.decode()); } catch { throw new ClientMarketError("行情响应无法解析", { code: "invalid_json", stage: "browser" }); }
    if (controller.signal.aborted) throw clientCancelled(signal.reason);
    if (!response.ok) {
      const info: MarketErrorInfo = body?.errorInfo && typeof body.errorInfo.code === "string" ? { ...body.errorInfo } : fallbackInfo;
      if (fallbackInfo.retryAt) info.retryAt = Math.max(fallbackInfo.retryAt, Number.isFinite(info.retryAt) ? info.retryAt! : 0);
      throw new ClientMarketError(typeof body?.error === "string" ? body.error.slice(0,180) : "行情暂不可用", info);
    }
    return body as T;
  } catch (error) {
    if (signal.aborted) throw clientCancelled(signal.reason);
    if (timeout) throw new ClientMarketError("行情请求超时", { code: "timeout", stage: "browser" });
    throw clientFailure(error);
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}

export function validateClientHistory(value: unknown, symbol: string, range: Range): MarketHistory {
  const data = value as MarketHistory;
  if (!data || data.symbol !== symbol || data.range !== range || !Array.isArray(data.points) || data.points.length > 1000 || !Number.isFinite(data.fetchedAt) || data.fetchedAt <= 0 || typeof data.source !== "string" || typeof data.timezone !== "string" || typeof data.currency !== "string" || (symbol.endsWith("-USDT") && (data.currency !== "USDT" || data.source !== "OKX 欧易"))) throw new ClientMarketError("走势身份或时间信息不匹配", { code: "invalid_data", stage: "admission" });
  if (data.points.length < 2) throw new ClientMarketError("暂无足够走势数据", { code: data.points.length ? "insufficient" : "empty", stage: "admission" });
  for (let i=0;i<data.points.length;i++) {
    const p=data.points[i];
    if (!p || !Number.isFinite(p.time) || p.time<=0 || !Number.isFinite(p.close) || p.close<=0 || (i>0 && p.time<=data.points[i-1].time)) throw new ClientMarketError("走势数据无效", { code: "invalid_data", stage: "admission" });
  }
  if (data.metadata !== undefined) {
    const m = data.metadata;
    const nullableTime = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value) && value > 0);
    const text = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 100;
    if (!m || typeof m !== "object" || !text(m.bar) || !text(m.exchange) || !text(m.bucketTimezone) || m.instrument !== symbol
      || !(m.intervalMs === null || (typeof m.intervalMs === "number" && Number.isFinite(m.intervalMs) && m.intervalMs > 0))
      || !["spot", "equity", "index", "unknown"].includes(m.marketType) || !["base", "quote", "shares", "unknown"].includes(m.volumeUnit)
      || !["source", "time_window", "unknown"].includes(m.completion) || !["candles", "history-candles", "yahoo-chart", "monitor"].includes(m.path)
      || ![m.firstAt, m.lastAt, m.lastCompleteAt].every(nullableTime) || m.firstAt !== data.points[0].time || m.lastAt !== data.points.at(-1)!.time
      || ![m.invalidRows, m.duplicateRows, m.gapCount].every(value => Number.isSafeInteger(value) && value >= 0)
      || !Array.isArray(m.limitations) || m.limitations.length > 32 || !m.limitations.every(value => typeof value === "string" && value.length <= 500)
      || (symbol.endsWith("-USDT") && (m.exchange !== "OKX" || m.marketType !== "spot" || m.intervalMs !== ({ "15m": 900_000, "1d": 900_000, "1w": 3_600_000, "1m": 14_400_000, "3m": 86_400_000 })[range]))) throw new ClientMarketError("走势来源或周期信息无效", { code: "invalid_data", stage: "admission" });
  }
  return data;
}

export function completeQuoteResults(symbols: string[], input: unknown): QuoteResult[] {
  const rows = Array.isArray(input) ? input as QuoteResult[] : [];
  return symbols.map(symbol => {
    const matches = rows.filter(row => row?.symbol === symbol);
    const row = matches.length === 1 ? matches[0] : undefined;
    if (row?.quote && !row.error && !row.quote.error && row.quote.symbol === symbol && Number.isFinite(row.quote.price) && row.quote.price > 0 && Number.isFinite(row.quote.timestamp) && row.quote.timestamp > 0 && Number.isFinite(row.quote.fetchedAt) && row.quote.fetchedAt > 0 && typeof row.quote.source === "string" && typeof row.quote.currency === "string" && (!symbol.endsWith("-USDT") || row.quote.currency === "USDT") && Array.isArray(row.quote.points)) return row;
    return { symbol, error: row?.error || "该标的未返回有效报价", errorInfo: row?.errorInfo ?? { code: "invalid_data", stage: "admission" } };
  });
}

/** Cache reads keep source acquisition time. Manual refresh skips this cache but joins
 * an existing operation; only the last departing consumer aborts its transport. */
export class ClientHistoryCache {
  private cache = new Map<string, { at: number; data: MarketHistory }>();
  readonly pool = new ClientRequestPool();
  readonly cooldown: ClientCooldown;
  constructor(cooldown = browserMarketCooldown) { this.cooldown = cooldown; }
  peek(symbol: string, range: Range): MarketHistory | undefined {
    const item = this.cache.get(clientHistoryKey(symbol, range));
    return item ? { ...item.data, range } : undefined;
  }
  async read(symbol: string, range: Range, signal: AbortSignal, force = false): Promise<{ data: MarketHistory; network: boolean }> {
    if (signal.aborted) throw clientCancelled(signal.reason);
    const key = clientHistoryKey(symbol, range), cached = this.cache.get(key);
    if (!force && !this.pool.has(key) && cached && Date.now() - cached.at < 5000) return { data: { ...cached.data, range }, network: false };
    const data = await this.pool.request(key, async sharedSignal => {
      this.cooldown.check(symbol);
      try {
        const body = validateClientHistory(await clientJson<unknown>(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`, sharedSignal, 35_000), symbol, range);
        if (sharedSignal.aborted) throw clientCancelled(sharedSignal.reason);
        const data = { ...body, points: reusePoints(this.cache.get(key)?.data.points, body.points) };
        this.cache.delete(key); this.cache.set(key, { at: Date.now(), data });
        if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value!);
        return data;
      } catch (error) { const failure = clientFailure(error); this.cooldown.observe(symbol, failure); throw failure; }
    }, signal);
    return { data: { ...data, range }, network: true };
  }
}

/** Visual gaps only. Original points and all downstream State/Signal inputs remain untouched. */
export function chartGapSeries<T extends { time: number; close: number }>(points: T[], intervalMs: number | null | undefined): (T | { time: number; close: null })[] {
  if (!intervalMs || intervalMs <= 0) return points;
  const output: (T | { time: number; close: null })[] = [];
  points.forEach((point, i) => { const before=points[i-1]; if (before && point.time-before.time > intervalMs) output.push({ time: before.time+intervalMs, close: null }); output.push(point); });
  return output;
}
