import { D1ProductBudget, type BudgetDatabase } from "../lib/ai/d1-budget";
import { D1Records } from "../lib/ai/d1-records";
import { AIAccessError, authorizeAI, readAICommand, type AIGrant } from "./ai-authorization";

type Environment = { AI_SITE_ENABLED?: string; AI_SITE_ORIGIN?: string; AI_SITE_ID?: string; DB?: BudgetDatabase };
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: {
  "Cache-Control": "private, no-store", "Vary": "Cookie, oai-authenticated-user-id", "X-Content-Type-Options": "nosniff",
} });

// Bind the final operation to the same still-valid grant even if it changed after the identity check.
const controlScope = `id=1 AND authority='market-radar-product' AND schema_version='d1-budget-v1'
  AND EXISTS (SELECT 1 FROM ai_access_grants AS g
    WHERE g.site_id=? AND g.subject_id=? AND g.revision=? AND g.enabled=1
      AND typeof(g.expires_at)='integer' AND g.expires_at=? AND g.expires_at > unixepoch('subsec')*1000
      AND json_type(g.permissions_json)='array' AND json_type(g.symbols_json)='array'
      AND (SELECT json_group_array(value) FROM json_each(g.permissions_json))=?
      AND (SELECT json_group_array(value) FROM json_each(g.symbols_json))=?)`;

/** Owner-only status and emergency stop. Neither operation can enable dispatch or change a spending limit. */
export async function handleSiteControl(request: Request, env: Environment) {
  if (env.AI_SITE_ENABLED !== "1" || !env.DB || !env.AI_SITE_ID || !env.AI_SITE_ORIGIN) {
    return response({ error: "authorization_unavailable" }, 503);
  }
  const url = new URL(request.url);
  if (url.pathname !== "/api/interpretation/control" || url.search) return response({ error: "invalid_request" }, 400);
  try {
    const db = env.DB, config = { siteId: env.AI_SITE_ID, origin: env.AI_SITE_ORIGIN, symbols: [] };
    const records = new D1Records(db);
    let checkedGrant: AIGrant | null | undefined;
    const principal = await authorizeAI(request, "manage", null, {
      get: async (site, subject) => (checkedGrant = await records.getGrant(site, subject)),
    }, config, Date.now());
    if (!checkedGrant) throw new AIAccessError("authorization_unavailable");
    const stop = request.method === "POST";
    if (stop && (await readAICommand(request, config)).action !== "disable") throw new AIAccessError("invalid_request");
    // A damaged ledger must not prevent an authorized emergency stop. Settlement stays available.
    const totals = stop ? undefined : await new D1ProductBudget(db).inspect(Date.now());
    const columns = "enabled, import_status";
    const query = stop
      ? `UPDATE ai_budget_control SET enabled=0, disabled_reason='operator_stop' WHERE ${controlScope} RETURNING ${columns}`
      : `SELECT ${columns} FROM ai_budget_control WHERE ${controlScope}`;
    const [result] = await db.batch<{ enabled: number; import_status: string }>([
      db.prepare(query).bind(principal.siteId, principal.subjectId, principal.grantRevision, principal.expiresAt,
        JSON.stringify(checkedGrant.permissions), JSON.stringify(checkedGrant.symbols)),
    ]);
    if (!result?.success) return response({ error: "budget_unavailable" }, 503);
    if (result.results.length !== 1) return response({ error: "authorization_unavailable" }, 403);
    const row = result.results[0];
    return response({ enabled: row.enabled === 1, importStatus: row.import_status, ...(totals && { budget: totals }) });
  } catch (error) {
    if (!(error instanceof AIAccessError)) return response({ error: "budget_unavailable" }, 503);
    const status = error.code === "invalid_method" ? 405 : error.code === "input_limit" ? 413 :
      ["invalid_request", "invalid_content_type"].includes(error.code) ? 400 : 403;
    return response({ error: error.code }, status);
  }
}
