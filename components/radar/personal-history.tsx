"use client";
import { useEffect, useId, useRef, useState } from "react";
import { parsePersonalHistory, type PersonalHistory } from "@/lib/ai/personal-history-contract";
import { ClaimText, Disclosures, Evidence } from "./ai-interpretation";

const time = (at: number) => new Date(at).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const messages: Record<string, string> = {
  saved_result_invalid: "文件格式、资产身份或引用关联不符合个人解释格式。",
  saved_result_unavailable: "文件暂时不可读，请重新选择本地解释文件。",
  file_too_large: "解释文件不能超过64KiB；请使用导出的显示文件，不要选择原始数据包。",
  retention_review_required: "这份记录已到保存复核日期，请先复核私人资料的保存范围。",
  timeout: "文件读取超时，可重新选择；没有上传或调用模型。",
};

/** 与实时选中资产、解释派发和历史回放状态隔离，只读已有记录。 */
export function PersonalHistoryPanel() {
  const [result, setResult] = useState<PersonalHistory | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const instance = useId(), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { generation.current++; clearTimeout(timer.current); }, []);
  function cancel() { generation.current++; clearTimeout(timer.current); setBusy(false); setError("读取已取消，文件没有上传。"); }
  function clear() { generation.current++; clearTimeout(timer.current); setBusy(false); setError(""); setResult(null); }
  async function read(file: File) {
    const current = ++generation.current; clearTimeout(timer.current); setBusy(true); setError("");
    timer.current = setTimeout(() => { if (current === generation.current) { generation.current++; setBusy(false); setError(messages.timeout); } }, 8000);
    try {
      if (!file.size || file.size > 65536) throw Error("file_too_large");
      const bytes = await file.arrayBuffer(); if (bytes.byteLength > 65536) throw Error("file_too_large");
      let payload; try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw Error("saved_result_invalid"); }
      let next; try { next = parsePersonalHistory(payload); } catch { throw Error("saved_result_invalid"); }
      if (Date.now() >= next.retentionReviewAt) throw Error("retention_review_required");
      if (current === generation.current) { setResult(next); setRevision(value => value + 1); }
    } catch (e) {
      if (current === generation.current) { const code = e instanceof Error ? e.message : "saved_result_unavailable"; setError(messages[code] ?? messages.saved_result_unavailable); if (code === "retention_review_required") setResult(null); }
    } finally { if (current === generation.current) { clearTimeout(timer.current); setBusy(false); } }
  }
  const scope = `${instance}-personal-${result?.catalogId ?? "empty"}-${revision}`;
  return <section className="ai-interpretation personal-history" aria-label="个人历史 AI 解释" id="personal-history-ai">
    <div className="ai-body"><h3>已保存的个人解释</h3><p>{result ? "只在本页读取 · 不上传、不调用模型 · 刷新后清除" : "选择个人研究导出的解释文件，核对原快照与依据。仅在本页内存读取，不上传、不重新生成、不消耗模型额度；刷新后需重新选择。"}</p>
      <input ref={fileInput} id={instance+"-file"} type="file" hidden aria-label="选择解释文件" accept=".json,application/json" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) void read(file); }}/>
      <div className="ai-actions"><button type="button" className={result ? "btn" : "btn btn-primary"} onClick={() => fileInput.current?.click()}>{result ? "更换文件" : "选择解释文件"}</button>{busy && <><span role="status">正在读取本地文件…</span><button className="btn" onClick={cancel}>取消读取</button></>}{(result || busy) && <button className="btn" onClick={clear}>清除本页记录</button>}<a className="btn" href="#price-chart">返回实时图表</a></div>
      {error && <p role="status" className="ai-feedback">{error}{result ? " 下方仍为上次读取的固定BTC历史记录，不是本次读取成功。" : ""}</p>}
      {result && <section key={scope} className="ai-result" data-evidence-scope={scope} aria-label="个人历史解释结果">
        <div className="ai-result-heading"><strong id={scope+"-heading"} tabIndex={-1}>BTC / USDT · 历史解释 · 仅个人研究</strong><small>文件声明：DeepSeek / deepseek-flash</small></div>
        <p>本页仅校验文件格式与引用关联，未向服务端验证原始数据、模型调用或文件来源。</p>
        <p className="ai-summary">历史截止 {time(result.context.asOf)}</p>
        <p>原生 15 分钟 · 历史重算，非实时行情或当时在线观察。切换实时资产不会改变这份 BTC 记录。</p>
        <ul aria-label="模型选择的重点">{result.modelSelection.sentences.map(c => <li key={c.claimId}><ClaimText claim={c} scope={scope} /></li>)}</ul>
        <Disclosures result={result} scope={scope}/>
        <details><summary>同一快照：程序摘要与模型选择</summary>
          <section className="ai-comparison" aria-label="A 程序摘要"><h4>程序摘要</h4><ul>{result.baseline.sentences.map(c => <li key={c.claimId}><ClaimText claim={c} scope={scope} /></li>)}</ul><p>{result.baseline.rationale}</p></section>
          <section className="ai-comparison" aria-label="B 模型选择"><h4>模型选择与顺序</h4><ul>{result.modelSelection.sentences.map(c => <li key={c.claimId}><ClaimText claim={c} scope={scope} /></li>)}</ul><p>只由模型选择固定事实编号与顺序，未重新计算指标。</p></section>
          <section className="ai-comparison" aria-label="C 最终呈现"><h4>系统补齐后的呈现</h4><p>上述选择加下方全部系统披露；系统补齐不计入模型贡献。</p></section>
        </details>

        <Evidence context={result.context} scope={scope}/>
        <details><summary>文件声明的来源、时间与版本</summary><p>Binance Vision · SPOT · BTCUSDT · USDT · 15m / UTC · CC BY-NC-SA 4.0</p><p>计算 {time(result.context.capturedAt)} · 模型回复 {time(result.generatedAt)}</p><p>保存复核 {time(result.retentionReviewAt)}，不代表后台自动删除。</p><p>身份 {result.inputIdentity} / {result.reconstruction} / {result.vintage}</p><p>规则 {result.context.ruleVersion} · 目录 {result.catalogId}</p><p>协议 {result.versions.output} · 数据 {result.context.evidence[0].dataVersion}</p><p>文件记录的事实选择 / 组织 / 披露：PASS；价值：{result.modelValue}。这些是原记录声明，不是本页重新验收。</p></details>
      </section>}
    </div>
  </section>;
}
