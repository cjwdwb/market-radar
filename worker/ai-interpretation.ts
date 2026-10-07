import { z } from "zod";
import { AI_LIMITS, InterpretationError } from "../lib/ai/contracts";
import { FixtureScenarioSchema, FIXTURE_SYMBOLS, fixtureContext } from "../lib/ai/fixture";
import { fixtureProvider } from "../lib/ai/provider";
import { createInterpretationService } from "../lib/ai/service";

const service = createInterpretationService(fixtureProvider());
const contexts = new Map<string, ReturnType<typeof fixtureContext>>();
const RequestSchema = z.object({ symbol: z.enum(FIXTURE_SYMBOLS), scenario: FixtureScenarioSchema }).strict();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
/** 既有访问门禁后调用；生产不具备可信实时输入/消费预算，因此绝不调用真实Provider。 */
export async function handleInterpretation(request: Request, env: { AI_FIXTURE_ENABLED?: string }, now = Date.now()) {
  const url = new URL(request.url), local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const enabled = local && env.AI_FIXTURE_ENABLED === "1";
  if (request.method === "GET") return json({ mode: enabled ? "fixture" : "unconfigured", demonstration: enabled, realProviderEnabled: false });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (request.headers.get("origin") !== url.origin || request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({ error: "invalid_origin" }, 403);
  if (!enabled) return json({ error: "provider_not_configured" }, 503);
  if (Number(request.headers.get("content-length")) > AI_LIMITS.inputBytes) return json({ error: "input_limit" }, 413);
  try {
    const reader = request.body?.getReader(); if (!reader) return json({ error: "invalid_request" }, 400);
    let size = 0; const chunks: Uint8Array[] = [];
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > AI_LIMITS.inputBytes) throw new InterpretationError("input_limit"); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = RequestSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!parsed.success) return json({ error: "invalid_request" }, 400);
    const { symbol, scenario } = parsed.data, key = `${symbol}:${scenario}`;
    let context = contexts.get(key);
    if (!context || now - context.capturedAt >= AI_LIMITS.cacheTtlMs) { context = fixtureContext(scenario, symbol, now); contexts.set(key, context); }
    while (contexts.size > AI_LIMITS.cacheEntries) contexts.delete(contexts.keys().next().value!);
    const result = await service.interpret(context, "loopback-fixture", request.signal);
    return json(result);
  } catch (e) {
    const code = e instanceof InterpretationError ? e.code : "invalid_request";
    return json({ error: code }, code === "busy" || code === "budget_exhausted" ? 429 : code === "input_limit" ? 413 : code === "invalid_request" ? 400 : 422);
  }
}
