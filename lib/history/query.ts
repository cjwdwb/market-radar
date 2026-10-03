import type { HistoryBar, HistoryPackage } from "./package";
import type { HistoryReplay, HistoryResearch } from "./replay";

export type HistoryNavigationState = { previous: number | null; next: number | null; suggested: number | null; displayedAt: number | null };
/** 完整收盘记录与分析资格分开；仅提供候选，不自动更改用户请求。 */
export function historyNavigation(bars: HistoryBar[], intervalMs: number, at: number): HistoryNavigationState {
  let previous: number | null = null, next: number | null = null, displayedAt: number | null = null;
  for (const bar of bars) {
    const end = bar.time + intervalMs;
    if (end < at) previous = end;
    else if (end === at) displayedAt = end;
    else if (next === null) next = end;
  }
  return { previous, next, displayedAt, suggested: displayedAt === null ? previous : null };
}
export type ArchiveSeries = { key: string; source: string; asset: HistoryPackage["asset"]; intervalMs: number; firstOpenAt: number; lastCloseAt: number; records: number; identity: "fixture"; coverage: "not_verified" };
export type ArchiveSelection = { snapshot: string; series: string; from: number; to: number; asOf: number };
export type ArchiveScan = { status: "complete" | "partial" | "not_run"; reason: string | null; requestedFrom: number; requestedTo: number; checkedTo: number; rows: number; pages: number; elapsedMs: number; gapCount: number; gaps: { from: number; to: number }[] };
export type ArchivePricePage = { records: (HistoryBar & { firstReceivedAt: number })[]; nextCursor: string | null };
export type ArchiveAnalysis = {
  format: "archive-analysis-v1"; selection: ArchiveSelection; series: ArchiveSeries; snapshotCreatedAt: number;
  requestedAt: number; displayedAt: number | null; navigation: HistoryNavigationState;
  replay: HistoryReplay; research: HistoryResearch; scan: ArchiveScan; prices: ArchivePricePage;
  input: { digest: string; vintage: "current_vintage"; publicationPrecision: "unknown"; sourcePublishedAt: null; evidenceFirstReceivedAt: number | null; evidenceVersionReceivedAt: number | null; bars: HistoryBar[] };
};
export type ArchiveCatalog = { format: "archive-catalog-v1"; snapshot: string; readRevision: number; createdAt: number; series: ArchiveSeries[]; limitation: string };
