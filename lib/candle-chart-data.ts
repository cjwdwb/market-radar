import type { Point } from "./market";

export function knownInterval(intervalMs: number | null | undefined): number | null {
  return typeof intervalMs === "number" && Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : null;
}

export function candleIntervalLabel(intervalMs: number | null | undefined): string {
  const interval = knownInterval(intervalMs);
  if (interval === null) return "周期未知";
  if (interval % 86_400_000 === 0) return `${interval / 86_400_000} 日`;
  if (interval % 3_600_000 === 0) return `${interval / 3_600_000} 小时`;
  if (interval % 60_000 === 0) return `${interval / 60_000} 分钟`;
  return `${interval / 1000} 秒`;
}

export function candleConfirmation(point: Pick<Point, "confirmed" | "windowEnded">) {
  if (point.confirmed === true) return { status: "confirmed", label: "已收盘 · 来源确认" } as const;
  if (point.confirmed === false) return { status: "current", label: "本根未收盘 · 来源确认" } as const;
  if (point.windowEnded === true) return { status: "window_ended", label: "周期已结束 · 收盘未确认" } as const;
  if (point.windowEnded === false) return { status: "window_open", label: "周期内 · 收盘未确认" } as const;
  return { status: "unknown", label: "收盘状态未知" } as const;
}

/** Keep the same SMA definition; a missing interval starts a new full-window warmup. */
export function prepareCandleAverages(points: Pick<Point, "time" | "close">[], intervalMs: number | null | undefined) {
  const interval = knownInterval(intervalMs), sums = [0], starts: number[] = [];
  let start = 0;
  points.forEach((point, index) => {
    if (index && interval !== null && point.time - points[index - 1].time !== interval) start = index;
    starts.push(start);
    sums.push(sums[index] + point.close);
  });
  return (index: number, period: number): number | null => {
    if (!Number.isInteger(index) || index < 0 || index >= points.length || !Number.isInteger(period) || period < 1 || index - starts[index] + 1 < period) return null;
    return (sums[index + 1] - sums[index + 1 - period]) / period;
  };
}

/** Selection follows the candle's timestamp, while null continues to follow the visible tail. */
export function selectedCandleIndex(points: Pick<Point, "time">[], selectedTime: number | null): number {
  if (selectedTime !== null) {
    const index = points.findIndex(point => point.time === selectedTime);
    if (index !== -1) return index;
  }
  return points.length - 1;
}
