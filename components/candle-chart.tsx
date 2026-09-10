"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { compact, price, type Point } from "@/lib/market";

export function CandleChart({ points, currency, timezone }: { points: Point[]; currency: string; timezone: string }) {
  const [focus, setFocus] = useState<number | null>(null);
  const [averages, setAverages] = useState(true), [volumeVisible, setVolumeVisible] = useState(true);
  const [windowSize, setWindowSize] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null), [width, setWidth] = useState(900);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(280, entries[0].contentRect.width)));
    observer.observe(container.current); return () => observer.disconnect();
  }, []);
  const all = points.filter(p => p.open != null && p.high != null && p.low != null);
  const count = Math.min(windowSize ?? (width < 600 ? 40 : 96), all.length);
  const candles = all.slice(-count), offset = all.length - candles.length;
  const average = (i: number, period: number) => i + 1 < period ? null : all.slice(i + 1 - period, i + 1).reduce((sum, p) => sum + p.close, 0) / period;
  if (!candles.length) return <div className="chart-empty">暂无有效 K 线数据</div>;
  const left = 12, right = width < 600 ? 78 : 100, plot = width - left - right;
  const maValues = averages ? candles.flatMap((_, i) => [average(i + offset, 7), average(i + offset, 25)]).filter((v): v is number => v !== null) : [];
  const low = Math.min(...candles.map(p => p.low!), ...maValues), high = Math.max(...candles.map(p => p.high!), ...maValues);
  const pad = Math.max((high - low) * .09, high * .0001), min = low - pad, max = high + pad;
  const y = (v: number) => 16 + (max - v) / (max - min) * (volumeVisible ? 208 : 300);
  const step = plot / candles.length, x = (i: number) => left + (i + .5) * step;
  const volMax = Math.max(1, ...candles.map(p => p.volume ?? 0));
  const index = Math.min(focus ?? candles.length - 1, candles.length - 1), selected = candles[index], last = candles.at(-1)!;
  const time = (v: number) => new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(v);
  const line = (period: number) => {
    let started = false;
    return candles.map((_, i) => { const v = average(i + offset, period); if (v === null) return ""; const command = started ? "L" : "M"; started = true; return `${command}${x(i)},${y(v)}`; }).join(" ");
  };
  function zoom(delta: number) { setWindowSize(Math.max(16, Math.min(all.length, count + delta))); setFocus(null); }
  return <div className="candlestick-panel" ref={container}>
    <div className="chart-tools" aria-label="图表工具">
      <div className="indicator-tools"><button aria-pressed={averages} onClick={() => setAverages(v => !v)}>均线 <span className="ma-short">7</span><span className="ma-long">25</span></button><button aria-pressed={volumeVisible} onClick={() => setVolumeVisible(v => !v)}>成交量</button></div>
      <div className="zoom-tools"><span>{count} 根</span><button aria-label="缩小 K 线" disabled={count >= all.length} onClick={() => zoom(16)}><Minus size={14}/></button><button aria-label="放大 K 线" disabled={count <= 16} onClick={() => zoom(-16)}><Plus size={14}/></button><button aria-label="重置图表" onClick={() => { setWindowSize(null); setFocus(null); }}><RotateCcw size={13}/></button></div>
    </div>
    <div className="candle-readout"><strong>{time(selected.time)}</strong><span>开 {price(selected.open, currency, false)}</span><span>高 {price(selected.high, currency, false)}</span><span>低 {price(selected.low, currency, false)}</span><span>收 <b className={selected.close >= selected.open! ? "positive" : "negative"}>{price(selected.close, currency, false)}</b></span><span>量 {compact(selected.volume)}</span><span className="candle-confirmation">{selected.confirmed === false ? "本根未收盘" : "已收盘"}</span></div>
    {averages && <div className="ma-readout"><span className="ma-short">MA 7 · {price(average(index + offset, 7), currency, false)}</span><span className="ma-long">MA 25 · {price(average(index + offset, 25), currency, false)}</span></div>}
    <svg viewBox={`0 0 ${width} 354`} role="img" aria-label="15 分钟 K 线与成交量，左右方向键逐根查看" tabIndex={0} style={{ width: "100%", display: "block", touchAction: "pan-y" }}
      onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setFocus(Math.max(0, Math.min(candles.length - 1, index + (e.key === "ArrowLeft" ? -1 : 1)))); } }}
      onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(); setFocus(Math.max(0, Math.min(candles.length - 1, Math.floor(((e.clientX - rect.left) / rect.width * width - left) / step)))); }} onPointerLeave={() => setFocus(null)}>
      {[0, 1, 2, 3, 4].map(i => { const value = max - (max - min) * i / 4, yy = y(value); return <g key={i}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#25282d" strokeDasharray="2 4"/><text x={width - right + 10} y={yy + 4} fill="#85888e" fontSize="11">{price(value, currency, false)}</text></g>; })}
      {volumeVisible && <text x={left} y={256} fill="#85888e" fontSize="11">成交量 · 每根 15 分钟</text>}
      {candles.map((p, i) => { const color = p.close >= p.open! ? "#00c087" : "#f6465d", xx = x(i), w = Math.max(1, step * .65), volume = (p.volume ?? 0) / volMax * 58; return <g key={p.time} opacity={p.confirmed === false ? .72 : 1}><line x1={xx} x2={xx} y1={y(p.high!)} y2={y(p.low!)} stroke={color}/><rect x={xx - w / 2} y={Math.min(y(p.open!), y(p.close))} width={w} height={Math.max(1, Math.abs(y(p.open!) - y(p.close)))} fill={color}/>{volumeVisible && <rect data-volume="true" x={xx - w / 2} y={322 - volume} width={w} height={Math.max(.5, volume)} fill={color} opacity={.45}/>}</g>; })}
      {averages && <g fill="none" strokeWidth="1.3"><path data-ma="7" d={line(7)} stroke="#dfbb66"/><path data-ma="25" d={line(25)} stroke="#a88dde"/></g>}
      <line x1={left} x2={width - right} y1={y(last.close)} y2={y(last.close)} stroke={last.close >= last.open! ? "#00c087" : "#f6465d"} strokeDasharray="4 4" opacity=".6"/>
      <rect x={width - right + 3} y={y(last.close) - 10} width={right - 5} height={20} rx={2} fill={last.close >= last.open! ? "#087b5b" : "#b93244"}/><text x={width - right + 8} y={y(last.close) + 4} fill="#fff" fontSize="11">{price(last.close, currency, false)}</text>
      <line x1={x(index)} x2={x(index)} y1={10} y2={323} stroke="#8593a3" strokeDasharray="3 3"/>
      {[0, Math.floor(candles.length / 2), candles.length - 1].filter((_, i) => width >= 600 || i !== 1).map(i => <text key={i} x={x(i)} y={346} textAnchor={i === 0 ? "start" : i === candles.length - 1 ? "end" : "middle"} fill="#85888e" fontSize="11">{time(candles[i].time)}</text>)}
    </svg>
    <div className="chart-interaction-hint">{width < 600 ? "轻触查看单根价格" : "移动光标或使用 ← → 查看单根价格"}<span>{currency} · {timezone}</span></div>
  </div>;
}
