"use client";
import { useEffect, useRef, useState } from "react";
import type { ReferenceCatalog, ReferenceQuery } from "@/lib/history/reference";

const date = (at: number) => new Date(at).toISOString().slice(0, 10);
const utc = (at: number) => new Date(at).toISOString().replace("T", " ");
const day = (v: string) => { const at = Date.parse(v + "T00:00:00Z"); if (!Number.isFinite(at) || date(at) !== v) throw Error("请选择有效的 UTC 日期。"); return at; };
type QueryCall = (body: { asset: string; from: number; cutoff: number; version: string }, signal: AbortSignal) => Promise<ReferenceQuery>;

/** 日频事实与分钟研究分别展示；失败保留带完整身份的上一份结果。 */
export function ReferenceHistory({ catalog, query }: { catalog: ReferenceCatalog; query: QueryCall }) {
  const first = catalog.series[0];
  const [asset, setAsset] = useState(first?.asset ?? "btc");
  const [from, setFrom] = useState(first ? date(first.range.from) : "2026-09-01");
  const [cutoff, setCutoff] = useState(first ? date(first.range.cutoff) : "2026-10-01");
  const [accepted, setAccepted] = useState<ReferenceQuery | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [acceptedInput, setAcceptedInput] = useState<string | null>(null);
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  const selected = catalog.series.find(s => s.asset === asset);
  function cancel() { generation.current++; controller.current?.abort(); setBusy(false); }
  async function load(pageFrom?: number) {
    cancel(); const id = generation.current; controller.current = new AbortController(); setBusy(true); setError("");
    try {
      if (!selected) throw Error("这个资产尚未取得日频数据。");
      const queryFrom=pageFrom??day(from),queryCutoff=day(cutoff);
      const result = await query({ asset, from: queryFrom, cutoff: queryCutoff, version: selected.version }, controller.current.signal);
      if (id !== generation.current) return;
      if (result.format !== "coinmetrics-reference-slice-v1" || result.series.providerId !== asset || result.version !== selected.version || result.identity !== catalog.identity || result.points.length > 31 || result.queryRange.from!==queryFrom || result.queryRange.cutoff!==queryCutoff || result.page && (result.page.from!==queryFrom || result.page.cutoff!==Math.min(queryCutoff,queryFrom+31*86400000) || result.page.nextFrom!==(result.page.cutoff<queryCutoff?result.page.cutoff:null))) throw Error("日频查询身份或版本不一致。");
      setAccepted(result);setAcceptedInput([asset,from,cutoff].join(":"));
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "查询未完成。"); }
    finally { if (id === generation.current) setBusy(false); }
  }
  const changed = acceptedInput !== null && acceptedInput !== [asset,from,cutoff].join(":");
  return <details className="reference-history" onToggle={e => { if (e.target === e.currentTarget && !e.currentTarget.open) cancel(); }}>
    <summary>日频参考价格 · {catalog.identity === "fixture" ? "模拟验证" : "真实来源归档"}</summary>
    <p>Coin Metrics 聚合 USD 日终参考价，非交易所 USDT K 线。日期按 UTC；每个值对应次日 00:00 的日终边界。</p>
    <p>当前批次 {catalog.batch}：{catalog.series.map(s => s.asset.toUpperCase() + " " + s.count + "/" + s.coverage.expectedDates + " 日").join(" · ") || "尚无成功取得的序列"}。日格有值不等于价格准确或历史当时可知。</p>
    {selected && <p>可查询日期 {date(selected.range.from)} 至 {date(selected.range.cutoff)}（不含）；来源缺失 {selected.coverage.gapCount??selected.coverage.missing.length} 日{selected.coverage.notBackfilledCount!==undefined&&`，尚未回补 ${selected.coverage.notBackfilledCount} 日`}。每页最多 31 日，翻页保持同一读取版本。</p>}
    <form className="macro-filter" onSubmit={e => { e.preventDefault(); void load(); }}>
      <label>日频资产<select aria-label="日频资产" value={asset} onChange={e => { cancel(); setAsset(e.target.value as "btc" | "eth"); }}>{catalog.series.map(s => <option key={s.asset} value={s.asset}>{s.asset.toUpperCase()} / USD · 1d</option>)}</select></label>
      <label>日期起点 UTC<input type="date" aria-label="日频日期起点" value={from} min={selected && date(selected.range.from)} max={selected && date(selected.range.cutoff - 86400000)} onChange={e => { cancel(); setFrom(e.target.value); }}/></label>
      <label>截止日期（不含）UTC<input type="date" aria-label="日频日期截止" value={cutoff} min={selected && date(selected.range.from + 86400000)} max={selected && date(selected.range.cutoff)} onChange={e => { cancel(); setCutoff(e.target.value); }}/></label>
      <button className="btn" type="submit" disabled={busy || !selected}>查询日频价格</button>
    </form>
    {busy && <p role="status">正在读取固定版本… <button className="btn" onClick={cancel}>取消日频查询</button></p>}
    {error && <p role="alert" className="error-text">{error} 上一份有效结果保持不变。</p>}
    {accepted && <div className="reference-result" data-reference-asset={accepted.series.providerId}>
      <h3>{accepted.series.providerId.toUpperCase()} / USD · 日终参考价</h3>
      <p>显示范围 {date(accepted.page?.from??accepted.queryRange.from)} 至 {date(accepted.page?.cutoff??accepted.queryRange.cutoff)}（不含）· UTC。{changed && "输入已改变；这里仍是上次成功查询的结果。"}</p>
      <p>{accepted.provenance.responseDigests?"读取版本所用响应最晚取得于 ":"取得于 "}{utc(accepted.provenance.receivedAt)}；后来取得的当前版本历史重算，不能证明当时已知。{accepted.identity === "fixture" && "这些记录是模拟数据。"}</p>
      {accepted.page && <div className="macro-filter" aria-label="日频分页"><button className="btn" disabled={busy||changed||accepted.page.from<=day(from)} onClick={()=>void load(Math.max(day(from),accepted.page!.from-31*86400000))}>上一页日频</button><button className="btn" disabled={busy||changed||accepted.page.nextFrom===null} onClick={()=>void load(accepted.page!.nextFrom!)}>下一页日频</button><span>截止 {date(accepted.queryRange.cutoff)}（不含）；读取版本不变</span></div>}
      {accepted.derivation && <p>本次离线提取 {utc(accepted.derivation.derivedAt)}；复用 {accepted.derivation.parentBatch} 已取得文件，新增网络请求 0。原 CSV 九月批次的缺口记录仍保留。</p>}
      <details><summary>覆盖、版本与限制</summary>
        <p>覆盖核对范围 {date(accepted.coverageRange.from)} 至 {date(accepted.coverageRange.cutoff)}（不含），{accepted.coverage.presentValues}/{accepted.coverage.expectedDates} 日有值，缺失 {accepted.coverage.missing.length} 日。</p>
        <ul>{accepted.coverage.missing.map(m => <li key={m.sourceDate}>{m.sourceDate}：{m.reason === "missing_value" ? "来源价格为空" : m.reason === "not_backfilled" ? "尚未回补" : "来源缺少日期"}</li>)}</ul>
        <p>读取版本 {accepted.version}；来源 {accepted.provenance.transport === "community_api" ? "官方 Community API · 响应版本见 SHA256" : "Git " + accepted.provenance.commit}。</p>
        <p>{accepted.provenance.responseDigests?"该读取版本的响应集合摘要":"原始来源响应 SHA256"} {accepted.provenance.sha256}。校验和用于完整性检查，不证明发布者真实性。首次发布时间未知，不具备严格历史时点版本。</p>
      </details>
      <p>不支持 Short90m、Medium180m 或 forward30m 分钟方法；此处不生成状态、信号或预测。</p>
      <ol className="macro-records">{accepted.points.map(p => <li key={p.sourceDate}><time dateTime={p.sourceDate}>{p.sourceDate}</time><p className="numeric">USD {p.price}</p><small>证据截止 {utc(p.evidenceEndAt)}</small>{p.sourceVersion&&<details><summary>这条记录的来源版本</summary><p>首次取得 {utc(p.firstReceivedAt!)}；当前版本取得 {utc(p.versionReceivedAt!)}。</p><p>原始响应 SHA256 {p.sourceVersion}</p></details>}</li>)}</ol>
      {!accepted.points.length && <p>选定范围内没有有效日频值；不填零。</p>}
    </div>}
    <p>Data: <a href="https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data" target="_blank" rel="noreferrer">Coin Metrics</a> · <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">CC BY-NC 4.0</a>。仅提取日期与 PriceUSD、按批准日期范围筛选；来源不提供担保。免费非商业展示，许可权利与本站代码许可分开。</p>
  </details>;
}
