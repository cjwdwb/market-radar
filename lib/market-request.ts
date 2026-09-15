/** Transport recovery only. HTTP errors and rate limits are never retried here. */
export class MarketRequestError extends Error {
  readonly status?: number;
  readonly retryAt?: number;
  readonly blocked: boolean;
  constructor(message: string, status?: number, retryAt?: number, blocked = false) {
    super(message); this.status = status; this.retryAt = retryAt; this.blocked = blocked;
  }
}

export async function marketJson<T>(url: URL, options: { timeoutMs: number; attempts?: number; headers?: Record<string, string> }): Promise<T> {
  const deadline = Date.now() + options.timeoutMs;
  const attempts = Math.max(1, Math.min(2, options.attempts ?? 1));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new MarketRequestError("行情连接超时，请稍后重试");
    try {
      const response = await fetch(url, { headers: options.headers ?? { Accept: "application/json" }, signal: AbortSignal.timeout(remaining) });
      if (!response.ok) {
        const header = response.headers.get("Retry-After");
        const seconds = header === null ? NaN : Number(header);
        const advisedAt = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : header ? Date.parse(header) : NaN;
        const retryAt = response.status === 429 ? Math.max(Date.now() + 60_000, Number.isFinite(advisedAt) ? advisedAt : 0) : undefined;
        await response.body?.cancel().catch(() => {});
        throw new MarketRequestError(response.status === 429 ? "行情源请求繁忙，正在等待限流恢复" : response.status === 404 ? "未找到该代码的行情" : "行情源暂时不可用", response.status, retryAt);
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof MarketRequestError) throw error;
      const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
      if (cause?.code === "EACCES" || cause?.code === "EPERM") throw new MarketRequestError("当前运行环境禁止连接行情源", undefined, undefined, true);
      if (error instanceof SyntaxError) throw new MarketRequestError("行情源返回了无效数据");
      if (attempt + 1 >= attempts || Date.now() >= deadline) {
        const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
        throw new MarketRequestError(timeout ? "行情连接超时，请稍后重试" : "行情连接中途断开，请稍后重试");
      }
    }
  }
  throw new MarketRequestError("行情连接暂时中断");
}
