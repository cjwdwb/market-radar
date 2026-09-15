"use client";
import { useCallback, useEffect, useState } from "react";
import { Cloud } from "lucide-react";
import { type PriceAlert, price } from "@/lib/market";
type State = {enabled:boolean;watchlist:string[];alerts:PriceAlert[];lastFinished?:number;report?:{checked:number;failed:string[]};updatedAt:number};
export function CloudMonitor({watchlist,alerts}:{watchlist:string[];alerts:PriceAlert[]}) {
  const [state,setState]=useState<State|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [ownerOnly,setOwnerOnly]=useState(false);
  const refresh=useCallback(async()=>{try{const res=await fetch('/api/monitor',{cache:'no-store',signal:AbortSignal.timeout(18000)});const data=await res.json() as State & {error?:string};if(res.status===401){setOwnerOnly(true);setError("");return;}if(!res.ok)throw new Error(data.error);setOwnerOnly(false);setState(data);setError("");}catch(e){setError(e instanceof Error?e.message:"云端连接失败");}},[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);return()=>clearInterval(timer);},[refresh]);
  async function save(enabled:boolean, sync:boolean){setBusy(true);try{const res=await fetch('/api/monitor',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled,watchlist:sync?watchlist:state?.watchlist??watchlist,alerts:sync?alerts:state?.alerts??alerts}),signal:AbortSignal.timeout(18000)});const data=await res.json() as State & {error?:string};if(!res.ok)throw new Error(data.error);setState(data);setError("");}catch(e){setError(e instanceof Error?e.message:"同步失败");}finally{setBusy(false);}}
  const recent=state?.lastFinished&&Date.now()-state.lastFinished<180000;
  const triggered=state?.alerts.filter(a=>a.triggeredAt)??[];
  if(ownerOnly)return <div className="cloud-status"><div><Cloud size={20}/><strong>云端持续监控</strong><span>站主管理</span></div><p>访客可查看行情并使用本机自选与提醒。站主的云端提醒独立保存。</p><a className="small-link" href="/signin-with-chatgpt?return_to=%2F">站主登录管理</a></div>;
  return <div className="cloud-status"><div><Cloud size={20}/><strong>云端持续监控</strong><span>{error?"连接异常":!state?"连接中":!state.enabled?"已暂停":recent?"每分钟运行":"等待定时检查"}</span></div>
    <p>关闭网页后继续检查。将本机自选与提醒同步到云端；修改、暂停或删除本机提醒后，请再次同步。云端开关独立于本机自动监控。</p>
    {state&&<p>云端自选 {state.watchlist.length} 个 · 待触发 {state.alerts.filter(a=>a.enabled&&!a.triggeredAt).length} 条<br/>最近完成：{state.lastFinished?new Date(state.lastFinished).toLocaleString('zh-CN'):"等待首次运行"}{state.report?.failed?.length?` · ${state.report.failed.length} 个行情暂不可用`:""}</p>}
    {error&&<p role="alert" className="error-text">{error}</p>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn btn-primary" disabled={busy||!state} onClick={()=>void save(true,true)}>{busy?"正在保存…":"同步本机自选与提醒"}</button><button className="btn" disabled={busy||!state} onClick={()=>void save(!state?.enabled,false)}>{state?.enabled?"暂停云端":"恢复云端"}</button></div>
    <p>触发记录保存在云端，下次打开即可查看。手机锁屏推送尚未接入。</p>
    {triggered.length>0&&<div className="alert-list">{triggered.map(a=><div key={a.id} className="alert-item"><strong>{a.symbol} · 已触发</strong><p>{new Date(a.triggeredAt!).toLocaleString('zh-CN')} · {price(a.triggeredPrice,a.symbol.endsWith('-USDT')?'USDT':/\.(SS|SZ)$/.test(a.symbol)?'CNY':a.symbol.endsWith('.HK')?'HKD':'USD')}</p></div>)}</div>}
  </div>;
}
