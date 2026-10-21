import { getQuote, getHistory } from "../market-data";
import type { RadarSnapshot } from "../radar/types";
import { InterpretationError } from "./contracts";
import { REAL_CONTEXT_SERIES } from "./real-context-policy";

type Source = { quote: typeof getQuote; history: typeof getHistory };
/** One symbol, two logical requests; existing transport dedupe/finite fallback stays intact. */
export function createCurrentContextLoader(source: Source = { quote: getQuote, history: getHistory }) {
  return async (symbol: string, signal: AbortSignal): Promise<RadarSnapshot> => {
    if (symbol !== REAL_CONTEXT_SERIES.instrument) throw new InterpretationError("asset_not_approved");
    if (signal.aborted) throw new InterpretationError("cancelled");
    let rejectAbort: () => void = () => {}, timer: ReturnType<typeof setTimeout> | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new InterpretationError("cancelled"));
      signal.addEventListener("abort", rejectAbort, { once: true });
      timer = setTimeout(() => reject(new InterpretationError("loader_timeout")), 25000);
    });
    try {
      // Shared underlying source requests cannot yet be aborted per waiter. Cancel this wait,
      // discard late data, and never continue into State or model dispatch after cancellation.
      const [quote, history] = await Promise.race([Promise.all([source.quote(symbol, false), source.history(symbol, "15m")]), cancelled]);
      if (signal.aborted) throw new InterpretationError("cancelled");
      if (quote.symbol !== symbol || history.symbol !== symbol || quote.source !== REAL_CONTEXT_SERIES.source || history.source !== quote.source || quote.currency !== "USDT" || history.currency !== "USDT" || quote.timezone !== "UTC" || history.timezone !== "UTC" || quote.session !== "open") throw new InterpretationError("source_identity_mismatch");
      if (history.points.length > 96 || history.points.some(p => p.time % REAL_CONTEXT_SERIES.intervalMs !== 0 || typeof p.confirmed !== "boolean")) throw new InterpretationError("interval_mismatch");
      return { symbols: [symbol], quotes: { [symbol]: { ...quote, points: [] } }, histories: { [symbol]: { points: history.points, source: history.source, currency: history.currency, fetchedAt: history.fetchedAt, intervalMs: REAL_CONTEXT_SERIES.intervalMs } } };
    } finally { signal.removeEventListener("abort", rejectAbort); if (timer) clearTimeout(timer); }
  };
}
