import { directionForWindow, volatilityForWindow } from "../radar/asset-state";
import { ASSET_STATE_V2_RULES } from "../radar/asset-state-v2";
import type { HistoryPackage } from "./package";

export type ReplayHorizon = {
  id: "short" | "medium"; minutes: number; reason: "missing_endpoint" | "insufficient_contiguous_bars" | null;
  evidence: null | { closeStartAt: number; closeEndAt: number; dependencyStartAt: number; pointCount: number; validatedPointCount: number };
  direction: ReturnType<typeof directionForWindow> | null; volatility: ReturnType<typeof volatilityForWindow> | null;
};
export type HistoryReplay = {
  asset: string; source: string; digest: string; readRevision: number; intervalMs: number;
  identity: "historical_simulation"; vintage: "current_vintage"; ruleVersion: string;
  asOf: number; calculatedAt: number; horizons: ReplayHorizon[];
};
/** 输入须先通过parseHistoryPackage；历史有效性独立判断，不补造实时报价、抓取或session信息。 */
export function replayHistory(p: HistoryPackage, asOf: number, calculatedAt: number): HistoryReplay {
  if (!Number.isSafeInteger(asOf) || !Number.isSafeInteger(calculatedAt) || asOf < p.range.from || asOf > p.range.cutoff || calculatedAt < p.exportedAt || asOf > calculatedAt) throw Error("INVALID_REPLAY_TIME");
  const interval = p.intervalMs;
  // asOf必须恰好对应完整K线收盘；不能拿较早末根冒充请求时点的证据。
  const end = p.bars.findIndex(b => b.time + interval === asOf);
  let start = end;
  // 只取截止点之前连续的后缀，遇到缺口即停止；不跨午休/隔夜插值补样本。
  while (start > 0 && p.bars[start].time - p.bars[start - 1].time === interval) start--;
  const suffix = end < 0 ? [] : p.bars.slice(start, end + 1);
  const horizons = (["short", "medium"] as const).map<ReplayHorizon>(id => {
    const config = ASSET_STATE_V2_RULES[id];
    const count = config.durationMs / interval + 1;
    // 保留共用输入的22根有效性下限；收益窗口还需要多一个起始收盘价。
    const required = Math.max(22, count);
    const reason = end < 0 ? "missing_endpoint" : suffix.length < required ? "insufficient_contiguous_bars" : null;
    if (reason) return { id, minutes: config.durationMs / 60000, reason, evidence: null, direction: null, volatility: null };
    const window = suffix.slice(-count).map(b => ({ time: b.time, close: b.close }));
    const floor = p.asset.market === "crypto" ? config.cryptoDirectionFloor : config.otherDirectionFloor;
    const current = (count - 1) / 3, baseline = count - 1 - current;
    return { id, minutes: config.durationMs / 60000, reason: null,
      evidence: { closeStartAt: window[0].time + interval, closeEndAt: asOf, dependencyStartAt: suffix.at(-required)!.time, pointCount: count, validatedPointCount: required },
      direction: directionForWindow(window, floor, "固定历史窗口的净变化与路径效率；不是预测。"),
      volatility: volatilityForWindow(window, interval, current, baseline, "后 1/3 收益 RMS 对比此前 2/3；较低不代表低风险。") };
  });
  return { asset: p.asset.id, source: p.source, digest: p.digest, readRevision: p.readRevision, intervalMs: interval, identity: "historical_simulation", vintage: "current_vintage", ruleVersion: ASSET_STATE_V2_RULES.version, asOf, calculatedAt, horizons };
}

export const RESEARCH_PROTOCOL = Object.freeze({ id: "same-asset-short90-forward30-v1", targetMs: 30 * 60000, netTolerancePP: .30, efficiencyTolerance: .20, minimum: 10, maximum: 200 });
export type ResearchSample = { asOf: number; dependencyStartAt: number; targetEnd: number; distancePP: number; startPrice: number; endPrice: number; returnPercent: number };
export type HistoryResearch = {
  protocol: string; identity: "historical_simulation"; vintage: "current_vintage"; digest: string; asOf: number; createdAt: number;
  status: "available" | "insufficient" | "query_unavailable";
  counts: { candidates: number; invalidFeature: number; unmatched: number; immature: number; missingOutcome: number; overlap: number; capped: number; retained: number };
  samples: ResearchSample[]; statistics: { min: number; median: number; max: number } | null;
};
export function researchHistory(p: HistoryPackage, asOf: number, createdAt: number): HistoryResearch {
  // 当前版本历史模拟：相似样本只是描述性参照，不是过去发布过的预测或PIT证明。
  const query = replayHistory(p, asOf, createdAt).horizons[0];
  const counts = { candidates: 0, invalidFeature: 0, unmatched: 0, immature: 0, missingOutcome: 0, overlap: 0, capped: 0, retained: 0 };
  const result: HistoryResearch = { protocol: RESEARCH_PROTOCOL.id, identity: "historical_simulation", vintage: "current_vintage", digest: p.digest, asOf, createdAt, status: "query_unavailable", counts, samples: [], statistics: null };
  if (!query.evidence || query.direction?.availability !== "available" || query.volatility?.availability !== "available") return result;
  const eligible: ResearchSample[] = [];
  const index = new Map(p.bars.map((b, i) => [b.time + p.intervalMs, i]));
  for (const b of p.bars) {
    const candidateAt = b.time + p.intervalMs;
    if (candidateAt >= asOf) break;
    counts.candidates++;
    const targetEnd = candidateAt + RESEARCH_PROTOCOL.targetMs;
    // 候选的30分钟结果须已结束，且不能进入查询自身的完整依赖窗口，避免未来信息泄漏。
    if (targetEnd >= asOf || targetEnd > query.evidence.dependencyStartAt) { counts.immature++; continue; }
    const candidate = replayHistory(p, candidateAt, createdAt).horizons[0];
    if (!candidate.evidence || candidate.direction?.availability !== "available" || candidate.volatility?.availability !== "available") { counts.invalidFeature++; continue; }
    const distancePP = Math.abs(candidate.direction.metrics.netPercent - query.direction.metrics.netPercent);
    if (candidate.direction.classification !== query.direction.classification || candidate.volatility.classification !== query.volatility.classification || distancePP > RESEARCH_PROTOCOL.netTolerancePP || Math.abs(candidate.direction.metrics.efficiency - query.direction.metrics.efficiency) > RESEARCH_PROTOCOL.efficiencyTolerance) { counts.unmatched++; continue; }
    const first = index.get(candidateAt)!, last = index.get(targetEnd);
    if (last === undefined || last - first !== RESEARCH_PROTOCOL.targetMs / p.intervalMs || p.bars.slice(first + 1, last + 1).some((bar, i) => bar.time - p.bars[first + i].time !== p.intervalMs)) { counts.missingOutcome++; continue; }
    const returnPercent = (p.bars[last].close / b.close - 1) * 100;
    if (!Number.isFinite(returnPercent)) { counts.missingOutcome++; continue; }
    eligible.push({ asOf: candidateAt, dependencyStartAt: candidate.evidence.dependencyStartAt, targetEnd, distancePP, startPrice: b.close, endPrice: p.bars[last].close, returnPercent });
  }
  // 先按时间消除“特征+结果”窗口重叠，再按相似度排序，避免重复证据撑大样本量。
  // 窗口可边界接触；消重后仍不宣称样本在统计上完全独立。
  let previousEnd = 0;
  for (const candidate of eligible) {
    if (candidate.dependencyStartAt < previousEnd) { counts.overlap++; continue; }
    result.samples.push(candidate); previousEnd = candidate.targetEnd;
  }
  result.samples.sort((a, b) => a.distancePP - b.distancePP || a.asOf - b.asOf);
  counts.capped = Math.max(0, result.samples.length - RESEARCH_PROTOCOL.maximum);
  result.samples = result.samples.slice(0, RESEARCH_PROTOCOL.maximum); counts.retained = result.samples.length;
  result.status = counts.retained < RESEARCH_PROTOCOL.minimum ? "insufficient" : "available";
  if (result.status === "available") {
    const returns = result.samples.map(s => s.returnPercent).sort((a, b) => a - b), middle = Math.floor(returns.length / 2);
    // 两项先各除以2再相加，防止极大但有限收益在求偶数中位数时溢出。
    const statistics = { min: returns[0], median: returns.length % 2 ? returns[middle] : returns[middle - 1] / 2 + returns[middle] / 2, max: returns.at(-1)! };
    if (!Object.values(statistics).every(Number.isFinite)) throw Error("INVALID_RESEARCH_STATISTICS");
    result.statistics = statistics;
  }
  return result;
}
