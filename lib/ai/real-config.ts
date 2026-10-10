/** 产品API配置与开发模型无关；本地试点不授权生产启用。 */
export const REAL_AI = Object.freeze({
  model: "gpt-6-luna", endpoint: "https://api.openai.com/v1/responses", serviceTier: "default", effort: "none",
  generation: "luna-standard-none-v1", prompt: "bounded-synthesis-v2", output: "interpretation-v2", validation: "synthesis-evidence-v2",
  priceVersion: "openai-standard-luna-2026-10-08", inputNanoPerToken: 100, cachedNanoPerToken: 10, cacheWriteNanoPerToken: 125, outputNanoPerToken: 500,
  monthlyNano: 8_000_000_000, dispatchNano: 7_000_000_000, pilotNano: 250_000_000, pilotCalls: 20,
  inputBytes: 32768, wrapperTokenReserve: 2048, outputTokens: 2048, responseBytes: 65536,
  timeoutMs: 30000, concurrency: 1, retries: 0, cacheEntries: 16, cacheTtlMs: 60000,
});
export const SYNTHETIC_PILOT_ID = "MR-30B-SYNTHETIC-001";
