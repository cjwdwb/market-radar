"use client";
import { useMemo, useRef, useState } from "react";
import { parseFedView, queryFedView, VIEW_LIMIT, type FedView } from "@/lib/information/fed-view.mjs";

const day=(at:number)=>new Date(at).toISOString().slice(0,10);
const time=(at:number)=>new Date(at).toISOString().replace('T',' ').slice(0,19)+' UTC';
export function MacroTimeline(){
  const [view,setView]=useState<FedView|null>(null),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(0);
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  const generation=useRef(0);
  async function load(file:File|undefined){
    if(!file)return;const version=++generation.current;setLoading(true);setError('');setView(null);setPage(0);
    try{
      if(file.size>VIEW_LIMIT)throw Error('归档文件不能超过 1 MiB。');
      const next=await parseFedView(await file.text(),Date.now());if(version!==generation.current)return;
      setView(next);setFrom(day(next.range.from));setTo(day(next.range.cutoff-1));
    }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'无法读取归档。');}
    finally{if(version===generation.current)setLoading(false);}
  }
  const result=useMemo(()=>{
    if(!view)return null;
    for(const date of [from,to]){const at=Date.parse(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(at)||day(at)!==date||date<day(view.range.from)||date>day(view.range.cutoff-1))return null;}
    try{return queryFedView(view,{from:Math.max(Date.parse(from+'T00:00:00Z'),view.range.from),to:Math.min(Date.parse(to+'T00:00:00Z')+86400000,view.range.cutoff),page});}
    catch{return null;}
  },[view,from,to,page]);
  return <details className="panel macro-timeline"><summary>官方宏观资料 <span>本地归档</span></summary>
    <p>{view?'已载入本地归档 · 文件仅在本页读取':'导入公开视图文件后查看，不上传、不启动采集。'}</p>
    <input type="file" accept=".json,application/json" aria-label="导入官方宏观归档" onChange={event=>{void load(event.target.files?.[0]);event.target.value='';}}/>
    {loading&&<p role="status">正在检查归档…</p>}{error&&<p role="alert" className="error-text">{error}</p>}
    {view&&<div className="macro-view" data-view-id={view.viewId}>
      <p className="macro-notice">一般宏观资料 · 未在线重新核验。不关联个股，不解释价格原因。</p>
      <details className="macro-provenance"><summary>归档来源与时间说明</summary>
        <p>文件仅在本页读取，不上传、不启动采集；刷新页面后需重新导入。来源按文件记录展示，文件校验不证明官方签名。</p>
        <p>历史重建 · 当前取得版本。不是当时的在线观察，也不证明当时可知。</p>
        <p className="numeric">查询范围 {time(view.range.from)} — {time(view.range.cutoff)}（不含截止时刻）<br/>导出 {time(view.exportedAt)} · 数据修订 {view.readRevision}</p>
        <p>入库时间指本地首次接受该事实及此内容版本的时间，不代表来源最早公开或全系统最早收到。</p>
      </details>
      <div className="macro-filter"><label>起始日期（UTC）<input type="date" value={from} min={day(view.range.from)} max={day(view.range.cutoff-1)} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></label><label>结束日期（UTC）<input type="date" value={to} min={day(view.range.from)} max={day(view.range.cutoff-1)} onChange={e=>{setTo(e.target.value);setPage(0);}}/></label></div>
      {!result?<p role="alert">请选择归档范围内的有效日期，起始日期不能晚于结束日期。</p>:<>
        <p role="status">符合查询的归档记录 {result.total} 条 · 第 {result.page+1}/{result.pages} 页</p>
        <ol className="macro-records">{result.records.map(record=><li key={record.id}><time dateTime={new Date(record.publishedAt).toISOString()}>{time(record.publishedAt)} · {record.publicationPrecision==='minute'?'分钟':'秒'}精度</time><h3><a href={record.url} target="_blank" rel="noopener noreferrer">{record.title}<span className="sr-only">（官方原文，新窗口）</span></a></h3><details><summary>来源与时间记录</summary><p>Federal Reserve Board · 官方货币政策发布</p><p>首次入库 {time(record.firstReceivedAt)}<br/>此版本入库 {time(record.versionReceivedAt)}<br/>本地内容修订 {record.version}</p><p>保留原文链接，不推断利好、利空或价格原因。</p></details></li>)}</ol>
        {!result.total&&<p>这个区间内没有匹配的已归档记录，不代表没有官方发布。</p>}
        <nav className="macro-pages" aria-label="宏观归档分页"><button className="btn" disabled={!page} onClick={()=>setPage(p=>p-1)}>上一页</button><button className="btn" disabled={page+1>=result.pages} onClick={()=>setPage(p=>p+1)}>下一页</button></nav>
      </>}
      <p className="macro-coverage">仅覆盖取得的 RSS 快照，历史完整性未核实；不是九月全部公告或公司资讯。</p><p>{view.attribution}</p>
    </div>}
  </details>;
}
