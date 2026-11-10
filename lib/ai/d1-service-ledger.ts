import { D1ProductBudget } from "./d1-budget";
import { DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from "./real-config";
import type { Ledger, ServiceReservation, ServiceReserveInput } from "./real-service";

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Server-only adapter. The caller binds an already authorized scope; no policy,
 * transport, initialization, new prices or financial calculations are supplied here. */
export function createD1ServiceLedger(budget: D1ProductBudget, scopeHash: string): Ledger {
  if (!/^[a-f0-9]{64}$/.test(scopeHash)) throw new Error("budget_request_invalid");
  const owned = new WeakMap<ServiceReservation, { payloadHash: string; snapshotId: string; snapshotHash: string; catalogHash: string; profileHash: string; authorizationId: string; policyId: string }>();
  return {
    feeMultiplier: budget.feeMultiplier,
    needsExecutionContext: true,
    async reserve(input: ServiceReserveInput) {
      const { prepared, snapshotId } = input;
      if (input.pilot !== SYNTHETIC_PILOT_ID || input.provider !== DEEPSEEK_AI.provider || input.model !== DEEPSEEK_AI.model ||
        prepared.profile !== DEEPSEEK_AI || !Object.isFrozen(prepared) || !("selection" in prepared.request) ||
        input.batch && input.batch.scopeHash !== scopeHash) throw new Error("budget_request_invalid");
      const payload = prepared.request.body;
      const [payloadHash, snapshotHash, catalogHash] = await Promise.all([
        digest(payload), digest(JSON.stringify(prepared.safe)), digest(JSON.stringify(prepared.request.selection)),
      ]);
      const idempotencyKey = await digest(JSON.stringify(["ai-dispatch-v1", scopeHash, snapshotId, snapshotHash, catalogHash, payloadHash]));
      const reservation = Object.freeze(await budget.reserve({ now: input.now, idempotencyKey, scopeHash, payloadHash,
        payloadBytes: new TextEncoder().encode(payload).byteLength, snapshotId, snapshotHash, catalogHash }));
      // A different spending authorization cannot sponsor a controlled admission.
      // If a new reservation was already committed, failing here keeps its full hold.
      if (input.batch && input.batch.authorizationId !== reservation.authorizationId) throw new Error("idempotency_conflict");
      owned.set(reservation, { payloadHash, snapshotId, snapshotHash, catalogHash, profileHash: reservation.profileHash,
        authorizationId: reservation.authorizationId, policyId: reservation.policyId });
      return reservation;
    },
    async claim(reservation, { now }) {
      const identity = owned.get(reservation);
      if (!identity || reservation.repeated) throw new Error("budget_request_invalid");
      const result = await budget.claim(reservation.id, { now, scopeHash });
      if (!result.claimed) return result;
      const claimed = result.identity;
      if (claimed.request_id !== reservation.id || claimed.payload_hash !== identity.payloadHash || claimed.snapshot_id !== identity.snapshotId ||
        claimed.snapshot_hash !== identity.snapshotHash || claimed.catalog_hash !== identity.catalogHash || claimed.profile_hash !== identity.profileHash ||
        claimed.authorization_id !== identity.authorizationId || claimed.policy_id !== identity.policyId) throw new Error("idempotency_conflict");
      return { claimed: true };
    },
    settle: (id, input) => budget.settle(id, input),
    unknown: (id, now, outcome) => budget.unknown(id, { now, outcome }),
    inspect: now => budget.inspect(now),
  };
}
