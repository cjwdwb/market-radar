import { AI_LIMITS, AI_VERSIONS, InterpretationError, boundedJson, type InterpretationResult, type MarketIntelligenceContext } from "./contracts";
import { projectProviderContext } from "./context";
import { INTERPRETATION_PROMPT, type InterpretationProvider } from "./provider";
import { validateOutput } from "./validation";

/** 可注入/同步预留；本实现仅用于单进程fixture，不能当成生产持久日预算。 */
export class FixtureBudget {
  private entries = new Map<string, { calls: number; tokens: number }>();
  reserve(scope: string, now: number, tokens: number) {
    const key = `${scope}:${Math.floor(now / 86400000)}`, v = this.entries.get(key) ?? { calls: 0, tokens: 0 };
    if (v.calls >= AI_LIMITS.dailyCalls || v.tokens + tokens > AI_LIMITS.dailyTokens) throw new InterpretationError("budget_exhausted");
    v.calls++; v.tokens += tokens; this.entries.set(key, v);
    // 有界存储；过期日不影响今天预算，不通过切asset/context清空当日scope。
    for (const entry of this.entries.keys()) if (Number(entry.slice(entry.lastIndexOf(":") + 1)) < Math.floor(now / 86400000) - 1) this.entries.delete(entry);
    return key;
  }
  inspect(scope: string, now: number) { return this.entries.get(`${scope}:${Math.floor(now / 86400000)}`) ?? { calls: 0, tokens: 0 }; }
}
export function createInterpretationService(provider: InterpretationProvider, options: { now?: () => number; budget?: FixtureBudget; timeoutMs?: number } = {}) {
  const now = options.now ?? Date.now, budget = options.budget ?? new FixtureBudget();
  type Flight={promise:Promise<InterpretationResult>;controller:AbortController;subscribers:Set<symbol>;settled:boolean};
  const cache = new Map<string, { until: number; result: InterpretationResult }>(), flights = new Map<string, Flight>();
  const controllers = new Set<AbortController>();
  let active = 0, sequence = 0, stopped = false;
  const telemetry = { calls: 0, cacheHits: 0, failures: 0, cancelled: 0, totalLatencyMs: 0 };
  function subscribe(flight:Flight,signal?:AbortSignal):Promise<InterpretationResult>{
    return new Promise((resolve,reject)=>{
      const token=Symbol();let completed=false;flight.subscribers.add(token);
      const release=()=>{signal?.removeEventListener("abort",abort);flight.subscribers.delete(token);if(!flight.settled&&!flight.subscribers.size)flight.controller.abort();};
      const abort=()=>{if(completed)return;completed=true;release();reject(new InterpretationError("cancelled"));};
      signal?.addEventListener("abort",abort,{once:true});
      flight.promise.then(value=>{if(!completed){completed=true;release();resolve(value);}},error=>{if(!completed){completed=true;release();reject(error);}});
      if(signal?.aborted)abort();
    });
  }
  async function interpret(context: MarketIntelligenceContext, scope: string, signal?: AbortSignal): Promise<InterpretationResult> {
    if (stopped) throw new InterpretationError("disabled");
    if (signal?.aborted) throw new InterpretationError("cancelled");
    if (!/^[a-z0-9_-]{1,80}$/i.test(scope)) throw new InterpretationError("invalid_scope");
    const safe = projectProviderContext(context), time = now();
    if (safe.capturedAt > time || time - safe.capturedAt > AI_LIMITS.cacheTtlMs) throw new InterpretationError("context_expired");
    // 完整规范payload保留所有时间/权限/版本；绝不只用可碰撞的短摘要。
    const key = boundedJson({ scope, context: safe, prompt: AI_VERSIONS.prompt, output: AI_VERSIONS.output, provider: provider.kind, model: provider.model, generation: AI_VERSIONS.generation }, AI_LIMITS.inputBytes + 1024);
    const cached = cache.get(key);
    if (cached && cached.until > time) { telemetry.cacheHits++; return { ...cached.result, cacheHit: true }; }
    if (flights.has(key)) return subscribe(flights.get(key)!,signal);
    if (active >= AI_LIMITS.concurrency) throw new InterpretationError("busy");
    budget.reserve(scope, time, AI_LIMITS.inputTokens + AI_LIMITS.outputTokens);
    active++; telemetry.calls++;
    const requestId = `fixture-request-${++sequence}`, controller = new AbortController(); controllers.add(controller);
    // 下一微任务再调用Provider，确保同步抛错也先登记flight再清理。
    const operation = Promise.resolve().then(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined, internalAbort: (()=>void)|undefined;
      try {
        if(controller.signal.aborted)throw new InterpretationError(stopped?"disabled":"cancelled");
        const failure = new Promise<never>((_, reject) => {
          internalAbort=()=>reject(new InterpretationError(stopped?"disabled":"cancelled"));
          controller.signal.addEventListener("abort",internalAbort,{once:true});
          timer = setTimeout(() => { reject(new InterpretationError("timeout")); controller.abort(); }, options.timeoutMs ?? AI_LIMITS.timeoutMs);
          if(controller.signal.aborted) { reject(new InterpretationError(stopped?"disabled":"cancelled")); controller.abort(); }
        });
        const reply = await Promise.race([provider.generate({ context: safe, prompt: INTERPRETATION_PROMPT, maxOutputTokens: AI_LIMITS.outputTokens, signal: controller.signal }), failure]);
        if (controller.signal.aborted) throw new InterpretationError(stopped?"disabled":"cancelled");
        if (reply.status !== "completed") throw new InterpretationError(reply.status);
        if (reply.usage && (![reply.usage.inputTokens, reply.usage.outputTokens].every(v => Number.isInteger(v) && v >= 0) || reply.usage.inputTokens > AI_LIMITS.inputTokens || reply.usage.outputTokens > AI_LIMITS.outputTokens)) throw new InterpretationError("invalid_usage");
        const output = validateOutput(reply.json, safe);
        const result: InterpretationResult = { requestId, contextId: safe.contextId, asOf: safe.asOf, generatedAt: now(), provider: provider.kind, model: provider.model, promptVersion: AI_VERSIONS.prompt, outputVersion: AI_VERSIONS.output, validationVersion: AI_VERSIONS.validation, demonstration: true, cacheHit: false,
          status: safe.evidence.some(e => e.availability !== "available") ? "partial" : "success", usage: { inputTokens: reply.usage?.inputTokens ?? null, outputTokens: reply.usage?.outputTokens ?? null, simulated: true, billedCost: null }, context: safe, output };
        cache.set(key, { until: Math.min(time + AI_LIMITS.cacheTtlMs, safe.capturedAt + AI_LIMITS.cacheTtlMs), result });
        while (cache.size > AI_LIMITS.cacheEntries) cache.delete(cache.keys().next().value!);
        return result;
      } catch (e) { telemetry.failures++; if (e instanceof InterpretationError && e.code === "cancelled") telemetry.cancelled++; throw e instanceof InterpretationError ? e : new InterpretationError("provider_error"); }
      finally { flight.settled=true; if (timer) clearTimeout(timer); if(internalAbort)controller.signal.removeEventListener("abort",internalAbort); controllers.delete(controller); active--; flights.delete(key); telemetry.totalLatencyMs += Math.max(0, now() - time); }
    });
    const flight:Flight={promise:operation,controller,subscribers:new Set(),settled:false};flights.set(key, flight); return subscribe(flight,signal);
  }
  return { interpret, budget, telemetry, inspect: () => ({ active, flights: flights.size, cache: cache.size }), stop: () => { stopped = true; cache.clear(); for(const controller of controllers)controller.abort(); } };
}
