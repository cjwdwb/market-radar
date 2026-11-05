"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Bell, BellPlus, ChevronRight, Clock3, ExternalLink, Info, Loader2, Plus, RefreshCw, Star, Trash2, WifiOff, X, SlidersHorizontal, Layers, ShieldCheck, Search, Maximize2, Minimize2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ASSETS, DEFAULT_WATCHLIST, MARKET_LABELS, OVERVIEW, VALID_SYMBOL, alertMatches, assetFor, chartPrice, compact, displaySymbol, percent, price, type Asset, type Point, type PriceAlert, type Quote, type QuoteResult, type Range } from "@/lib/market";

import { CloudMonitor } from "@/components/cloud-monitor";
import { CandleChart } from "@/components/candle-chart";
import { PricePulse } from "@/components/price-pulse";
import { applyMotionPreference, MOTION_CHANGE_EVENT, normalizeMotionPreference, PREFERENCES_KEY, type MotionPreference } from "@/lib/motion-preference";
import { canMonitor } from "@/lib/monitoring";
import { chartGapSeries, clientJson, completeQuoteResults, historyEvidenceLag } from "@/lib/market-client";
import { useMarketHistory } from "@/components/use-market-history";
import { useMarketQuotes } from "@/components/use-market-quotes";
import { formatMarketTime, marketTimezoneLabel, normalizeDisplayTimePreference, resolveDisplayTimezone, type DisplayTimePreference } from "@/lib/market-time";
import { MarketTimeProvider } from "@/components/market-time-context";
import { RadarFeed } from "@/components/radar/radar-feed";
import { AssetRadarAwareness, AssetStateSummary, RadarOriginContext } from "@/components/radar/asset-context";
import { buildWatchlistState } from "@/lib/radar/watchlist-state";
import { browserWatchlistExport, type WatchlistOrigin } from "@/lib/radar/watchlist-export";
import { WatchlistState } from "@/components/radar/watchlist-state";
import { useRadar } from "@/components/radar/use-radar";
import { useInterpretation } from "@/components/radar/use-interpretation";
import type { OfficialView } from "@/lib/information/official.mjs";
import { experienceForHash } from "@/lib/radar/navigation";
import { benchmarkSymbols } from "@/lib/radar/engine";
import { buildAssetIntelligenceContext, chartRangeForEvent, enabledPriceAlertCounts, resolveRadarEvent, type RadarEventReference } from "@/lib/radar/workflow";
import type { MarketMode, RadarIntelligenceEvent } from "@/lib/radar/types";

type QuoteResponse={results?:QuoteResult[];error?:string};
const STORAGE_KEY=PREFERENCES_KEY;
const EMPTY_POINTS:Point[]=[];
const HISTORY_LIMITS:Record<string,string>={invalid_rows:"无效记录已剔除；实际范围可能不完整。",duplicate_rows:"重复记录已去重。",gaps:"来源时间网格存在缺口，未补值。",unknown_confirmation:"部分 K 线未提供收盘确认。",historical_endpoint:"数据来自来源历史接口。",legacy_proxy_metadata_unverified:"代理未提供完整的来源元数据，已单独校验价格与时间。",proxy_attempts_and_cancellation_unknown:"远端代理内部重试和取消状态不可核实。",source_confirmation_unavailable:"来源不提供收盘确认；时间窗口结束不代表来源确认。",daily_session_end_unknown:"日线实际交易时段结束尚未核实，不按固定 24 小时推定收盘。",session_or_data_gaps:"时间间隔可能包含休市或数据缺口，未将两端拼成连续数据。"};
const PERIODS:{value:Range;label:string}[]=[{value:"15m",label:"15 分钟"},{value:"1d",label:"1 日"},{value:"1w",label:"1 周"},{value:"1m",label:"1 月"},{value:"3m",label:"3 月"}];
function tone(n:number|null|undefined){return n==null||n===0?"neutral":n>0?"positive":"negative";}
function AssetIcon({asset,small=false}:{asset:Asset;small?:boolean}){return <span className={`asset-icon ${small?"small":""}`} aria-hidden="true">{asset.mark}</span>;}
function Change({value}:{value:number|null|undefined}){return <span className={`change numeric ${tone(value)}`}>{value!=null&&value!==0&&(value>0?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>)}{percent(value)}</span>;}
const Sparkline=memo(function Sparkline({points,change,intervalMs}:{points?:Point[];change?:number|null;intervalMs?:number|null}){
  if(!points||points.length<2)return <span className="sparkline" aria-hidden="true"/>;
  const values=points.map(p=>p.close);
  const low=Math.min(...values),high=Math.max(...values),span=high-low||1;
  const d=values.map((p,i)=>`${i===0||(intervalMs&&points[i].time-points[i-1].time>intervalMs)?"M":"L"}${(i/(values.length-1)*94).toFixed(1)},${(26-(p-low)/span*22).toFixed(1)}`).join(" ");
  return <svg className={`sparkline ${tone(change)}`} viewBox="0 0 96 30" preserveAspectRatio="none" aria-hidden="true"><path d={d} stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
});
function ChartTip({active,payload,currency,timezone}:{active?:boolean;payload?:readonly {payload?:Point}[];currency:string;timezone:string}){
  const point=payload?.[0]?.payload;
  return active&&point?<div className="chart-tooltip"><p>{formatMarketTime(point.time,timezone,"full")} · {marketTimezoneLabel(timezone,point.time)}</p><strong className="numeric">{price(point.close,currency)}</strong></div>:null;
}

export default function MarketRadar(){
  const [marketMode,setMarketMode]=useState<MarketMode>("classic");
  const [defaultMarketMode,setDefaultMarketMode]=useState<MarketMode>("classic");
  const [section,setSection]=useState("#overview");
  const [watchlist,setWatchlist]=useState<string[]>(DEFAULT_WATCHLIST);
  const [watchlistOrigin,setWatchlistOrigin]=useState<WatchlistOrigin>("app_default");
  const [watchlistEdited,setWatchlistEdited]=useState(false);
  const [watchStatesOpen,setWatchStatesOpen]=useState(false);
  const [alerts,setAlerts]=useState<PriceAlert[]>([]);
  const alertsRef=useRef<PriceAlert[]>([]);
  const [hydrated,setHydrated]=useState(false);
  const [selected,setSelected]=useState("BTC-USDT");
  const [radarOrigin,setRadarOrigin]=useState<RadarEventReference|null>(null);
  const [radarAssetFocus,setRadarAssetFocus]=useState(false);
  const [officialView,setOfficialView]=useState<OfficialView|null>(null);
  const [auto,setAuto]=useState(true);
  const [visible,setVisible]=useState(true);
  const [backgroundTabs,setBackgroundTabs]=useState(true);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [motionPreference,setMotionPreference]=useState<MotionPreference>("system");
  const [systemMotion,setSystemMotion]=useState("normal");
  const [displayTimePreference,setDisplayTimePreference]=useState<DisplayTimePreference>("device");
  const [deviceTimezone,setDeviceTimezone]=useState<string|null>(null);
  const [manualRefreshing,setManualRefreshing]=useState(false);
  const displayTimezone=resolveDisplayTimezone(displayTimePreference,deviceTimezone);
  const formatTime=useCallback((at:number|undefined,full=false)=>formatMarketTime(at,displayTimezone,full?"full":"clock"),[displayTimezone]);
  const [online,setOnline]=useState(true);
  const [now,setNow]=useState<number>();
  const [range,setRange]=useState<Range>("15m");
  const [marketFilter,setMarketFilter]=useState("all");
  const [sort,setSort]=useState("default");
  const [watchSearch,setWatchSearch]=useState("");
  const [chartExpanded,setChartExpanded]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [candidate,setCandidate]=useState("");
  const [adding,setAdding]=useState(false);
  const [alertOpen,setAlertOpen]=useState(false);
  const [alertSymbol,setAlertSymbol]=useState("BTC-USDT");
  const [direction,setDirection]=useState<"above"|"below">("above");
  const [target,setTarget]=useState("");
  const [infoOpen,setInfoOpen]=useState(false);
  const [notifying,setNotifying]=useState(false);
  const failedStorage=useRef(false);
  const mayRun=canMonitor(auto,visible,backgroundTabs,online);

  useEffect(()=>{
    let preferred:MarketMode="classic",motion:MotionPreference="system";
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){const data=JSON.parse(raw);
        if(Array.isArray(data.watchlist)){setWatchlistOrigin("saved_browser");setWatchlist([...new Set<string>(data.watchlist.filter((s:unknown)=>typeof s==="string"&&VALID_SYMBOL.test(s)).map((s:string)=>s.replace(/-USD$/,"-USDT")))].slice(0,20));}
        if(Array.isArray(data.alerts)){
          const valid=data.alerts.filter((a:PriceAlert)=>a&&typeof a.id==="string"&&typeof a.symbol==="string"&&VALID_SYMBOL.test(a.symbol)&&["above","below"].includes(a.direction)&&Number.isFinite(a.target)&&a.target>0&&typeof a.enabled==="boolean"&&Number.isFinite(a.createdAt)).slice(0,20);
          setAlerts(valid);alertsRef.current=valid;
        }
        if(typeof data.auto==="boolean")setAuto(data.auto);
        if(typeof data.backgroundTabs==="boolean")setBackgroundTabs(data.backgroundTabs);
        if(data.marketMode==="radar")preferred="radar";
        motion=normalizeMotionPreference(data.motionPreference);
        setDisplayTimePreference(normalizeDisplayTimePreference(data.displayTimePreference));
      }
    }catch{setWatchlistOrigin("storage_unavailable");toast.info("无法读取已保存的设置，本次使用默认自选。");}
    setMotionPreference(motion);applyMotionPreference(motion);
    setDeviceTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setDefaultMarketMode(preferred);setMarketMode(experienceForHash(location.hash,preferred));setSection(location.hash||"#overview");
    setNow(Date.now());setHydrated(true);setVisible(document.visibilityState==="visible");setOnline(navigator.onLine);
    const visibility=()=>{setVisible(document.visibilityState==="visible");setNow(Date.now());};
    const connectivity=()=>setOnline(navigator.onLine);
    document.addEventListener("visibilitychange",visibility);window.addEventListener("online",connectivity);window.addEventListener("offline",connectivity);
    const timer=setInterval(()=>setNow(Date.now()),10_000);
    return()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("online",connectivity);window.removeEventListener("offline",connectivity);clearInterval(timer);};
  },[]);
  useEffect(()=>{alertsRef.current=alerts;},[alerts]);
  useEffect(()=>{
    const update=()=>setSystemMotion(document.documentElement.dataset.systemMotion??"normal");
    update();window.addEventListener(MOTION_CHANGE_EVENT,update);
    return()=>window.removeEventListener(MOTION_CHANGE_EVENT,update);
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({watchlist,alerts,auto,backgroundTabs,marketMode:defaultMarketMode,motionPreference,displayTimePreference}));}
    catch{if(!failedStorage.current){failedStorage.current=true;toast.error("浏览器未允许保存设置，关闭后本次更改可能丢失。");}}
  },[watchlist,alerts,auto,backgroundTabs,defaultMarketMode,motionPreference,displayTimePreference,hydrated]);

  useEffect(()=>{
    if(!hydrated)return;
    let frame=0;
    const navigate=()=>{
      const hash=location.hash;setMarketMode(experienceForHash(hash,defaultMarketMode));setSection(hash||"#overview");if(hash!=="#price-chart")setRadarOrigin(null);
      if(hash!=="#radar"&&hash!=="#price-chart")setRadarAssetFocus(false);
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
        const destination=document.getElementById(hash.slice(1)||"overview");
        destination?.scrollIntoView();
      });});
    };
    window.addEventListener("hashchange",navigate);
    return()=>{window.removeEventListener("hashchange",navigate);cancelAnimationFrame(frame);};
  },[hydrated,defaultMarketMode]);
  const viewAsset=useCallback((target:RadarIntelligenceEvent|string)=>{
    const event=typeof target === "string" ? null : target;
    const symbol=typeof target === "string" ? target : target.symbol;
    setSelected(symbol);if(symbol!==selected)setRadarAssetFocus(false);if(event){setRadarOrigin({symbol,eventId:event.id});setRange(chartRangeForEvent(event,range));}else setRadarOrigin(null);setMarketMode("classic");setSection("#price-chart");
    location.hash="price-chart";
  },[range,selected]);
  const selectAsset=useCallback((symbol:string)=>{setSelected(symbol);setRadarOrigin(previous=>previous?.symbol===symbol?previous:null);if(symbol!==selected)setRadarAssetFocus(false);},[selected]);
  const toggleRadarWatch=useCallback((symbol:string)=>{if(watchlist.includes(symbol))removeAsset(symbol);else {setCandidate(symbol);setAddOpen(true);}},[watchlist,removeAsset]);

  const symbolKey=useMemo(()=>[...new Set([...OVERVIEW,...watchlist,selected,...alerts.filter(a=>a.enabled).map(a=>a.symbol)])].sort().join(","),[watchlist,selected,alerts]);
  const requestKey=useMemo(()=>{const symbols=symbolKey.split(",");return [...new Set([...symbols,...benchmarkSymbols(symbols)])].sort().join(",");},[symbolKey]);
  const {quotes,errors,loading,lastFetched,refresh,acceptQuote}=useMarketQuotes({requestKey,symbolKey,hydrated,visible,online,auto,backgroundTabs});
  const {history,trends,historyLoading,historyError,trendErrors,refresh:refreshHistory}=useMarketHistory({selected,range,requestKey,hydrated,visible,online,auto});
  const refreshing=loading||manualRefreshing;
  const radarSnapshot=useMemo(()=>({quotes,histories:trends,symbols:symbolKey.split(",")}),[quotes,trends,symbolKey]);
  const radar=useRadar(radarSnapshot,watchlist,now,hydrated&&mayRun);
  const radarContext=resolveRadarEvent(radar.intelligence.events,radarOrigin,selected);
  const priceAlertCounts=useMemo(()=>enabledPriceAlertCounts(alerts),[alerts]);
  const selectedRadar=useMemo(()=>buildAssetIntelligenceContext({events:radar.intelligence.events,coverage:radar.coverage,symbol:selected,now,enabled:hydrated&&mayRun,online,isWatched:watchlist.includes(selected),enabledAlertCount:priceAlertCounts.get(selected)??0}),[radar.intelligence.events,radar.coverage,selected,now,hydrated,mayRun,online,watchlist,priceAlertCounts]);
  const watchStates=useMemo(()=>buildWatchlistState({snapshot:radarSnapshot,watchlist,selected,now,enabled:!hydrated||mayRun,online}),[radarSnapshot,watchlist,selected,now,hydrated,mayRun,online]);
  const selectedState=watchStates.states.get(selected)!;
  const interpretation=useInterpretation(selected);
  const [aiContextModule,setAiContextModule]=useState<typeof import("@/lib/ai/context")|null>(null);
  useEffect(()=>{
    if(!radarAssetFocus||marketMode!=="radar"||aiContextModule)return;
    let active=true;
    void import("@/lib/ai/context").then(module=>{if(active)setAiContextModule(module);}).catch(()=>{});
    return()=>{active=false;};
  },[radarAssetFocus,marketMode,aiContextModule]);
  const aiContext=useMemo(()=>{
    if(now===undefined||!aiContextModule)return null;
    try{return aiContextModule.buildMarketContext({symbol:selected,quote:quotes[selected],state:selectedState,radar:selectedRadar,now,online,enabled:mayRun,information:aiContextModule.loadedInformationFacts(officialView,selected)});}
    catch{return null;}
  },[selected,quotes,selectedState,selectedRadar,now,online,mayRun,officialView,aiContextModule]);
  function exportWatchlist(){
    if(!hydrated)return;
    let url:string|undefined;
    try{
      const payload=browserWatchlistExport(watchlist,Date.now(),watchlistOrigin,watchlistEdited);
      url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
      const link=document.createElement("a");link.href=url;link.download="market-radar-watchlist.json";link.click();
      toast.info("已生成本地自选文件；未上传，也未启动历史采集。");
    }catch{toast.error("无法生成自选文件，请稍后重试。");}
    finally{if(url)URL.revokeObjectURL(url);}
  }
  function openRelatedRadar(){setRadarAssetFocus(true);setRadarOrigin(null);setMarketMode("radar");setSection("#radar");location.hash="radar";}
  function returnToRadar(){setRadarOrigin(null);setMarketMode("radar");setSection("#radar");location.hash="radar";}
  function openRadarAlert(symbol:string){
    selectAsset(symbol);
    if(priceAlertCounts.has(symbol)){setMarketMode("classic");setSection("#price-alerts");location.hash="price-alerts";}
    else openAlert(symbol);
  }
  useEffect(()=>{
    if(!hydrated||!mayRun)return;
    const instant=Date.now();const matching=alertsRef.current.filter(a=>quotes[a.symbol]&&alertMatches(a,quotes[a.symbol],instant));
    if(!matching.length)return;
    const triggered=new Set(matching.map(a=>a.id));
    const next=alertsRef.current.map(a=>triggered.has(a.id)?{...a,enabled:false,triggeredAt:instant,triggeredPrice:quotes[a.symbol].price}:a);
    alertsRef.current=next;setAlerts(next);
    for(const a of matching){
      const q=quotes[a.symbol];const message=`${displaySymbol(a.symbol)} ${a.direction==="above"?"已达到":"已跌至"} ${price(q.price,q.currency)}`;
      toast(message,{description:`目标价 ${price(a.target,q.currency)} · 行情 ${formatTime(q.timestamp)}`,duration:15000,icon:<Bell size={19}/>});
      if(notifying&&"Notification" in window&&Notification.permission==="granted"){try{new Notification("市场雷达 · 价格提醒",{body:message,tag:a.id});}catch{}}
    }
  },[quotes,hydrated,mayRun,notifying,formatTime]);

  const activeAsset=assetFor(selected),quote=quotes[selected],quoteError=errors[selected]??quote?.error;
  const quoteOld=!!quote&&!!now&&(now-quote.timestamp>(activeAsset.market==="crypto"?180_000:1_200_000));
  const selectedName=activeAsset.name===selected?(quote?.name??selected):activeAsset.name;
  const active=mayRun;
  const failedCount=Object.keys(errors).length;
  const displayedHistory=history?.key===`${selected}:${range}`?history:undefined;
  const quoteChart=range==="1d"&&!selected.endsWith("-USDT");
  const chartPoints=quoteChart?(quote?.points??EMPTY_POINTS):displayedHistory?.points??EMPTY_POINTS;
  const chartColor=chartPoints.length>1?(chartPoints.at(-1)!.close>chartPoints[0].close?"var(--market-up)":chartPoints.at(-1)!.close<chartPoints[0].close?"var(--market-down)":"#aaa"):"#aaa";
  const chartTimezone=displayTimezone;
  const chartMetadata=quoteChart?quote?.historyMetadata:displayedHistory?.metadata;
  const chartFetchedAt=quoteChart?quote?.fetchedAt:displayedHistory?.fetchedAt;
  const chartInterval=chartMetadata?.intervalMs;
  const chartSeries=useMemo(()=>chartGapSeries(chartPoints,chartInterval),[chartPoints,chartInterval]);
  const chartStale=!!chartFetchedAt&&!!now&&now-chartFetchedAt>(range==="15m"||range==="1d"?120_000:300_000);
  const chartEvidenceLag=historyEvidenceLag(chartMetadata,now);
  const zoneLabel=displayTimePreference==="device"&&!deviceTimezone?"UTC · 等待设备时区":marketTimezoneLabel(displayTimezone,now);
  const chartBusy=quoteChart?!quote&&loading:historyLoading;
  const chartProblem=quoteChart?quoteError:historyError;
  const watchQuotes=watchlist.map(s=>quotes[s]).filter((q):q is Quote=>!!q&&!q.error);
  const up=watchQuotes.filter(q=>(q.changePercent??0)>0).length,down=watchQuotes.filter(q=>(q.changePercent??0)<0).length,flat=watchQuotes.length-up-down;
  const watchItems=watchlist.filter(s=>(marketFilter==="all"||assetFor(s).market===marketFilter)&&`${s} ${assetFor(s).name} ${quotes[s]?.name??""}`.toLowerCase().includes(watchSearch.trim().toLowerCase())).slice().sort((a,b)=>{
    if(sort==="default")return 0;
    const av=quotes[a]?.changePercent,bv=quotes[b]?.changePercent;
    if(av==null)return bv==null?0:1;if(bv==null)return -1;return sort==="gainers"?bv-av:av-bv;
  });
  const enabledAlerts=alerts.filter(a=>a.enabled).length;
  const quoteStatus=!quote?"等待行情":quoteError?"连接中断 · 保留上次报价":activeAsset.market==="crypto"?(quoteOld?"报价已过期":"24 / 7 交易"):quote.session==="closed"?"常规交易时段已结束":quoteOld?"报价延迟 / 已过期":quote.session==="open"?"常规交易时段":"交易状态未知";
  function openAlert(symbol:string){setAlertSymbol(symbol);setDirection("above");setTarget("");setAlertOpen(true);}
  function removeAsset(symbol:string){
    const before=watchlist;setWatchlistEdited(true);setWatchlist(list=>list.filter(s=>s!==symbol));
    toast("已移出自选，已设提醒仍保留",{action:{label:"撤销",onClick:()=>setWatchlist(before)}});
  }
  async function addAsset(event:React.FormEvent){
    event.preventDefault();const symbol=candidate.trim().toUpperCase();
    if(!VALID_SYMBOL.test(symbol)){toast.error("请检查代码，例如 AAPL、BTC-USDT、600519.SS 或 0700.HK");return;}
    if(watchlist.includes(symbol)){selectAsset(symbol);setAddOpen(false);return;}
    if(watchlist.length>=20){toast.error("最多保存 20 个自选，请先移除一个。");return;}
    setAdding(true);
    try{
      const body=await clientJson<QuoteResponse>(`/api/quotes?symbols=${encodeURIComponent(symbol)}`,new AbortController().signal,18_000);
      const result=completeQuoteResults([symbol],body.results)[0];
      if(!result?.quote)throw new Error(result?.error??body.error??"暂时无法验证该代码");
      const quote=result.quote;acceptQuote(quote);setWatchlistEdited(true);setWatchlist(list=>[...list,symbol]);selectAsset(symbol);setAddOpen(false);setCandidate("");toast.success("已添加到自选");
    }catch(error){toast.error(error instanceof Error?error.message:"暂时无法添加，请稍后重试");}finally{setAdding(false);}
  }
  function createAlert(event:React.FormEvent){
    event.preventDefault();const amount=Number(target);
    if(!Number.isFinite(amount)||amount<=0){toast.error("请输入大于 0 的有效目标价");return;}
    if(!quotes[alertSymbol]){toast.error("请先加载该标的的行情，再创建提醒");return;}
    if(alerts.length>=20){toast.error("最多保存 20 条提醒，请删除不用的提醒。");return;}
    const alert:PriceAlert={id:crypto.randomUUID(),symbol:alertSymbol,direction,target:amount,enabled:true,createdAt:Date.now()};
    const next=[alert,...alertsRef.current];alertsRef.current=next;setAlerts(next);setAlertOpen(false);
    toast.success("提醒已创建",{description:auto?"将在下一次有效行情更新时检查。":"当前监控已暂停，恢复后开始检查。"});
  }
  async function enableNotifications(){
    if(!("Notification" in window)){toast.info("此浏览器暂不支持系统通知，页面内提醒仍可使用。");return;}
    try{const permission=await Notification.requestPermission();setNotifying(permission==="granted");if(permission!=="granted")toast.info("未开启系统通知，仍会在页面内提醒。");else toast.success("已开启本次访问的系统通知");}
    catch{toast.info("无法开启系统通知，仍会在页面内提醒。");}
  }
  async function refreshAll(){
    if(!online)return;
    setManualRefreshing(true);
    try{await Promise.allSettled([refresh(),refreshHistory()]);}finally{setManualRefreshing(false);}
  }

  return <MarketTimeProvider timezone={displayTimezone}>
    <Toaster theme="dark" position="top-right" closeButton richColors/>
    <div id="overview" aria-hidden="true"/>
    <header className="topbar">
      <a className="brand" href="#overview" aria-label="市场雷达 · 返回总览"><div className="brand-icon"><img src="/brand-light-v2.png" alt="" width={56} height={48}/></div><div><strong>市场雷达</strong><span>MARKET RADAR</span></div></a>
      <nav className="desktop-nav" aria-label="主导航"><a data-product-nav href="#overview" aria-current={marketMode==="classic"&&!["#watchlist","#price-alerts"].includes(section)?"page":undefined}>Markets</a><a data-product-nav href="#radar" aria-current={marketMode==="radar"?"page":undefined}>Radar</a><a data-product-nav href="#watchlist" aria-current={marketMode==="classic"&&section==="#watchlist"?"page":undefined}>Watchlist</a><a data-product-nav href="#price-alerts" aria-current={marketMode==="classic"&&section==="#price-alerts"?"page":undefined}>Alerts</a></nav><div className="top-right"><button className="btn settings-trigger" aria-label="运行设置" onClick={()=>setSettingsOpen(true)}><SlidersHorizontal size={17}/><span>运行设置</span></button></div>
    </header>
    <main className="page">
      <div className="page-heading"><div><h1><span className="heading-title"><span className="heading-title-inner">{marketMode==="radar"?"Radar":"市场总览"}</span></span></h1></div><div className="toolbar"><button className="btn refresh-button" onClick={refreshAll} disabled={refreshing||!online} aria-label="刷新行情"><RefreshCw size={15} className={refreshing?"spin":""}/><span>刷新行情</span></button><button className="btn btn-primary" data-magnetic onClick={()=>{setCandidate("");setAddOpen(true);}}><Plus size={16}/>添加自选</button></div></div>
      {(!online||failedCount>0)&&<div className="connection-banner" role="status"><WifiOff size={17}/><span>{!online?"网络已断开；恢复后按自动监控设置继续，或手动刷新。":`${failedCount} 个标的暂时无法更新；上次报价已标记，暂停对应提醒。`}</span><button onClick={refreshAll} disabled={refreshing||!online}>重试</button></div>}
      <section className="monitoring-strip" aria-label="监控状态">
        <div className="runtime-summary"><span className={`runtime-icon ${!active?"idle":""}`}><Activity size={18}/></span><div><strong>{!online?"网络已断开":!active?"监控已暂停":visible?"前台监控中":"标签页后台 · 尽力运行"}</strong><small>{lastFetched?`最近有效报价获取 ${formatTime(lastFetched)}`:"尚未取得有效报价"}<span className="runtime-cadence"> · {refreshing?"正在更新":!auto?"自动刷新已暂停":visible?"加密 5 秒 / 股票 15 秒":"后台可能降频"}</span></small></div></div>
        <div className="runtime-count"><span>关注标的</span><strong>{watchlist.length}<small> 个</small></strong></div><div className="runtime-count"><span>有效提醒</span><strong>{enabledAlerts}<small> 条</small></strong></div>
        <button className="runtime-link" onClick={()=>setSettingsOpen(true)}><Layers size={15}/>{backgroundTabs?"标签页后台已启用":"仅前台运行"}<ChevronRight size={14}/></button>
        <label className="refresh-label"><Switch checked={auto} onCheckedChange={setAuto} aria-label="自动刷新与提醒"/>自动监控</label>
      </section>
      <div className="radar-view" hidden={marketMode!=="radar"}><RadarFeed intelligence={radar.intelligence} history={radar.history} coverage={radar.coverage} watchlist={watchlist} watchStates={watchStates.states} onExport={exportWatchlist} exportReady={hydrated} scanning={mayRun} loading={loading} online={online} onAsset={viewAsset} onWatch={toggleRadarWatch} onAlert={openRadarAlert} priceAlertCounts={priceAlertCounts} assetContext={radarAssetFocus?selectedRadar:undefined} assetState={selectedState} interpretation={interpretation} aiContext={aiContext} onInformationView={setOfficialView} onClearContext={()=>setRadarAssetFocus(false)} onAdd={()=>{setCandidate("");setAddOpen(true);}} onRemove={removeAsset}/></div>
      <div className="classic-experience" hidden={marketMode!=="classic"}>
      <div className="overview-wrap"><section className="overview" aria-label="市场概览">
        {OVERVIEW.map(symbol=>{const a=assetFor(symbol),q=quotes[symbol];return <button key={symbol} className={`overview-card ${selected===symbol?"is-selected":""}`} aria-pressed={selected===symbol} onClick={()=>selectAsset(symbol)} aria-label={`查看${a.name}走势`}><div className="overview-top"><AssetIcon asset={a} small/><span>{a.name}</span><span className="unit">{symbol.startsWith("^")?"指数":q?.currency??(symbol.endsWith("-USDT")?"USDT":"USD")}</span></div>{!q&&loading?<Skeleton className="skeleton-price"/>:<div className="overview-price numeric"><PricePulse value={q?.price} text={price(q?.price,q?.currency,false)} identity={symbol}/></div>}<div className="overview-bottom"><div><Change value={q?.changePercent}/><span className="overview-caption">{symbol.endsWith("-USDT")?"24 小时":"较前收"}</span></div><Sparkline points={trends[symbol]?.points??q?.points} change={q?.changePercent} intervalMs={trends[symbol]?.intervalMs??q?.historyMetadata?.intervalMs}/></div>{errors[symbol]&&<div className="error-text">{q?"更新失败 · 上次报价":"暂未取得行情"}</div>}{trendErrors[symbol]&&<div className="overview-history-status" title={trendErrors[symbol]}>走势未更新 · {formatTime(trends[symbol]?.fetchedAt)}</div>}</button>;})}
      </section><span className="overview-scroll-hint" aria-hidden="true">滑动查看更多 <ChevronRight size={12}/></span></div>
      <div className={`workspace ${chartExpanded?"chart-expanded":""}`}>
        <div className="left-column">
          <section className="panel chart-panel" id="price-chart" aria-label={`${selectedName}价格走势图`}>
            <div className="symbol-rail" aria-label="快速切换自选"><Star size={13}/><div>{[...new Set([selected,...watchlist])].map(symbol=><button key={symbol} aria-pressed={selected===symbol} onClick={()=>selectAsset(symbol)}><span>{displaySymbol(symbol)}</span><span className={errors[symbol]?"muted":tone(quotes[symbol]?.changePercent)}>{errors[symbol]?"更新失败":percent(quotes[symbol]?.changePercent)}</span></button>)}</div></div>
            <div className="chart-top"><div><div className="selected-title"><AssetIcon asset={activeAsset}/><h2>{displaySymbol(selected)}</h2><span className="market-tag">{MARKET_LABELS[activeAsset.market]}</span></div><p className="selected-subtitle">{selectedName} <span> / {quote?.currency??(activeAsset.market==="cn"?"CNY":activeAsset.market==="hk"?"HKD":"USD")}</span></p><div className="chart-price"><strong className="numeric"><PricePulse value={quote?.price} text={price(quote?.price,quote?.currency,false)} identity={selected}/></strong>{!selected.startsWith("^")&&<span className="quote-unit">{quote?.currency??(selected.endsWith("-USDT")?"USDT":activeAsset.market==="cn"?"CNY":activeAsset.market==="hk"?"HKD":"USD")}</span>}<Change value={quote?.changePercent}/></div></div><span className="chart-top-actions"><button className="icon-btn" aria-label={`为${selectedName}设置提醒`} onClick={()=>openAlert(selected)}><BellPlus size={18}/></button><button className="icon-btn" aria-label={chartExpanded?"收起图表":"展开图表"} aria-pressed={chartExpanded} onClick={()=>setChartExpanded(v=>!v)}>{chartExpanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button></span></div>
            <div className="chart-market-summary"><span>{selected.endsWith("-USDT")?"24h 高":"日内最高"}<b>{price(quote?.high,quote?.currency,false)}</b></span><span>{selected.endsWith("-USDT")?"24h 低":"日内最低"}<b>{price(quote?.low,quote?.currency,false)}</b></span><span>{activeAsset.market==="crypto"?"成交额":"成交量"}<b>{compact(quote?.volume)} <small>{activeAsset.market==="crypto"?quote?.currency:"股 / 份"}</small></b></span><span className="summary-freshness">{quoteStatus}<b>{formatTime(quote?.timestamp)} <small>{zoneLabel}</small></b></span></div>
            {radarOrigin?.symbol===selected?<RadarOriginContext symbol={selected} event={radarContext} onReturn={returnToRadar} onDismiss={()=>setRadarOrigin(null)}/>:<AssetRadarAwareness context={selectedRadar} onOpen={openRelatedRadar}/>}
            <AssetStateSummary state={selectedState} onOpen={openRelatedRadar}/>
            {interpretation.result && <button className="btn ai-classic-link" onClick={openRelatedRadar}>查看 {selected} 的{interpretation.resultKind === "private_real" ? "原快照解释 · 本机私有试点" : "解释演示 · 未调用真实模型"}</button>}
            <Tabs value={range} onValueChange={value=>setRange(value as Range)}>
              <div className="period-tabs"><TabsList className="range-list" aria-label="走势时间范围">{PERIODS.map(p=><TabsTrigger key={p.value} value={p.value} className="range-trigger">{p.label}</TabsTrigger>)}</TabsList><span className="chart-legend"><span className="line-swatch" style={{background:chartColor}}/>{range==="15m"?"K 线 + 成交量":"价格走势"}</span></div>
              <TabsContent value={range}>
                {chartBusy&&chartPoints.length<2?<div className="chart-empty"><Loader2 size={24} className="spin"/><span>正在获取真实行情…</span></div>:chartPoints.length<2?<div className="chart-empty"><Activity size={30}/><span>{chartProblem||"暂无足够走势数据"}</span><button className="small-link" onClick={refreshAll}>重新获取</button></div>:range==="15m"?<CandleChart key={selected} points={chartPoints} currency={displayedHistory?.currency??quote?.currency??"USD"} timezone={chartTimezone} intervalMs={chartInterval} metadata={chartMetadata}/>:<div className="price-chart"><AreaChart responsive style={{width:"100%",height:"100%"}} data={chartSeries} margin={{top:10,right:8,bottom:0,left:5}} accessibilityLayer><defs><linearGradient id="radar-price-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity={.09}/><stop offset="96%" stopColor={chartColor} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#252525" strokeDasharray="3 5"/><XAxis dataKey="time" tickFormatter={v=>new Intl.DateTimeFormat("zh-CN",range==="1d"?{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:chartTimezone}:{month:"numeric",day:"numeric",timeZone:chartTimezone}).format(v)} minTickGap={60} tick={{fill:"#858585",fontSize:12}} axisLine={false} tickLine={false} dy={8}/><YAxis orientation="right" domain={["auto","auto"]} tickFormatter={chartPrice} tick={{fill:"#858585",fontSize:12}} axisLine={false} tickLine={false} width="auto" tickCount={4}/><Tooltip content={<ChartTip currency={quote?.currency??"USD"} timezone={chartTimezone}/>} cursor={{stroke:"#a0a0a0",strokeDasharray:"4 4"}}/><Area connectNulls={false} type="linear" dataKey="close" name="价格" stroke={chartColor} strokeWidth={2.3} fill="url(#radar-price-fill)" isAnimationActive={false} activeDot={{r:4,stroke:"#111111",strokeWidth:2,fill:chartColor}}/></AreaChart></div>}
              </TabsContent>
            </Tabs>
            <div className="chart-footer"><span className={chartProblem||chartStale||chartEvidenceLag?"error-text":""}>{chartProblem?`走势更新失败 · ${chartProblem}`:chartBusy?"正在更新 · 保留当前图表":chartStale?"走势获取时间已过期 · 保留上次数据":chartEvidenceLag?"最新 K 线时间落后 · 保留旧走势":`${quoteChart?quote?.source??"行情源":displayedHistory?.source??"行情源"} · ${range==="1d"?(activeAsset.market==="crypto"?"最近窗口（非自然日）":"最近交易日"):"历史行情"}`}</span><span>{chartMetadata?.bar?`原生 ${chartMetadata.bar} · `:""}{zoneLabel}</span></div>
            <details className="market-data-status"><summary>数据时间与状态{trendErrors[selected]?" · 分析基线更新失败":""}{chartMetadata?.gapCount?` · ${chartMetadata.gapCount} 处间隔缺口`:""}</summary><dl>
              <div><dt>来源报价时间</dt><dd>{formatTime(quote?.timestamp,true)}{quoteError?" · 更新失败":quoteOld?" · 过期":""}</dd></div>
              <div><dt>报价实际获取</dt><dd>{formatTime(quote?.fetchedAt,true)}{quote?.cache?.hit?" · 缓存读取":""}</dd></div>
              <div><dt>走势实际获取</dt><dd>{formatTime(chartFetchedAt,true)}{chartStale?" · 过期":""}</dd></div>
              <div><dt>实际开盘时间范围</dt><dd>{formatTime(chartPoints[0]?.time,true)} — {formatTime(chartPoints.at(-1)?.time,true)}{chartEvidenceLag?" · 末端延迟，刚获取不代表行情新鲜":""}</dd></div>
              <div><dt>最近完整 K 线结束</dt><dd>{formatTime(chartMetadata?.lastCompleteAt??undefined,true)} · {chartMetadata?.completion==="source"?"来源确认":chartMetadata?.completion==="time_window"?"仅时间窗口结束":"完整性未知"}</dd></div>
              <div><dt>分析基线</dt><dd>{selected.endsWith("-USDT")?(trendErrors[selected]?`${trendErrors[selected]} · 保留旧基线仅供查看`:trends[selected]?`${formatTime(trends[selected].fetchedAt,true)} · ${now&&now-trends[selected].fetchedAt>120_000?"已过期":trends[selected].intervalMs===900000?"原生 15m":"周期待验证"}`:"等待获取"):"使用股票报价内的历史；独立检查交易时段与时效"}</dd></div>
            </dl>{chartMetadata?.gapCount? <p>缺口保留，不补值；走势与均线在缺口处断开。</p>:null}{chartMetadata?.limitations.map(item=><p key={item}>{HISTORY_LIMITS[item]??"部分来源信息尚未验证。"}</p>)}</details>
          </section>
          <section className="panel recent-signals" aria-label="资产近期信号"><h3>{displaySymbol(selected)} · 近期信号</h3>{radar.signals.filter(signal=>signal.symbol===selected).slice(0,3).map(signal=><button key={signal.id} onClick={()=>{location.hash="radar";}}>{signal.title} · {signal.metric} · {formatTime(signal.detectedAt)} · {signal.status==="active"?"异常持续":signal.status==="resolved"?"已恢复":"已过期"}</button>)}{!radar.signals.some(signal=>signal.symbol===selected)&&<p>本次会话暂无该标的异常记录。</p>}</section>
          <section className="panel watch-panel" id="watchlist" aria-label="我的自选">
            <div className="panel-heading"><h2><Star size={17} className="muted"/>我的自选 <span className="count">{watchlist.length}</span></h2><div className="watch-heading-tools"><label className="watch-search"><Search size={14}/><input aria-label="搜索自选" placeholder="搜索币种 / 股票" value={watchSearch} onChange={e=>setWatchSearch(e.target.value)}/>{watchSearch&&<button aria-label="清空搜索" onClick={()=>setWatchSearch("")}><X size={13}/></button>}</label><button className="btn btn-quiet" onClick={()=>{setCandidate("");setAddOpen(true);}}><Plus size={15}/>添加</button></div></div>
            <Tabs value={marketFilter} onValueChange={setMarketFilter} className="watchlist-tabs"><div className="filter-row"><TabsList className="filter-list" aria-label="筛选自选市场">{[["all","全部"],["crypto","加密货币"],["us","美股"],["cn","A 股"],["hk","港股"]].map(([key,label])=><TabsTrigger key={key} value={key} className="filter-trigger">{label}</TabsTrigger>)}</TabsList><Select value={sort} onValueChange={setSort}><SelectTrigger className="sorting" aria-label="自选排序"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="default">默认排序</SelectItem><SelectItem value="gainers">涨幅优先</SelectItem><SelectItem value="losers">跌幅优先</SelectItem></SelectContent></Select></div>
              <TabsContent value={marketFilter}>
                {!watchItems.length?<Empty className="empty-watch"><EmptyHeader><EmptyTitle>{watchSearch?"没有匹配的自选":"还没有这类自选"}</EmptyTitle><EmptyDescription>{watchSearch?"试试其他代码或名称，或切换市场分类。":"添加你关注的币种或股票，开始监控。"}</EmptyDescription></EmptyHeader><button className="btn" onClick={()=>setAddOpen(true)}><Plus size={15}/>添加自选</button></Empty>:<Table className="watch-table"><TableHeader><TableRow><TableHead>标的名称</TableHead><TableHead className="table-market">市场</TableHead><TableHead className="right">最新价格</TableHead><TableHead className="right">日涨跌</TableHead><TableHead className="table-trend right">日内走势</TableHead><TableHead className="table-actions right"><span className="sr-only">操作</span></TableHead></TableRow></TableHeader><TableBody>{watchItems.map(symbol=>{const a=assetFor(symbol),q=quotes[symbol],error=errors[symbol]??q?.error;return <TableRow key={symbol} className={selected===symbol?"selected":""} onClick={()=>selectAsset(symbol)}><TableCell><button className="asset-cell text-left" onClick={()=>selectAsset(symbol)} aria-label={`查看${a.name}行情`}><AssetIcon asset={a}/><span><strong>{displaySymbol(symbol)}</strong><small>{a.name===symbol?q?.name??a.name:a.name}</small></span></button></TableCell><TableCell className="table-market"><span className="market-tag">{MARKET_LABELS[a.market]}</span></TableCell><TableCell className="right"><span className="table-price numeric">{price(q?.price,q?.currency,false)}</span><span className={error?"table-meta error-text":"table-meta"}>{error?(q?"上次报价":"连接中断"):`${q?.currency??"—"} · ${formatTime(q?.timestamp,true)}`}</span></TableCell><TableCell className="right"><Change value={q?.changePercent}/><span className="table-meta">{q?.session==="closed"?"收盘":a.market==="crypto"?(symbol.endsWith("-USDT")?"24 小时":"较前收"):"常规时段"}</span></TableCell><TableCell className="table-trend right"><Sparkline points={trends[symbol]?.points??q?.points} change={q?.changePercent} intervalMs={trends[symbol]?.intervalMs??q?.historyMetadata?.intervalMs}/></TableCell><TableCell className="table-actions"><div className="table-operations"><button className="icon-btn" aria-label={`为${a.name}创建提醒`} onClick={e=>{e.stopPropagation();openAlert(symbol);}}><BellPlus size={15}/></button><button className="icon-btn" aria-label={`移除${a.name}`} onClick={e=>{e.stopPropagation();removeAsset(symbol);}}><X size={15}/></button></div></TableCell></TableRow>;})}</TableBody></Table>}
              </TabsContent>
            </Tabs><div className="watch-state-toolbar"><details className="watch-state-overview" onToggle={event=>setWatchStatesOpen(event.currentTarget.open)}><summary>自选状态总览 · {watchlist.length}</summary><p>固定 90 / 180 分钟观测，与资产详情使用同一结果；各资产证据时间分别列示。</p>{watchStatesOpen&&watchStates.symbols.map(symbol=><section className="watch-state-asset" key={symbol}><button className="watch-state-link" onClick={()=>viewAsset(symbol)}>{symbol}<span>查看图表</span></button><WatchlistState state={watchStates.states.get(symbol)!}/></section>)}{!watchlist.length&&<p>尚未添加自选。</p>}</details><button className="btn watch-export" onClick={exportWatchlist} disabled={!hydrated}>导出当前自选</button><p className="watch-export-note">仅下载本地名单，不含提醒或设置，不会启用采集。</p></div><div className="watchlist-footer"><Info size={13}/>欧易交易对显示 24 小时涨跌（USDT）；股票与旧美元交易对相对前收盘价。</div>
          </section>
        </div>
        <aside className="right-column">
          <details className="panel detail-panel"><summary>行情详情<ChevronRight size={15}/></summary><div className="detail-name"><AssetIcon asset={activeAsset}/><div><strong>{selectedName}</strong><p>{selected} · {quote?.currency??"—"}</p></div></div><div className={`detail-status ${quote?.session!=="open"||quoteError||quoteOld?"closed":""}`}><span>{quoteStatus}</span><Clock3 size={13}/></div><dl className="detail-grid"><div><dt>日内最高</dt><dd>{price(quote?.high,quote?.currency,false)}</dd></div><div><dt>日内最低</dt><dd>{price(quote?.low,quote?.currency,false)}</dd></div><div><dt>{selected.endsWith("-USDT")?"24 小时起始价":"前收盘价"}</dt><dd>{price(quote?.previousClose,quote?.currency,false)}</dd></div><div><dt>日涨跌额</dt><dd className={tone(quote?.change)}>{quote?.change!=null&&quote.change>0?"+":""}{price(quote?.change,quote?.currency,false)}</dd></div><div><dt>{activeAsset.market==="crypto"?"行情源成交额":"成交量"}</dt><dd>{compact(quote?.volume)}<span className="currency-label"> {activeAsset.market==="crypto"?quote?.currency:"股 / 份"}</span></dd></div><div><dt>报价时间 · 本地</dt><dd style={{fontSize:13}}>{formatTime(quote?.timestamp,true)}</dd></div></dl><div className="detail-action"><button className="btn btn-primary" onClick={()=>openAlert(selected)} disabled={!quote}><BellPlus size={16}/>设置价格提醒</button>{watchlist.includes(selected)?<button className="icon-btn" aria-label="移出自选" title="移出自选" onClick={()=>removeAsset(selected)}><Trash2 size={16}/></button>:<button className="icon-btn" aria-label="加入自选" title="加入自选" onClick={()=>{setCandidate(selected);setAddOpen(true);}}><Star size={17}/></button>}</div></details>
          <section className="panel alert-panel" id="price-alerts"><div className="panel-heading"><h2><Bell size={17} className="muted"/>价格提醒 <span className="count">{enabledAlerts}</span></h2><button className="icon-btn" aria-label="新建价格提醒" onClick={()=>openAlert(selected)}><Plus size={17}/></button></div><p className="alert-explanation">为关注的价格，留一个提醒。</p>{alerts.length===0?<div className="empty-alert"><div className="bell-ring"><Bell size={19}/></div><strong>还没有价格提醒</strong><p>选择标的，设定涨至或跌至的价格。</p><button className="small-link" onClick={()=>openAlert(selected)}>创建第一条提醒 <ChevronRight size={13} className="inline"/></button></div>:<div className="alert-list">{alerts.map(a=><div className="alert-item" key={a.id}><div className="alert-item-top"><strong>{displaySymbol(a.symbol)}</strong><div className="alert-tools"><Switch checked={a.enabled} onCheckedChange={enabled=>{const next=alertsRef.current.map(item=>item.id===a.id?{...item,enabled,triggeredAt:undefined,triggeredPrice:undefined,createdAt:Date.now()}:item);alertsRef.current=next;setAlerts(next);}} aria-label={`${a.enabled?"暂停":"重新启用"}${displaySymbol(a.symbol)}提醒`}/><button className="icon-btn" aria-label="删除这条提醒" onClick={()=>{const next=alertsRef.current.filter(item=>item.id!==a.id);alertsRef.current=next;setAlerts(next);}}><Trash2 size={14}/></button></div></div><p>{a.direction==="above"?"涨至 ≥":"跌至 ≤"} <span className="numeric">{price(a.target,quotes[a.symbol]?.currency??(assetFor(a.symbol).market==="cn"?"CNY":assetFor(a.symbol).market==="hk"?"HKD":"USD"))}</span></p><small>{a.triggeredAt?`已触发 · ${formatTime(a.triggeredAt,true)} · ${price(a.triggeredPrice,quotes[a.symbol]?.currency)}`:!a.enabled?"已暂停":!active?"等待监控恢复":errors[a.symbol]?"等待行情恢复":quotes[a.symbol]?.session==="closed"?"等待常规交易时段":"等待目标价"}</small></div>)}</div>}<div className="notification-line"><span>本次访问的系统通知</span><button className="small-link" onClick={()=>notifying?setNotifying(false):void enableNotifications()}>{notifying?"已开启":"开启"}</button></div><div className="data-note">本机提醒在页面运行时检查。云端每分钟监控由站主在运行设置中管理。</div></section>
          <section className="panel source-panel"><div className="market-breadth"><div className="breadth-head"><span>自选涨跌分布</span><span className="muted">{watchQuotes.length} 个有效报价</span></div><div className="breadth-track" aria-label={`${up} 个上涨，${down} 个下跌，${flat} 个持平`}><div className="breadth-up" style={{flex:up}}/><div className="breadth-flat" style={{flex:flat}}/><div className="breadth-down" style={{flex:down}}/></div><div className="breadth-labels"><span className="positive">{up} 上涨</span><span className="muted">{flat} 持平</span><span className="negative">{down} 下跌</span></div></div><details className="source-disclosure"><summary>数据来源与时效<ChevronRight size={13}/></summary><div className="data-note"><a href="https://www.okx.com/trade-spot/btc-usdt" target="_blank" rel="noreferrer">OKX 欧易</a> · USDT 现货与 K 线。<br/><a href="https://help.yahoo.com/kb/SLN2310.html" target="_blank" rel="noreferrer">Yahoo Finance <ExternalLink size={11} className="inline"/></a> · 免费行情可能延迟。更新频率不等于交易所实时数据，休市时显示最近常规时段报价。<br/><button className="small-link" style={{marginTop:8}} onClick={()=>setInfoOpen(true)}>查看使用说明</button></div></details></section>
        </aside>
      </div>
      </div>
      <footer className="footnote"><span><Activity size={13}/>市场雷达 · 行情监控</span><span>自选与提醒可同步云端 · 仅监控行情，不执行交易</span></footer>
    </main>
    <nav className="mobile-dock" aria-label="快捷操作"><a data-product-nav href="#overview" aria-current={marketMode==="classic"&&!["#watchlist","#price-alerts"].includes(section)?"page":undefined}><Activity size={19}/><span>Markets</span></a><a data-product-nav href="#radar" aria-current={marketMode==="radar"?"page":undefined}><Layers size={19}/><span>Radar</span></a><a data-product-nav href="#watchlist" aria-current={marketMode==="classic"&&section==="#watchlist"?"page":undefined}><Star size={19}/><span>自选</span></a><a data-product-nav href="#price-alerts" aria-current={marketMode==="classic"&&section==="#price-alerts"?"page":undefined}><Bell size={19}/><span>提醒</span></a><button onClick={()=>setSettingsOpen(true)}><SlidersHorizontal size={19}/><span>设置</span></button></nav>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="modal-content settings-modal"><DialogHeader><span className="settings-emblem"><SlidersHorizontal size={23}/></span><DialogTitle>运行与通知</DialogTitle><DialogDescription>选择监控方式，清楚掌握雷达何时在运行。</DialogDescription></DialogHeader>
      <div className="setting-row"><div className="setting-copy"><strong>界面动效</strong><p id="motion-description">减少开场、位移与价格光晕，保留选中、焦点和操作反馈。</p><fieldset className="experience-setting motion-setting" aria-describedby="motion-description motion-system-status"><legend className="sr-only">界面动效</legend>{(["system","normal","reduced"] as const).map(mode=><label key={mode}><input type="radio" name="motion-preference" value={mode} checked={motionPreference===mode} onChange={()=>{setMotionPreference(mode);applyMotionPreference(mode);}}/>{mode==="system"?"跟随系统":mode==="normal"?"标准":"减少"}</label>)}</fieldset><p id="motion-system-status">系统当前：{systemMotion==="reduced"?"减少动态效果":"标准动态效果"}{motionPreference!=="system"?"；已采用你的选择，可切回跟随系统。":"。"}</p></div></div>
      <div className="setting-row"><div className="setting-copy"><strong>行情显示时区</strong><p>只改变时间显示，不移动 K 线、不重新取数。当前：{zoneLabel}</p><fieldset className="experience-setting"><legend className="sr-only">行情显示时区</legend>{(["device","UTC","Asia/Shanghai"] as const).map(zone=><label key={zone}><input type="radio" name="display-timezone" value={zone} checked={displayTimePreference===zone} onChange={()=>setDisplayTimePreference(zone)}/>{zone==="device"?"设备时区":zone==="UTC"?"UTC":"北京时间"}</label>)}</fieldset></div></div>
      <div className="setting-row"><div className="setting-copy"><strong>Market Experience</strong><p>默认打开的体验；导航中可随时切换。更改后下次访问根路径生效。</p><fieldset className="experience-setting"><legend className="sr-only">默认市场体验</legend>{(["classic","radar"] as const).map(mode=><label key={mode}><input type="radio" name="market-experience" value={mode} checked={defaultMarketMode===mode} onChange={()=>setDefaultMarketMode(mode)}/>{mode==="classic"?"Classic":"Radar"}</label>)}</fieldset></div></div>
      <div className="setting-row"><div className="setting-copy"><strong><Activity size={17}/>自动监控</strong><p>前台加密货币约每 5 秒、股票约每 15 秒查询并检查提醒。</p></div><Switch checked={auto} onCheckedChange={setAuto} aria-label="开启自动监控"/></div>
      <div className="setting-row"><div className="setting-copy"><strong><Layers size={17}/>标签页后台监控</strong><p>切换到其他标签页后，每 60 秒尝试检查。浏览器可能延迟或停止执行。</p></div><Switch checked={backgroundTabs} onCheckedChange={setBackgroundTabs} aria-label="切换标签页后继续尝试监控"/></div>
      <div className="setting-row"><div className="setting-copy"><strong><Bell size={17}/>本次访问的系统通知</strong><p>浏览器支持且授权后，触价时显示系统通知。</p></div><button className="btn" onClick={()=>notifying?setNotifying(false):void enableNotifications()}>{notifying?"关闭":"开启"}</button></div>
      <CloudMonitor watchlist={watchlist} alerts={alerts}/>
      <form action="/api/access/logout" method="post"><button className="btn w-full" type="submit">退出访问</button></form>
      <p className="settings-foot"><ShieldCheck size={14}/>本机设置保存在浏览器；同步后的云端设置独立保存，可随时暂停。</p>
    </DialogContent></Dialog>

    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="modal-content"><DialogHeader><DialogTitle>添加自选</DialogTitle><DialogDescription>选择常用标的，或输入完整行情代码。最多 20 个。</DialogDescription></DialogHeader><form onSubmit={addAsset} className="grid gap-4"><div className="field"><label id="asset-search-label">搜索常用标的</label><Combobox items={ASSETS.map(a=>`${a.symbol} ${a.name}`)} onValueChange={value=>{if(typeof value==="string")setCandidate(value.split(" ")[0]);}}><ComboboxInput placeholder="搜索比特币、英伟达、腾讯…" aria-labelledby="asset-search-label" className="w-full h-11"/><ComboboxContent><ComboboxEmpty>暂无匹配标的，可在下方输入代码。</ComboboxEmpty><ComboboxList>{(item:string)=><ComboboxItem key={item} value={item} className="py-3">{item}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div><div className="field"><label htmlFor="custom-symbol">行情代码</label><input id="custom-symbol" value={candidate} onChange={e=>setCandidate(e.target.value.toUpperCase())} placeholder="例如 BTC-USD 或 AAPL" autoComplete="off" maxLength={16} required/></div><div className="custom-form"><p>加密：BTC-USD · 美股：AAPL<br/>沪市：600519.SS · 深市：300750.SZ · 港股：0700.HK</p><button className="btn btn-primary w-full" type="submit" disabled={adding||!candidate.trim()}>{adding?<Loader2 size={16} className="spin"/>:<Plus size={16}/>} {adding?"验证行情中…":"添加并查看"}</button></div></form></DialogContent></Dialog>
    <Dialog open={alertOpen} onOpenChange={setAlertOpen}><DialogContent className="modal-content"><DialogHeader><DialogTitle>设置价格提醒</DialogTitle><DialogDescription>为关注的价格设一个提醒，触发后保留记录。</DialogDescription></DialogHeader><form onSubmit={createAlert} className="grid gap-4"><div className="field"><label>监控标的</label><Select value={alertSymbol} onValueChange={value=>{setAlertSymbol(value);setTarget("");}}><SelectTrigger aria-label="选择提醒标的"><SelectValue/></SelectTrigger><SelectContent>{[...new Set([selected,...watchlist,...OVERVIEW,alertSymbol])].map(symbol=><SelectItem value={symbol} key={symbol}>{displaySymbol(symbol)} · {assetFor(symbol).name}</SelectItem>)}</SelectContent></Select></div><div className="field-row"><div className="field"><label>触发条件</label><Select value={direction} onValueChange={v=>setDirection(v as "above"|"below")}><SelectTrigger aria-label="提醒触发条件"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="above">价格涨至 ≥</SelectItem><SelectItem value="below">价格跌至 ≤</SelectItem></SelectContent></Select></div><div className="field"><label className="field-label" htmlFor="alert-price">目标价 <span className="currency-label">{quotes[alertSymbol]?.currency??"—"}</span></label><input id="alert-price" type="number" inputMode="decimal" step="any" min="0.00000001" value={target} onChange={e=>setTarget(e.target.value)} placeholder="输入价格" required/></div></div><div className="modal-note">当前报价：<strong className="numeric">{price(quotes[alertSymbol]?.price,quotes[alertSymbol]?.currency)}</strong><br/>{quotes[alertSymbol]?.session==="closed"?"当前已休市，开市且有新报价后检查。":"满足条件的有效报价到达后触发一次。"}<br/>创建后请到运行设置同步云端，关闭页面后仍可检查。锁屏推送尚未接入。</div><button className="btn btn-primary" type="submit" disabled={!quotes[alertSymbol]||!target}><BellPlus size={16}/>创建提醒</button></form></DialogContent></Dialog>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="modal-content"><DialogHeader><DialogTitle>使用说明</DialogTitle><DialogDescription>了解行情时效、提醒范围和保存方式。</DialogDescription></DialogHeader><div className="info-list"><p><strong>行情：</strong>加密货币 USDT 交易对来自 OKX 欧易，股票和旧 USD 交易对来自 Yahoo Finance，前台加密货币约每 5 秒、股票约每 15 秒查询一次；免费接口可能延迟、限流或暂时不可用。价格旁显示行情源报价时间，取数失败会保留并标记上次价格。</p><p><strong>涨跌与走势：</strong>欧易 USDT 交易对显示滚动 24 小时涨跌；股票与旧 USD 交易对相对前收盘价。股票显示常规交易时段；当前行情、图表与事件时间遵循运行设置中的显示时区；K 线分桶仍按来源规则，不因显示时区变化。</p><p><strong>提醒：</strong>开启自动监控时，前台随新报价检查（加密货币约 5 秒、股票约 15 秒）。启用标签页后台后，切走页面会以 60 秒间隔尝试检查；浏览器仍可能降频或冻结。股票休市、取数失败或报价过期时不触发。免费行情延迟也会影响提醒时间。每条触发一次，重新开启开关可再用。</p><p><strong>保存：</strong>自选与提醒保存在当前浏览器，可在运行设置手动同步至云端。云端每分钟独立检查，关闭网页后继续运行并保存触发记录；系统通知仅在网页运行时可用，锁屏推送尚未接入。</p><a href="https://help.yahoo.com/kb/SLN2310.html" target="_blank" rel="noreferrer">查看行情源交易所与延迟说明 <ExternalLink size={13} className="inline"/></a></div></DialogContent></Dialog>
  </MarketTimeProvider>;
}
