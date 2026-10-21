import { AI_VERSIONS, InterpretationError, type MarketIntelligenceContext, type ProviderSafeContext } from "./contracts";
import { projectProviderContext } from "./context";
import { buildResponsesRequest, type RealReply, type RealUsage } from "./openai-provider";
import { buildDeepSeekRequest } from "./deepseek-provider";
import { validateSynthesis, type SynthesisOutput } from "./real-output";
import { REAL_AI, DEEPSEEK_AI, SYNTHETIC_PILOT_ID, type ProductAIProfile } from "./real-config";
import { validateClaimSelection, type ClaimSelectionResult } from "./claim-selection";
import { controlledAdmission, type ControlledAdmission } from "./snapshot";

const preparedInputs = new WeakSet<object>();
function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freezeSnapshot(child); Object.freeze(value); }
  return value;
}
export function preparePilotRequest(context: MarketIntelligenceContext, profile: ProductAIProfile, admit = projectProviderContext) {
  if (profile !== REAL_AI && profile !== DEEPSEEK_AI) throw new InterpretationError("billing_identity_unknown");
  const projected = structuredClone(admit(context));
  const request = profile.provider === "deepseek" ? buildDeepSeekRequest(projected) : buildResponsesRequest(projected);
  const safe = "selection" in request ? request.selection.context : projected;
  const prepared = freezeSnapshot({ safe, request, profile });
  preparedInputs.add(prepared); return prepared;
}
type PreparedRequest = ReturnType<typeof preparePilotRequest>;
const approvedRequests = new WeakMap<object, ControlledAdmission>();
export function prepareControlledRequest(admission: ControlledAdmission, profile: ProductAIProfile = DEEPSEEK_AI) {
  if (profile !== DEEPSEEK_AI) throw new InterpretationError("billing_identity_unknown");
  const record = controlledAdmission(admission); record.assertCurrent();
  const prepared = preparePilotRequest(record.context, profile, () => record.context);
  approvedRequests.set(prepared, admission); return prepared;
}

type Ledger = { feeMultiplier: number; reserve(input: { now: number; pilot: string; maximumNano: number; model: string; provider: string; batch?: { id: string; authorizationId: string; policyVersion: string; snapshotId: string; scopeHash: string } }): { id: string; reservedNano: number; month: string }; settle(id: string, input: { now: number; usageCostNano: number; usage: RealUsage; outcome: string; responseId: string | null }): number; unknown(id: string, now: number, outcome: string): void; inspect(now: number, pilot: string): unknown; stopRealContextBatch?: (reason: string) => void };
type Provider = { kind?: "openai" | "deepseek"; generate(body: string, signal: AbortSignal): Promise<RealReply> };
export type RealInterpretation = {
  provider: "openai" | "deepseek"; inputIdentity: "synthetic" | "approved_real"; inputTrust: "fixture" | "controlled"; deploymentMode: "local_pilot";
  requestedModel: string; returnedModel: string; returnedServiceTier: string | null; responseId: string; requestId: string; context: ProviderSafeContext;
  adapterVersion: string; priceVersion: string; billingProfile: string; costBasis: "configured_peak_or_cache_write_bound";
  asOf: number; generatedAt: number; cacheHit: boolean; promptVersion: string; outputVersion: string; validationVersion: string;
  usage: RealUsage; usageIdentity: "provider_reported"; usageCalculatedNano: number; budgetChargedBoundNano: number; billedCost: null;
  output: SynthesisOutput | ClaimSelectionResult; limitations: string[]; oldSnapshot: boolean;
};
/** 本地试点服务。旧fixture服务保持原有身份/校验；不给生产注入默认真实transport。 */
export function createRealPilotService(provider: Provider, ledger: Ledger, options: { now?: () => number; timeoutMs?: number; admit?: (context: MarketIntelligenceContext) => ProviderSafeContext; profile?: ProductAIProfile; record?: (requestId: string, event: string, value: unknown) => void } = {}) {
  const profile = options.profile ?? REAL_AI;
  // 只支持两个已审核的固定对象，不接收任意费率/地址或自动回退。
  if (profile !== REAL_AI && profile !== DEEPSEEK_AI || provider.kind && provider.kind !== profile.provider || profile.provider === "deepseek" && provider.kind !== "deepseek") throw new InterpretationError("billing_identity_unknown");
  const now = options.now ?? Date.now, admit = options.admit ?? projectProviderContext;
  type Flight = { promise: Promise<RealInterpretation>; controller: AbortController; subscribers: Set<symbol>; settled: boolean };
  const flights = new Map<string, Flight>(), cache = new Map<string, { until: number; result: RealInterpretation }>();
  let stopped = false;
  function check(safe: ProviderSafeContext, prepared: PreparedRequest) {
    const time = now();
    const approval = approvedRequests.get(prepared);
    if (approval) {
      const r = controlledAdmission(approval); r.assertCurrent();
      if (profile !== DEEPSEEK_AI || safe.trust !== "controlled" || JSON.stringify(r.context) !== JSON.stringify(safe)) throw new InterpretationError("snapshot_admission_invalid");
    } else if (safe.trust !== "fixture" || safe.evidence.some(e => !e.source.startsWith("fixture:"))) throw new InterpretationError("data_permission_unavailable");
    if (safe.capturedAt > time || time - safe.capturedAt >= REAL_AI.cacheTtlMs) throw new InterpretationError("context_expired");
    if (!safe.evidence.some(e => ["direction", "rms", "relative"].includes(e.kind) && e.availability === "available")) throw new InterpretationError("insufficient_context");
    return safe;
  }
  function subscribe(f: Flight, signal?: AbortSignal) {
    return new Promise<RealInterpretation>((resolve, reject) => {
      const token = Symbol(); let done = false; f.subscribers.add(token);
      const release = () => { signal?.removeEventListener("abort", abort); f.subscribers.delete(token); if (!f.settled && !f.subscribers.size) f.controller.abort(); };
      const abort = () => { if (!done) { done = true; release(); reject(new InterpretationError("cancelled")); } };
      signal?.addEventListener("abort", abort, { once: true });
      f.promise.then(r => { if (!done) { done = true; release(); resolve(r); } }, e => { if (!done) { done = true; release(); reject(e); } });
      if (signal?.aborted) abort();
    });
  }
  function interpret(context: MarketIntelligenceContext, signal?: AbortSignal): Promise<RealInterpretation> {
    try { return interpretPrepared(preparePilotRequest(context, profile, admit), signal); } catch (e) { return Promise.reject(e); }
  }
  function interpretPrepared(prepared: PreparedRequest, signal?: AbortSignal): Promise<RealInterpretation> {
    if (stopped) return Promise.reject(new InterpretationError("disabled"));
    if (signal?.aborted) return Promise.reject(new InterpretationError("cancelled"));
    if (!preparedInputs.has(prepared) || prepared.profile !== profile) return Promise.reject(new InterpretationError("catalog_invalid"));
    const { safe, request } = prepared;
    const approval = approvedRequests.get(prepared);
    try { check(safe, prepared); } catch (e) { return Promise.reject(e); }
    const approved = approval ? controlledAdmission(approval) : null;
    const key = JSON.stringify({ safe, body: request.body, permissionVersion: AI_VERSIONS.projection, generation: profile.generation,
      provider: profile.provider, model: profile.model, adapter: profile.adapterVersion, price: profile.priceVersion, billing: profile.billingProfile, prompt: profile.prompt,
      selection: "selection" in request ? request.selection : null, scope: approved?.scopeHash, snapshot: approved?.metadata });
    const hit = cache.get(key);
    if (hit && hit.until > now()) return Promise.resolve({ ...hit.result, cacheHit: true });
    const previous = flights.get(key); if (previous) return subscribe(previous, signal);
    if (flights.size) return Promise.reject(new InterpretationError("busy"));
    let reservation: ReturnType<Ledger["reserve"]>;
    try { reservation = ledger.reserve({ now: now(), pilot: SYNTHETIC_PILOT_ID, maximumNano: Math.ceil(request.maximumBaseNano * ledger.feeMultiplier), model: profile.model, provider: profile.provider,
      ...(approved ? { batch: { id: "MR-30B-REAL-CONTEXT-001", authorizationId: approved.metadata.authorizationId, policyVersion: approved.metadata.policyVersion, snapshotId: approved.metadata.id, scopeHash: approved.scopeHash } } : {}) }); }
    catch (e) { return Promise.reject(new InterpretationError(e instanceof Error && ["busy", "budget_exhausted", "budget_profile_migration_required", "batch_stopped", "batch_exhausted"].includes(e.message) ? e.message : "budget_unavailable")); }
    const controller = new AbortController();
    const flight: Flight = { controller, subscribers: new Set(), settled: false, promise: Promise.resolve(null as unknown as RealInterpretation) };
    flight.promise = Promise.resolve().then(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined, removeAbort: (() => void) | undefined, accounted = false;
      try {
        check(safe, prepared); if (controller.signal.aborted || stopped) throw new InterpretationError("cancelled");
        if (approved) options.record?.(reservation.id, "frozen", { snapshot: approved.metadata, context: safe, request: request.body, catalog: "selection" in request ? request.selection : null });
        check(safe, prepared); if (controller.signal.aborted || stopped) throw new InterpretationError("cancelled");
        const failed = new Promise<never>((_, reject) => {
          const abort = () => reject(new InterpretationError(stopped ? "disabled" : "cancelled"));
          controller.signal.addEventListener("abort", abort, { once: true }); removeAbort = () => controller.signal.removeEventListener("abort", abort);
          timer = setTimeout(() => { reject(new InterpretationError("timeout")); controller.abort(); }, options.timeoutMs ?? REAL_AI.timeoutMs);
        });
        const reply = await Promise.race([provider.generate(request.body, controller.signal), failed]);
        if (approved) options.record?.(reservation.id, "reply", reply);
        let outcome = reply.status as string, output: SynthesisOutput | ClaimSelectionResult | null = null, validationError: unknown;
        if (reply.status === "completed" && reply.json) try {
          output = profile.output === "claim-selection-v1" && "selection" in request ? validateClaimSelection(reply.json, request.selection) : validateSynthesis(reply.json, safe);
          if ("modelOrganizationQuality" in output && output.modelOrganizationQuality === "FAIL") outcome = "organization_failed";
        } catch (e) { outcome = "validation_failed"; validationError = e; }
        if (reply.status === "model_mismatch" || reply.status === "billing_identity_unknown" || reply.status === "configuration_mismatch") throw new InterpretationError(reply.status);
        if (profile.provider === "deepseek" && (reply.provider !== "deepseek" || reply.billingProfile !== profile.billingProfile || reply.adapterVersion !== profile.adapterVersion || reply.returnedModel !== profile.model)) throw new InterpretationError("billing_identity_unknown");
        if (reply.usage && reply.usage.inputTokens <= request.maximumInputTokens && reply.usage.outputTokens <= REAL_AI.outputTokens) {
          // Keep the reservation occupied until a linked failure and its stop state can
          // be committed together by the authoritative ledger, including revoked access.
          if (approved) try { approved.assertAccess(); } catch (error) { outcome = "permission_revoked"; validationError = error; }
          if (controller.signal.aborted || stopped) { outcome = stopped ? "disabled" : "cancelled"; validationError = new InterpretationError(outcome); }
          // Persist the validated selection before releasing the occupied reservation.
          // Accounting remains solely in the ledger; this record does not claim settlement.
          if (approved) options.record?.(reservation.id, "validated", { output, outcome, usage: reply.usage, validatedAt: now(), accounting: "reservation_still_held" });
          if (approved) try { approved.assertAccess(); } catch (error) { outcome = "permission_revoked"; validationError = error; }
          if (controller.signal.aborted || stopped) { outcome = stopped ? "disabled" : "cancelled"; validationError = new InterpretationError(outcome); }
          const baseCost = reply.usage.inputTokens * profile.cacheWriteNanoPerToken + reply.usage.outputTokens * profile.outputNanoPerToken;
          const charged = ledger.settle(reservation.id, { now: now(), usageCostNano: baseCost, usage: reply.usage, outcome, responseId: reply.responseId }); accounted = true;
          approved?.assertAccess();
          if (controller.signal.aborted || stopped) throw new InterpretationError(stopped ? "disabled" : "cancelled");
          if (validationError) throw validationError;
          if (!output || reply.status !== "completed" || !reply.responseId || !reply.returnedModel) throw new InterpretationError(reply.status);
          if (approved && outcome === "organization_failed") throw new InterpretationError("organization_failed");
          let oldSnapshot = now() - safe.capturedAt >= REAL_AI.cacheTtlMs;
          if (approved) try { approved.assertCurrent(); } catch { oldSnapshot = true; }
          const result: RealInterpretation = { provider: profile.provider, inputIdentity: approved ? "approved_real" : "synthetic", inputTrust: approved ? "controlled" : "fixture", deploymentMode: "local_pilot", requestedModel: profile.model, returnedModel: reply.returnedModel,
            returnedServiceTier: reply.returnedServiceTier, responseId: reply.responseId, requestId: reservation.id, context: safe, asOf: safe.asOf, generatedAt: now(), cacheHit: false,
            adapterVersion: profile.adapterVersion, priceVersion: profile.priceVersion, billingProfile: profile.billingProfile, costBasis: "configured_peak_or_cache_write_bound",
            promptVersion: profile.prompt, outputVersion: profile.output, validationVersion: profile.validation,
            usage: reply.usage, usageIdentity: "provider_reported", usageCalculatedNano: baseCost, budgetChargedBoundNano: charged, billedCost: null,
            output, limitations: safe.limitations, oldSnapshot };
          if (!result.oldSnapshot && outcome !== "organization_failed") cache.set(key, { until: safe.capturedAt + REAL_AI.cacheTtlMs, result });
          while (cache.size > REAL_AI.cacheEntries) cache.delete(cache.keys().next().value!);
          return result;
        }
        throw new InterpretationError("invalid_usage");
      } catch (e) {
        if (!accounted) ledger.unknown(reservation.id, now(), e instanceof InterpretationError ? e.code : "provider_error");
        if (approved) ledger.stopRealContextBatch?.(e instanceof InterpretationError ? e.code : "provider_error");
        throw e instanceof InterpretationError ? e : new InterpretationError("provider_error");
      } finally { flight.settled = true; if (timer) clearTimeout(timer); removeAbort?.(); flights.delete(key); }
    });
    flights.set(key, flight); return subscribe(flight, signal);
  }
  return { interpret, interpretPrepared, interpretControlled: (admission: ControlledAdmission, signal?: AbortSignal) => {
    try { return interpretPrepared(prepareControlledRequest(admission, profile), signal); } catch (e) { return Promise.reject(e); }
  }, inspect: () => ({ active: flights.size, cache: cache.size, budget: ledger.inspect(now(), SYNTHETIC_PILOT_ID) }), stop: () => { stopped = true; cache.clear(); for (const f of flights.values()) f.controller.abort(); } };
}
