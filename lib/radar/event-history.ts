import { z } from "zod";
import type { RadarSignal } from "./types";
import { MINUTE } from "./market-input";

export const EVENT_HISTORY_KEY = "market-radar-event-history-v1";
export const EVENT_HISTORY_LIMIT = 120;
export const EVENT_HISTORY_TTL = 7 * 24 * 60 * 60_000;
export const EVENT_HISTORY_MAX_CHARS = 256_000;
export type EventObservation = { signal: RadarSignal; observedAt: number };
export type EventHistoryStorage = "loading" | "saved" | "unavailable" | "invalid";

const text = z.string().min(1).max(1200);
const numeric = z.number().finite();
const timestamp = numeric.int().nonnegative().max(8_640_000_000_000_000);
const item = z.object({ label: text, value: z.union([numeric, text]), unit: z.enum(["%", "×", "bars"]).optional(), baseline: numeric.optional(), threshold: numeric.optional() }).strict();
const signalSchema = z.object({
  id: text, fingerprint: text, symbol: z.string().regex(/^[A-Z0-9^=.-]{1,40}$/), market: z.enum(["crypto", "us", "cn", "hk"]),
  type: z.enum(["price_move", "volume_spike", "breakout", "breakdown", "volatility_spike", "relative_strength", "relative_weakness"]),
  title: text, description: text, metric: text, direction: z.enum(["up", "down", "neutral"]), severity: z.enum(["medium", "high", "critical"]), status: z.enum(["active", "resolved", "expired"]),
  detectedAt: timestamp, updatedAt: timestamp, quoteAt: timestamp, fetchedAt: timestamp, evidenceAt: timestamp, expiresAt: timestamp,
  source: text, currency: z.string().min(1).max(12), metrics: z.record(z.union([numeric, text])).refine(value => Object.keys(value).length <= 32),
  evidence: z.object({ reason: text, items: z.array(item).min(1).max(24), sampleSize: numeric.int().nonnegative(), minimumSamples: numeric.int().positive(), strength: numeric.nonnegative(), freshnessRatio: numeric.min(0).max(1),
    benchmark: z.object({ symbol: text, returnPercent: numeric, quoteAt: timestamp, fetchedAt: timestamp, evidenceAt: timestamp }).strict().optional(),
  }).strict(),
}).strict();
const archiveSchema = z.object({ version: z.literal(1), observations: z.array(z.object({ signal: signalSchema, observedAt: timestamp }).strict()).max(EVENT_HISTORY_LIMIT) }).strict();

function validObservation({ signal: s, observedAt }: EventObservation, now: number) {
  return s.detectedAt <= now && s.updatedAt >= s.detectedAt && s.updatedAt <= observedAt && observedAt <= now &&
    s.evidenceAt <= s.detectedAt + MINUTE && s.expiresAt > s.detectedAt &&
    s.quoteAt <= observedAt + MINUTE && s.fetchedAt <= observedAt + MINUTE &&
    s.id === `${s.fingerprint}:${s.evidenceAt}` && s.fingerprint.startsWith(`${s.symbol}:`);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** 只保存观察记录，不把旧信号重新注入 Engine、State 或 AI。读取不延长保留期限。 */
export function mergeEventHistory(previous: EventObservation[], incoming: EventObservation[], now: number): EventObservation[] {
  const byId = new Map<string, EventObservation>();
  for (const observation of [...previous, ...incoming]) {
    const s = observation.signal;
    if (s.detectedAt <= now - EVENT_HISTORY_TTL || !validObservation(observation, now)) continue;
    const old = byId.get(s.id);
    if (!old) { byId.set(s.id, observation); continue; }
    // 刷新可能再次扫描同一根证据；不能把已经结束的观察倒退成当前异常。
    // 同更新时间的冲突也必须收敛；字典序仅选择已有观察，不代表终态的重要程度。
    // 首次发现时间独立取 min，不能同时参与版本排序，否则分批合并顺序会改变结果。
    const versionOrder = Number(s.status !== "active") - Number(old.signal.status !== "active") || s.updatedAt - old.signal.updatedAt || canonical({ ...s, detectedAt: 0 }).localeCompare(canonical({ ...old.signal, detectedAt: 0 }));
    const useIncoming = versionOrder > 0 || versionOrder === 0 && observation.observedAt < old.observedAt;
    const chosen = useIncoming ? observation : old;
    const firstDetectedAt = Math.min(old.signal.detectedAt, s.detectedAt);
    if (chosen.signal.detectedAt !== firstDetectedAt) byId.set(s.id, { ...chosen, signal: { ...chosen.signal, detectedAt: firstDetectedAt } });
    else if (useIncoming) byId.set(s.id, chosen);
  }
  const next = [...byId.values()].sort((a, b) => b.signal.detectedAt - a.signal.detectedAt || a.signal.id.localeCompare(b.signal.id)).slice(0, EVENT_HISTORY_LIMIT);
  return next.length === previous.length && next.every((value, i) => value === previous[i]) ? previous : next;
}

export function decodeEventHistory(raw: string | null, now: number): EventObservation[] {
  if (raw === null) return [];
  if (raw.length > EVENT_HISTORY_MAX_CHARS) throw new Error("history_size");
  const data = archiveSchema.parse(JSON.parse(raw));
  if (data.observations.some(observation => !validObservation(observation, now))) throw new Error("history_identity_time");
  return mergeEventHistory([], data.observations, now);
}

export function encodeEventHistory(observations: EventObservation[]) {
  const bounded = observations.slice(0, EVENT_HISTORY_LIMIT);
  let encoded = JSON.stringify({ version: 1, observations: bounded });
  while (encoded.length > EVENT_HISTORY_MAX_CHARS && bounded.length) {
    bounded.pop(); encoded = JSON.stringify({ version: 1, observations: bounded });
  }
  return encoded;
}

export function captureEventHistory(previous: EventObservation[], signals: RadarSignal[], now: number) {
  return mergeEventHistory(previous, signals.map(signal => ({ signal, observedAt: now })), now);
}

export type EventHistory = { observations: EventObservation[]; storage: EventHistoryStorage };
type StorageAccess = Pick<Storage, "getItem" | "setItem">;

/** Reads before writing to merge other tabs; malformed archives are preserved, never silently overwritten. */
export function syncEventHistory(previous: EventObservation[], signals: RadarSignal[], now: number, storage: () => StorageAccess): EventHistory {
  const local = captureEventHistory(previous, signals, now);
  let access: StorageAccess, raw: string | null;
  try { access = storage(); raw = access.getItem(EVENT_HISTORY_KEY); } catch { return { observations: local, storage: "unavailable" }; }
  let stored: EventObservation[];
  try { stored = decodeEventHistory(raw, now); } catch { return { observations: local, storage: "invalid" }; }
  const observations = mergeEventHistory(local, stored, now);
  const encoded = encodeEventHistory(observations);
  try { if (encoded !== raw && (raw !== null || observations.length)) access.setItem(EVENT_HISTORY_KEY, encoded); }
  catch { return { observations, storage: "unavailable" }; }
  return { observations, storage: "saved" };
}
