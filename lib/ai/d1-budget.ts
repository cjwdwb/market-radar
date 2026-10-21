import { ACTIVE_PRODUCT_AI, REAL_AI, DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from "./real-config";

// Structural D1 boundary; no Node, transport, credentials, initialization or policy approval API.
type Value = string | number | null;
type Result<T = Record<string, unknown>> = { success: boolean; results: T[]; meta: { changes: number } };
type Statement = { bind(...values: Value[]): Statement; all<T = Record<string, unknown>>(): Promise<Result<T>> };
export type BudgetDatabase = { prepare(sql: string): Statement; batch<T = Record<string, unknown>>(statements: Statement[]): Promise<Result<T>[]> };
export type ReservationInput = {
  now: number; idempotencyKey: string; scopeHash: string; payloadHash: string; payloadBytes: number;
  snapshotId: string; snapshotHash: string; catalogHash: string;
};
type Intent = {
  request_id: string; policy_id: string; authorization_id: string; scope_hash: string; idempotency_key: string;
  payload_hash: string; payload_bytes: number; snapshot_id: string; snapshot_hash: string; catalog_hash: string;
  profile_hash: string; state: "ready" | "dispatch_started" | "unknown" | "settled";
  reserved: number; month: string; active_policy_id: string;
};
type Entry = {
  id: string; state: string; reserved: number; charged: number | null; usage_cost: number | null;
  input_tokens: number | null; output_tokens: number | null; response_id: string | null; outcome: string | null;
  provider: string; model: string; profile_model: string; price_version: string; adapter_version: string; billing_profile: string;
  input_nano: number; output_nano: number; fee_multiplier: number;
};
type Settlement = { now: number; usageCostNano: number; usage: { inputTokens: number; outputTokens: number }; outcome: string; responseId: string | null };
const profile = ACTIVE_PRODUCT_AI;
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
const identity = (s: string) => typeof s === "string" && /^[a-zA-Z0-9_.:-]{1,180}$/.test(s);
const hash = (s: string) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
const outcomeValid = (s: string) => typeof s === "string" && /^[a-z_]{1,60}$/.test(s);
function month(now: number) {
  if (!integer(now) || now > 8_640_000_000_000_000) throw new Error("budget_request_invalid");
  return new Date(now).toISOString().slice(0, 7);
}
async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), x => x.toString(16).padStart(2, "0")).join("");
}
const occupied = "CASE WHEN state='settled' THEN charged ELSE reserved END";
const safeIntegerSql = (column: string, nullable = false) => `(${nullable ? `${column} IS NULL OR ` : ""}(typeof(${column})='integer' AND ${column} BETWEEN 0 AND ${Number.MAX_SAFE_INTEGER}))`;
const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
const historicalProfiles = [REAL_AI, DEEPSEEK_AI].map(p => `(q.provider IS ${sqlLiteral(p.provider)}
  AND q.model IS ${sqlLiteral(p.model)} AND q.price_version IS ${sqlLiteral(p.priceVersion)}
  AND q.adapter_version IS ${sqlLiteral(p.adapterVersion)} AND q.billing_profile IS ${sqlLiteral(p.billingProfile)}
  AND q.input_nano IS ${p.cacheWriteNanoPerToken} AND q.output_nano IS ${p.outputNanoPerToken})`).join(" OR ");
// Check stored types before any SQLite SUM can coerce malformed text into zero. This predicate
// runs inside the admitting SQL statement, so a separately checked snapshot never grants spending.
const ledgerHealthy = `EXISTS(SELECT 1 FROM metadata lm WHERE lm.id=1 AND lm.identity='market-radar-product-budget-v2'
    AND typeof(lm.fee_multiplier) IN ('integer','real') AND lm.fee_multiplier=2)
  AND NOT EXISTS(SELECT 1 FROM requests r LEFT JOIN request_profiles q ON q.request_id=r.id WHERE
    NOT ${safeIntegerSql("r.reserved")} OR NOT ${safeIntegerSql("r.charged", true)} OR NOT ${safeIntegerSql("r.usage_cost", true)}
    OR NOT ${safeIntegerSql("r.input_tokens", true)} OR NOT ${safeIntegerSql("r.output_tokens", true)}
    OR NOT ${safeIntegerSql("r.created_at")} OR NOT ${safeIntegerSql("r.ended_at", true)}
    OR r.state IS NULL OR r.state NOT IN ('reserved','unknown','settled')
    OR (r.state='settled' AND (r.charged IS NULL OR r.charged>r.reserved))
    OR q.request_id IS NULL OR q.model IS NOT r.model OR NOT (${historicalProfiles})
    OR NOT ${safeIntegerSql("q.input_nano")} OR NOT ${safeIntegerSql("q.output_nano")}
    OR typeof(q.fee_multiplier) NOT IN ('integer','real') OR q.fee_multiplier IS NOT 2)
  AND NOT EXISTS(SELECT 1 FROM request_profiles q LEFT JOIN requests r ON r.id=q.request_id WHERE r.id IS NULL)
  AND NOT EXISTS(SELECT 1 FROM ai_budget_policies lp WHERE NOT ${safeIntegerSql("lp.max_calls")} OR lp.max_calls=0
    OR NOT ${safeIntegerSql("lp.max_nano")} OR lp.max_nano=0
    OR typeof(lp.stop_on_failure)<>'integer' OR lp.stop_on_failure NOT IN (0,1)
    OR typeof(lp.stopped)<>'integer' OR lp.stopped NOT IN (0,1))
  AND NOT EXISTS(SELECT 1 FROM ai_dispatch_intents li LEFT JOIN requests lr ON lr.id=li.request_id
    LEFT JOIN ai_budget_policies lp ON lp.id=li.policy_id WHERE lr.id IS NULL OR lp.id IS NULL
    OR li.authorization_id IS NOT lp.authorization_id OR li.scope_hash IS NOT lp.scope_hash
    OR NOT ${safeIntegerSql("li.payload_bytes")} OR li.payload_bytes NOT BETWEEN 1 AND ${profile.inputBytes}
    OR NOT ${safeIntegerSql("li.dispatch_started_at", true)})`;
// Used in reserve and claim, including after shutdown/restart. Normal production is deliberately unsupported in B1.
const allowed = `c.authority='market-radar-product' AND c.schema_version='d1-budget-v1'
  AND c.enabled=1 AND c.import_status='verified' AND length(c.import_hash)=64
  AND m.identity='market-radar-product-budget-v2' AND m.fee_multiplier=2
  AND p.mode='pilot' AND p.pilot='${SYNTHETIC_PILOT_ID}' AND p.stopped=0
  AND p.max_calls BETWEEN 1 AND ${REAL_AI.pilotCalls} AND p.max_nano BETWEEN 1 AND ${REAL_AI.pilotNano}`;

/** One D1 authority for the project. All amounts are integer nano-USD, never billed cost. */
export class D1ProductBudget {
  readonly feeMultiplier = 2;
  private readonly profileHash = digest(JSON.stringify([
    profile.provider, profile.model, profile.priceVersion, profile.adapterVersion, profile.billingProfile,
    profile.cacheWriteNanoPerToken, profile.outputNanoPerToken, 2,
  ]));
  private readonly db: BudgetDatabase;
  constructor(db: BudgetDatabase) { this.db = db; }
  private statement(sql: string, ...values: Value[]) { return this.db.prepare(sql).bind(...values); }
  private async rows<T>(sql: string, ...values: Value[]): Promise<T[]> {
    const result = await this.statement(sql, ...values).all<T>();
    if (!result.success) throw new Error("budget_unavailable");
    return result.results;
  }
  private async transaction(statements: Statement[]) {
    const results = await this.db.batch(statements);
    if (results.some(result => !result.success)) throw new Error("budget_unavailable");
    return results;
  }
  private reservation(row: Intent, repeated: boolean) {
    return { id: row.request_id, reservedNano: row.reserved, month: row.month, state: row.state,
      policyId: row.policy_id, authorizationId: row.authorization_id, payloadHash: row.payload_hash,
      snapshotId: row.snapshot_id, snapshotHash: row.snapshot_hash, catalogHash: row.catalog_hash,
      profileHash: row.profile_hash, repeated };
  }
  async reserve(input: ReservationInput) {
    input = { ...input };
    const atMonth = month(input.now);
    if (!identity(input.idempotencyKey) || !identity(input.snapshotId)
      || ![input.scopeHash, input.payloadHash, input.snapshotHash, input.catalogHash].every(hash)
      || !integer(input.payloadBytes) || input.payloadBytes < 1 || input.payloadBytes > profile.inputBytes) throw new Error("budget_request_invalid");
    const profileHash = await this.profileHash, id = crypto.randomUUID();
    const maximumNano = Math.ceil(((input.payloadBytes + profile.wrapperTokenReserve) * profile.cacheWriteNanoPerToken
      + profile.outputTokens * profile.outputNanoPerToken) * this.feeMultiplier);
    // The FIRST write contains every admission/limit predicate. D1 batch serializes the entire
    // profile -> request -> intent transaction; neither a read nor JS arithmetic authorizes it.
    const results = await this.transaction([
      this.statement(`INSERT INTO request_profiles
        SELECT ?,?,?,?,?,?,?,?,? FROM ai_budget_control c JOIN metadata m ON m.id=c.id
        JOIN ai_budget_policies p ON p.id=c.policy_id WHERE c.id=1 AND ${allowed} AND ${ledgerHealthy} AND p.scope_hash=?
        AND NOT EXISTS(SELECT 1 FROM ai_dispatch_intents WHERE scope_hash=? AND idempotency_key=?)
        AND NOT EXISTS(SELECT 1 FROM requests WHERE state='reserved')
        AND (SELECT COALESCE(SUM(${occupied}),0) FROM requests WHERE month=? OR state<>'settled')+?<=?
        AND (SELECT COUNT(*) FROM requests WHERE pilot=?)<?
        AND (SELECT COALESCE(SUM(${occupied}),0) FROM requests WHERE pilot=?)+?<=?
        AND (SELECT COUNT(*) FROM ai_dispatch_intents WHERE policy_id=p.id)<p.max_calls
        AND (SELECT COALESCE(SUM(CASE WHEN r.state='settled' THEN r.charged ELSE r.reserved END),0)
          FROM requests r JOIN ai_dispatch_intents i ON i.request_id=r.id WHERE i.policy_id=p.id)+?<=p.max_nano`,
        id, profile.provider, profile.model, profile.priceVersion, profile.adapterVersion, profile.billingProfile,
        profile.cacheWriteNanoPerToken, profile.outputNanoPerToken, this.feeMultiplier,
        input.scopeHash, input.scopeHash, input.idempotencyKey, atMonth, maximumNano, REAL_AI.dispatchNano,
        SYNTHETIC_PILOT_ID, REAL_AI.pilotCalls, SYNTHETIC_PILOT_ID, maximumNano, REAL_AI.pilotNano, maximumNano),
      this.statement(`INSERT INTO requests(id,month,pilot,reserved,state,created_at,model)
        SELECT ?,?,?,?,'reserved',?,? WHERE EXISTS(SELECT 1 FROM request_profiles WHERE request_id=?)`,
        id, atMonth, SYNTHETIC_PILOT_ID, maximumNano, input.now, profile.model, id),
      this.statement(`INSERT INTO ai_dispatch_intents(request_id,policy_id,authorization_id,scope_hash,idempotency_key,
        payload_hash,payload_bytes,snapshot_id,snapshot_hash,catalog_hash,profile_hash,state)
        SELECT ?,p.id,p.authorization_id,?,?,?,?,?,?,?,?,'ready' FROM ai_budget_control c
        JOIN ai_budget_policies p ON p.id=c.policy_id WHERE c.id=1 AND EXISTS(SELECT 1 FROM requests WHERE id=?)`,
        id, input.scopeHash, input.idempotencyKey, input.payloadHash, input.payloadBytes, input.snapshotId, input.snapshotHash, input.catalogHash, profileHash, id),
    ]);
    const [row] = await this.rows<Intent>(`SELECT i.*,r.reserved,r.month,c.policy_id AS active_policy_id FROM ai_dispatch_intents i
      JOIN requests r ON r.id=i.request_id JOIN ai_budget_control c ON c.id=1
      WHERE i.scope_hash=? AND i.idempotency_key=? AND ${ledgerHealthy}`, input.scopeHash, input.idempotencyKey);
    if (!row) throw new Error("budget_admission_denied");
    if (row.payload_hash !== input.payloadHash || row.payload_bytes !== input.payloadBytes || row.snapshot_id !== input.snapshotId
      || row.snapshot_hash !== input.snapshotHash || row.catalog_hash !== input.catalogHash || row.profile_hash !== profileHash
      || row.reserved !== maximumNano || row.policy_id !== row.active_policy_id) throw new Error("idempotency_conflict");
    return this.reservation(row, results[0].meta.changes === 0);
  }
  async claim(id: string, input: { now: number; scopeHash: string }) {
    const atMonth = month(input.now);
    if (!identity(id) || !hash(input.scopeHash)) throw new Error("budget_request_invalid");
    const result = await this.transaction([this.statement(`UPDATE ai_dispatch_intents SET state='dispatch_started',dispatch_started_at=?
      WHERE request_id=? AND scope_hash=? AND state='ready' AND ${ledgerHealthy}
      AND EXISTS(SELECT 1 FROM requests r WHERE r.id=request_id AND r.state='reserved' AND r.month=?
        AND r.created_at<=? AND r.created_at>?)
      AND EXISTS(SELECT 1 FROM ai_budget_control c JOIN metadata m ON m.id=c.id JOIN ai_budget_policies p ON p.id=c.policy_id
        WHERE c.id=1 AND ${allowed} AND p.id=ai_dispatch_intents.policy_id
        AND p.authorization_id=ai_dispatch_intents.authorization_id AND p.scope_hash=ai_dispatch_intents.scope_hash)
      RETURNING request_id,policy_id,authorization_id,payload_hash,snapshot_id,snapshot_hash,catalog_hash,profile_hash`,
      input.now, id, input.scopeHash, atMonth, input.now, input.now - REAL_AI.cacheTtlMs)]);
    // A lost commit response yields no proof. Reading dispatch_started never grants a second claim.
    return result[0].meta.changes === 1 ? { claimed: true as const, identity: result[0].results[0] } : { claimed: false as const };
  }
  private async entry(id: string) {
    const [entry] = await this.rows<Entry>(`SELECT r.*,p.provider,p.model AS profile_model,p.price_version,p.adapter_version,p.billing_profile,
      p.input_nano,p.output_nano,p.fee_multiplier FROM requests r JOIN request_profiles p ON p.request_id=r.id WHERE r.id=?`, id);
    if (!entry || !integer(entry.reserved) || [entry.charged, entry.usage_cost, entry.input_tokens, entry.output_tokens].some(n => n !== null && !integer(n))) throw new Error("budget_unavailable");
    const fixed = entry.provider === "openai" ? REAL_AI : entry.provider === "deepseek" ? DEEPSEEK_AI : null;
    if (!fixed || entry.model !== fixed.model || entry.profile_model !== fixed.model || entry.price_version !== fixed.priceVersion || entry.adapter_version !== fixed.adapterVersion
      || entry.billing_profile !== fixed.billingProfile || entry.input_nano !== fixed.cacheWriteNanoPerToken
      || entry.output_nano !== fixed.outputNanoPerToken || entry.fee_multiplier !== this.feeMultiplier) throw new Error("budget_profile_invalid");
    return entry;
  }
  async settle(id: string, input: Settlement) {
    input = { ...input, usage: { ...input.usage } };
    month(input.now);
    if (!identity(id) || !outcomeValid(input.outcome) || input.responseId !== null && !identity(input.responseId)
      || !integer(input.usageCostNano) || !input.usage || !integer(input.usage.inputTokens) || !integer(input.usage.outputTokens)) throw new Error("invalid_usage");
    const before = await this.entry(id), cost = input.usage.inputTokens * before.input_nano + input.usage.outputTokens * before.output_nano;
    const charged = Math.ceil(cost * before.fee_multiplier);
    if (!integer(cost) || cost !== input.usageCostNano || !integer(charged)) throw new Error("invalid_usage");
    if (charged > before.reserved) throw new Error("reservation_exceeded");
    const matches = (row: Entry) => row.state === "settled" && row.charged === charged && row.usage_cost === cost
      && row.input_tokens === input.usage.inputTokens && row.output_tokens === input.usage.outputTokens
      && row.response_id === input.responseId && row.outcome === input.outcome;
    if (before.state === "settled") {
      if (!matches(before)) throw new Error("settlement_conflict");
      return charged;
    }
    // Exact persisted accounting tuple also gates the linked policy stop. A conflicting winner
    // cannot be overwritten, and releasing the global reservation cannot precede that stop.
    const tuple = `r.id=? AND r.state='settled' AND r.charged=? AND r.usage_cost=? AND r.input_tokens=?
      AND r.output_tokens=? AND r.response_id IS ? AND r.outcome=?`;
    const values: Value[] = [id, charged, cost, input.usage.inputTokens, input.usage.outputTokens, input.responseId, input.outcome];
    await this.transaction([
      this.statement(`UPDATE requests SET state='settled',charged=?,usage_cost=?,input_tokens=?,output_tokens=?,response_id=?,outcome=?,ended_at=?
        WHERE id=? AND state<>'settled' AND (NOT EXISTS(SELECT 1 FROM ai_dispatch_intents WHERE request_id=?)
          OR EXISTS(SELECT 1 FROM ai_dispatch_intents WHERE request_id=? AND dispatch_started_at IS NOT NULL AND state IN ('dispatch_started','unknown')))`,
        charged, cost, input.usage.inputTokens, input.usage.outputTokens, input.responseId, input.outcome, input.now, id, id, id),
      this.statement(`UPDATE ai_dispatch_intents SET state='settled' WHERE request_id=? AND EXISTS(SELECT 1 FROM requests r WHERE ${tuple})`, id, ...values),
      this.statement(`UPDATE ai_budget_policies SET stopped=1,stop_reason=? WHERE stopped=0 AND stop_on_failure=1 AND ?<>'completed'
        AND id IN(SELECT i.policy_id FROM ai_dispatch_intents i JOIN requests r ON r.id=i.request_id WHERE ${tuple})`, input.outcome, input.outcome, ...values),
    ]);
    if (!matches(await this.entry(id))) throw new Error("settlement_conflict");
    return charged;
  }
  async unknown(id: string, input: { now: number; outcome: string }) {
    input = { ...input };
    month(input.now);
    if (!identity(id) || !outcomeValid(input.outcome)) throw new Error("budget_request_invalid");
    await this.entry(id);
    await this.transaction([
      this.statement("UPDATE requests SET state='unknown',ended_at=?,outcome=? WHERE id=? AND state='reserved'", input.now, input.outcome, id),
      this.statement("UPDATE ai_dispatch_intents SET state='unknown' WHERE request_id=? AND EXISTS(SELECT 1 FROM requests WHERE id=? AND state='unknown')", id, id),
      this.statement(`UPDATE ai_budget_policies SET stopped=1,stop_reason=(SELECT outcome FROM requests WHERE id=?)
        WHERE stopped=0 AND stop_on_failure=1 AND id IN(SELECT i.policy_id FROM ai_dispatch_intents i
          JOIN requests r ON r.id=i.request_id WHERE r.id=? AND r.state='unknown')`, id, id),
    ]);
  }
  async disable(reason: string) {
    if (!outcomeValid(reason)) throw new Error("budget_request_invalid");
    await this.transaction([this.statement("UPDATE ai_budget_control SET enabled=0,disabled_reason=? WHERE id=1", reason)]);
  }
  async inspect(now: number) {
    const atMonth = month(now);
    const [totals] = await this.rows<{ monthly: number; carry: number; pilot: number; calls: number; active: number }>(`SELECT
      COALESCE(SUM(CASE WHEN month=? THEN ${occupied} ELSE 0 END),0) AS monthly,
      COALESCE(SUM(CASE WHEN month<>? AND state<>'settled' THEN reserved ELSE 0 END),0) AS carry,
      COALESCE(SUM(CASE WHEN pilot=? THEN ${occupied} ELSE 0 END),0) AS pilot,
      COALESCE(SUM(CASE WHEN pilot=? THEN 1 ELSE 0 END),0) AS calls,
      COALESCE(SUM(CASE WHEN state='reserved' THEN 1 ELSE 0 END),0) AS active FROM requests HAVING ${ledgerHealthy}`, atMonth, atMonth, SYNTHETIC_PILOT_ID, SYNTHETIC_PILOT_ID);
    if (!totals || !Object.values(totals).every(integer)) throw new Error("budget_unavailable");
    return { month: atMonth, ...totals, dispatchRemainingNano: Math.max(0, REAL_AI.dispatchNano - totals.monthly - totals.carry), billedCost: null };
  }
}
