import type { MarketMode } from "./types";

export function experienceForHash(hash: string, preferred: MarketMode): MarketMode {
  if (hash === "#radar") return "radar";
  if (["#overview", "#price-chart", "#watchlist", "#price-alerts"].includes(hash)) return "classic";
  return preferred;
}
