"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { displaySymbol, MARKET_LABELS } from "@/lib/market";
import type { EventHistory as HistoryData } from "@/lib/radar/event-history";

const statuses = { active: "异常持续", resolved: "已恢复", expired: "已过期" };
const severities = { medium: "中等", high: "高优先", critical: "极高" };
const date = (at: number) => new Date(at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const value = (input: string | number) => typeof input === "number" ? new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 10 }).format(input) : input;
const PAGE_SIZE = 12;

export function EventHistory({ history, scope, onAsset }: { history: HistoryData; scope: string; onAsset: (symbol: string) => void }) {
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [page, setPage] = useState({ key: "", index: 0 });
  const filtered = history.observations.filter(({ signal }) => (status === "all" || signal.status === status) && `${signal.symbol} ${signal.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  const key = `${scope}:${query}:${status}`, pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const index = Math.min(page.key === key ? page.index : 0, pages - 1);
  const visible = filtered.slice(index * PAGE_SIZE, (index + 1) * PAGE_SIZE);
  return <section className="event-history" aria-label="历史事件记录">
    <div className="event-history-note"><History size={18} aria-hidden="true"/><p>本机最近 7 天 · 最多 120 条原始事件。保留当时的观察和证据，不代表当前状态；组合事件在此按原始信号展开。未打开网站期间不补录，不跨设备同步。</p></div>
    {history.storage === "loading" && <p role="status">正在读取本机记录…</p>}
    {history.storage === "unavailable" && <p className="event-history-warning" role="status">本机存储不可用，新增记录仅在本次页面保留，刷新后可能丢失。</p>}
    {history.storage === "invalid" && <p className="event-history-warning" role="status">本机旧记录无法读取，已保留原文件；本次记录暂不保存，不影响看盘。</p>}
    <div className="event-history-controls"><label>搜索事件<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="资产代码或事件名称" maxLength={80}/></label><label>上次观察状态<select aria-label="上次观察状态" value={status} onChange={event => setStatus(event.target.value)}><option value="all">全部状态</option><option value="active">当时异常持续</option><option value="resolved">已恢复</option><option value="expired">已过期</option></select></label></div>
    <p className="event-history-count" role="status">{filtered.length} 条记录 · 时间为本机时区</p>
    {visible.length ? <ol className="event-history-list">{visible.map(({ signal: s, observedAt }) => <li key={s.id}>
      <details className="event-history-item" data-symbol={s.symbol}>
        <summary><span className="event-history-identity"><strong>{displaySymbol(s.symbol)}</strong><small>{s.symbol} · {MARKET_LABELS[s.market]}</small></span><span className="event-history-fact"><strong>{s.title}</strong><span className={s.direction === "up" ? "positive" : s.direction === "down" ? "negative" : ""}>{s.metric}</span></span><span className="event-history-time"><time dateTime={new Date(s.detectedAt).toISOString()}>{date(s.detectedAt)}</time><small>上次观察时：{statuses[s.status]}</small></span><span aria-hidden="true" className="event-history-chevron">＋</span></summary>
        <div className="event-history-detail"><p>{s.evidence.reason}</p><dl>{s.evidence.items.map((item, i) => <div key={i}><dt>{item.label}</dt><dd>{value(item.value)}{item.unit ?? ""}{item.baseline !== undefined && <small>基线 {value(item.baseline)}{item.unit ?? ""}</small>}{item.threshold !== undefined && <small>阈值 {value(item.threshold)}{item.unit ?? ""}</small>}</dd></div>)}</dl>
          <dl><div><dt>事件强度（当时）</dt><dd>{severities[s.severity]}</dd></div><div><dt>来源 / 币种</dt><dd>{s.source} / {s.currency}</dd></div><div><dt>证据截止</dt><dd>{date(s.evidenceAt)}</dd></div><div><dt>报价时间</dt><dd>{date(s.quoteAt)}</dd></div><div><dt>数据取得</dt><dd>{date(s.fetchedAt)}</dd></div><div><dt>状态更新</dt><dd>{date(s.updatedAt)}</dd></div><div><dt>本机记录</dt><dd>{date(observedAt)}</dd></div><div><dt>样本 / 最低要求</dt><dd>{s.evidence.sampleSize} / {s.evidence.minimumSamples}</dd></div>{s.evidence.benchmark && <><div><dt>同步基准</dt><dd>{s.evidence.benchmark.symbol}</dd></div><div><dt>基准变化</dt><dd>{value(s.evidence.benchmark.returnPercent)}%</dd></div><div><dt>基准报价 / 取得</dt><dd>{date(s.evidence.benchmark.quoteAt)} / {date(s.evidence.benchmark.fetchedAt)}</dd></div><div><dt>基准证据截止</dt><dd>{date(s.evidence.benchmark.evidenceAt)}</dd></div></>}</dl>
          <p>历史观察仅供核对，不确认异常仍在持续。打开的是当前行情，保留你选择的图表周期。</p><button className="btn" onClick={() => onAsset(s.symbol)}>查看 {displaySymbol(s.symbol)} 当前图表</button>
        </div>
      </details>
    </li>)}</ol> : <div className="radar-empty"><History size={26}/><h3>{history.observations.length ? "没有匹配的历史事件" : "这里还没有历史事件"}</h3><p>{history.observations.length ? "试试其他状态、资产代码或市场筛选。" : "网站打开期间检测到的有效事件会保留在这里。空记录不代表过去没有异常。"}</p></div>}
    {pages > 1 && <nav className="event-history-pagination" aria-label="历史事件分页"><button className="btn" disabled={index === 0} onClick={() => setPage({ key, index: index - 1 })}>上一页</button><span>{index + 1} / {pages}</span><button className="btn" disabled={index + 1 === pages} onClick={() => setPage({ key, index: index + 1 })}>下一页</button></nav>}
  </section>;
}
