import { InterpretationError } from "./contracts";
import { createRealPilotService, prepareControlledRequest } from "./real-service";
import { controlledAdmission, createRealContextSnapshots } from "./snapshot";
import { createCurrentContextLoader } from "./real-context-loader";
import { approvedRealContextGrant, type RealContextGrant } from "./real-context-policy";
import { DEEPSEEK_AI } from "./real-config";
import { parsePrivateInterpretation } from "./private-contract";

type Budget = Parameters<typeof createRealPilotService>[1] & { inspectRealContextBatch(): { id: string; calls: number; limit: number; stopped: boolean; authorizationId: string; policyVersion: string } };
type Options = { grant?: RealContextGrant | null; loader?: ReturnType<typeof createCurrentContextLoader>; now?: () => number;
  provider?: Parameters<typeof createRealPilotService>[0]; ledger?: Budget; record?: (requestId: string, event: string, value: unknown) => void };

/** One bounded private runtime; no route can inject its loader, grant, provider or budget. */
export function createPrivateContextRuntime(options: Options = {}) {
  const grant = options.grant === undefined ? approvedRealContextGrant() : options.grant, now = options.now ?? Date.now;
  const registry = grant ? createRealContextSnapshots(options.loader ?? createCurrentContextLoader(), grant, { now }) : null;
  const service = grant && options.provider && options.ledger && options.record ? createRealPilotService(options.provider, options.ledger, { profile: DEEPSEEK_AI, now, record: options.record }) : null;
  let closed = false;
  function gate() {
    if (closed || grant?.revoked) return { admission: "blocked" as const, reason: "permission_revoked" };
    if (!grant || !registry) return { admission: "blocked" as const, reason: "data_permission_unavailable" };
    if (!service || !options.ledger) return { admission: "blocked" as const, reason: "provider_not_configured" };
    try {
      const batch = options.ledger.inspectRealContextBatch();
      if (batch.authorizationId !== grant.authorizationId || batch.policyVersion !== grant.policyVersion) throw Error("batch_identity_mismatch");
      if (batch.stopped || batch.calls >= 3) return { admission: "blocked" as const, reason: batch.stopped ? "batch_stopped" : "batch_exhausted" };
      return { admission: "ready" as const };
    } catch { return { admission: "blocked" as const, reason: "budget_unavailable" }; }
  }
  const requireReady = () => { const g = gate(); if (g.admission !== "ready") throw new InterpretationError(g.reason); };
  return {
    status() { return { gate: gate(), allowedSymbol: "BTC-USDT" }; },
    async snapshot(scope: string, symbol: string, signal: AbortSignal) { requireReady(); return registry!.create(scope, symbol, signal); },
    async interpret(scope: string, symbol: string, snapshotId: string, signal: AbortSignal) {
      requireReady(); const admission = registry!.get(scope, symbol, snapshotId), identity = controlledAdmission(admission);
      const prepared = prepareControlledRequest(admission), { request } = prepared;
      if (!("selection" in request)) throw new InterpretationError("catalog_invalid");
      const result = await service!.interpretPrepared(prepared, signal); identity.assertAccess();
      if (signal.aborted) throw new InterpretationError("cancelled");
      const selected = result.output;
      if (!("modelSelected" in selected) || result.inputIdentity !== "approved_real" || selected.modelOrganizationQuality !== "PASS") throw new InterpretationError("organization_failed");
      const baseline = request.selection.deterministicBaseline;
      return parsePrivateInterpretation({ format: "private-interpretation-v1", provider: result.provider, model: result.returnedModel, inputIdentity: result.inputIdentity, inputTrust: result.inputTrust, deploymentMode: result.deploymentMode,
        contextId: result.context.contextId, requestId: result.requestId, asOf: result.asOf, generatedAt: result.generatedAt, cacheHit: result.cacheHit, oldSnapshot: result.oldSnapshot,
        snapshot: identity.metadata, context: result.context, catalogId: selected.catalogId, versions: selected.versions,
        baseline: { selectedClaimIds: baseline.selectedClaimIds, rationale: baseline.rationale, sentences: baseline.selectedClaimIds.map(id => { const e = request.selection.entries.find(e => e.claimId === id)!; return { claimId: e.claimId, text: e.text, evidenceRefs: e.evidenceRefs, metricRefs: e.metricRefs }; }) },
        modelSelection: { selectedClaimIds: selected.modelSelected, sentences: selected.renderedResult.summary }, systemRequired: selected.systemRequired, systemAdded: selected.systemAdded,
        selectionValidity: selected.selectionValidity, modelOrganizationQuality: selected.modelOrganizationQuality, disclosureCompleteness: selected.disclosureCompleteness, modelValue: "UNPROVEN",
        status: result.context.evidence.some(e => e.availability !== "available") ? "partial" : "success",
        usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, usageIdentity: result.usageIdentity, usageCalculatedNano: result.usageCalculatedNano, budgetChargedBoundNano: result.budgetChargedBoundNano, billedCost: null },
      });
    },
    evidence(scope: string, symbol: string, snapshotId: string) { if (closed || !registry || grant?.revoked) throw new InterpretationError("permission_revoked"); return registry.evidence(scope, symbol, snapshotId); },
    close() { closed = true; service?.stop(); registry?.revoke(); },
  };
}
