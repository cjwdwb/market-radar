import { VALID_SYMBOL, type Range } from "../../../lib/market";
import { getHistory } from "../../../lib/market-data";
import { validateProxyHistory } from "../../../lib/market-history";
import { checkCooldown, rememberOKXRateLimit } from "../../../lib/okx";
import { checkScope, errorResponse, marketError, marketJson, marketScope, MarketRequestError, recordMarketFailure } from "../../../lib/market-request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const startedAt = Date.now(); const scope = marketScope({ signal: request.signal });
  const url = new URL(request.url); const symbol = url.searchParams.get("symbol") ?? ""; const range = url.searchParams.get("range") ?? "1d";
  if (!VALID_SYMBOL.test(symbol) || !["15m", "1d", "1w", "1m", "3m"].includes(range)) return errorResponse(marketError("invalid_parameter", scope, { stage: "site" }));
  try {
    checkScope(scope);
    const proxyUrl = process.env.MONITOR_URL; const token = process.env.MONITOR_TOKEN;
    if (symbol.endsWith("-USDT") && (proxyUrl || token)) {
      if (!proxyUrl || !token) throw marketError("proxy_configuration_error", scope, { stage: "proxy" });
      checkCooldown(scope);
      let upstream: URL;
      try { upstream = new URL("/history", proxyUrl); if (upstream.protocol !== "https:" || upstream.username || upstream.password) throw new Error(); }
      catch { throw marketError("proxy_configuration_error", scope, { stage: "proxy" }); }
      upstream.searchParams.set("symbol", symbol); upstream.searchParams.set("range", range);
      try {
        const deadline = Math.min(scope.deadline, Date.now() + 6_000);
        const body = await marketJson<unknown>(upstream, { ...scope, deadline, timeoutMs: 6_000, maxBytes: 512 * 1024, stage: "proxy", monitorErrors: true, onMonitorRateLimit: rememberOKXRateLimit, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "X-Market-Deadline": String(deadline), "X-Market-Trace": scope.traceId } });
        checkScope(scope);
        return Response.json(validateProxyHistory(body, symbol, range as Range, scope), { headers: { "Cache-Control": "no-store", "X-Market-Trace": scope.traceId } });
      } catch (error) {
        if (error instanceof MarketRequestError && error.code === "rate_limited") rememberOKXRateLimit(error.retryAt ?? Date.now() + 60_000);
        if (error instanceof MarketRequestError && error.validatedMonitorError) throw error;
        if (error instanceof MarketRequestError && [401, 403].includes(error.status ?? 0)) throw marketError("proxy_auth_error", scope, { stage: "proxy", upstreamStatus: error.status });
        if (error instanceof MarketRequestError && ["upstream_unavailable", "transport_error"].includes(error.code)) throw marketError("proxy_unavailable", scope, { stage: "proxy", upstreamStatus: error.status });
        throw error;
      }
    }
    const history = await getHistory(symbol, range as Range, scope);
    return Response.json(history, { headers: { "Cache-Control": "no-store", "X-Market-Trace": scope.traceId } });
  } catch (error) {
    recordMarketFailure(error, scope, { symbol, source: symbol.endsWith("-USDT") ? "OKX" : "Yahoo", range, path: symbol.endsWith("-USDT") && (process.env.MONITOR_URL || process.env.MONITOR_TOKEN) ? "monitor" : "direct", startedAt });
    return errorResponse(error, scope);
  }
}
