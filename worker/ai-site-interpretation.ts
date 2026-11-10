import { InterpretationError } from "../lib/ai/contracts";
import { D1Records } from "../lib/ai/d1-records";
import type { BudgetDatabase } from "../lib/ai/d1-budget";
import { createSiteContextRuntime } from "../lib/ai/site-runtime";
import { approvedSiteContextGrant } from "../lib/ai/real-context-policy";
import { createDeepSeekProvider } from "../lib/ai/deepseek-provider";
import type { ServiceExecution } from "../lib/ai/real-service";
import { parseSiteCapability } from "../lib/ai/site-contract";
import { AIAccessError, authorizeAI, createAIRevalidation, readAICommand, type AIGrantReader, type AIAccessConfig } from "./ai-authorization";

const SYMBOL = "BTC-USDT";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, oai-authenticated-user-id", "X-Content-Type-Options": "nosniff" } });
const capability = (reason?: string, readable = false) => parseSiteCapability({ format: "site-ai-capability-v1", mode: "site_controlled", auth: "site_session", deploymentMode: "site_pilot",
  admission: reason ? "blocked" : "ready", ...(reason ? { reason } : {}), allowedSymbols: !reason || readable ? [SYMBOL] : [], realProviderEnabled: !reason });
const errorCode = (error: unknown) => error instanceof InterpretationError || error instanceof AIAccessError ? error.code : "record_unavailable";
type Dependencies = { config: AIAccessConfig; reader: AIGrantReader; runtime: ReturnType<typeof createSiteContextRuntime>; now?: () => number };

/** Server composition boundary. It is never populated from request JSON or client capabilities. */
export function createSiteInterpretationHandler({ config, reader, runtime, now = Date.now }: Dependencies) {
  return async (request: Request, execution: ServiceExecution) => {
    const url = new URL(request.url), resultPath = url.pathname === "/api/interpretation/result";
    try {
      if (!resultPath && url.pathname !== "/api/interpretation") throw new AIAccessError("invalid_request");
      if (resultPath) {
        if (request.method !== "GET") throw new AIAccessError("invalid_method");
        if (url.searchParams.size !== 2 || url.searchParams.getAll("symbol").length !== 1 || url.searchParams.getAll("snapshotId").length !== 1 ||
          [...url.searchParams.keys()].some(k => !["symbol", "snapshotId"].includes(k))) throw new AIAccessError("invalid_request");
        const symbol = url.searchParams.get("symbol")!, snapshotId = url.searchParams.get("snapshotId")!;
        if (symbol !== SYMBOL || !/^[A-Za-z0-9_-]{16,160}$/.test(snapshotId)) throw new AIAccessError("invalid_request");
        const principal = await authorizeAI(request, "read", symbol, reader, config, now());
        const revalidate = createAIRevalidation(request, { ...principal, symbol }, reader, config, now);
        return json(await runtime.result(principal, symbol, snapshotId, () => revalidate("read")));
      }
      if (url.search) throw new AIAccessError("invalid_request");
      if (request.method === "GET") {
        const principal = await authorizeAI(request, "read", SYMBOL, reader, config, now());
        const revalidate = createAIRevalidation(request, { ...principal, symbol: SYMBOL }, reader, config, now);
        let blocked: string | undefined;
        try { await runtime.ready(principal); }
        catch (error) {
          // A stopped spending policy need not erase an authorized, already-paid result.
          // The result endpoint still checks the source, review window and record owner.
          const code = errorCode(error);
          if (!["disabled", "provider_not_configured"].includes(code)) throw error;
          blocked = code;
        }
        try { await revalidate("capability"); }
        catch (error) {
          if (!(error instanceof AIAccessError) || error.code !== "read_only") throw error;
          blocked = "read_only";
        }
        return json(capability(blocked, true));
      }
      const command = await readAICommand(request, config);
      if (command.action !== "snapshot" && command.action !== "interpret") throw new AIAccessError("invalid_request");
      const principal = await authorizeAI(request, "invoke", command.symbol, reader, config, now());
      const revalidate = createAIRevalidation(request, { ...principal, symbol: command.symbol }, reader, config, now);
      if (command.action === "snapshot") return json(await runtime.snapshot(principal, command.symbol, request.signal, () => revalidate("dispatch")));
      return json(await runtime.interpret(principal, command.symbol, command.snapshotId, request.signal, execution, revalidate));
    } catch (error) {
      const code = errorCode(error);
      if (!resultPath && request.method === "GET" && !url.search && !["invalid_host", "invalid_origin", "invalid_method", "invalid_request"].includes(code)) return json(capability(code));
      return json({ error: code }, code === "input_limit" ? 413 : code === "invalid_method" ? 405 : ["invalid_request", "invalid_content_type"].includes(code) ? 400 : code === "busy" ? 409 : 403);
    }
  };
}

export type SiteAIEnvironment = {
  AI_SITE_ENABLED?: string; AI_SITE_ID?: string; AI_SITE_ORIGIN?: string; MARKET_RADAR_DEEPSEEK_API_KEY?: string; DB?: BudgetDatabase;
};
/** Default-denied production entry. No remote initialization, source override, alternate key or fallback. */
export async function handleSiteInterpretation(request: Request, env: SiteAIEnvironment, execution: ServiceExecution) {
  const grant = approvedSiteContextGrant();
  const reason = env.AI_SITE_ENABLED !== "1" ? "disabled" : !grant ? "data_permission_unavailable" :
    !env.DB || !env.AI_SITE_ID || !env.AI_SITE_ORIGIN ? "authorization_unavailable" : null;
  if (reason || !env.DB || !grant) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/interpretation" && !url.search) return json(capability(reason ?? "disabled"));
    return json({ error: reason ?? "disabled" }, 503);
  }
  const records = new D1Records(env.DB);
  const key = env.MARKET_RADAR_DEEPSEEK_API_KEY;
  const runtime = createSiteContextRuntime({ db: env.DB, grant, provider: key ? createDeepSeekProvider(key) : undefined });
  return createSiteInterpretationHandler({ config: { siteId: env.AI_SITE_ID!, origin: env.AI_SITE_ORIGIN!, symbols: [SYMBOL] },
    reader: { get: (siteId, subjectId) => records.getGrant(siteId, subjectId) }, runtime })(request, execution);
}
