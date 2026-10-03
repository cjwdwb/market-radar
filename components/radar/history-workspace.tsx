"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PACKAGE_LIMIT, parseHistoryPackage, type HistoryPackage } from "@/lib/history/package";
import { replayHistory, researchHistory, type HistoryReplay, type HistoryResearch } from "@/lib/history/replay";
import { historyNavigation, type ArchiveAnalysis, type ArchiveCatalog, type ArchiveSelection, type ArchiveSeries, type ArchivePricePage } from "@/lib/history/query";
import { HistoryResult } from "./history-result";
import { HistoryNavigation } from "./history-navigation";
import { ReferenceHistory } from "./reference-history";
import { PublishedReferenceHistory } from "./published-reference-history";
import type { ReferenceCatalog, ReferenceQuery } from "@/lib/history/reference";

const inputTime = (at: number) => new Date(at).toISOString().slice(0, 16);
const utc = (at: number) => new Date(at).toISOString().replace("T", " ");
const parseTime = (value: string) => { const at = Date.parse(value + ":00Z"); if (!Number.isFinite(at) || inputTime(at) !== value) throw Error("请选择有效 UTC 时间。"); return at; };
const subscribe = () => () => {};
const localHost = () => location.hostname === "127.0.0.1";
type Accepted = { mode: "file"; data: HistoryPackage; replay: HistoryReplay; research: HistoryResearch } | { mode: "archive"; analysis: ArchiveAnalysis };
// 文件I/O与取时只在用户操作路径执行；组件render只读取已接受结果。
function replayFile(data: HistoryPackage, at: number): Extract<Accepted, { mode: "file" }> {
  const now = Date.now();
  return { mode: "file", data, replay: replayHistory(data, at, now), research: researchHistory(data, at, now) };
}
async function importFile(file: File) {
  if (file.size > PACKAGE_LIMIT) throw Error("历史文件不能超过 2 MiB。");
  const data = await parseHistoryPackage(await file.text(), Date.now());
  return data;
}
type SavedRecord = { id: string; identity: string; question: string; correctionOf: string | null; registeredAt: number; inputCutoff: number; targetEnd: number | null; series: string; snapshot: string; outcomes: { id: string; status: string; evaluatedAt: number; returnPercent: number | null }[] };

/** 已接受结果与正在编辑的请求分离；失败和旧响应不能把旧事实标成新选择的成功。 */
export function HistoryWorkspace() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const isLocal = useSyncExternalStore(subscribe, localHost, () => false);
  const [accepted, setAccepted] = useState<Accepted | null>(null), [mode, setMode] = useState<"file" | "archive">("file");
  const [asOf, setAsOf] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false), [page, setPage] = useState(0);
  const [catalog, setCatalog] = useState<(ArchiveCatalog & { reference?: ReferenceCatalog | null }) | null>(null), [seriesKey, setSeriesKey] = useState("");
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [keyInput, setKeyInput] = useState("");
  const [question, setQuestion] = useState("观察随后 30 分钟的区间变化"), [correctionOf, setCorrectionOf] = useState<string | null>(null);
  const [records, setRecords] = useState<SavedRecord[]>([]), [nextRecords, setNextRecords] = useState<number | null>(null), [notice, setNotice] = useState("");
  const generation = useRef(0), controller = useRef<AbortController | null>(null), sessionKey = useRef(""), panel = useRef<HTMLDetailsElement>(null);
  const pendingRegistration = useRef<{ intent: string; key: string } | null>(null), pendingAction = useRef<"read" | "write" | null>(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); sessionKey.current = ""; }, []);
  function invalidate() { generation.current++; controller.current?.abort(); if (pendingAction.current === "write") setNotice("已停止等待；登记或核验可能已保存，请读取记录核对。"); pendingAction.current = null; setLoading(false); }
  function begin(action: "read" | "write" = "read") { controller.current?.abort(); controller.current = new AbortController(); pendingAction.current = action; const id = ++generation.current; setLoading(true); setError(""); setNotice(""); return { id, signal: controller.current.signal }; }
  function failed(id: number, e: unknown) { if (id === generation.current) setError(e instanceof Error ? e.message : "本地历史操作失败。"); }
  function end(id: number) { if (id === generation.current) { pendingAction.current = null; setLoading(false); } }
  async function call<T>(action: string, body: unknown, signal: AbortSignal, key = sessionKey.current): Promise<T> {
    if (!localHost()) throw Error("数据库查询仅在显式启动的本地工作台使用。");
    const response = await fetch(`/__archive/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Archive-Key": key }, body: JSON.stringify(body), signal, cache: "no-store" });
    const text = await response.text(); if (text.length > 1024 * 1024) throw Error("本地响应超出限制。");
    let data; try { data = JSON.parse(text); } catch { throw Error("本地归档服务未连接，已有结果保持不变。"); }
    if (!response.ok) throw Error(`本地操作未完成：${data.error ?? response.status}`);
    return data as T;
  }
  function draftSeries(series: ArchiveSeries) { setSeriesKey(series.key); setFrom(inputTime(series.firstOpenAt)); setTo(inputTime(series.lastCloseAt)); setAsOf(inputTime(series.lastCloseAt)); }
  async function connect() {
    const job = begin();
    try {
      const data = await call<ArchiveCatalog & { reference?: ReferenceCatalog | null }>("catalog", {}, job.signal, keyInput);
      if (job.id !== generation.current) return;
      if (data.format !== "archive-catalog-v1" || !Array.isArray(data.series) || data.series.length > 100) throw Error("归档目录格式无效。");
      sessionKey.current = keyInput; setKeyInput(""); setCatalog(data); setMode("archive"); setRecords([]); setNextRecords(null);
      if (data.series[0]) draftSeries(data.series[0]); else setNotice(data.reference ? "已连接日频参考价；下方日频入口可查询，分钟研究保持独立。" : "快照中没有已准入的价格序列；现有宏观信息不能代替价格历史。");
    } catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  function draft(at = parseTime(asOf)): ArchiveSelection { if (!catalog) throw Error("请先连接本地归档。"); return { snapshot: catalog.snapshot, series: seriesKey, from: parseTime(from), to: parseTime(to), asOf: at }; }
  async function queryArchive(at?: number) {
    const job = begin();
    try {
      const analysis = await call<ArchiveAnalysis>("query", { selection: draft(at) }, job.signal);
      if (job.id !== generation.current) return;
      if (analysis.format !== "archive-analysis-v1") throw Error("历史查询格式无效。");
      setAccepted({ mode: "archive", analysis }); setPage(0);
    } catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  async function handleImport(file: File | undefined) {
    if (!file) return; const job = begin();
    try {
      const data = await importFile(file); if (job.id !== generation.current) return;
      const at = data.bars.at(-1)!.time + data.intervalMs;
      setAccepted(replayFile(data, at));
      setMode("file"); setAsOf(inputTime(at)); setPage(0);
    } catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  function handleQuery(at?: number) {
    if (mode === "archive") { void queryArchive(at); return; }
    if (accepted?.mode !== "file") return;
    invalidate();
    try { const time = at ?? parseTime(asOf); setAccepted(replayFile(accepted.data, time)); setPage(0); setError(""); }
    catch { setError("请选择归档范围内的有效 UTC 时间，已有结果保持不变。"); }
  }
  async function prices(cursor: string | null, nextPage: number) {
    if (accepted?.mode !== "archive") return;
    const current = accepted, job = begin();
    try { const prices = await call<ArchivePricePage>("prices", { selection: current.analysis.selection, cursor }, job.signal); if (job.id === generation.current) { setAccepted({ mode: "archive", analysis: { ...current.analysis, prices } }); setPage(nextPage); } }
    catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  async function readRecords(offset = 0) {
    const job = begin();
    try { const data = await call<{ records: SavedRecord[]; nextOffset: number | null }>("records", { offset }, job.signal); if (job.id === generation.current) { setRecords(data.records); setNextRecords(data.nextOffset); } }
    catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  async function save(recordMode: "historical" | "prospective") {
    if (accepted?.mode !== "archive") return;
    const intent = JSON.stringify([recordMode, question, correctionOf, accepted.analysis.selection]);
    if (pendingRegistration.current?.intent !== intent) pendingRegistration.current = { intent, key: crypto.randomUUID() };
    const requestKey = pendingRegistration.current.key, job = begin("write");
    try {
      const result = await call<{ id: string }>("register", { selection: accepted.analysis.selection, requestKey, mode: recordMode, question, correctionOf }, job.signal);
      if (job.id === generation.current) { pendingRegistration.current = null; setNotice(`已保存${recordMode === "prospective" ? "模拟前瞻登记（结果待到期核验）" : "模拟历史研究"}：${result.id}`); setCorrectionOf(null); }
    } catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  async function evaluate(id: string) {
    const job = begin("write");
    try { const result = await call<{ status: string }>("evaluate", { id }, job.signal); if (job.id === generation.current) setNotice(result.status === "pending" ? "尚未到期：pending，没有写入提前结果。" : result.status === "unavailable" ? "已追加结果不可得记录；原登记保留。" : "已追加当前结果快照的观察结果；原登记保留。"); }
    catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  async function reproduce(id: string) {
    const job = begin();
    try {
      const record = await call<{ selection: ArchiveSelection }>("record", { id }, job.signal);
      const analysis = await call<ArchiveAnalysis>("query", { selection: record.selection }, job.signal);
      if (job.id !== generation.current) return;
      setAccepted({ mode: "archive", analysis }); setMode("archive"); setSeriesKey(analysis.series.key); setFrom(inputTime(analysis.selection.from)); setTo(inputTime(analysis.selection.to)); setAsOf(inputTime(analysis.requestedAt)); setPage(0); setNotice("已按保存的同一快照与范围重新计算；计算时间为本次时间。");
    } catch (e) { failed(job.id, e); } finally { end(job.id); }
  }
  const replay = accepted?.mode === "file" ? accepted.replay : accepted?.analysis.replay;
  const research = accepted?.mode === "file" ? accepted.research : accepted?.analysis.research;
  const activeSeries = catalog?.series.find(s => s.key === seriesKey);
  const draftTime = Date.parse(asOf + ":00Z");
  const requested = Number.isFinite(draftTime) && inputTime(draftTime) === asOf ? draftTime : null;
  const sameDraft = accepted?.mode === "archive" && mode === "archive" && accepted.analysis.selection.snapshot === catalog?.snapshot && accepted.analysis.selection.series === seriesKey && inputTime(accepted.analysis.selection.from) === from && inputTime(accepted.analysis.selection.to) === to && accepted.analysis.requestedAt === requested;
  const navigation = mode === "file" && accepted?.mode === "file" && requested !== null ? historyNavigation(accepted.data.bars, accepted.data.intervalMs, requested) : sameDraft && accepted?.mode === "archive" ? accepted.analysis.navigation : { previous: null, next: null, suggested: null, displayedAt: null };
  const bounds = mode === "archive" && activeSeries ? { from: activeSeries.firstOpenAt, cutoff: catalog!.createdAt } : accepted?.mode === "file" ? accepted.data.range : null;
  const fileBars = accepted?.mode === "file" ? accepted.data.bars.filter(b => b.time + accepted.data.intervalMs <= accepted.replay.asOf) : [];
  const displayedBars = accepted?.mode === "archive" ? accepted.analysis.prices.records : fileBars.slice(page * 20, (page + 1) * 20), pages = Math.max(1, Math.ceil(fileBars.length / 20));
  function leave() { invalidate(); if (panel.current) { panel.current.open = false; panel.current.querySelector("summary")?.focus(); } }
  return <details ref={panel} onToggle={e => { if (e.target === e.currentTarget) setHistoryOpen(e.currentTarget.open); }} className="panel macro-timeline history-workspace" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <summary>历史回放与研究 <span>独立于实时</span></summary>
    <p>按固定版本查看历史。分钟回放与研究仍为模拟数据；已连接的真实日频参考价在独立入口展示，不参与分钟方法。查询不会启动采集。</p>
    {historyOpen && !catalog?.reference && <PublishedReferenceHistory/>}
    {isLocal && <details className="history-connect"><summary>连接本地归档数据库</summary><p>先显式启动本地查询服务。使用独立本地会话密钥，仅在本页内存保留；网站访问码不授予数据库权限。</p>
      <form className="macro-filter" onSubmit={e => { e.preventDefault(); void connect(); }}><label>本地会话密钥<input type="password" autoComplete="off" value={keyInput} onChange={e => { invalidate(); setKeyInput(e.target.value); }} aria-label="本地归档会话密钥"/></label><button className="btn" type="submit" disabled={loading || !keyInput}>连接归档</button></form>
    </details>}
    {catalog?.reference && <ReferenceHistory key={JSON.stringify(catalog.reference)} catalog={catalog.reference} query={(body, signal) => call<ReferenceQuery>("reference-query", body, signal)}/>}
    <a className="btn" style={{ minHeight: 44, display: "inline-flex", marginBottom: 8 }} href="/examples/history28-fixture.json" download>下载模拟历史示例</a>
    <input type="file" accept=".json,application/json" aria-label="导入模拟历史包" onChange={e => { void handleImport(e.target.files?.[0]); e.target.value = ""; }}/>
    {catalog && catalog.series.length > 0 && <div className="history-controls"><p>{catalog.limitation}</p><label>归档序列（资产 / 原生周期）<select aria-label="归档序列" value={seriesKey} onChange={e => { invalidate(); const s = catalog.series.find(s => s.key === e.target.value); if (s) { draftSeries(s); setMode("archive"); } }}>{catalog.series.map(s => <option key={s.key} value={s.key}>{s.asset.id} · {s.intervalMs / 60000} 分钟</option>)}</select></label>
      {activeSeries && <p>本快照记录：{utc(activeSeries.firstOpenAt)} — {utc(activeSeries.lastCloseAt)} · {activeSeries.records} 根。首尾不证明区间无缺口。</p>}
      <div className="macro-filter"><label>范围起点 UTC<input type="datetime-local" aria-label="历史范围起点 UTC" value={from} onChange={e => { invalidate(); setMode("archive"); setFrom(e.target.value); }}/></label><label>范围截止 UTC<input type="datetime-local" aria-label="历史范围截止 UTC" value={to} onChange={e => { invalidate(); setMode("archive"); setTo(e.target.value); }}/></label></div>
    </div>}
    {catalog && mode === "file" && <button className="btn" onClick={() => { invalidate(); setMode("archive"); if (activeSeries) draftSeries(activeSeries); }}>切回已连接归档</button>}
    {bounds && <HistoryNavigation value={asOf} minimum={bounds.from} maximum={bounds.cutoff} busy={loading} previous={navigation.previous} next={navigation.next} suggested={navigation.suggested} requestedAt={replay?.asOf ?? null} displayedAt={accepted?.mode === "archive" ? accepted.analysis.displayedAt : replay?.horizons.some(h => h.reason !== "missing_endpoint") ? replay?.asOf ?? null : null} onChange={v => { invalidate(); setAsOf(v); }} onQuery={() => handleQuery()} onChoose={at => { setAsOf(inputTime(at)); handleQuery(at); }}/>}
    {loading && <p role="status">正在校验或查询历史版本… <button className="btn" onClick={() => { const writing = pendingAction.current === "write"; invalidate(); if (!writing) setNotice("已取消本次操作；上一份结果保留。"); }}>停止等待</button></p>}
    {error && <p role="alert" className="error-text">{error}{accepted && " 已保留上一份有效历史与查询。"}</p>}
    {notice && <p role="status">{notice}</p>}
    {accepted && replay && research && <div className="history-view" data-history-id={accepted.mode === "file" ? accepted.data.digest : replay.digest}>
      <h3>{replay.asset}</h3><p>{accepted.mode === "file" ? accepted.data.asset.currency : accepted.analysis.series.asset.currency} · {accepted.mode === "file" ? accepted.data.asset.adjustment : accepted.analysis.series.asset.adjustment}</p><p className="history-current-context">当前显示结果：{replay.asset} · 原生 {replay.intervalMs / 60000} 分钟 · {utc(replay.asOf)} · 修订 {replay.readRevision}。{(accepted.mode === "archive" ? !sameDraft : mode !== "file" || requested !== replay.asOf) && "输入已变化；这里仍是上次成功请求的结果。"}</p>
      {accepted.mode === "archive" && <details><summary>覆盖、检索范围与限制</summary><p>固定快照 {accepted.analysis.selection.snapshot} · 取得 {utc(accepted.analysis.snapshotCreatedAt)}</p><p>请求开盘范围 {utc(accepted.analysis.selection.from)} — {utc(accepted.analysis.selection.to)}（完整收盘可等于截止）。</p><p>研究遍历：{accepted.analysis.scan.status} · {accepted.analysis.scan.rows} 根 · 已检查至 {utc(accepted.analysis.scan.checkedTo)} · {accepted.analysis.scan.reason ?? "仅证明该快照查询已遍历，不证明市场完整覆盖"}</p><p>已见间隔缺口 {accepted.analysis.scan.gapCount}；原因未核实，不自动认定为休市。边界预热不足时需显式扩大范围；不插值。</p>{accepted.analysis.scan.gaps.map(g => <p key={g.from}>{utc(g.from)} — {utc(g.to)}</p>)}<p>日线/小时、历史相对表现、对齐与变化比较尚未支持。current-vintage 不证明当时可知。</p></details>}
      <HistoryResult replay={replay} research={research}/>
      <details><summary>已归档价格 · {accepted.mode === "file" ? `${fileBars.length} 根` : "有界查询页"}</summary><p>仅列完整记录；可查询不代表市场覆盖完整。当前第 {page + 1} 页{accepted.mode === "file" ? `，共 ${pages} 页` : "，每页最多 100 根"}。</p>
        <ol className="macro-records">{displayedBars.map(b => <li key={b.time}><time dateTime={new Date(b.time).toISOString()}>{utc(b.time)} 开盘</time><p className="numeric">O {b.open} · H {b.high} · L {b.low} · C {b.close}</p><small>内容修订 {b.version} · 此版本入库 {utc(b.receivedAt)}</small></li>)}</ol>
        <nav className="macro-pages" aria-label="历史价格分页">{accepted.mode === "file" ? <><button className="btn" disabled={!page} onClick={() => setPage(p => p - 1)}>上一页</button><button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>下一页</button></> : <><button className="btn" disabled={loading || !page} onClick={() => void prices(null, 0)}>回到第一页</button><button className="btn" disabled={loading || !accepted.analysis.prices.nextCursor} onClick={() => { if (accepted.mode === "archive") void prices(accepted.analysis.prices.nextCursor, page + 1); }}>下一页</button></>}</nav>
      </details>
      <p>覆盖未核实 · 模拟 session 不证明真实交易时段。{accepted.mode === "file" ? "文件刷新后需重新导入；不是长期保管。" : "查询仅驻留当前有界页面；正式长期保管条件仍待落实。"}</p>
      {accepted.mode === "archive" && <details><summary>保存研究 / 登记前瞻观察</summary><p>模拟历史研究与事前登记分开。登记不是上涨预测；未到期 pending，到期缺数据 unavailable，不填零。</p><label>研究问题<input aria-label="研究问题" maxLength={500} value={question} onChange={e => setQuestion(e.target.value)}/></label>{correctionOf && <p>关联更正：{correctionOf}（原记录保留）<button className="btn" onClick={() => setCorrectionOf(null)}>取消关联</button></p>}<div className="macro-pages"><button className="btn" disabled={loading || !sameDraft || !question.trim()} onClick={() => void save("historical")}>保存本次研究</button><button className="btn" disabled={loading || !sameDraft || !question.trim()} onClick={() => void save("prospective")}>登记前瞻观察</button></div></details>}
    </div>}
    {catalog && catalog.series.length > 0 && <details className="history-records"><summary>本地研究记录</summary><p>所有记录为明确模拟身份，不代表真实观察、真实成熟结果或预测有效性。到期核验需手动进行；新数据需操作者打开新快照并复用同一账本。</p><div className="macro-pages"><button className="btn" disabled={loading} onClick={() => void readRecords()}>读取记录</button><button className="btn" disabled={loading || nextRecords === null} onClick={() => { if (nextRecords !== null) void readRecords(nextRecords); }}>下一组记录</button></div>
      <ol className="macro-records">{records.map(r => <li key={r.id}><strong>{r.question}</strong><p>{r.series} · {r.identity} · 登记 {utc(r.registeredAt)} · 输入截止 {utc(r.inputCutoff)}</p><p>{r.correctionOf ? `关联原记录 ${r.correctionOf}` : "独立登记"} · 快照 {r.snapshot}</p>{r.targetEnd && <p>结果截止 {utc(r.targetEnd)} · 尚无结果时不代表成功或失败。</p>}{r.outcomes.map(o => <p key={o.id}>结果 {o.status} · 核验 {utc(o.evaluatedAt)}{o.returnPercent === null ? " · 结果不可得" : ` · 区间收益 ${o.returnPercent}%`}</p>)}<div className="macro-pages"><button className="btn" disabled={loading || r.snapshot !== catalog.snapshot} onClick={() => void reproduce(r.id)}>按原快照重算</button><button className="btn" disabled={loading} onClick={() => { setCorrectionOf(r.id); setQuestion(r.question); setNotice("已选择关联原记录；请在当前成功查询下提交新记录。"); }}>关联更正</button>{r.identity === "fixture_prospective" && <button className="btn" disabled={loading} onClick={() => void evaluate(r.id)}>手动核验到期结果</button>}</div></li>)}</ol>
    </details>}
    <div className="macro-pages"><button className="btn" onClick={leave}>返回实时 Radar</button><a className="btn" style={{ minHeight: 44 }} href="#price-chart" onClick={leave}>返回实时图表</a></div>
  </details>;
}
