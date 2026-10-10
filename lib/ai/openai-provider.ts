import { InterpretationError, boundedJson, type ProviderSafeContext } from "./contracts";
import { REAL_AI } from "./real-config";
import { synthesisCatalog, SYNTHESIS_JSON_SCHEMA, SYNTHESIS_PROMPT } from "./real-output";

export type RealUsage = { inputTokens: number; outputTokens: number; cachedTokens: number | null; reasoningTokens: number | null };
export type RealReply = { status: "completed" | "refusal" | "incomplete" | "invalid_response" | "model_mismatch" | "billing_identity_unknown"; json: string | null; usage: RealUsage | null; responseId: string | null; returnedModel: string | null; returnedServiceTier: string | null };
const object = (v: unknown): Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function parseUsage(raw: unknown): RealUsage | null {
  const u = object(raw), input = u.input_tokens, output = u.output_tokens;
  if (!integer(input) || !integer(output) || u.total_tokens !== undefined && (!integer(u.total_tokens) || u.total_tokens !== input + output)) return null;
  const cached = object(u.input_tokens_details).cached_tokens, reasoning = object(u.output_tokens_details).reasoning_tokens;
  if (cached !== undefined && (!integer(cached) || cached > input) || reasoning !== undefined && (!integer(reasoning) || reasoning > output)) return null;
  return { inputTokens: input, outputTokens: output, cachedTokens: cached === undefined ? null : cached as number, reasoningTokens: reasoning === undefined ? null : reasoning as number };
}
export function buildResponsesRequest(context: ProviderSafeContext) {
  const request = { model: REAL_AI.model, service_tier: REAL_AI.serviceTier, reasoning: { effort: REAL_AI.effort }, store: false, stream: false,
    max_output_tokens: REAL_AI.outputTokens,
    input: [{ role: "developer", content: SYNTHESIS_PROMPT }, { role: "user", content: boundedJson({ context, catalog: synthesisCatalog(context) }, REAL_AI.inputBytes) }],
    text: { format: { type: "json_schema", name: "market_radar_synthesis_v2", strict: true, schema: SYNTHESIS_JSON_SCHEMA } },
  };
  const body = boundedJson(request, REAL_AI.inputBytes);
  // 包含schema、完整数据、转义和指令，按UTF-8字节保守计算，并留协议包装余量；不使用缓存折扣。
  const maximumInputTokens = new TextEncoder().encode(body).length + REAL_AI.wrapperTokenReserve;
  const maximumBaseNano = maximumInputTokens * REAL_AI.cacheWriteNanoPerToken + REAL_AI.outputTokens * REAL_AI.outputNanoPerToken;
  return { body, maximumInputTokens, maximumBaseNano };
}
export function parseResponses(raw: unknown): RealReply {
  const data = object(raw), usage = parseUsage(data.usage);
  const responseId = typeof data.id === "string" && /^resp_[a-zA-Z0-9_-]{1,160}$/.test(data.id) ? data.id : null;
  const returnedModel = typeof data.model === "string" && data.model.length <= 180 ? data.model : null;
  const returnedServiceTier = typeof data.service_tier === "string" ? data.service_tier : null;
  const base = { usage, responseId, returnedModel, returnedServiceTier, json: null };
  if (!returnedModel || !/^gpt-6-luna(?:-\d{4}-\d{2}-\d{2})?$/.test(returnedModel)) return { ...base, status: "model_mismatch" };
  if (returnedServiceTier !== REAL_AI.serviceTier) return { ...base, status: "billing_identity_unknown" };
  if (data.status === "incomplete" || data.status === "failed" || data.error != null || data.incomplete_details != null) return { ...base, status: "incomplete" };
  if (data.status !== "completed" || !Array.isArray(data.output) || !responseId) return { ...base, status: "invalid_response" };
  const texts: string[] = []; let refusal = false, invalid = false;
  for (const rawItem of data.output) {
    const item = object(rawItem);
    if (item.type === "reasoning") continue;
    if (item.type !== "message" || item.role !== "assistant" || item.status !== "completed" || !Array.isArray(item.content)) { invalid = true; continue; }
    for (const rawContent of item.content) {
      const content = object(rawContent);
      if (content.type === "refusal") refusal = true;
      else if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) texts.push(content.text);
      else invalid = true;
    }
  }
  if (refusal) return { ...base, status: "refusal" };
  if (invalid || texts.length !== 1) return { ...base, status: "invalid_response" };
  return { ...base, status: "completed", json: texts[0] };
}
export function createOpenAIProvider(key: string, transport: typeof fetch = fetch) {
  if (!key || /\s/.test(key)) throw new InterpretationError("provider_not_configured");
  return { kind: "openai" as const, model: REAL_AI.model,
    async generate(body: string, signal: AbortSignal): Promise<RealReply> {
      if (signal.aborted) throw new InterpretationError("cancelled");
      let response: Response;
      try { response = await transport(REAL_AI.endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal, redirect: "error" }); }
      catch { throw new InterpretationError(signal.aborted ? "cancelled" : "transport_error"); }
      // 错误正文可能包含反射输入/供应商敏感内容，不透传、不记日志，也不重试。
      if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new InterpretationError(response.status === 429 ? "rate_limited" : response.status === 401 || response.status === 403 ? "provider_access_denied" : "provider_http_error"); }
      const reader = response.body?.getReader(); if (!reader) throw new InterpretationError("invalid_response");
      let size = 0; const chunks: Uint8Array[] = [];
      try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > REAL_AI.responseBytes) throw new InterpretationError("response_limit"); chunks.push(value); } }
      catch (e) { throw e instanceof InterpretationError ? e : new InterpretationError(signal.aborted ? "cancelled" : "transport_error"); }
      finally { await reader.cancel().catch(() => {}); }
      const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
      try { return parseResponses(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); } catch { throw new InterpretationError("invalid_response"); }
    },
  };
}
