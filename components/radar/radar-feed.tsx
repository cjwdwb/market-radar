"use client";

import { memo, useState } from "react";
import { ArrowUpRight, Plus, ScanLine, Star, X } from "lucide-react";
import { assetFor, displaySymbol, MARKET_LABELS, type Market } from "@/lib/market";
import type { RadarCoverage, RadarSignal } from "@/lib/radar/types";

const severity = { medium: "中等", high: "高优先", critical: "极高" };
const status = { active: "异常持续", resolved: "已恢复", expired: "已过期" };
function time(value: number) { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(value); }

export const SignalCard = memo(function SignalCard({ signal, onAsset }: { signal: RadarSignal; onAsset: (symbol: string) => void }) {
  return <article className={`radar-signal signal-${signal.status}`} aria-label={`${displaySymbol(signal.symbol)} ${signal.title}`}>
    <div className="signal-heading"><button className="signal-asset" onClick={() => onAsset(signal.symbol)} aria-label={`查看 ${signal.symbol} 行情`}><span className="asset-icon small" aria-hidden="true">{assetFor(signal.symbol).mark}</span><span><strong>{displaySymbol(signal.symbol)}</strong><small>{signal.symbol} · {MARKET_LABELS[signal.market]}</small></span><ArrowUpRight size={16}/></button><span className={`signal-severity severity-${signal.severity}`}>{severity[signal.severity]}</span></div>
    <div className="signal-summary"><h3>{signal.title}</h3><strong className={`numeric ${signal.direction === "up" ? "positive" : signal.direction === "down" ? "negative" : ""}`}>{signal.metric}</strong></div>
    <div className="signal-meta"><span>{status[signal.status]}</span><time dateTime={new Date(signal.detectedAt).toISOString()}>发现于 {time(signal.detectedAt)}</time></div>
    <details className="signal-context"><summary>依据与来源</summary><p>{signal.description}</p><dl><div><dt>数据来源</dt><dd>{signal.source} · {signal.currency}</dd></div><div><dt>报价时间</dt><dd>{time(signal.quoteAt)}</dd></div><div><dt>K 线结束</dt><dd>{time(signal.evidenceAt)}</dd></div><div><dt>状态更新</dt><dd>{time(signal.updatedAt)}</dd></div></dl></details>
  </article>;
});

type Props = {
  signals: RadarSignal[]; coverage: RadarCoverage[]; watchlist: string[];
  scanning: boolean; loading: boolean; online: boolean;
  onAsset: (symbol: string) => void; onAdd: () => void; onRemove: (symbol: string) => void;
};
export function RadarFeed({ signals, coverage, watchlist, scanning, loading, online, onAsset, onAdd, onRemove }: Props) {
  const [filter, setFilter] = useState("all");
  const [showHistory, setShowHistory] = useState(false);
  const ready = coverage.filter(item => item.eligible).length;
  const markets = [...new Set(coverage.map(item => assetFor(item.symbol).market))];
  const filtered = signals.filter(signal => (showHistory || signal.status === "active") && (filter === "all" || filter === "watchlist" && watchlist.includes(signal.symbol) || filter === "priority" && signal.severity !== "medium" || filter === signal.market));
  const filters = [["all", "全部"], ["watchlist", "My Radar"], ...markets.map(market => [market, MARKET_LABELS[market as Market]]), ["priority", "高优先"]];
  const headline = !online ? "网络已断开" : !scanning ? "扫描已暂停" : loading && !ready ? "正在获取市场数据" : !ready ? "等待有效行情与历史基线" : "市场扫描中";
  return <section className="radar-experience" id="radar" aria-label="Radar 市场事件">
    <div className="radar-intro"><div><span className="radar-eyebrow">LET THE MARKET COME TO YOU.</span><h2>少一点噪声。<br/>看见值得关注的变化。</h2><p>从关注的市场中，识别有数据依据的价格、量能与波动异常。</p></div><div className="radar-scan-status" role="status"><ScanLine size={21}/><strong>{headline}</strong><span>{ready} / {coverage.length} 个标的基线可用</span><small>仅扫描当前自选、市场概览与已加载的标的</small></div></div>
    <div className="radar-layout"><div className="radar-feed-column"><div className="radar-feed-toolbar"><div><h2>市场事件 <span className="count">{filtered.length}</span></h2><p>完整 K 线确认 · 当前页面会话记录</p></div><label className="radar-history-toggle"><input type="checkbox" checked={showHistory} onChange={event => setShowHistory(event.target.checked)}/>包含历史</label></div>
      <div className="radar-filter-wrap"><div className="radar-filters" aria-label="筛选 Radar">{filters.map(([key, label]) => <button key={key} className="btn" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div><span className="radar-filter-hint">横向滑动查看更多筛选</span></div>
      {filtered.length ? <div className="radar-feed">{filtered.map(signal => <SignalCard key={signal.id} signal={signal} onAsset={onAsset}/>)}</div> : <div className="radar-empty"><ScanLine size={28}/><h3>{!online ? "等待网络恢复" : !scanning ? "恢复自动监控后继续扫描" : !ready ? "正在等待可靠基线" : "当前筛选下，暂无异常事件"}</h3><p>{!ready ? "缺失、休市、延迟或不连续的数据不会生成信号。其他标的数据就绪后将独立参与扫描。" : "市场平静也是信息。新的有效异常出现后，会在这里显示。"}</p>{filter === "watchlist" && !watchlist.length && <button className="btn" onClick={onAdd}><Plus size={15}/>添加关注标的</button>}</div>}
    </div><aside className="radar-sidebar"><section className="panel radar-watchlist"><div className="panel-heading"><h2><Star size={16}/>My Radar <span className="count">{watchlist.length}</span></h2><button className="icon-btn" aria-label="Radar 添加自选" onClick={onAdd}><Plus size={17}/></button></div><p>与 Markets 共用同一份自选。</p><div>{watchlist.map(symbol => <div className="radar-watch-row" key={symbol}><button onClick={() => onAsset(symbol)}><strong>{displaySymbol(symbol)}</strong><small>{assetFor(symbol).name}</small></button><button className="icon-btn" aria-label={`Radar 移除 ${symbol}`} onClick={() => onRemove(symbol)}><X size={15}/></button></div>)}</div></section>
      <details className="panel radar-coverage"><summary>扫描覆盖与限制 <span>{ready}/{coverage.length}</span></summary><ul>{coverage.map(item => <li key={item.symbol}><strong>{item.symbol}</strong><span>{item.reason}</span></li>)}</ul><p>加密使用 15 分钟 K 线；股票使用常规交易时段的 5 分钟 K 线。短周期异常由近期基线确认，不等同于实时买卖建议。</p><p>股票量能、加密 5 分钟及相对强弱信号尚未启用。历史不足时等待，不生成模拟事件。</p></details>
    </aside></div>
  </section>;
}
