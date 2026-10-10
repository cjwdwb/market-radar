import { AI_VERSIONS, InterpretationError, type MarketIntelligenceContext, type ProviderSafeContext } from "./contracts";
import { projectProviderContext } from "./context";
import { buildResponsesRequest, type RealReply, type RealUsage } from "./openai-provider";
import { validateSynthesis, type SynthesisOutput } from "./real-output";
import { REAL_AI, SYNTHETIC_PILOT_ID } from "./real-config";

type Ledger = { feeMultiplier: number; reserve(input: { now: number; pilot: string; maximumNano: number }): { id: string; reservedNano: number; month: string }; settle(id: string, input: { now: number; usageCostNano: number; usage: RealUsage; outcome: string; responseId: string | null }): number; unknown(id: string, now: number, outcome: string): void; inspect(now: number, pilot: string): unknown };
type Provider = { generate(body: string, signal: AbortSignal): Promise<RealReply> };
export type RealInterpretation = {
  provider: "openai"; inputIdentity: "synthetic"; inputTrust: "fixture"; deploymentMode: "local_pilot";
  requestedModel: string; returnedModel: string; returnedServiceTier: string; responseId: string; requestId: string; context: ProviderSafeContext;
  asOf: number; generatedAt: number; cacheHit: boolean; promptVersion: string; outputVersion: string; validationVersion: string;
  usage: RealUsage; usageIdentity: "provider_reported"; usageCalculatedNano: number; budgetChargedBoundNano: number; billedCost: null;
  output: SynthesisOutput; limitations: string[]; oldSnapshot: boolean;
};
/** 本地试点服务。旧fixture服务保持原有身份/校验；不给生产注入默认真实transport。 */
export function createRealPilotService(provider: Provider, ledger: Ledger, options: { now?: () => number; timeoutMs?: number; admit?: (context: MarketIntelligenceContext) => ProviderSafeContext } = {}) {
  const now = options.now ?? Date.now, admit = options.admit ?? projectProviderContext;
  type Flight = { promise: Promise<RealInterpretation>; controller: AbortController; subscribers: Set<symbol>; settled: boolean };
  const flights = new Map<string, Flight>(), cache = new Map<string, { until: number; result: RealInterpretation }>();
  let stopped = false;
  function check(context: MarketIntelligenceContext) {
    const safe = admit(context), time = now();
    // 首批只合成；B需要单独已批准的真实权限与接入，不因注入admit回调升权。
    if (safe.trust !== "fixture" || safe.evidence.some(e => !e.source.startsWith("fixture:"))) throw new InterpretationError("data_permission_unavailable");
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
    if (stopped) return Promise.reject(new InterpretationError("disabled"));
    if (signal?.aborted) return Promise.reject(new InterpretationError("cancelled"));
    let safe: ProviderSafeContext;
    try { safe = check(context); } catch (e) { return Promise.reject(e); }
    const request = buildResponsesRequest(safe), key = JSON.stringify({ safe, body: request.body, permissionVersion: AI_VERSIONS.projection, generation: REAL_AI.generation });
    const hit = cache.get(key);
    if (hit && hit.until > now()) return Promise.resolve({ ...hit.result, cacheHit: true });
    const previous = flights.get(key); if (previous) return subscribe(previous, signal);
    if (flights.size) return Promise.reject(new InterpretationError("busy"));
    let reservation: ReturnType<Ledger["reserve"]>;
    try { reservation = ledger.reserve({ now: now(), pilot: SYNTHETIC_PILOT_ID, maximumNano: Math.ceil(request.maximumBaseNano * ledger.feeMultiplier) }); }
    catch (e) { return Promise.reject(new InterpretationError(e instanceof Error && ["busy", "budget_exhausted"].includes(e.message) ? e.message : "budget_unavailable")); }
    const controller = new AbortController();
    const flight: Flight = { controller, subscribers: new Set(), settled: false, promise: Promise.resolve(null as unknown as RealInterpretation) };
    flight.promise = Promise.resolve().then(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined, removeAbort: (() => void) | undefined, accounted = false;
      try {
        check(context); if (controller.signal.aborted || stopped) throw new InterpretationError("cancelled");
        const failed = new Promise<never>((_, reject) => {
          const abort = () => reject(new InterpretationError(stopped ? "disabled" : "cancelled"));
          controller.signal.addEventListener("abort", abort, { once: true }); removeAbort = () => controller.signal.removeEventListener("abort", abort);
          timer = setTimeout(() => { reject(new InterpretationError("timeout")); controller.abort(); }, options.timeoutMs ?? REAL_AI.timeoutMs);
        });
        const reply = await Promise.race([provider.generate(request.body, controller.signal), failed]);
        let outcome = reply.status as string, output: SynthesisOutput | null = null, validationError: unknown;
        if (reply.status === "completed" && reply.json) try { output = validateSynthesis(reply.json, safe); } catch (e) { outcome = "validation_failed"; validationError = e; }
        if (reply.status === "model_mismatch" || reply.status === "billing_identity_unknown") throw new InterpretationError(reply.status);
        if (reply.usage && reply.usage.inputTokens <= request.maximumInputTokens && reply.usage.outputTokens <= REAL_AI.outputTokens) {
          const baseCost = reply.usage.inputTokens * REAL_AI.cacheWriteNanoPerToken + reply.usage.outputTokens * REAL_AI.outputNanoPerToken;
          const charged = ledger.settle(reservation.id, { now: now(), usageCostNano: baseCost, usage: reply.usage, outcome, responseId: reply.responseId }); accounted = true;
          if (controller.signal.aborted || stopped) throw new InterpretationError(stopped ? "disabled" : "cancelled");
          if (validationError) throw validationError;
          if (!output || reply.status !== "completed" || !reply.responseId || !reply.returnedModel) throw new InterpretationError(reply.status);
          const result: RealInterpretation = { provider: "openai", inputIdentity: "synthetic", inputTrust: "fixture", deploymentMode: "local_pilot", requestedModel: REAL_AI.model, returnedModel: reply.returnedModel,
            returnedServiceTier: reply.returnedServiceTier!, responseId: reply.responseId, requestId: reservation.id, context: safe, asOf: safe.asOf, generatedAt: now(), cacheHit: false,
            promptVersion: REAL_AI.prompt, outputVersion: REAL_AI.output, validationVersion: REAL_AI.validation,
            usage: reply.usage, usageIdentity: "provider_reported", usageCalculatedNano: baseCost, budgetChargedBoundNano: charged, billedCost: null,
            output, limitations: safe.limitations, oldSnapshot: now() - safe.capturedAt >= REAL_AI.cacheTtlMs };
          if (!result.oldSnapshot) cache.set(key, { until: safe.capturedAt + REAL_AI.cacheTtlMs, result });
          while (cache.size > REAL_AI.cacheEntries) cache.delete(cache.keys().next().value!);
          return result;
        }
        throw new InterpretationError("invalid_usage");
      } catch (e) {
        if (!accounted) ledger.unknown(reservation.id, now(), e instanceof InterpretationError ? e.code : "provider_error");
        throw e instanceof InterpretationError ? e : new InterpretationError("provider_error");
      } finally { flight.settled = true; if (timer) clearTimeout(timer); removeAbort?.(); flights.delete(key); }
    });
    flights.set(key, flight); return subscribe(flight, signal);
  }
  return { interpret, inspect: () => ({ active: flights.size, cache: cache.size, budget: ledger.inspect(now(), SYNTHETIC_PILOT_ID) }), stop: () => { stopped = true; cache.clear(); for (const f of flights.values()) f.controller.abort(); } };
}
