import { VALID_SYMBOL } from "../../../lib/market";
import { getQuotes } from "../../../lib/market-data";
import { errorResponse, marketError, marketScope } from "../../../lib/market-request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const symbols = [...new Set((new URL(request.url).searchParams.get("symbols") ?? "").split(",").filter(Boolean))];
  const yahooCount = symbols.filter(symbol => !symbol.endsWith("-USDT")).length;
  const scope = marketScope({ signal: request.signal }, 16_000, yahooCount * 2 + (yahooCount < symbols.length ? 2 : 0));
  if (!symbols.length || symbols.length > 28 || symbols.some(symbol => !VALID_SYMBOL.test(symbol))) return errorResponse(marketError("invalid_parameter", scope, { stage: "site" }));
  const results = await getQuotes(symbols, false, scope);
  // This envelope time is the completed check. Acquisition belongs to each quote.
  return Response.json({ results, fetchedAt: Date.now(), checkedAt: Date.now(), traceId: scope.traceId }, { headers: { "Cache-Control": "no-store", "X-Market-Trace": scope.traceId } });
}
