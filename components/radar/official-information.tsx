"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {OFFICIAL_LIMIT,OFFICIAL_SOURCES,officialSource,parseOfficialView,queryOfficialView,type OfficialView} from "@/lib/information/official.mjs";
const time=(at:number)=>new Date(at).toISOString().replace('T',' ').slice(0,19)+' UTC';
export function OfficialInformation({symbol}:{symbol?:string}){
 const [view,setView]=useState<OfficialView|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[mode,setMode]=useState('context'),[page,setPage]=useState(0),[checkedAt,setCheckedAt]=useState(0);
 const generation=useRef(0),attempted=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
 // 换资产只改变本地筛选，不产生新请求；页码随身份重置。
 const selection=mode==='context'?(symbol??'all'):mode;
 const [pageIdentity,setPageIdentity]=useState(selection);
 if(pageIdentity!==selection){setPageIdentity(selection);setPage(0);}
 const result=useMemo(()=>view?queryOfficialView(view,{symbol:mode==='context'?symbol:undefined,category:['crypto','company'].includes(mode)?mode:'all',page:pageIdentity===selection?page:0}):null,[view,symbol,mode,page,pageIdentity,selection]);
 async function load(){
  attempted.current=true;controller.current?.abort();const request=new AbortController();controller.current=request;const version=++generation.current;setLoading(true);setError('');
  try{
   const r=await fetch('/api/asset-information',{signal:request.signal,cache:'no-store'});if(!r.ok)throw Error('资料暂时无法读取，请稍后重试。');const reader=r.body?.getReader();if(!reader)throw Error('资料响应为空。');
   const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>OFFICIAL_LIMIT)throw Error('资料超出读取上限。');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const next=await parseOfficialView(new TextDecoder('utf-8',{fatal:true}).decode(bytes),Date.now());if(generation.current===version){setView(next);setPage(0);setCheckedAt(Date.now());}
  }catch(e){if(generation.current===version)setError(e instanceof Error?e.message:'资料暂不可用。');}
  finally{if(generation.current===version){setLoading(false);controller.current=null;}}
 }
 function cancel(){generation.current++;controller.current?.abort();controller.current=null;setLoading(false);setError('已停止等待。');}
 return <details className="panel official-information macro-timeline" onToggle={e=>{if(e.target!==e.currentTarget)return;if(e.currentTarget.open){setCheckedAt(Date.now());if(!attempted.current)void load();}}}>
  <summary>项目与公司更新 <span>{view?'官方版本资料':'打开查看'}</span></summary>
  <p>币圈客户端与公司开源产品的发布记录。不是财报、媒体新闻或买卖信号。</p>
  <label className="information-filter">查看范围<select aria-label="官方资料范围" value={mode} onChange={e=>{setMode(e.target.value);setPage(0);setCheckedAt(Date.now());}}><option value="context">{symbol?`当前资产 · ${symbol}`:'全部已接入资产'}</option><option value="crypto">币圈项目</option><option value="company">公司产品</option><option value="all">全部已接入资料</option></select></label>
  <div className="macro-actions"><button className="btn" disabled={loading} onClick={()=>void load()}>刷新项目资料</button>{loading&&<button className="btn" onClick={cancel}>停止等待项目资料</button>}</div>
  {loading&&<p role="status">正在读取资料…</p>}{error&&<p role="alert">{error}{view?' 仍显示上一份已保存资料。':''}</p>}
  {view&&result&&<div className="official-view" data-view-id={view.viewId} data-context-symbol={mode==='context'?symbol??'all':mode}>
   {!result.covered?<p role="status">当前资产尚未接入官方资料，不代表没有消息。可切换查看已接入来源。</p>:<>
    <p role="status">{result.total} 条已保存版本资料 · 第 {page+1}/{result.pages} 页</p>
    {!result.collected&&<p>来源尚未取得资料。</p>}{result.collected&&!result.total&&<p>这份来源快照没有记录，不代表没有发布。</p>}
    <ol className="macro-records">{result.records.map(r=>{const source=officialSource(r.sourceId)!;return <li key={`${r.sourceId}:${r.fact.id}`} data-information-source={r.sourceId}>
     <time dateTime={new Date(r.fact.publishedAt).toISOString()}>发布 {time(r.fact.publishedAt)}</time>
     <h3><a href={r.fact.url} target="_blank" rel="noopener noreferrer">{source.name} · {r.fact.tag}<span className="sr-only">（官方原文，新窗口）</span></a></h3>
     {r.fact.prerelease&&<p className="information-prerelease">来源标记：预发布</p>}
     <details><summary>出处与时间</summary><p>来源：{source.repo} · {source.category==='crypto'?'项目客户端':'公司开源产品'}更新</p><p>资料取得 {time(r.checkedAt)}{checkedAt-r.checkedAt>86400000?' · 已超过24小时，需更新':''}</p><p>来源更新时间 {time(r.fact.sourceUpdatedAt)}<br/>首次保存 {time(r.firstSavedAt)}<br/>此版本保存 {time(r.versionSavedAt)}</p><p>当前取得版本的历史记录，不证明当时已知。来源预发布标记：{r.fact.prerelease?'是':'否（不等于稳定性保证）'}。</p><p>仅索引版本事实与官方链接，<a href={source.rightsUrl} target="_blank" rel="noopener noreferrer">项目许可 {source.license}</a>；不转载发布正文。</p></details>
    </li>;})}</ol>
    <nav className="macro-pages" aria-label="项目资料分页"><button className="btn" disabled={!page} onClick={()=>{setPage(p=>p-1);setCheckedAt(Date.now());}}>上一页项目资料</button><button className="btn" disabled={page+1>=result.pages} onClick={()=>{setPage(p=>p+1);setCheckedAt(Date.now());}}>下一页项目资料</button></nav>
   </>}
   {view.sources.some(s=>s.checkedAt!==null&&checkedAt-s.checkedAt>86400000)&&<p className="macro-freshness">部分来源距上次核对已超过24小时；此处为已保存快照。</p>}
   <details className="information-coverage"><summary>已接入与未覆盖</summary><p>{OFFICIAL_SOURCES.map(s=>s.name).join('、')}。每个来源仅保存取得的一页，最多5条，不代表全量或所有最新消息。</p><p>Agave是Anza维护的Solana客户端；项目资料不区分USD/USDT交易对，也不说明价格变化原因。</p><p>SEC申报入口当前拒绝访问；公司新闻转载许可未确认。财报、公司重大事项、A股和港股公告尚未接入。美联储资料见下方“官方宏观资料”。</p><p>只展示官方提供的版本事实，完整说明请打开原文；原站可能后续修改内容。</p></details>
  </div>}
 </details>;
}
