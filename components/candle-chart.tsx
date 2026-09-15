"use client";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { compact, price, type Point } from "@/lib/market";
import {useChartViewport} from "./use-chart-viewport";

export const CandleChart=memo(function CandleChart({ points, currency, timezone }: { points: Point[]; currency: string; timezone: string }) {
  const [focus, setFocus] = useState<number | null>(null);
  const [averages, setAverages] = useState(true), [volumeVisible, setVolumeVisible] = useState(true);
  const clipId=useId().replaceAll(":","");
  const container = useRef<HTMLDivElement>(null), [width, setWidth] = useState(900);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(280, entries[0].contentRect.width)));
    observer.observe(container.current); return () => observer.disconnect();
  }, []);
  const all = useMemo(()=>points.filter(p => p.open != null && p.high != null && p.low != null),[points]);
  const axisWidth=useMemo(()=>Math.min(width-100,Math.max(width<600?78:100,...all.flatMap(p=>[p.low!,p.high!,p.close].map(v=>price(v,currency,false).length*7.2+20)))),[all,width,currency]);
  const viewport=useChartViewport(all,width,axisWidth);
  const {start,count}=viewport.window,offset=Math.floor(start),end=Math.ceil(start+count);
  const candles = useMemo(()=>all.slice(offset,end),[all,offset,end]);
  const sums=useMemo(()=>{const values=[0];for(const p of all)values.push(values.at(-1)!+p.close);return values;},[all]);
  const timeFormatter=useMemo(()=>new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:timezone}),[timezone]);
  const geometry=useMemo(()=>buildGeometry(candles,sums,width,count,offset,offset,averages,volumeVisible,timeFormatter,axisWidth),[candles,sums,width,count,offset,averages,volumeVisible,timeFormatter,axisWidth]);
  const hoverFrame=useRef(0),hoverX=useRef(0),hoverRect=useRef<DOMRect|null>(null);
  const hoverHandler=useRef<(clientX:number)=>void>(()=>{});
  hoverHandler.current=clientX=>{
    if(!geometry||!viewport.svg.current)return;
    const rect=hoverRect.current??(hoverRect.current=viewport.svg.current.getBoundingClientRect());
    const next=Math.max(0,Math.min(candles.length-1,Math.floor(((clientX-rect.left)/rect.width*width-geometry.left)/geometry.step+start-offset)));
    setFocus(previous=>previous===next?previous:next);
  };
  function queueHover(clientX:number){hoverX.current=clientX;if(!hoverFrame.current)hoverFrame.current=requestAnimationFrame(()=>{hoverFrame.current=0;hoverHandler.current(hoverX.current);});}
  function clearHover(){cancelAnimationFrame(hoverFrame.current);hoverFrame.current=0;hoverRect.current=null;setFocus(null);}
  useEffect(()=>{
    const invalidate=()=>{hoverRect.current=null;};
    window.addEventListener('scroll',invalidate,{passive:true,capture:true});
    window.addEventListener('resize',invalidate,{passive:true});
    return()=>{cancelAnimationFrame(hoverFrame.current);window.removeEventListener('scroll',invalidate,true);window.removeEventListener('resize',invalidate);};
  },[]);
  useEffect(()=>{hoverRect.current=null;},[width]);
  if(!geometry)return <div className="chart-empty">暂无有效 K 线数据</div>;
  const {left,right,plot,average,time}=geometry;
  const shift=(start-offset)*geometry.step,x=(i:number)=>geometry.x(i)-shift;
  const index=Math.min(focus??candles.length-1,candles.length-1),selected=candles[index];
  function zoom(delta: number) { clearHover();viewport.zoom(delta); }
  function reset(){clearHover();viewport.reset();}
  return <div className="candlestick-panel" ref={container}>
    <div className="candle-readout"><strong>{time(selected.time)}</strong><span>开 {price(selected.open, currency, false)}</span><span>高 {price(selected.high, currency, false)}</span><span>低 {price(selected.low, currency, false)}</span><span>收 <b className={selected.close >= selected.open! ? "positive" : "negative"}>{price(selected.close, currency, false)}</b></span><span>量 {compact(selected.volume)}</span><span className="candle-confirmation">{selected.confirmed === false ? "本根未收盘" : "已收盘"}</span></div>
    {averages && <div className="ma-readout"><span className="ma-short">MA 7 · {price(average(index + offset, 7), currency, false)}</span><span className="ma-long">MA 25 · {price(average(index + offset, 25), currency, false)}</span></div>}
    <svg ref={viewport.svg} viewBox={`0 0 ${width} 354`} role="img" aria-label="15 分钟 K 线与成交量，可拖动和缩放" aria-describedby={`${clipId}-help`} tabIndex={0} data-view-start={start} data-view-count={count} data-first-time={candles[0].time} data-follow-latest={viewport.following} className={viewport.dragging?"candle-canvas dragging":"candle-canvas"} style={{ width: "100%", display: "block", touchAction: "none" }}
      onKeyDown={e=>{
        cancelAnimationFrame(hoverFrame.current);hoverFrame.current=0;
        if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();const direction=e.key==="ArrowLeft"?-1:1;if(e.shiftKey){viewport.pan(direction*Math.max(1,Math.floor(count/5)));setFocus(null);}else setFocus(Math.max(0,Math.min(candles.length-1,index+direction)));}
        else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(-16);}else if(e.key==="-"){e.preventDefault();zoom(16);}
        else if(e.key==="Home"){e.preventDefault();viewport.pan(-all.length);setFocus(null);}else if(e.key==="End"){e.preventDefault();viewport.latest();setFocus(null);}else if(e.key==="Escape"){e.preventDefault();reset();}
      }}
      onPointerDown={e=>{clearHover();hoverHandler.current(e.clientX);viewport.pointerDown(e);}}
      onPointerUp={viewport.pointerUp} onPointerCancel={viewport.pointerUp} onLostPointerCapture={viewport.pointerUp} onDoubleClick={reset}
      onPointerMove={e=>{if(viewport.pointerMove(e)){clearHover();return;}queueHover(e.clientX);}} onPointerLeave={clearHover}>
      <defs><clipPath id={clipId}><rect x={left} y={0} width={plot} height={325}/></clipPath></defs>
      <CandleScene geometry={geometry} shift={shift} clipId={clipId} currency={currency}/>
      <line x1={Math.max(left,Math.min(width-right,x(index)))} x2={Math.max(left,Math.min(width-right,x(index)))} y1={10} y2={323} stroke="#888888" strokeDasharray="3 3"/>
    </svg>
    <div className="chart-tools" aria-label="图表工具">
      <div className="indicator-tools"><button aria-pressed={averages} onClick={() => setAverages(v => !v)}>均线 <span className="ma-short">7</span><span className="ma-long">25</span></button><button aria-pressed={volumeVisible} onClick={() => setVolumeVisible(v => !v)}>成交量</button></div>
      <div className="zoom-tools"><span>{count} 根</span><button aria-label="缩小 K 线" disabled={count >= all.length} onClick={() => zoom(16)}><Minus size={14}/></button><button aria-label="放大 K 线" disabled={count <= 16} onClick={() => zoom(-16)}><Plus size={14}/></button><button aria-label="回到最新行情" disabled={viewport.following} onClick={()=>{viewport.latest();setFocus(null);}}>最新</button><button aria-label="重置图表" onClick={reset}><RotateCcw size={13}/></button></div>
    </div>
    <div className="candle-key"><span><i className="candle-key-up"/>阳线 · 实心</span><span><i className="candle-key-down"/>阴线 · 空心</span></div>
    <div className="chart-interaction-hint" id={`${clipId}-help`}>{width < 600 ? "单指拖动 · 双指缩放 · 双击复位" : "拖动平移 · Ctrl + 滚轮缩放 · 双击复位"}<span>{start<.001?"已到已加载历史起点":viewport.following?"跟随最新行情":"查看历史区间"}</span></div>
    <span className="sr-only">左右方向键查看价格；Shift 加方向键平移；加减号缩放；Home 到历史起点；End 回到最新。</span>
  </div>;
});

function buildGeometry(candles:Point[],sums:number[],width:number,count:number,start:number,offset:number,averages:boolean,volumeVisible:boolean,timeFormatter:Intl.DateTimeFormat,axisWidth:number){
  if(!candles.length)return null;
  const average=(i:number,period:number)=>i+1<period?null:(sums[i+1]-sums[i+1-period])/period;
  const left=12,right=axisWidth,plot=width-left-right;
  const maValues=averages?candles.flatMap((_,i)=>[average(i+offset,7),average(i+offset,25)]).filter((v):v is number=>v!==null):[];
  const low=Math.min(...candles.map(p=>p.low!),...maValues),high=Math.max(...candles.map(p=>p.high!),...maValues);
  const pad=Math.max((high-low)*.09,high*.0001),min=low-pad,max=high+pad;
  const y=(v:number)=>16+(max-v)/(max-min)*(volumeVisible?208:300);
  const step=plot/count,x=(i:number)=>left+(i+offset-start+.5)*step;
  const volMax=Math.max(1,...candles.map(p=>p.volume??0));
  const time=(v:number)=>timeFormatter.format(v);
  const line=(period:number)=>{let started=false;return candles.map((_,i)=>{const v=average(i+offset,period);if(v===null)return '';const command=started?'L':'M';started=true;return command+x(i)+','+y(v);}).join(' ')};
  return {candles,offset,start,count,averages,volumeVisible,width,left,right,plot,min,max,y,step,x,volMax,time,line,average,last:candles.at(-1)!};
}

// Hover moves only the readout and crosshair; candle geometry stays untouched.
const CandleScene=memo(function CandleScene({geometry,shift,clipId,currency}:{geometry:NonNullable<ReturnType<typeof buildGeometry>>;shift:number;clipId:string;currency:string}){
  const {candles,width,left,right,min,max,y,time,last,volumeVisible}=geometry;
  const x=(i:number)=>geometry.x(i)-shift;
  return <g data-chart-scene="true">
      {[0, 1, 2, 3, 4].map(i => { const value = max - (max - min) * i / 4, yy = y(value); return <g key={i}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#232323" strokeDasharray="2 4"/><text x={width - right + 10} y={yy + 4} fill="#a0a0a0" fontSize="12" opacity={Math.abs(yy-y(last.close))<17?0:1}>{price(value, currency, false)}</text></g>; })}
      {volumeVisible && <text x={left} y={256} fill="#a0a0a0" fontSize="12">成交量 · 每根 15 分钟</text>}
      <g clipPath={`url(#${clipId})`}><g transform={`translate(${-shift} 0)`}><CandleSeries geometry={geometry}/></g></g>
      <line x1={left} x2={width - right} y1={y(last.close)} y2={y(last.close)} stroke={last.close >= last.open! ? "var(--market-up)" : "var(--market-down)"} strokeDasharray="4 4" opacity=".6"/>
      <rect x={width - right + 3} y={y(last.close) - 10} width={right - 5} height={20} rx={2} fill={last.close >= last.open! ? "var(--market-up-surface)" : "var(--market-down-surface)"}/><text x={width - right + 8} y={y(last.close) + 4} fill={last.close >= last.open! ? "var(--market-up)" : "var(--market-down)"} fontSize="12">{price(last.close, currency, false)}</text>
      {[0, Math.floor(candles.length / 2), candles.length - 1].filter((_, i) => width >= 600 || i !== 1).map(i => <text key={i} x={Math.max(left,Math.min(width-right,x(i)))} y={346} textAnchor={i === 0 ? "start" : i === candles.length - 1 ? "end" : "middle"} fill="#a0a0a0" fontSize="12">{time(candles[i].time)}</text>)}
  </g>;
});

// Fractional panning translates the series as a unit instead of rewriting every candle.
const CandleSeries=memo(function CandleSeries({geometry}:{geometry:NonNullable<ReturnType<typeof buildGeometry>>}){
  const {candles,step,x,y,volMax,volumeVisible,averages,line}=geometry;
  return <g>{candles.map((p, i) => { const color = p.close >= p.open! ? "var(--market-up)" : "var(--market-down)", xx = x(i), w = Math.max(1, step * .65), volume = (p.volume ?? 0) / volMax * 58; return <g key={p.time} opacity={p.confirmed === false ? .72 : 1}><line x1={xx} x2={xx} y1={y(p.high!)} y2={y(p.low!)} stroke={color}/><rect x={xx - w / 2} y={Math.min(y(p.open!), y(p.close))} width={w} height={Math.max(1, Math.abs(y(p.open!) - y(p.close)))} fill={p.close >= p.open! ? color : "var(--surface-panel)"} stroke={color} strokeWidth={1}/>{volumeVisible && <rect data-volume="true" x={xx - w / 2} y={322 - volume} width={w} height={Math.max(.5, volume)} fill={color} opacity={.32}/>}</g>; })}
      {averages && <g fill="none" strokeWidth="1.3"><path data-ma="7" d={line(7)} stroke="#c9c9c9"/><path data-ma="25" d={line(25)} stroke="#787878" strokeDasharray="4 4"/></g>}</g>;
});
