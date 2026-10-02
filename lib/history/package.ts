/** Bounded, portable transport. A checksum proves integrity, never data rights. */
export const PACKAGE_LIMIT = 2 * 1024 * 1024;
export const BAR_LIMIT = 2000;
export type HistoryBar = { time: number; open: number; high: number; low: number; close: number; volume: number | null; version: number; receivedAt: number };
export type HistoryPackage = {
  format: "history-package-v1"; identity: "fixture"; vintage: "current_vintage";
  source: string; asset: { id: string; market: "crypto" | "us" | "cn" | "hk"; venue: string; providerId: string; currency: string; adjustment: string };
  intervalMs: number; sessionEvidence: "fixture_only"; readRevision: number;
  range: { from: number; cutoff: number }; exportedAt: number;
  coverage: "not_verified"; bars: HistoryBar[]; digest: string;
};
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  if (typeof value === "number" && !Number.isFinite(value)) throw Error("INVALID_NUMBER");
  if (value === undefined) throw Error("INVALID_VALUE");
  return JSON.stringify(value);
}
export async function packageDigest(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
const keys = (value: unknown, names: string): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === names.split(" ").sort().join(",");
const integer = (v: unknown, min = 1): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min;
const token = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9:^._/@+-]{1,120}$/.test(v);
const price = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
export async function parseHistoryPackage(text: string, now: number): Promise<HistoryPackage> {
  if (!integer(now) || new TextEncoder().encode(text).length > PACKAGE_LIMIT) throw Error("历史文件超出大小或时间限制。");
  const p = JSON.parse(text);
  if (!keys(p, "format identity vintage source asset intervalMs sessionEvidence readRevision range exportedAt coverage bars digest") || p.format !== "history-package-v1" || p.identity !== "fixture" || p.vintage !== "current_vintage" || !token(p.source) || !p.source.startsWith("fixture:") || p.sessionEvidence !== "fixture_only" || p.coverage !== "not_verified") throw Error("此入口仅接受明确标记的模拟历史包，真实来源尚未准入。");
  if (!keys(p.asset, "id market venue providerId currency adjustment") || !Object.values(p.asset).every(token) || !["crypto", "us", "cn", "hk"].includes(p.asset.market as string)) throw Error("资产身份不完整。");
  if (![300000, 900000].includes(p.intervalMs as number) || !integer(p.readRevision) || !integer(p.exportedAt) || p.exportedAt > now || !keys(p.range, "from cutoff") || !integer(p.range.from) || !integer(p.range.cutoff) || p.range.cutoff <= p.range.from || p.range.cutoff > p.exportedAt || p.range.cutoff - p.range.from > 31 * 86400000 || !Array.isArray(p.bars) || !p.bars.length || p.bars.length > BAR_LIMIT) throw Error("历史范围、周期或条数无效。");
  const interval = p.intervalMs as number;
  let previous = 0;
  for (const b of p.bars) {
    if (!keys(b, "time open high low close volume version receivedAt") || !integer(b.time) || b.time % interval || b.time <= previous || b.time < p.range.from || b.time + interval > p.range.cutoff || ![b.open, b.high, b.low, b.close].every(price) || (b.volume !== null && !(typeof b.volume === "number" && Number.isFinite(b.volume) && b.volume >= 0)) || !integer(b.version) || b.version > p.readRevision || !integer(b.receivedAt) || b.receivedAt < b.time + interval || b.receivedAt > p.exportedAt) throw Error("历史记录无效、未完成、重复或乱序。");
    if ((b.high as number) < Math.max(b.open as number, b.close as number, b.low as number) || (b.low as number) > Math.min(b.open as number, b.close as number)) throw Error("OHLC 关系无效。");
    previous = b.time;
  }
  const { digest, ...body } = p;
  if (typeof digest !== "string" || digest !== await packageDigest(body)) throw Error("历史文件校验失败。");
  return p as HistoryPackage;
}
