import type { BudgetDatabase } from "./d1-budget";
import type { AIGrant, AIPrincipal } from "../../worker/ai-authorization";
import type { RealContextGrant } from "./real-context-policy";
import type { SiteSnapshotRecord } from "./snapshot";
import { parseSiteInterpretation, type SiteInterpretation } from "./site-contract";
import { InterpretationError } from "./contracts";
import { SYNTHETIC_PILOT_ID } from "./real-config";

type SnapshotRow = { id: string; site_id: string; subject_id: string; grant_revision: number; scope_hash: string; symbol: string;
  policy_id: string; captured_at: number; fresh_until: number; access_until: number; delete_after: number; body: string; digest: string };
type Link = { policy_id: string; authorization_id: string; policy_version: string; scope_hash: string; review_started_at: number; review_until: number };
const fail = (code = "record_unavailable"): never => { throw new InterpretationError(code); };
export async function recordDigest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), n => n.toString(16).padStart(2,"0")).join("");
}
const bounded = (value: unknown, limit: number) => { const body = JSON.stringify(value); if (new TextEncoder().encode(body).length > limit) fail("input_limit"); return body; };
export class D1Records {
  private readonly db: BudgetDatabase;
  constructor(db: BudgetDatabase) { this.db = db; }
  private async rows<T>(sql: string, ...values: (string | number | null)[]): Promise<T[]> {
    try { const response = await this.db.prepare(sql).bind(...values).all<T>(); if (!response.success) fail(); return response.results; }
    catch { return fail(); }
  }
  async getGrant(siteId: string, subjectId: string): Promise<AIGrant | null> {
    try {
      const [r] = await this.rows<{ revision: number; enabled: number; expires_at: number; permissions_json: string; symbols_json: string }>(
        "SELECT * FROM ai_access_grants WHERE site_id=? AND subject_id=?", siteId, subjectId);
      if (!r) return null;
      return { siteId, subjectId, revision: r.revision, enabled: r.enabled === 1, expiresAt: r.expires_at,
        permissions: JSON.parse(r.permissions_json), symbols: JSON.parse(r.symbols_json) };
    } catch { return fail("authorization_unavailable"); }
  }
  async link(principal: AIPrincipal, grant: RealContextGrant, now: number, dispatch = true): Promise<Link> {
    const [r] = await this.rows<Link & { enabled: number; stopped: number }>(`SELECT l.*,c.enabled,p.stopped FROM ai_context_policy_links l
      JOIN ai_budget_policies p ON p.id=l.policy_id JOIN ai_budget_control c ON c.policy_id=p.id AND c.id=1
      WHERE c.import_status='verified' AND c.authority='market-radar-product' AND c.schema_version='d1-budget-v1'
        AND p.mode='pilot' AND p.pilot=? AND p.max_calls BETWEEN 1 AND 3 AND p.max_nano BETWEEN 1 AND 250000000
        AND p.stop_on_failure=1 AND p.authorization_id=l.authorization_id AND p.scope_hash=l.scope_hash
        AND l.authorization_id=? AND l.policy_version=? AND l.scope_hash=?`, SYNTHETIC_PILOT_ID, grant.authorizationId, grant.policyVersion, principal.scope);
    if (!r || grant.revoked || !Number.isSafeInteger(r.review_started_at) || !Number.isSafeInteger(r.review_until) ||
      r.review_until !== r.review_started_at + 1200000 || now < r.review_started_at || now >= r.review_until || now >= principal.expiresAt) fail("permission_revoked");
    if (dispatch && (!r.enabled || r.stopped)) fail("disabled");
    return r;
  }
  async putSnapshot(principal: AIPrincipal, record: SiteSnapshotRecord, link: Link, now: number) {
    const body = bounded(record, 131072), digest = await recordDigest(body);
    const accessUntil = Math.min(principal.expiresAt, link.review_until), deleteAfter = record.metadata.capturedAt + 30 * 86400000;
    if (record.scope !== principal.scope || record.reviewUntil !== link.review_until || record.metadata.expiresAt > accessUntil || now >= record.metadata.expiresAt) fail("context_expired");
    await this.rows(`INSERT INTO ai_snapshots SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?
      WHERE (SELECT COUNT(*) FROM ai_snapshots WHERE scope_hash=? AND delete_after>?)<16
        AND (SELECT COUNT(*) FROM ai_snapshots WHERE delete_after>?)<128`, record.metadata.id, principal.siteId, principal.subjectId,
      principal.grantRevision, principal.scope, record.symbol, link.policy_id, record.metadata.capturedAt, record.metadata.expiresAt,
      accessUntil, deleteAfter, body, digest, principal.scope, now, now);
    const row = await this.snapshot(principal, record.symbol, record.metadata.id, now);
    if (row.row.digest !== digest) fail();
  }
  async checkCapacity(scope: string, now: number) {
    const [r] = await this.rows<{ owned: number; total: number }>("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN scope_hash=? THEN 1 ELSE 0 END),0) AS owned FROM ai_snapshots WHERE delete_after>?", scope, now);
    if (!r || r.owned >= 16 || r.total >= 128) fail("snapshot_capacity");
  }
  async snapshot(principal: AIPrincipal, symbol: string, id: string, now: number): Promise<{ row: SnapshotRow; record: SiteSnapshotRecord }> {
    const [r] = await this.rows<SnapshotRow>(`SELECT * FROM ai_snapshots WHERE id=? AND site_id=? AND subject_id=? AND grant_revision=? AND scope_hash=? AND symbol=?`,
      id, principal.siteId, principal.subjectId, principal.grantRevision, principal.scope, symbol);
    if (!r || !Number.isSafeInteger(r.access_until) || !Number.isSafeInteger(r.delete_after) || now >= r.access_until || now >= r.delete_after || now >= principal.expiresAt) fail();
    if (new TextEncoder().encode(r.body).length > 131072 || await recordDigest(r.body) !== r.digest) fail("snapshot_invalid");
    let record: SiteSnapshotRecord;
    try { record = JSON.parse(r.body); } catch { return fail("snapshot_invalid"); }
    if (record.scope !== principal.scope || record.symbol !== symbol || record.metadata.id !== id || record.metadata.capturedAt !== r.captured_at || record.metadata.expiresAt !== r.fresh_until ||
      r.access_until > record.reviewUntil || r.delete_after !== record.metadata.capturedAt + 30 * 86400000) fail("snapshot_invalid");
    return { row: r, record };
  }
  async result(principal: AIPrincipal, symbol: string, snapshotId: string, now: number): Promise<SiteInterpretation | null> {
    const { row, record } = await this.snapshot(principal, symbol, snapshotId, now);
    const [r] = await this.rows<{ request_id: string; body: string; digest: string; delete_after: number }>(
      "SELECT * FROM ai_results WHERE snapshot_id=?", snapshotId);
    if (!r) return null;
    if (r.delete_after !== row.delete_after || now >= r.delete_after || new TextEncoder().encode(r.body).length > 65536 || await recordDigest(r.body) !== r.digest) fail();
    const result = parseSiteInterpretation(JSON.parse(r.body));
    const [accounting] = await this.rows<{ state: string; charged: number; snapshot_id: string; scope_hash: string; policy_id: string }>(
      "SELECT r.state,r.charged,i.snapshot_id,i.scope_hash,i.policy_id FROM requests r JOIN ai_dispatch_intents i ON i.request_id=r.id WHERE r.id=?", r.request_id);
    if (!accounting || accounting.state !== "settled" || accounting.charged !== result.usage.budgetChargedBoundNano || accounting.scope_hash !== principal.scope || accounting.snapshot_id !== snapshotId || accounting.policy_id !== row.policy_id ||
      result.requestId !== r.request_id || result.snapshot.id !== snapshotId || result.context.asset.symbol !== symbol ||
      JSON.stringify(result.context) !== JSON.stringify(record.context) || JSON.stringify(result.snapshot) !== JSON.stringify(record.metadata)) fail();
    return { ...result, cacheHit: true, oldSnapshot: now >= row.fresh_until || result.oldSnapshot };
  }
  async putResult(principal: AIPrincipal, result: SiteInterpretation, now: number) {
    const parsed = parseSiteInterpretation(result), { row, record } = await this.snapshot(principal, parsed.context.asset.symbol, parsed.snapshot.id, now);
    if (JSON.stringify(parsed.context) !== JSON.stringify(record.context) || JSON.stringify(parsed.snapshot) !== JSON.stringify(record.metadata)) fail("snapshot_invalid");
    const body = bounded(parsed, 65536), digest = await recordDigest(body);
    const [old] = await this.rows<{ digest: string }>("SELECT digest FROM ai_results WHERE snapshot_id=?", parsed.snapshot.id);
    if (old) { if (old.digest !== digest) fail("idempotency_conflict"); return; }
    await this.rows(`INSERT INTO ai_results SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM requests r JOIN ai_dispatch_intents i ON i.request_id=r.id
      WHERE r.id=? AND r.state='settled' AND r.charged=? AND i.snapshot_id=? AND i.scope_hash=? AND i.policy_id=?)`,
      parsed.requestId, parsed.snapshot.id, body, digest, row.delete_after, parsed.requestId, parsed.usage.budgetChargedBoundNano, parsed.snapshot.id, principal.scope, row.policy_id);
    if (!(await this.result(principal, parsed.context.asset.symbol, parsed.snapshot.id, now))) fail("result_unavailable");
  }
  async purgeExpired(now: number) {
    // Bounded opportunistic cleanup, never financial records. No punctual deletion promise without scheduling.
    const result = await this.db.batch([
      this.db.prepare("DELETE FROM ai_results WHERE request_id IN(SELECT request_id FROM ai_results WHERE delete_after<=? LIMIT 100)").bind(now),
      this.db.prepare("DELETE FROM ai_snapshots WHERE id IN(SELECT s.id FROM ai_snapshots s WHERE s.delete_after<=? AND NOT EXISTS(SELECT 1 FROM ai_results r WHERE r.snapshot_id=s.id) LIMIT 100)").bind(now),
    ]);
    if (result.some(r => !r.success)) fail();
  }
}
