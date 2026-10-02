"use client";
import { useEffect, useRef, useState } from "react";
import { PACKAGE_LIMIT, parseHistoryPackage, type HistoryPackage } from "@/lib/history/package";
import { replayHistory, researchHistory, type HistoryReplay, type HistoryResearch } from "@/lib/history/replay";
import { HistoryResult } from "./history-result";

const inputTime = (at: number) => new Date(at).toISOString().slice(0, 16);
const utc = (at: number) => new Date(at).toISOString().replace("T", " ");
type Accepted = { data: HistoryPackage; replay: HistoryReplay; research: HistoryResearch };
/** 历史文件与实时行情隔离；只有完整校验和计算成功后才替换上一份有效结果。 */
export function HistoryWorkspace() {
  const [accepted, setAccepted] = useState<Accepted | null>(null);
  const [asOf, setAsOf] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false), [page, setPage] = useState(0);
  // 新文件或卸载推进代次，防止较慢的旧读取覆盖较新的选择，或在卸载后写回状态。
  const generation = useRef(0), panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => () => { generation.current++; }, []);
  async function load(file: File | undefined) {
    if (!file) return;
    const version = ++generation.current; setLoading(true); setError("");
    try {
      if (file.size > PACKAGE_LIMIT) throw Error("历史文件不能超过 2 MiB。");
      const data = await parseHistoryPackage(await file.text(), Date.now());
      if (version !== generation.current) return;
      const at = data.bars.at(-1)!.time + data.intervalMs, now = Date.now();
      const replay = replayHistory(data, at, now), research = researchHistory(data, at, now);
      // 成功时一起提交文件、回放和研究；catch只提示错误，保留旧文件、查询与分页。
      setAccepted({ data, replay, research }); setAsOf(inputTime(at)); setPage(0);
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : "无法读取历史。"); }
    finally { if (version === generation.current) setLoading(false); }
  }
  function query() {
    if (!accepted) return;
    try {
      // datetime-local本身不带时区；本面板明确使用UTC，不能按设备时区解释归档时间。
      const at = Date.parse(asOf + ":00Z"), now = Date.now();
      if (!Number.isFinite(at) || inputTime(at) !== asOf) throw Error("请选择归档范围内的有效 UTC 时间。");
      const replay = replayHistory(accepted.data, at, now), research = researchHistory(accepted.data, at, now);
      setAccepted({ data: accepted.data, replay, research }); setPage(0); setError("");
    } catch { setError("请选择归档范围内的有效 UTC 时间，已有结果保持不变。"); }
  }
  const bars = accepted?.data.bars.filter(b => b.time + accepted.data.intervalMs <= accepted.replay.asOf) ?? [];
  const pages = Math.max(1, Math.ceil(bars.length / 20));
  return <details ref={panel} className="panel macro-timeline history-workspace" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <summary>历史回放与研究 <span>模拟数据</span></summary>
    <p>导入示例，查看历史窗口与相近样本。当前仅支持模拟价格；真实价格归档尚未接入。文件只在本页读取。</p>
    <a className="btn" style={{ minHeight: 44, display: "inline-flex", marginBottom: 8 }} href="/examples/history28-fixture.json" download>下载模拟历史示例</a>
    <input type="file" accept=".json,application/json" aria-label="导入模拟历史包" onChange={e => { void load(e.target.files?.[0]); e.target.value = ""; }}/>
    {loading && <p role="status">正在校验历史版本…</p>}
    {error && <p role="alert" className="error-text">{error}{accepted && " 已保留上一份有效历史与查询。"}</p>}
    {accepted && <div className="history-view" data-history-id={accepted.data.digest}>
      <h3>{accepted.data.asset.id}</h3><p>{accepted.data.asset.currency} · {accepted.data.asset.adjustment} · 原生 {accepted.data.intervalMs / 60000} 分钟</p>
      <form onSubmit={e => { e.preventDefault(); query(); }} className="macro-filter">
        <label>回放截止（UTC）<input type="datetime-local" style={{ fontSize: 16, minWidth: 0 }} aria-label="历史回放截止 UTC" value={asOf} min={inputTime(accepted.data.range.from)} max={inputTime(accepted.data.range.cutoff)} onChange={e => setAsOf(e.target.value)}/></label>
        <button type="submit" className="btn" style={{ minHeight: 44 }} disabled={loading}>查询历史</button>
      </form>
      <HistoryResult replay={accepted.replay} research={accepted.research}/>
      <details><summary>已归档价格 · {bars.length} 根</summary>
        <p>仅列不晚于回放截止的完整记录；可查询不代表市场覆盖完整。共 {pages} 页，当前第 {page + 1} 页。</p>
        <ol className="macro-records">{bars.slice(page * 20, (page + 1) * 20).map(b => <li key={b.time}><time dateTime={new Date(b.time).toISOString()}>{utc(b.time)} 开盘</time><p className="numeric">O {b.open} · H {b.high} · L {b.low} · C {b.close}</p><small>内容修订 {b.version} · 此版本入库 {utc(b.receivedAt)}</small></li>)}</ol>
        <nav className="macro-pages" aria-label="历史价格分页"><button className="btn" disabled={!page} onClick={() => setPage(p => p - 1)}>上一页</button><button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>下一页</button></nav>
      </details>
      <p>覆盖未核实 · 模拟 session 不证明真实交易时段。刷新后需重新导入；不是长期保管。</p>
    </div>}
    <button className="btn" style={{ minHeight: 44 }} onClick={() => { if (panel.current) { panel.current.open = false; panel.current.querySelector("summary")?.focus(); } }}>返回实时 Radar</button>
  </details>;
}
