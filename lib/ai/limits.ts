/** 轻量共享预算；不导入schema，避免首屏为按需解释加载解析器。 */
export const AI_LIMITS = Object.freeze({ inputBytes: 16384, outputBytes: 16384, inputTokens: 16384, outputTokens: 2048, timeoutMs: 5000, concurrency: 1, queue: 0, dailyCalls: 100, dailyTokens: 500000, cacheEntries: 16, cacheTtlMs: 60000, retries: 0 });
