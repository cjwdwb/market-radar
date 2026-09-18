import type { Market, Point, Quote } from "../market";

export type MarketMode = "classic" | "radar";
export type RadarHistory = {
  points: Point[];
  source: string;
  currency: string;
  fetchedAt: number;
  intervalMs: number;
};
export type RadarSignalType = "price_move" | "volume_spike" | "breakout" | "breakdown" | "volatility_spike" | "relative_strength" | "relative_weakness";
export type RadarEvidenceItem = { label: string; value: number | string; unit?: "%" | "×" | "bars"; baseline?: number; threshold?: number };
export type RadarSignalEvidence = {
  reason: string;
  items: RadarEvidenceItem[];
  sampleSize: number;
  minimumSamples: number;
  strength: number;
  freshnessRatio: number;
  benchmark?: { symbol: string; returnPercent: number; quoteAt: number; fetchedAt: number; evidenceAt: number };
};
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
  fetchedAt: number;
  evidenceAt: number;
  expiresAt: number;
  source: string;
  currency: string;
  metrics: Record<string, number | string>;
  evidence: RadarSignalEvidence;
};
export type RadarSnapshot = { quotes: Record<string, Quote>; histories: Record<string, RadarHistory>; symbols: string[] };
export type RadarReadiness = "ready" | "waiting" | "stale" | "unsupported" | "insufficient";
export type RadarCoverage = { symbol: string; eligible: boolean; reason: string; readiness?: RadarReadiness; relativeEligible?: boolean; relativeReason?: string };
export type RadarStore = {
  signals: RadarSignal[];
  gates: Record<string, { lastTriggeredAt: number; evidenceAt: number; recovered: boolean }>;
};
export const emptyRadarStore = (): RadarStore => ({ signals: [], gates: {} });

export type RadarConfidence = { level: "high" | "medium" | "low"; reasons: string[] };
export type RadarEventKind = "signal" | "momentum_expansion" | "breakout_confirmation" | "selling_pressure" | "relative_strength_event" | "relative_weakness_event";
export type RadarIntelligenceEvent = {
  id: string; kind: RadarEventKind; symbol: string; market: Market; title: string; metric: string;
  direction: RadarSignal["direction"]; severity: RadarSignal["severity"]; status: RadarSignal["status"];
  detectedAt: number; updatedAt: number; confidence: RadarConfidence; signals: RadarSignal[];
  context: string[]; rankingReason: string;
};
export type RadarSummary = { windowMinutes: 60; activeEvents: number; watchlistAssets: number; priorityEvents: number; highlights: RadarIntelligenceEvent[] };
export type RadarIntelligence = { events: RadarIntelligenceEvent[]; summary: RadarSummary };

/** Derived from current pipeline outputs; no navigation state or independent financial score. */
export type AssetIntelligenceContext = {
  symbol: string;
  coverage: { state: "healthy" | "partial" | Exclude<RadarReadiness, "ready">; reason: string; relativeReady: boolean; relativeReason: string; source?: RadarCoverage };
  freshness: { state: "current" | "degraded" | "stale" | "insufficient" | "unavailable"; reason: string };
  activeEvents: RadarIntelligenceEvent[];
  primaryEvent?: RadarIntelligenceEvent;
  eventCount: number;
  latestEvidenceAt?: number;
  relationship: { state: "aligned" | "mixed" | "neutral" | "insufficient"; events: RadarIntelligenceEvent[] };
  relativeSignals: RadarSignal[];
  user: { isWatched: boolean; enabledAlertCount: number };
};
