"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatMarketTime, type MarketTimeStyle } from "@/lib/market-time";

const MarketTimeContext = createContext("UTC");

/** Presentation only: no clock, storage, source timestamps or market requests are changed here. */
export function MarketTimeProvider({ timezone, children }: { timezone: string; children: ReactNode }) {
  return <MarketTimeContext.Provider value={timezone}>{children}</MarketTimeContext.Provider>;
}

export function useMarketTime() {
  const timezone = useContext(MarketTimeContext);
  return useMemo(() => ({ timezone, formatTime: (at: number | null | undefined, style: MarketTimeStyle = "short") => formatMarketTime(at, timezone, style) }), [timezone]);
}
