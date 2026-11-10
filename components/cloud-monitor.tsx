"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud } from "lucide-react";
import { type PriceAlert, price } from "@/lib/market";
type State = {enabled:boolean;watchlist:string[];alerts:PriceAlert[];lastFinished?:number;report?:{checked:number;failed:string[]};updatedAt:number};
type MonitorConfig = Pick<State, "enabled" | "watchlist" | "alerts">;
async function requestState(config?:MonitorConfig):Promise<State|null> {
  const response = await fetch("/api/monitor", {
    method: config ? "PUT" : "GET", cache:"no-store", signal:AbortSignal.timeout(18000),
    ...(config && {headers:{"Content-Type":"application/json"},body:JSON.stringify(config)})
  });
  if (response.status === 401) return null;
  const data = await response.json() as State & {error?:string};
  if (!response.ok) throw new Error(data.error || "云端连接失败");
  return data;
}

export async function updateCloudMonitor(previous:State, local:Pick<MonitorConfig,"watchlist"|"alerts">|null) {
  const current = await requestState();
  if (!current) return {state:null, changed:false};
  if (previous.updatedAt !== current.updatedAt || previous.enabled !== current.enabled) {
    return {state:current, changed:true};
  }
  const config = local ? {...local,enabled:current.enabled}
    : {watchlist:current.watchlist,alerts:current.alerts,enabled:!current.enabled};
  return {state:await requestState(config), changed:false};
}

export function CloudMonitor({watchlist,alerts}:{watchlist:string[];alerts:PriceAlert[]}) {
  const [state,setState]=useState<State|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [ownerOnly,setOwnerOnly]=useState(false);
  const sequence=useRef(0), saving=useRef(false);
  const [notice,setNotice]=useState(""),[checkedAt,setCheckedAt]=useState(0);
  const showState=useCallback((data:State|null)=>{
    setOwnerOnly(data===null);setState(data);setCheckedAt(Date.now());setError("");
  },[]);
  const refresh=useCallback(async()=>{
    if(saving.current)return;
    const read=++sequence.current;
    try{
      const data=await requestState();
      if(read===sequence.current)showState(data);
    }catch(e){if(read===sequence.current)setError(e instanceof Error?e.message:"云端连接失败");}
  },[showState]);
  useEffect(()=>{
    const first=setTimeout(()=>void refresh(),0);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);
    return()=>{clearTimeout(first);clearInterval(timer);};
  },[refresh]);
  async function save(sync:boolean){
    if(!state||saving.current)return;
    const write=++sequence.current;
    saving.current=true;setBusy(true);setNotice("");
    try{
      const result=await updateCloudMonitor(state,sync?{watchlist,alerts}:null);
      if(write!==sequence.current)return;
      showState(result.state);
      if(result.changed)setNotice("云端设置已有变化，请核对当前状态后再次操作。");
    }catch(e){if(write===sequence.current)setError(e instanceof Error?e.message:"同步失败");}
    finally{saving.current=false;if(write===sequence.current)setBusy(false);}
  }
  const recent=state?.lastFinished&&checkedAt-state.lastFinished<180000;
  const triggered=state?.alerts.filter(a=>a.triggeredAt)??[];
  if(ownerOnly)return <div className="cloud-status"><div><Cloud size={20}/><strong>云端持续监控</strong><span>站主管理</span></div><p>访客可查看行情并使用本机自选与提醒。站主的云端提醒独立保存。</p><a className="small-link" href="/signin-with-chatgpt?return_to=%2Faccess">站主登录管理</a></div>;
  return <div className="cloud-status"><div><Cloud size={20}/><strong>云端持续监控</strong><span>{error?"连接异常":!state?"连接中":!state.enabled?"已暂停":recent?"每分钟运行":"等待定时检查"}</span></div>
    <p>云端开启时，关闭网页后仍会检查。修改本机自选或提醒后可手动同步。同步沿用当前云端开关，暂停和恢复由你单独操作。</p>
    {state&&<p>云端自选 {state.watchlist.length} 个 · 待触发 {state.alerts.filter(a=>a.enabled&&!a.triggeredAt).length} 条<br/>最近完成：{state.lastFinished?new Date(state.lastFinished).toLocaleString('zh-CN'):"等待首次运行"}{state.report?.failed?.length?` · ${state.report.failed.length} 个行情暂不可用`:""}</p>}
    {error&&<p role="alert" className="error-text">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn btn-primary" disabled={busy||!state} onClick={()=>void save(true)}>{busy?"正在保存…":"同步本机自选与提醒"}</button><button className="btn" disabled={busy||!state} onClick={()=>void save(false)}>{state?.enabled?"暂停云端":"恢复云端"}</button></div>
    <p>触发记录保存在云端，下次打开即可查看。手机锁屏推送尚未接入。</p>
    {triggered.length>0&&<div className="alert-list">{triggered.map(a=><div key={a.id} className="alert-item"><strong>{a.symbol} · 已触发</strong><p>{new Date(a.triggeredAt!).toLocaleString('zh-CN')} · {price(a.triggeredPrice,a.symbol.endsWith('-USDT')?'USDT':/\.(SS|SZ)$/.test(a.symbol)?'CNY':a.symbol.endsWith('.HK')?'HKD':'USD')}</p></div>)}</div>}
  </div>;
}
