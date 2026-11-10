import { InterpretationError } from "./contracts";
import { createRealPilotService, prepareControlledRequest } from "./real-service";
import { controlledAdmission, createRealContextSnapshots } from "./snapshot";
import { createCurrentContextLoader } from "./real-context-loader";
import { approvedRealContextGrant, type RealContextGrant } from "./real-context-policy";
import { DEEPSEEK_AI } from "./real-config";
import { toPrivateInterpretation } from "./interpretation-display";

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
      return toPrivateInterpretation(prepared, result, identity.metadata);
    },
    evidence(scope: string, symbol: string, snapshotId: string) { if (closed || !registry || grant?.revoked) throw new InterpretationError("permission_revoked"); return registry.evidence(scope, symbol, snapshotId); },
    close() { closed = true; service?.stop(); registry?.revoke(); },
  };
}
