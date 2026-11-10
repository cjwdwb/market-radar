import { InterpretationError } from "./contracts";
import { D1ProductBudget, type BudgetDatabase } from "./d1-budget";
import { D1Records } from "./d1-records";
import { createD1ServiceLedger } from "./d1-service-ledger";
import { captureSiteSnapshot, restoreSiteSnapshot, controlledAdmission } from "./snapshot";
import { createRealPilotService, prepareControlledRequest, type ServiceExecution } from "./real-service";
import { createCurrentContextLoader } from "./real-context-loader";
import { type SiteContextGrant } from "./real-context-policy";
import { DEEPSEEK_AI } from "./real-config";
import { toSiteInterpretation } from "./interpretation-display";
import type { AIPrincipal } from "../../worker/ai-authorization";

function isOldSnapshot(identity: ReturnType<typeof controlledAdmission>, previouslyOld: boolean) {
  identity.assertAccess();
  try { identity.assertCurrent(); return previouslyOld; }
  catch (error) { if (error instanceof InterpretationError && error.code === "context_expired") return true; throw error; }
}

/** Same runtime for the hosted route and isolated Worker tests. No HTTP can supply dependencies. */
export function createSiteContextRuntime(options: { db: BudgetDatabase; grant: SiteContextGrant | null;
  loader?: ReturnType<typeof createCurrentContextLoader>; provider?: Parameters<typeof createRealPilotService>[0]; now?: () => number }) {
  const now = options.now ?? Date.now, records = new D1Records(options.db), load = options.loader ?? createCurrentContextLoader();
  const grant = options.grant;
  const grantIdentity = JSON.stringify(grant);
  function source() {
    if (!grant || grant.revoked || JSON.stringify(grant) !== grantIdentity || grant.retentionDays !== 30 ||
      grant.deployment !== "site_pilot" || grant.storage !== "d1-private" || grant.audience !== "site-owner" ||
      !grant.sourceEvidence || !grant.userAuthorizationEvidence || grant.approvedAt > now()) throw new InterpretationError("data_permission_unavailable");
    return grant;
  }
  function active(principal: AIPrincipal, symbol: string, signal?: AbortSignal) {
    if (source().siteId !== principal.siteId) throw new InterpretationError("data_permission_unavailable");
    if (signal?.aborted) throw new InterpretationError("cancelled");
    if (symbol !== "BTC-USDT") throw new InterpretationError("unsupported_asset");
    if (now() >= principal.expiresAt) throw new InterpretationError("permission_revoked");
  }
  async function link(principal: AIPrincipal, dispatch: boolean, expectedPolicy?: string) {
    const record = await records.link(principal, source(), now(), dispatch);
    // D1 may wait: validate the clock after the read, not only when it began.
    active(principal, "BTC-USDT");
    if (now() < record.review_started_at || now() >= record.review_until) throw new InterpretationError("permission_revoked");
    if (expectedPolicy && expectedPolicy !== record.policy_id) throw new InterpretationError("permission_revoked");
    return record;
  }
  async function verifiedLink(principal: AIPrincipal, dispatch: boolean, expectedPolicy: string, revalidate: () => Promise<void>) {
    const record = await link(principal, dispatch, expectedPolicy);
    // Grant revocation during the preceding D1 wait must be visible before dispatch/return.
    await revalidate(); active(principal, "BTC-USDT");
    if (now() < record.review_started_at || now() >= record.review_until) throw new InterpretationError("permission_revoked");
    return record;
  }
  return {
    async ready(principal: AIPrincipal) { active(principal, "BTC-USDT"); await link(principal, true); if (!options.provider) throw new InterpretationError("provider_not_configured"); },
    async snapshot(principal: AIPrincipal, symbol: string, signal: AbortSignal, revalidate: () => Promise<void>) {
      active(principal, symbol, signal); await revalidate();
      const policy = await link(principal, true);
      if (!options.provider) throw new InterpretationError("provider_not_configured");
      await records.purgeExpired(now()); active(principal, symbol, signal);
      await records.checkCapacity(principal.scope, now()); await verifiedLink(principal, true, policy.policy_id, revalidate); active(principal, symbol, signal);
      const data = await load(symbol, signal); active(principal, symbol, signal); await revalidate();
      const record = await captureSiteSnapshot(data, source(), principal.scope, policy.review_started_at, policy.review_until, now());
      await verifiedLink(principal, true, policy.policy_id, revalidate); active(principal, symbol, signal);
      await records.putSnapshot(principal, record, policy, now());
      await verifiedLink(principal, true, policy.policy_id, revalidate); active(principal, symbol, signal);
      if (now() >= record.metadata.expiresAt) throw new InterpretationError("context_expired");
      return { snapshotId: record.metadata.id, expiresAt: record.metadata.expiresAt };
    },
    async interpret(principal: AIPrincipal, symbol: string, snapshotId: string, signal: AbortSignal, execution: ServiceExecution,
      revalidate: (phase: "dispatch" | "read") => Promise<void>) {
      active(principal, symbol, signal); await revalidate("dispatch"); await link(principal, false);
      const { row, record } = await records.snapshot(principal, symbol, snapshotId, now());
      await link(principal, false, row.policy_id);
      const admission = await restoreSiteSnapshot(record, source(), principal.scope, now), identity = controlledAdmission(admission);
      const existing = await records.result(principal, symbol, snapshotId, now());
      if (existing) { await verifiedLink(principal, false, row.policy_id, () => revalidate("read")); active(principal, symbol, signal); return { ...existing, oldSnapshot: isOldSnapshot(identity, existing.oldSnapshot) }; }
      identity.assertCurrent(); await link(principal, true, row.policy_id);
      if (!options.provider) throw new InterpretationError("provider_not_configured");
      const checked = async (phase: "dispatch" | "read") => { await verifiedLink(principal, phase === "dispatch", row.policy_id, () => revalidate(phase)); };
      const service = createRealPilotService(options.provider, createD1ServiceLedger(new D1ProductBudget(options.db), principal.scope),
        { profile: DEEPSEEK_AI, deploymentMode: "site_pilot", now, revalidate: checked });
      const prepared = prepareControlledRequest(admission);
      const result = await service.interpretPrepared(prepared, signal, execution);
      await checked("read"); active(principal, symbol, signal);
      const dto = toSiteInterpretation(prepared, result, identity.metadata);
      // Never return success until durable display storage succeeds. A settled-without-result gap is not replayable.
      await records.putResult(principal, dto, now());
      await checked("read"); active(principal, symbol, signal);
      return { ...dto, oldSnapshot: isOldSnapshot(identity, dto.oldSnapshot) };
    },
    async result(principal: AIPrincipal, symbol: string, snapshotId: string, revalidate: () => Promise<void>) {
      active(principal, symbol); await revalidate(); await link(principal, false);
      const { row, record } = await records.snapshot(principal, symbol, snapshotId, now());
      const admission = await restoreSiteSnapshot(record, source(), principal.scope, now);
      controlledAdmission(admission).assertAccess();
      const result = await records.result(principal, symbol, snapshotId, now());
      if (!result) throw new InterpretationError("result_unavailable");
      await verifiedLink(principal, false, row.policy_id, revalidate); active(principal, symbol);
      return { ...result, oldSnapshot: isOldSnapshot(controlledAdmission(admission), result.oldSnapshot) };
    },
  };
}
