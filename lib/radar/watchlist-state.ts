import { VALID_SYMBOL } from "../market";
import { buildAssetStateV2, type AssetStateV2 } from "./asset-state-v2";
import type { StateInput } from "./asset-state";

// A bounded projection of the existing rule, never a second classifier or scanner.
export function buildWatchlistState(input: Omit<StateInput, "symbol"> & { watchlist: readonly string[]; selected: string }) {
  const symbols = [...new Set(input.watchlist.filter(symbol => VALID_SYMBOL.test(symbol)))].slice(0, 20);
  const states = new Map<string, AssetStateV2>();
  for (const symbol of new Set([...symbols, ...(VALID_SYMBOL.test(input.selected) ? [input.selected] : [])])) {
    states.set(symbol, buildAssetStateV2({ snapshot: input.snapshot, symbol, now: input.now, enabled: input.enabled, online: input.online }));
  }
  return { symbols, states: states as ReadonlyMap<string, AssetStateV2> };
}
