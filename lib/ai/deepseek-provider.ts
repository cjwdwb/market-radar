import { InterpretationError, boundedJson, type ProviderSafeContext } from "./contracts";
import { DEEPSEEK_AI } from "./real-config";
import { parseUsage, type RealReply } from "./openai-provider";
import { synthesisCatalog, SYNTHESIS_JSON_SCHEMA, SYNTHESIS_PROMPT } from "./real-output";
import { requestResponseJson } from "./responses-transport";

const object = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
// 明确既有validator的集合边界：缺失信息不是已证实分歧，不改变任何金融判断。
export const DEEPSEEK_SYNTHESIS_INSTRUCTIONS = SYNTHESIS_PROMPT + "引用集合须精确匹配，不能多填：conflictRefs只能且必须列出kind为alignment、classification为mixed、availability为available三项同时成立的证据ID；没有符合项时输出空数组[]。insufficient/unavailable/unsupported等不可判断证据不是已证实分歧，不得放入conflictRefs。limitationRefs只能且必须列出所有availability不为available的证据ID；没有符合项时输出[]。两种列表都不得重复。";
export function buildDeepSeekRequest(context: ProviderSafeContext) {
  const request = {
    model: DEEPSEEK_AI.model, instructions: DEEPSEEK_SYNTHESIS_INSTRUCTIONS, reasoning: { effort: "none" }, stream: false,
    max_output_tokens: DEEPSEEK_AI.outputTokens, tool_choice: "none",
    input: [{ role: "user", content: boundedJson({ context, catalog: synthesisCatalog(context) }, DEEPSEEK_AI.inputBytes) }],
    // 官方支持json_schema；未承诺OpenAI strict语义，仍必须通过原本地严格校验。
    text: { format: { type: "json_schema", name: "market_radar_synthesis_v2", schema: SYNTHESIS_JSON_SCHEMA } },
  };
  const body = boundedJson(request, DEEPSEEK_AI.inputBytes);
  const maximumInputTokens = new TextEncoder().encode(body).length + DEEPSEEK_AI.wrapperTokenReserve;
  return { body, maximumInputTokens, maximumBaseNano: maximumInputTokens * DEEPSEEK_AI.inputNanoPerToken + DEEPSEEK_AI.outputTokens * DEEPSEEK_AI.outputNanoPerToken };
}

export function parseDeepSeekResponse(raw: unknown): RealReply {
  const data = object(raw), usage = parseUsage(data.usage);
  const responseId = typeof data.id === "string" && /^[a-zA-Z0-9_.:-]{1,180}$/.test(data.id) ? data.id : null;
  const returnedModel = typeof data.model === "string" && data.model.length <= 180 ? data.model : null;
  const reason = object(data.incomplete_details).reason;
  const base = { responseId, returnedModel, returnedServiceTier: null, usage, json: null, provider: "deepseek" as const,
    billingProfile: DEEPSEEK_AI.billingProfile, adapterVersion: DEEPSEEK_AI.adapterVersion,
    failureReason: reason === "content_filter" || reason === "max_output_tokens" ? reason : null };
  if (returnedModel !== DEEPSEEK_AI.model) return { ...base, status: "model_mismatch" };
  if (data.object !== "response" || !responseId) return { ...base, status: "invalid_response" };
  if (object(data.reasoning).effort !== undefined && object(data.reasoning).effort !== "none" || usage?.reasoningTokens && usage.reasoningTokens > 0) return { ...base, status: "configuration_mismatch" };
  if (data.status === "failed" || data.error != null) return { ...base, status: "failed" };
  if (data.status === "incomplete" || data.incomplete_details != null) return { ...base, status: reason === "content_filter" ? "refusal" : "incomplete" };
  if (data.status !== "completed" || !Array.isArray(data.output)) return { ...base, status: "invalid_response" };
  const texts: string[] = []; let refusal = false, invalid = false;
  for (const rawItem of data.output) {
    const item = object(rawItem);
    if (item.type === "reasoning") {
      if (Array.isArray(item.content) && item.content.some(c => typeof object(c).text === "string" && (object(c).text as string).trim())) return { ...base, status: "configuration_mismatch" };
      continue;
    }
    if (item.type !== "message" || item.role !== "assistant" || item.status !== "completed" || !Array.isArray(item.content)) { invalid = true; continue; }
    for (const part of item.content) {
      const content = object(part);
      if (content.type === "refusal") refusal = true; // 安全拒绝兼容分支，实际供应商形式待首例核实。
      else if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) texts.push(content.text);
      else invalid = true;
    }
  }
  if (refusal) return { ...base, status: "refusal" };
  if (invalid || texts.length !== 1) return { ...base, status: "invalid_response" };
  return { ...base, status: "completed", json: texts[0] };
}

export function createDeepSeekProvider(productKey: string, transport: typeof fetch = fetch) {
  if (!productKey || /\s/.test(productKey)) throw new InterpretationError("provider_not_configured");
  return { kind: "deepseek" as const, model: DEEPSEEK_AI.model, adapterVersion: DEEPSEEK_AI.adapterVersion,
    async generate(body: string, signal: AbortSignal): Promise<RealReply> {
      return parseDeepSeekResponse(await requestResponseJson(DEEPSEEK_AI.endpoint, productKey, body, signal, transport));
    },
  };
}
