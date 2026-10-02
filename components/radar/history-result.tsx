import type { HistoryReplay, HistoryResearch, ReplayHorizon } from "@/lib/history/replay";

const time = (at: number) => new Date(at).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const financial = new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 10 });
const pct = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? financial.format(v) + "%" : "—");
const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? financial.format(v) : "—");
const wrap = { overflowWrap: "anywhere" as const, minWidth: 0 };

const horizonLabel: Record<ReplayHorizon["id"], string> = { short: "短期窗口", medium: "中期窗口" };
const reasonText: Record<NonNullable<ReplayHorizon["reason"]>, string> = {
  missing_endpoint: "缺少截止 K 线",
  insufficient_contiguous_bars: "连续 K 线不足",
};
const availabilityText: Record<string, string> = {
  available: "可用", waiting: "等待", insufficient: "证据不足", unsupported: "不支持",
  invalid: "无效", stale: "已过期", paused: "已暂停", offline: "离线",
};
const directionText: Record<string, string> = { upward: "窗口偏上", downward: "窗口偏下", no_direction: "无明显单向结构" };
const volatilityText: Record<string, string> = { higher: "高于此前基线", lower: "低于此前基线", similar: "接近此前基线" };
const statusText: Record<HistoryResearch["status"], string> = {
  available: "样本可用", insufficient: "样本不足", query_unavailable: "查询不可用",
};
const countLabels: [keyof HistoryResearch["counts"], string][] = [
  ["candidates", "候选"], ["invalidFeature", "特征无效"], ["unmatched", "不匹配"], ["immature", "未成熟或进入查询依赖窗口"],
  ["missingOutcome", "缺少结果"], ["overlap", "重叠"], ["capped", "截断"], ["retained", "保留"],
];
const MAX_SAMPLE_ROWS = 10;

function DirectionBlock({ dimension }: { dimension: ReplayHorizon["direction"] }) {
  if (!dimension) return <p>方向指标：未提供。</p>;
  return (
    <div className="history-direction">
      <p className="numeric">
        {dimension.availability === "available"
          ? "方向：" + directionText[dimension.classification]
          : "方向暂不可用 · " + (availabilityText[dimension.availability] ?? dimension.availability) + " · 原因 " + dimension.reason}
      </p>
      <details className="macro-provenance">
        <summary>方向依据</summary>
        <p>{dimension.message}</p>
        {dimension.metrics ? (
          <p className="numeric">
            净变化 {pct(dimension.metrics.netPercent)} · 路径效率 {num(dimension.metrics.efficiency)}<br/>
            最低净变化阈值 {pct(dimension.metrics.minimumNetPercent)} · 最低路径效率阈值 {num(dimension.metrics.minimumEfficiency)}
          </p>
        ) : null}
      </details>
    </div>
  );
}

function VolatilityBlock({ dimension }: { dimension: ReplayHorizon["volatility"] }) {
  if (!dimension) return <p>RMS 波动指标：未提供。</p>;
  return (
    <div className="history-volatility">
      <p className="numeric">
        {dimension.availability === "available"
          ? "波动：" + volatilityText[dimension.classification]
          : "波动暂不可用 · " + (availabilityText[dimension.availability] ?? dimension.availability) + " · 原因 " + dimension.reason}
      </p>
      <details className="macro-provenance">
        <summary>RMS依据</summary>
        <p>{dimension.message}</p>
        {dimension.metrics ? (
          <p className="numeric">
            当前 RMS {pct(dimension.metrics.currentRmsPercent)} · 基线 RMS {pct(dimension.metrics.baselineRmsPercent)}<br/>
            比值 {dimension.metrics.ratio === null ? "暂不可用" : num(dimension.metrics.ratio)} · 较低阈值 {num(dimension.metrics.lowerRatio)} · 较高阈值 {num(dimension.metrics.higherRatio)}
          </p>
        ) : null}
      </details>
    </div>
  );
}

export function HistoryResult({ replay, research }: { replay: HistoryReplay; research: HistoryResearch }) {
  const rows = research.samples.slice(0, MAX_SAMPLE_ROWS);
  return (
    <section className="history-result">
      <h2>历史重放与样本研究</h2>
      <p className="macro-notice">模拟历史 · 当前取得版本 · 非当时观察/预测</p>
      <p>基于已取得的归档 K 线重建固定窗口指标，只描述已发生的结构；不是当时的在线观察，也不构成预测主张。</p>

      <details className="macro-provenance">
        <summary>版本与身份说明</summary>
        <p style={wrap}>身份 {replay.identity} · 版本 {replay.vintage} · 规则 {replay.ruleVersion}</p>
        <p style={wrap}>资产 {replay.asset} · 来源 {replay.source}</p>
        <p style={wrap}>摘要 {replay.digest} · 数据修订 {replay.readRevision}</p>
        <p className="numeric">观测时点（asOf）{time(replay.asOf)}<br/>计算时点（calculatedAt）{time(replay.calculatedAt)}</p>
        <p>当前取得版本与固定样本来自历史重建，不代表取得时点即可知，也不构成无未来函数或预测准确率主张。</p>
      </details>

      <h3>窗口指标</h3>
      {replay.horizons.map((horizon) => (
        <div key={horizon.id} className="history-horizon">
          <h4>{horizonLabel[horizon.id]} · {horizon.minutes} 分钟</h4>
          {horizon.reason !== null ? (
            <p role="status" className="numeric">不可用（{horizon.reason}）：{reasonText[horizon.reason]}</p>
          ) : (
            <>
              <DirectionBlock dimension={horizon.direction} />
              <VolatilityBlock dimension={horizon.volatility} />
            </>
          )}
          {horizon.evidence ? (
            <details className="macro-provenance">
              <summary>证据与时间（UTC）</summary>
              <p className="numeric">收盘起点 {time(horizon.evidence.closeStartAt)}<br/>收盘终点 {time(horizon.evidence.closeEndAt)}<br/>依赖起点 {time(horizon.evidence.dependencyStartAt)}</p>
              <p className="numeric">点位数 {horizon.evidence.pointCount} · 校验点位数 {horizon.evidence.validatedPointCount}</p>
            </details>
          ) : (
            <p>无证据时间（未形成可用窗口）。</p>
          )}
        </div>
      ))}

      <details className="macro-provenance">
        <summary>样本研究详情</summary>
        <p style={wrap}>身份 {research.identity} · 版本 {research.vintage} · 摘要 {research.digest}</p>
        <p className="numeric">观测时点（asOf）{time(research.asOf)} · 生成时点（createdAt）{time(research.createdAt)}</p>
        <p style={wrap}>协议 {research.protocol} · 状态 {statusText[research.status]}</p>
        <p>结果期限 30 分钟，单位为区间收益率（%）。</p>
        <p>最少样本 10 条；低于 10 条不视为可用。本切片不保证真实覆盖范围。</p>
        <p>相对表现、窗口对齐与变化比较暂不可用；无法还原过去信号的生命周期。</p>
        <h4>计数台账</h4>
        <ul className="macro-records">
          {countLabels.map(([key, label]) => (
            <li key={key} className="numeric">{label}：{research.counts[key]}</li>
          ))}
        </ul>
        {research.statistics ? (
          <p className="numeric">收益率统计（%）：最小 {pct(research.statistics.min)} · 中位 {pct(research.statistics.median)} · 最大 {pct(research.statistics.max)}</p>
        ) : (
          <p>未提供样本统计（样本不足或查询不可用）。</p>
        )}
        <h4>候选样本（最多 10 条）</h4>
        {rows.length ? (
          <ol className="macro-records">
            {rows.map((sample) => (
              <li key={sample.asOf + "-" + sample.targetEnd} className="numeric">
                观测 {time(sample.asOf)} · 目标终点 {time(sample.targetEnd)}<br/>
                区间收益率 {pct(sample.returnPercent)} · 距离 {num(sample.distancePP)} 百分点
              </li>
            ))}
          </ol>
        ) : (
          <p>没有可展示的候选样本。</p>
        )}
        <p className="numeric">显示 {rows.length} / 保留 {research.counts.retained} 条</p>
        <p>完整样本不在本页展示，但全部计数已保留如上。样本来自当前取得版本，不构成结果概率或预测准确率主张。</p>
      </details>
    </section>
  );
}
