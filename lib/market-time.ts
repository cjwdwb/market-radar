export type DisplayTimePreference = "device" | "UTC" | "Asia/Shanghai";
export type MarketTimeStyle = "clock" | "short" | "full" | "date";

export function normalizeDisplayTimePreference(value: unknown): DisplayTimePreference {
  return value === "UTC" || value === "Asia/Shanghai" ? value : "device";
}

/** The caller supplies the device zone after hydration; server/default rendering stays UTC. */
export function resolveDisplayTimezone(preference: DisplayTimePreference, deviceTimezone?: string | null): string {
  return validTimezone(preference === "device" ? deviceTimezone : preference);
}

const zones = new Map<string, string>();
function validTimezone(timezone: string | null | undefined): string {
  if (!timezone) return "UTC";
  const cached = zones.get(timezone);
  if (cached) return cached;
  let zone = "UTC";
  try { zone = new Intl.DateTimeFormat("en", { timeZone: timezone }).resolvedOptions().timeZone; }
  catch { /* Invalid saved/device zones use the explicitly displayed UTC fallback. */ }
  if (zones.size >= 32) zones.delete(zones.keys().next().value!);
  zones.set(timezone, zone);
  return zone;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string, style: MarketTimeStyle): Intl.DateTimeFormat {
  const zone = validTimezone(timezone), key = `${zone}:${style}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  const options: Intl.DateTimeFormatOptions = {
    timeZone: zone, hourCycle: "h23", timeZoneName: "longOffset",
    ...(style === "clock" ? {} : { month: "2-digit", day: "2-digit" }),
    ...(style === "full" ? { year: "numeric" } : {}),
    ...(style === "date" ? {} : { hour: "2-digit", minute: "2-digit" }),
    ...(style === "full" || style === "clock" ? { second: "2-digit" } : {}),
  };
  const next = new Intl.DateTimeFormat("zh-CN", options);
  // The fixed preferences normally use at most three zones; keep malformed callers bounded too.
  if (formatters.size >= 32) formatters.delete(formatters.keys().next().value!);
  formatters.set(key, next);
  return next;
}

function validDate(at: number | null | undefined): at is number {
  return typeof at === "number" && Number.isFinite(at) && Math.abs(at) <= 8_640_000_000_000_000;
}

function offsetLabel(part: string): string {
  if (part === "GMT" || part === "GMT+00:00") return "UTC";
  return part.replace(/^GMT/, "UTC").replace("-", "−");
}

/** Offsets come from the displayed instant, including historical DST, never today's offset. */
export function formatMarketTime(at: number | null | undefined, timezone: string, style: MarketTimeStyle = "full", includeOffset = true): string {
  if (!validDate(at)) return "—";
  const parts = formatter(timezone, style).formatToParts(at);
  const date = parts.filter(part => part.type !== "timeZoneName").map(part => part.value).join("").replace(/\s+/g, " ").trim();
  const offset = parts.find(part => part.type === "timeZoneName");
  return includeOffset && offset ? `${date} ${offsetLabel(offset.value)}` : date;
}

export function marketTimezoneLabel(timezone: string, at: number | null | undefined): string {
  const zone = validTimezone(timezone);
  if (!validDate(at)) return zone;
  const offset = formatter(zone, "clock").formatToParts(at).find(part => part.type === "timeZoneName")?.value;
  return offset ? `${zone} · ${offsetLabel(offset)}` : zone;
}
