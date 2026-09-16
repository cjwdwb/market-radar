"use client";

import { memo, useState } from "react";
import { ArrowUpRight, Plus, ScanLine, Star, X } from "lucide-react";
import { assetFor, displaySymbol, MARKET_LABELS, type Market } from "@/lib/market";
import type { RadarCoverage, RadarEvidenceItem, RadarIntelligence, RadarIntelligenceEvent } from "@/lib/radar/types";
import { summarizeWatchlistCoverage, type assetRadarContext } from "@/lib/radar/workflow";

const severity = { medium: "中等", high: "高优先", critical: "极高" };
const confidence = { low: "低可信", medium: "中可信", high: "高可信" };
const status = { active: "异常持续", resolved: "已恢复", expired: "已过期" };
const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
function time(value: number) { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(value); }
function evidenceValue(item: RadarEvidenceItem) { return typeof item.value === "number" ? `${number.format(item.value)}${item.unit ?? ""}` : item.value; }

export const SignalCard = memo(function SignalCard({ event, onAsset, onWatch, onAlert, isWatched, alertCount, highlighted }: { event: RadarIntelligenceEvent; onAsset: (event: RadarIntelligenceEvent | string) => void; onWatch: (symbol: string) => void; onAlert: (symbol: string) => void; isWatched: boolean; alertCount: number; highlighted: boolean }) {
  const primary = event.signals[0];
  return <article className={`radar-signal signal-${event.status} ${event.kind !== "signal" ? "signal-cluster" : ""}`} data-context-event={highlighted || undefined} data-symbol={event.symbol} aria-label={`${displaySymbol(event.symbol)} ${event.title}`}>
    {highlighted && <p className="context-event-label">当前资产 · 首要事件</p>}
    <div className="signal-heading"><button className="signal-asset" onClick={() => onAsset(event)} aria-label={`查看 ${event.symbol} 行情`}><span className="asset-icon small" aria-hidden="true">{assetFor(event.symbol).mark}</span><span><strong>{displaySymbol(event.symbol)}</strong><small>{event.symbol} · {MARKET_LABELS[event.market]}</small></span><ArrowUpRight size={16}/></button><div className="signal-badges"><span className={`signal-severity severity-${event.severity}`}>{severity[event.severity]}</span><span className={`signal-confidence confidence-${event.confidence.level}`}>{confidence[event.confidence.level]}</span></div></div>
    <div className="signal-summary"><h3>{event.title}</h3><strong className={`numeric ${event.direction === "up" ? "positive" : event.direction === "down" ? "negative" : ""}`}>{event.metric}</strong>{event.signals.length > 1 && <small>{event.signals.length} 项独立证据合并</small>}</div>
    <div className="signal-meta"><span>{status[event.status]}</span><time dateTime={new Date(event.detectedAt).toISOString()}>发现于 {time(event.detectedAt)}</time></div>
    <details className="signal-context"><summary>Why triggered · 依据与来源</summary>
      <div className="signal-explanation"><p>{primary.evidence?.reason ?? primary.description}</p>
        {primary.evidence && <dl className="signal-evidence">{primary.evidence.items.map((item, index) => <div key={`${item.label}:${index}`}><dt>{item.label}</dt><dd className="numeric">{evidenceValue(item)}{item.baseline !== undefined && <small>基线 {number.format(item.baseline)}{item.unit === "%" ? "%" : ""}</small>}{item.threshold !== undefined && <small>阈值 {number.format(item.threshold)}{item.unit ?? ""}</small>}</dd></div>)}</dl>}
        {event.context.length > 0 && <section className="signal-related" aria-label="市场背景"><h4>Context</h4>{event.context.map((line, index) => <p key={index}>{line}</p>)}</section>}
        <section className="signal-related" aria-label="可信度依据"><h4>{confidence[event.confidence.level]}</h4><ul>{event.confidence.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></section>
        <div className="signal-actions"><button className="btn btn-primary" onClick={() => onAsset(event)}>查看图表</button><button className="btn" onClick={() => onWatch(event.symbol)}>{isWatched ? "移出自选" : "加入自选"}</button><button className="btn" onClick={() => onAlert(event.symbol)}>{alertCount ? `查看价格提醒 (${alertCount})` : "设置价格提醒"}</button></div>
        {alertCount > 0 && <p className="signal-alert-note">{alertCount} 条启用的价格提醒 · 用户设定的条件，独立于 Radar 事件。</p>}
        {event.signals.length > 1 && <section className="signal-related cluster-evidence-list" aria-label="组合中的原始信号"><h4>组合证据</h4>{event.signals.slice(1).map(signal => <section className="cluster-evidence" key={signal.id} aria-label={`${signal.title} 证据`}><h5>{signal.title} · {signal.metric}</h5><p>{signal.evidence.reason}</p><dl className="signal-evidence">{signal.evidence.items.map((item,index)=><div key={`${item.label}:${index}`}><dt>{item.label}</dt><dd className="numeric">{evidenceValue(item)}{item.baseline!==undefined&&<small>基线 {number.format(item.baseline)}{item.unit==="%"?"%":""}</small>}{item.threshold!==undefined&&<small>阈值 {number.format(item.threshold)}{item.unit??""}</small>}</dd></div>)}</dl><dl className="cluster-provenance"><div><dt>数据来源</dt><dd>{signal.source} · {signal.currency}</dd></div>{signal.evidence.benchmark&&<><div><dt>同步基准</dt><dd>{signal.evidence.benchmark.symbol}</dd></div><div><dt>基准报价时间</dt><dd>{time(signal.evidence.benchmark.quoteAt)}</dd></div><div><dt>基准获取时间</dt><dd>{time(signal.evidence.benchmark.fetchedAt)}</dd></div></>}<div><dt>报价时间</dt><dd>{time(signal.quoteAt)}</dd></div><div><dt>获取时间</dt><dd>{time(signal.fetchedAt)}</dd></div><div><dt>K 线结束</dt><dd>{time(signal.evidenceAt)}</dd></div><div><dt>信号发现</dt><dd>{time(signal.detectedAt)}</dd></div></dl></section>)}</section>}
        <dl><div><dt>数据来源</dt><dd>{primary.source} · {primary.currency}</dd></div>{primary.evidence?.benchmark && <div><dt>同步基准</dt><dd>{primary.evidence.benchmark.symbol} · {time(primary.evidence.benchmark.quoteAt)}</dd></div>}<div><dt>报价时间</dt><dd>{time(primary.quoteAt)}</dd></div><div><dt>获取时间</dt><dd>{time(primary.fetchedAt)}</dd></div><div><dt>K 线结束</dt><dd>{time(primary.evidenceAt)}</dd></div><div><dt>状态更新</dt><dd>{time(event.updatedAt)}</dd></div></dl>
      </div>
    </details>
  </article>;
});

type Props = {
  intelligence: RadarIntelligence; coverage: RadarCoverage[]; watchlist: string[];
  scanning: boolean; loading: boolean; online: boolean;
  assetContext?: ReturnType<typeof assetRadarContext>; onClearContext: () => void; priceAlertCounts: ReadonlyMap<string, number>;
  onAsset: (event: RadarIntelligenceEvent | string) => void; onWatch: (symbol: string) => void; onAlert: (symbol: string) => void; onAdd: () => void; onRemove: (symbol: string) => void;
};
export function RadarFeed({ intelligence, coverage, watchlist, scanning, loading, online, onAsset, onWatch, onAlert, onAdd, onRemove, assetContext, onClearContext, priceAlertCounts }: Props) {
  const [filter, setFilter] = useState("all"), [showHistory, setShowHistory] = useState(false);
  const ready = coverage.filter(item => item.eligible).length;
  const markets = [...new Set(coverage.map(item => assetFor(item.symbol).market))];
  const filtered = intelligence.events.filter(event => (showHistory || event.status === "active") && (assetContext ? event.symbol === assetContext.symbol : filter === "all" || filter === "watchlist" && watchlist.includes(event.symbol) || filter === "priority" && event.severity !== "medium" || filter === event.market));
  const filters = [["all", "全部"], ["watchlist", "My Radar"], ...markets.map(market => [market, MARKET_LABELS[market as Market]]), ["priority", "高优先"]];
  const headline = !online ? "网络已断开" : !scanning ? "扫描已暂停" : loading && !ready ? "正在获取市场数据" : !ready ? "等待有效行情与历史基线" : "市场扫描中";
  const summary = intelligence.summary;
  const coverageSummary = summarizeWatchlistCoverage(coverage, watchlist);
  return <section className="radar-experience" id="radar" aria-label="Radar 市场事件">
    <div className="radar-intro"><div><span className="radar-eyebrow">LET THE MARKET COME TO YOU.</span><h2>少一点噪声。<br/>理解值得关注的变化。</h2><p>同步基准、结构化证据和组合事件，让异常更容易判断。</p></div><div className="radar-scan-status" role="status"><ScanLine size={21}/><strong>{headline}</strong><span>{ready} / {coverage.length} 个标的基线可用</span><small>仅扫描当前自选、市场概览与已加载的标的</small></div></div>
    {assetContext && <section className="radar-asset-context" aria-label={`${assetContext.symbol} 的 Radar 上下文`}><div><span className="context-label">FROM CLASSIC</span><h2>{displaySymbol(assetContext.symbol)} <small>{assetContext.symbol}</small></h2><p>{assetContext.activeEvents.length} 个活跃事件 · {watchlist.includes(assetContext.symbol) ? "已自选" : "未加入自选"}</p></div><div className="context-actions"><button className="btn" onClick={()=>onAsset(assetContext.symbol)}>返回图表</button><button className="btn" onClick={onClearContext}>退出资产筛选</button></div></section>}
    {!assetContext && summary.activeEvents > 0 && <section className="radar-summary" aria-labelledby="radar-summary-title"><div><span>LAST 60 MINUTES</span><h2 id="radar-summary-title">{summary.watchlistAssets ? `${summary.watchlistAssets} 个自选标的需要关注` : `${summary.activeEvents} 个市场事件`}</h2><p>{summary.priorityEvents} 个高优先事件 · 已按自选、组合证据与可信度排序</p></div><ol>{summary.highlights.map(event => <li key={event.id}><button onClick={() => onAsset(event)}><strong>{displaySymbol(event.symbol)}</strong><span>{event.title}</span><small>{event.metric}</small></button></li>)}</ol></section>}
    <div className="radar-layout"><div className="radar-feed-column"><div className="radar-feed-toolbar"><div><h2>市场情报 <span className="count">{filtered.length}</span></h2><p>原始信号保留 · 相关事件已组合 · 当前页面会话记录</p></div><label className="radar-history-toggle"><input type="checkbox" checked={showHistory} onChange={event => setShowHistory(event.target.checked)}/>包含历史</label></div>
      <div className="radar-filter-wrap" hidden={!!assetContext}><div className="radar-filters" aria-label="筛选 Radar">{filters.map(([key, label]) => <button key={key} className="btn" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div><span className="radar-filter-hint">横向滑动查看更多筛选</span></div>
      {filtered.length ? <div className="radar-feed">{filtered.map(event => <SignalCard key={event.id} event={event} onAsset={onAsset} onWatch={onWatch} onAlert={onAlert} isWatched={watchlist.includes(event.symbol)} alertCount={priceAlertCounts.get(event.symbol)??0} highlighted={assetContext?.primaryEvent?.id===event.id}/>)}</div> : <div className="radar-empty"><ScanLine size={28}/><h3>{!online ? "等待网络恢复" : !scanning ? "恢复自动监控后继续扫描" : !ready ? "正在等待可靠基线" : "当前筛选下，暂无异常事件"}</h3><p>{!ready ? "缺失、休市、延迟或不连续的数据不会生成信号。Benchmark 失败只会关闭相对强弱，不影响其他检测。" : "新的有效异常出现后，会在这里显示。"}</p>{filter === "watchlist" && !watchlist.length && <button className="btn" onClick={onAdd}><Plus size={15}/>添加关注标的</button>}</div>}
    </div><aside className="radar-sidebar"><section className="panel radar-watchlist"><div className="panel-heading"><h2><Star size={16}/>My Radar <span className="count">{watchlist.length}</span></h2><button className="icon-btn" aria-label="Radar 添加自选" onClick={onAdd}><Plus size={17}/></button></div><p>与 Markets 共用同一份自选。</p><div>{watchlist.map(symbol => <div className="radar-watch-row" key={symbol}><button onClick={() => onAsset(symbol)}><strong>{displaySymbol(symbol)}</strong><small>{assetFor(symbol).name}</small></button><button className="icon-btn" aria-label={`Radar 移除 ${symbol}`} onClick={() => onRemove(symbol)}><X size={15}/></button></div>)}</div></section>
      <section className="panel radar-coverage-summary" aria-label="My Radar 覆盖概况"><div className="panel-heading"><h3>覆盖概况</h3><span className={`coverage-state coverage-${coverageSummary.state}`}>{coverageSummary.state === "ready" ? "完整" : coverageSummary.state === "partial" ? "部分" : coverageSummary.state === "waiting" ? "等待" : "—"}</span></div><p>{coverageSummary.total ? `${coverageSummary.ready} 个完整 · ${coverageSummary.partial} 个部分 · ${coverageSummary.waiting} 个等待` : "添加资产后开始监控"}</p></section>
      <details className="panel radar-coverage"><summary>扫描覆盖与限制 <span>{ready}/{coverage.length}</span></summary><ul>{coverage.map(item => <li key={item.symbol}><strong>{item.symbol}</strong><span>{item.reason}</span>{item.relativeReason && <small>相对信号：{item.relativeReason}</small>}</li>)}</ul><p>相对强弱只比较同步、同源、同币种的 15 分钟窗口。缺失 benchmark 时不生成相对事件。</p><p>股票量能、加密 5 分钟与跨设备历史尚未启用。不使用 AI 猜测行情原因。</p></details>
    </aside></div>
  </section>;
}
