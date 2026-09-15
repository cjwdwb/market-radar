import type { Market, Point, Quote } from "../market";

export type MarketMode = "classic" | "radar";
export type RadarHistory = {
  points: Point[];
  source: string;
  currency: string;
  fetchedAt: number;
  intervalMs: number;
};
export type RadarSignalType = "price_move" | "volume_spike" | "breakout" | "breakdown" | "volatility_spike";
export type RadarSignal = {
  id: string;
  fingerprint: string;
  symbol: string;
  market: Market;
  type: RadarSignalType;
  title: string;
  description: string;
  metric: string;
  direction: "up" | "down" | "neutral";
  severity: "medium" | "high" | "critical";
  status: "active" | "resolved" | "expired";
  detectedAt: number;
  updatedAt: number;
  quoteAt: number;
  evidenceAt: number;
  expiresAt: number;
  source: string;
  currency: string;
  metrics: Record<string, number | string>;
};
export type RadarSnapshot = { quotes: Record<string, Quote>; histories: Record<string, RadarHistory>; symbols: string[] };
export type RadarCoverage = { symbol: string; eligible: boolean; reason: string };
export type RadarStore = {
  signals: RadarSignal[];
  gates: Record<string, { lastTriggeredAt: number; evidenceAt: number; recovered: boolean }>;
};
export const emptyRadarStore = (): RadarStore => ({ signals: [], gates: {} });
