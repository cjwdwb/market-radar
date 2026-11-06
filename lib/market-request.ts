import type { MarketErrorCode, MarketErrorInfo } from "./market";

const messages: Record<MarketErrorCode, string> = {
  invalid_parameter: "无效的行情代码或时间范围", unsupported_asset: "未找到该代码的行情", access_required: "请先完成访问验证",
  proxy_configuration_error: "行情代理配置异常", proxy_auth_error: "行情代理验证失败", proxy_unavailable: "行情代理暂时不可用",
  upstream_denied: "行情来源拒绝访问", rate_limited: "行情源请求繁忙，正在等待限流恢复", timeout: "行情连接超时，请稍后重试",
  transport_error: "行情连接中途断开，请稍后重试", environment_denied: "当前运行环境禁止连接行情源",
  unexpected_content_type: "行情源返回了非行情内容", invalid_json: "行情源返回了无效数据", upstream_business_error: "行情来源未能提供数据",
  upstream_unavailable: "行情源暂时不可用", empty: "该时间范围暂无走势数据", insufficient: "该时间范围暂无足够的走势数据",
  invalid_data: "行情数据校验未通过", stale: "行情数据已过期", caller_cancelled: "已取消此次行情读取", superseded: "已切换到新的行情读取",
};
type RateLimitObservation = { kind: "http"; httpStatus: 429 } | { kind: "business"; httpStatus?: number; businessCode: "50011" } | { kind: "cooldown" };
export type RateLimitEndpoint = "candles" | "history-candles" | "tickers" | "ticker";
export type RateLimitDiagnostic = Readonly<RateLimitObservation & { version: 1; endpoint?: RateLimitEndpoint; attempts: number; observedAt: number }>;
/** Rebuild the fixed schema; an invalid optional diagnostic never changes the standard error. */
function validatedRateLimitDiagnostic(value: unknown, code: MarketErrorCode, status?: number): RateLimitDiagnostic | undefined {
  if (code !== "rate_limited" || status !== 429 || !value || typeof value !== "object" || Array.isArray(value)) return;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some(key => !["version", "kind", "httpStatus", "businessCode", "endpoint", "attempts", "observedAt"].includes(key))) return;
  if (item.version !== 1 || !["http", "business", "cooldown"].includes(item.kind as string)) return;
  if (typeof item.attempts !== "number" || !Number.isSafeInteger(item.attempts) || item.attempts < (item.kind === "cooldown" ? 0 : 1) || item.attempts > 16) return;
  if (typeof item.observedAt !== "number" || !Number.isSafeInteger(item.observedAt) || item.observedAt <= 0) return;
  if (item.endpoint !== undefined && !["candles", "history-candles", "tickers", "ticker"].includes(item.endpoint as string)) return;
  const common = { version: 1 as const, attempts: item.attempts, observedAt: item.observedAt, ...(item.endpoint === undefined ? {} : { endpoint: item.endpoint as RateLimitEndpoint }) };
  if (item.kind === "http" && item.httpStatus === 429 && item.businessCode === undefined) return Object.freeze({ ...common, kind: "http", httpStatus: 429 });
  if (item.kind === "business" && item.businessCode === "50011" && (item.httpStatus === undefined || typeof item.httpStatus === "number" && Number.isInteger(item.httpStatus) && item.httpStatus >= 200 && item.httpStatus <= 299)) return Object.freeze({ ...common, kind: "business", businessCode: "50011", ...(item.httpStatus === undefined ? {} : { httpStatus: item.httpStatus as number }) });
  if (item.kind === "cooldown" && item.httpStatus === undefined && item.businessCode === undefined) return Object.freeze({ ...common, kind: "cooldown" });
}
export function observeRateLimit(scope: MarketScope, observation: RateLimitObservation, endpoint?: RateLimitEndpoint) {
  return validatedRateLimitDiagnostic({ version: 1, ...observation, ...(endpoint ? { endpoint } : {}), attempts: scope.budget.used, observedAt: Date.now() }, "rate_limited", 429);
}
function rateLimitEndpoint(url: URL): RateLimitEndpoint | undefined {
  if (!["https://openapi.okx.com", "https://www.okx.com"].includes(url.origin)) return;
  return ({ "/api/v5/market/candles": "candles", "/api/v5/market/history-candles": "history-candles", "/api/v5/market/tickers": "tickers", "/api/v5/market/ticker": "ticker" } as Record<string, RateLimitEndpoint>)[url.pathname];
}
/** status remains the upstream status; public HTTP mapping is separate. */
export class MarketRequestError extends Error {
  readonly status?: number; readonly retryAt?: number; readonly blocked: boolean;
  readonly validatedMonitorError: boolean;
  readonly rateLimitDiagnostic?: RateLimitDiagnostic;
  readonly code: MarketErrorCode; readonly stage: MarketErrorInfo["stage"]; readonly traceId?: string; readonly businessCode?: string;
  constructor(message: string, status?: number, retryAt?: number, blocked = false, info: Partial<MarketErrorInfo> & { businessCode?: string; validatedMonitorError?: boolean; rateLimitDiagnostic?: RateLimitDiagnostic } = {}) {
    const code = info.code ?? (blocked ? "environment_denied" : status === 429 ? "rate_limited" : status === 401 || status === 403 || status === 451 ? "upstream_denied" : status === 404 ? "unsupported_asset" : status && status >= 500 ? "upstream_unavailable" : "transport_error");
    super(message); this.name = "MarketRequestError"; this.status = status; this.retryAt = retryAt; this.blocked = blocked;
    this.code = code; this.stage = info.stage ?? "upstream"; this.traceId = info.traceId; this.businessCode = info.businessCode;
    this.validatedMonitorError = info.validatedMonitorError === true;
    this.rateLimitDiagnostic = validatedRateLimitDiagnostic(info.rateLimitDiagnostic, code, status);
  }
}
export type AttemptBudget = { remaining: number; used: number };
export type MarketRequestOptions = { signal?: AbortSignal; deadline?: number; budget?: AttemptBudget; traceId?: string };
export type MarketScope = MarketRequestOptions & { deadline: number; budget: AttemptBudget; traceId: string };
export function marketScope(options: MarketRequestOptions = {}, timeoutMs = 26_000, attempts = 4): MarketScope {
  return { ...options, deadline: Math.min(options.deadline ?? Infinity, Date.now() + timeoutMs), budget: options.budget ?? { remaining: attempts, used: 0 }, traceId: options.traceId ?? crypto.randomUUID() };
}
export function marketError(code: MarketErrorCode, scope?: Pick<MarketScope, "traceId">, details: Partial<MarketErrorInfo> & { businessCode?: string; rateLimitDiagnostic?: RateLimitDiagnostic } = {}) {
  return new MarketRequestError(messages[code], details.upstreamStatus, details.retryAt, code === "environment_denied", { ...details, code, traceId: scope?.traceId ?? details.traceId });
}
function cancellation(signal: AbortSignal, scope?: Pick<MarketScope, "traceId">) {
  return signal.reason instanceof MarketRequestError ? signal.reason : marketError(signal.reason === "superseded" ? "superseded" : "caller_cancelled", scope);
}
export function checkScope(scope: MarketScope) {
  if (scope.signal?.aborted) throw cancellation(scope.signal, scope);
  if (Date.now() >= scope.deadline) throw marketError("timeout", scope);
}
export function errorInfo(error: unknown, scope?: Pick<MarketScope, "traceId">): MarketErrorInfo {
  const e = error instanceof MarketRequestError ? error : marketError("transport_error");
  return { code: e.code, traceId: e.traceId ?? scope?.traceId, stage: e.stage, ...(e.retryAt ? { retryAt: e.retryAt } : {}), ...(e.status ? { upstreamStatus: e.status } : {}) };
}
export function publicError(error: unknown) { return messages[errorInfo(error).code]; }
export function errorStatus(error: unknown) {
  const code = errorInfo(error).code;
  return code === "invalid_parameter" ? 400 : code === "unsupported_asset" ? 404 : code === "rate_limited" ? 429 : code === "timeout" ? 504 : code === "caller_cancelled" || code === "superseded" ? 499 : code === "proxy_configuration_error" || code === "environment_denied" ? 503 : 502;
}
export function errorResponse(error: unknown, scope?: Pick<MarketScope, "traceId">) {
  const info = errorInfo(error, scope);
  return Response.json({ error: publicError(error), errorInfo: info }, { status: errorStatus(error), headers: { "Cache-Control": "no-store", ...(info.traceId ? { "X-Market-Trace": info.traceId } : {}), ...(info.retryAt ? { "Retry-After": String(Math.max(0, Math.ceil((info.retryAt - Date.now()) / 1000))) } : {}) } });
}
/** Only the already-authenticated monitor history handler uses this internal envelope. */
export function monitorErrorResponse(error: unknown, scope?: Pick<MarketScope, "traceId">) {
  const response = errorResponse(error, scope);
  const diagnostic = error instanceof MarketRequestError ? validatedRateLimitDiagnostic(error.rateLimitDiagnostic, error.code, error.status) : undefined;
  return diagnostic ? Response.json({ error: publicError(error), errorInfo: errorInfo(error, scope), diagnostic }, { status: response.status, headers: response.headers }) : response;
}
/** Fixed diagnostic fields only: never log URLs, credentials, response bodies or exception messages. */
export function recordMarketFailure(error: unknown, scope: MarketScope, detail: { symbol: string; source: "OKX" | "Yahoo"; range?: string; path: "direct" | "monitor"; startedAt: number }) {
  const info = errorInfo(error, scope);
  if (info.code === "caller_cancelled" || info.code === "superseded") return;
  const diagnostic = error instanceof MarketRequestError ? validatedRateLimitDiagnostic(error.rateLimitDiagnostic, error.code, error.status) : undefined;
  console.warn(JSON.stringify({ event: "market_request_failed", at: new Date().toISOString(), ...info, symbol: detail.symbol, source: detail.source, marketType: detail.source === "OKX" ? "spot" : "provider_chart", currency: detail.source === "OKX" ? "USDT" : "source_defined", range: detail.range, path: detail.path, elapsedMs: Math.max(0, Date.now() - detail.startedAt), observedAttempts: scope.budget.used, upstreamAttempts: detail.path === "monitor" ? "UNKNOWN" : scope.budget.used, cacheHit: false, outcome: "failed", ...(detail.path === "monitor" ? { monitorErrorValidated: error instanceof MarketRequestError && error.validatedMonitorError } : {}), ...(error instanceof MarketRequestError && error.businessCode && /^[A-Za-z0-9_-]{1,20}$/.test(error.businessCode) ? { upstreamBusinessCode: error.businessCode } : {}), ...(diagnostic ? { diagnosticSource: error instanceof MarketRequestError && error.validatedMonitorError ? "monitor" : "local", rateLimitDiagnostic: diagnostic } : {}) }));
}
export function mayFallback(error: unknown) { return error instanceof MarketRequestError && (error.code === "transport_error" || error.code === "upstream_unavailable"); }
export function retryAfterAt(header: string | null, now = Date.now()) {
  const seconds = header !== null && /^\s*\d+(?:\.\d+)?\s*$/.test(header) ? Number(header) : NaN;
  const supplied = Number.isFinite(seconds) ? now + seconds * 1000 : header ? Date.parse(header) : NaN;
  return Math.max(now + 60_000, Number.isFinite(supplied) ? supplied : 0);
}
/** Only the configured monitor may report these standard provider errors. */
function monitorError(body: unknown, status: number, scope: MarketScope, httpFailure: MarketRequestError) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  const envelope = body as Record<string, unknown>;
  if (typeof envelope.error !== "string" || !envelope.errorInfo || typeof envelope.errorInfo !== "object" || Array.isArray(envelope.errorInfo)) return;
  const info = envelope.errorInfo as Record<string, unknown>;
  const codes = ["invalid_parameter", "unsupported_asset", "upstream_denied", "rate_limited", "timeout", "transport_error", "environment_denied", "unexpected_content_type", "invalid_json", "upstream_business_error", "upstream_unavailable", "empty", "insufficient", "invalid_data"];
  if (typeof info.code !== "string" || !codes.includes(info.code)) return;
  if (info.stage !== undefined && !["browser", "site", "proxy", "upstream", "parse", "admission"].includes(info.stage as string)) return;
  if (info.traceId !== undefined && typeof info.traceId !== "string") return;
  const code = info.code as MarketErrorCode;
  if (errorStatus(marketError(code)) !== status) return;
  const upstream = info.upstreamStatus;
  if (upstream !== undefined) {
    if (typeof upstream !== "number" || !Number.isInteger(upstream) || upstream < 300 || upstream > 599) return;
    const consistent = code === "upstream_denied" ? [401, 403, 451].includes(upstream)
      : code === "rate_limited" ? upstream === 429
      : code === "unsupported_asset" ? upstream === 404
      : code === "upstream_unavailable" ? upstream >= 500
      : code === "upstream_business_error" ? upstream < 500 && ![401, 403, 404, 429, 451].includes(upstream)
      : false;
    if (!consistent) return;
  }
  if (info.retryAt !== undefined && (code !== "rate_limited" || typeof info.retryAt !== "number" || !Number.isSafeInteger(info.retryAt) || info.retryAt <= 0)) return;
  const retryAt = code === "rate_limited" ? Math.max(httpFailure.retryAt ?? 0, (info.retryAt as number | undefined) ?? 0) : undefined;
  // Remote prose, trace and stage never become local diagnostics. The marker is local only.
  const diagnostic = validatedRateLimitDiagnostic(envelope.diagnostic, code, upstream as number | undefined);
  return new MarketRequestError(messages[code], upstream as number | undefined, retryAt, code === "environment_denied", { code, stage: "proxy", traceId: scope.traceId, validatedMonitorError: true, rateLimitDiagnostic: diagnostic, ...(diagnostic?.kind === "business" ? { businessCode: diagnostic.businessCode } : {}) });
}
function monitorRetryAfterAt(header: string | null) {
  // Very large numeric waits saturate instead of overflowing or shortening the cooldown.
  const supplied = header !== null && /^\s*\d+(?:\.\d+)?\s*$/.test(header) ? Date.now() + Number(header) * 1000 : retryAfterAt(header);
  return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(Math.max(Date.now() + 60_000, supplied)));
}
/** Also bounds runtimes that cannot propagate abort into fetch/body reads. */
function interrupted<T>(promise: Promise<T>, signal: AbortSignal, scope: MarketScope): Promise<T> {
  if (signal.aborted) return Promise.reject(cancellation(signal, scope));
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { cleanup(); reject(cancellation(signal, scope)); };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}
export async function marketJson<T>(url: URL, options: MarketRequestOptions & { timeoutMs: number; attempts?: number; headers?: Record<string, string>; maxBytes?: number; stage?: MarketErrorInfo["stage"]; monitorErrors?: boolean; onMonitorRateLimit?: (retryAt: number) => void; onRateLimit?: (retryAt: number) => void; onResponseStatus?: (status: number) => void; beforeAttempt?: (scope: MarketScope) => void }): Promise<T> {
  const scope = marketScope(options, options.timeoutMs, Math.max(1, Math.min(2, options.attempts ?? 1)));
  const attempts = Math.max(1, Math.min(2, options.attempts ?? 1));
  for (let attempt = 0; attempt < attempts; attempt++) {
    checkScope(scope);
    // Synchronous provider checks apply to retries too, before spending an attempt.
    options.beforeAttempt?.(scope);
    if (scope.budget.remaining <= 0) throw marketError("upstream_unavailable", scope);
    scope.budget.remaining--; scope.budget.used++;
    const controller = new AbortController();
    const abort = () => controller.abort(scope.signal ? cancellation(scope.signal, scope) : marketError("caller_cancelled", scope));
    scope.signal?.addEventListener("abort", abort, { once: true });
    const hop = { ...scope, deadline: Math.min(scope.deadline, Date.now() + 8_000) };
    const timer = setTimeout(() => controller.abort(marketError("timeout", scope)), Math.max(1, hop.deadline - Date.now()));
    let response: Response | undefined; let reader: ReadableStreamDefaultReader<Uint8Array> | undefined; let httpFailure: MarketRequestError | undefined;
    try {
      // workerd supports follow/manual only. Manual leaves all 3xx terminal below.
      const fetching = fetch(url, { headers: options.headers ?? { Accept: "application/json" }, signal: controller.signal, redirect: "manual" }).then(value => {
        if (controller.signal.aborted) { void value.body?.cancel().catch(() => {}); throw cancellation(controller.signal, scope); }
        return value;
      });
      response = await interrupted(fetching, controller.signal, scope);
      options.onResponseStatus?.(response.status);
      if (!response.ok) {
        httpFailure = marketError(response.status === 429 ? "rate_limited" : [401, 403, 451].includes(response.status) ? "upstream_denied" : response.status === 404 ? "unsupported_asset" : response.status >= 500 ? "upstream_unavailable" : "upstream_business_error", scope, { upstreamStatus: response.status, ...(response.status === 429 ? { retryAt: (options.monitorErrors ? monitorRetryAfterAt : retryAfterAt)(response.headers.get("Retry-After")), ...(!options.monitorErrors ? { rateLimitDiagnostic: observeRateLimit(scope, { kind: "http", httpStatus: 429 }, rateLimitEndpoint(url)) } : {}) } : {}) });
        // Publish observed HTTP cooldown synchronously, before another request can retry.
        if (httpFailure.retryAt) options.onRateLimit?.(httpFailure.retryAt);
        // Observe the header before optional body reading; a cancelled waiter must not clear provider cooldown.
        if (options.monitorErrors && httpFailure.retryAt) options.onMonitorRateLimit?.(httpFailure.retryAt);
        // Proxy authentication failures are authoritative HTTP errors, never provider envelopes.
        if (!options.monitorErrors || [401, 403].includes(response.status)) throw httpFailure;
      }
      if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get("Content-Type") ?? "")) throw marketError("unexpected_content_type", scope, { stage: "parse" });
      const limit = Math.min(options.maxBytes ?? 2 * 1024 * 1024, httpFailure ? 8 * 1024 : Infinity);
      if (Number(response.headers.get("Content-Length")) > limit) throw marketError("invalid_data", scope, { stage: "parse" });
      reader = response.body?.getReader();
      const chunks: Uint8Array[] = []; let bytes = 0;
      if (reader) while (true) {
        const item = await interrupted(reader.read(), controller.signal, scope); checkScope(hop);
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > limit) throw marketError("invalid_data", scope, { stage: "parse" });
        chunks.push(item.value);
      }
      const data = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
      const result = JSON.parse(new TextDecoder().decode(data)) as T;
      checkScope(hop);
      if (httpFailure) throw monitorError(result, response.status, scope, httpFailure) ?? httpFailure;
      return result;
    } catch (error) {
      let failure: MarketRequestError;
      if (controller.signal.aborted) failure = cancellation(controller.signal, scope);
      else if (Date.now() >= hop.deadline) failure = marketError("timeout", scope);
      else if (error instanceof MarketRequestError && error.validatedMonitorError) failure = error;
      else if (httpFailure) failure = httpFailure;
      else if (error instanceof MarketRequestError) failure = error;
      else if (error instanceof SyntaxError) failure = marketError("invalid_json", scope, { stage: "parse" });
      else {
        const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
        failure = marketError(cause?.code === "EACCES" || cause?.code === "EPERM" ? "environment_denied" : error instanceof Error && error.name === "TimeoutError" ? "timeout" : "transport_error", scope);
      }
      // Reading optional details must not erase an already authoritative HTTP cooldown.
      if (options.monitorErrors && httpFailure?.code === "rate_limited" && failure.code === "timeout" && !scope.signal?.aborted) failure = httpFailure;
      if (options.stage) failure = new MarketRequestError(failure.message, failure.status, failure.retryAt, failure.blocked, { ...errorInfo(failure), stage: options.stage, businessCode: failure.businessCode, validatedMonitorError: failure.validatedMonitorError, rateLimitDiagnostic: failure.rateLimitDiagnostic });
      if (failure.validatedMonitorError || failure.code !== "transport_error" || attempt + 1 >= attempts || scope.budget.remaining <= 0 || Date.now() >= scope.deadline) throw failure;
    } finally {
      clearTimeout(timer); scope.signal?.removeEventListener("abort", abort);
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      else if (response?.body) void response.body.cancel().catch(() => {});
    }
  }
  throw marketError("transport_error", scope);
}

type SharedEntry<T> = { promise: Promise<T>; controller: AbortController; scope: MarketScope; waiters: number; settled: boolean };
/** One operation deadline, independent consumers, bounded live entries. */
export class SharedMarketRequests<T> {
  private entries = new Map<string, SharedEntry<T>>();
  run(key: string, caller: MarketScope, operation: (scope: MarketScope) => Promise<T>): Promise<T> {
    checkScope(caller);
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= 128) return Promise.reject(marketError("upstream_unavailable", caller));
      const controller = new AbortController(); const scope = { ...caller, signal: controller.signal };
      entry = { promise: undefined as unknown as Promise<T>, controller, scope, waiters: 0, settled: false };
      const own = entry;
      const timer = setTimeout(() => controller.abort(marketError("timeout", scope)), Math.max(1, scope.deadline - Date.now()));
      own.promise = interrupted(Promise.resolve().then(() => { checkScope(scope); return operation(scope); }), controller.signal, scope).finally(() => {
        own.settled = true; clearTimeout(timer);
        if (this.entries.get(key) === own) this.entries.delete(key);
      });
      this.entries.set(key, own);
    }
    const own = entry; own.waiters++;
    return new Promise<T>((resolve, reject) => {
      let finished = false; let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: unknown, value?: T) => {
        if (finished) return; finished = true;
        caller.signal?.removeEventListener("abort", abort); if (timer) clearTimeout(timer);
        own.waiters--;
        if (!own.waiters && !own.settled) {
          if (this.entries.get(key) === own) this.entries.delete(key);
          own.controller.abort(marketError("caller_cancelled", own.scope));
        }
        if (error) reject(error); else resolve(value as T);
      };
      const abort = () => finish(caller.signal ? cancellation(caller.signal, caller) : marketError("caller_cancelled", caller));
      caller.signal?.addEventListener("abort", abort, { once: true });
      if (caller.deadline < own.scope.deadline) timer = setTimeout(() => finish(marketError("timeout", caller)), Math.max(1, caller.deadline - Date.now()));
      own.promise.then(value => { try { checkScope(caller); finish(undefined, value); } catch (error) { finish(error); } }, error => finish(error));
      if (caller.signal?.aborted) abort();
    });
  }
}
