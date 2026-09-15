"use client";

import { useEffect, useMemo, useReducer } from "react";
import { radarCoverage, scanRadar } from "@/lib/radar/engine";
import { emptyRadarStore, type RadarSnapshot, type RadarStore } from "@/lib/radar/types";

type Scan = { snapshot: RadarSnapshot; now: number; enabled: boolean };
function reduce(store: RadarStore, action: Scan) { return scanRadar(store, action.snapshot, action.now, action.enabled); }

/** Uses the parent's existing quote/history snapshots and clock; owns no requests or timers. */
export function useRadar(snapshot: RadarSnapshot, now: number | undefined, enabled: boolean) {
  const [store, dispatch] = useReducer(reduce, undefined, emptyRadarStore);
  useEffect(() => { if (now !== undefined) dispatch({ snapshot, now, enabled }); }, [snapshot, now, enabled]);
  const coverage = useMemo(() => now === undefined ? [] : radarCoverage(snapshot, now), [snapshot, now]);
  return { signals: store.signals, coverage };
}
