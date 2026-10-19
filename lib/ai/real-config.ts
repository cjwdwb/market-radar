/** 产品API配置与开发模型无关；本地试点不授权生产启用。 */
export const REAL_AI = Object.freeze({
  provider: "openai" as const, adapterVersion: "openai-responses-v1", billingProfile: "openai-luna-standard-bound-v1",
  model: "gpt-6-luna", endpoint: "https://api.openai.com/v1/responses", serviceTier: "default", effort: "none",
  generation: "luna-standard-none-v1", prompt: "bounded-synthesis-v2", output: "interpretation-v2", validation: "synthesis-evidence-v2",
  priceVersion: "openai-standard-luna-2026-10-08", inputNanoPerToken: 100, cachedNanoPerToken: 10, cacheWriteNanoPerToken: 125, outputNanoPerToken: 500,
  monthlyNano: 8_000_000_000, dispatchNano: 7_000_000_000, pilotNano: 250_000_000, pilotCalls: 20,
  inputBytes: 32768, wrapperTokenReserve: 2048, outputTokens: 2048, responseBytes: 65536,
  timeoutMs: 30000, concurrency: 1, retries: 0, cacheEntries: 16, cacheTtlMs: 60000,
});
/** 当前产品只选此profile；保留旧OpenAI适配供历史回归，不作自动回退。 */
export const DEEPSEEK_AI = Object.freeze({
  ...REAL_AI, provider: "deepseek" as const, model: "deepseek-flash", endpoint: "https://api.deepseek.com/responses", serviceTier: null,
  adapterVersion: "deepseek-responses-v1", billingProfile: "deepseek-flash-peak-no-cache-usd-v1",
  generation: "deepseek-flash-none-v1", prompt: "bounded-id-selection-v1", output: "claim-selection-v1", validation: "claim-selection-validation-v1",
  priceVersion: "deepseek-flash-usd-peak-2026-10-12",
  inputNanoPerToken: 300, cachedNanoPerToken: 6, cacheWriteNanoPerToken: 300, outputNanoPerToken: 1200,
});
export const ACTIVE_PRODUCT_AI = DEEPSEEK_AI;
export type ProductAIProfile = typeof REAL_AI | typeof DEEPSEEK_AI;
export const SYNTHETIC_PILOT_ID = "MR-30B-SYNTHETIC-001";
