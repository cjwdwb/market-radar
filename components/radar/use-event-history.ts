"use client";

import { useEffect, useReducer, useRef } from "react";
import { EVENT_HISTORY_KEY, syncEventHistory, type EventHistory } from "@/lib/radar/event-history";
import type { RadarSignal } from "@/lib/radar/types";

const initial: EventHistory = { observations: [], storage: "loading" };
export function useEventHistory(signals: RadarSignal[], now: number | undefined) {
  const current = useRef(initial);
  const [history, update] = useReducer((previous: EventHistory, next: EventHistory) =>
    previous.observations === next.observations && previous.storage === next.storage ? previous : next, initial);
  useEffect(() => {
    if (now === undefined) return;
    const sync = () => {
      const next = syncEventHistory(current.current.observations, signals, now, () => window.localStorage);
      current.current = next; update(next);
    };
    sync();
    const changed = (event: StorageEvent) => { if (event.key === EVENT_HISTORY_KEY || event.key === null) sync(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [signals, now]);
  return history;
}
