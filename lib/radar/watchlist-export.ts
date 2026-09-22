import { ASSETS, VALID_SYMBOL, assetFor } from "../market";

export type WatchlistOrigin = "saved_browser" | "app_default" | "storage_unavailable";
// Explicit local download only. Not a collector universe or verified issuer registry.
export function browserWatchlistExport(watchlist: readonly string[], exportedAt: number, origin: WatchlistOrigin, sessionEdited: boolean) {
  if (!Number.isFinite(exportedAt) || exportedAt <= 0) throw new Error("Invalid export time");
  return {
    formatVersion: "browser-watchlist-v1", scope: "browser_watchlist",
    exportedAt: new Date(exportedAt).toISOString(), origin, sessionEdited,
    identityStatus: "unverified_owner_universe",
    assets: [...new Set(watchlist.filter(symbol => VALID_SYMBOL.test(symbol)))].slice(0, 20).map(symbol => ({
      symbol, appMarket: assetFor(symbol).market,
      marketMapping: ASSETS.some(asset => asset.symbol === symbol) ? "app_catalog" : "inferred_by_app",
      providerRoute: symbol.endsWith("-USDT") ? "okx" : "yahoo",
      venue: null, issuerId: null, adjustment: null,
    })),
  };
}
