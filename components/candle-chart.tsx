"use client";
import { useEffect, useRef, useState } from "react";
import { compact, price, type Point } from "@/lib/market";

export function CandleChart({ points, currency, timezone }: { points: Point[]; currency: string; timezone: string }) {
  const [focus, setFocus] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(320, entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const candles = points.filter(p => p.open != null && p.high != null && p.low != null).slice(width < 600 ? -40 : -96);
  if (!candles.length) return <div className="chart-empty">暂无有效 K 线数据</div>;
  const left = 12, right = width < 600 ? 74 : 94, plot = width - left - right;
  const low = Math.min(...candles.map(p => p.low!)), high = Math.max(...candles.map(p => p.high!));
  const pad = Math.max((high - low) * .08, high * .0001), min = low - pad, max = high + pad;
  const y = (v: number) => 14 + (max - v) / (max - min) * 210;
  const step = plot / candles.length, x = (i: number) => left + (i + .5) * step;
  const volMax = Math.max(1, ...candles.map(p => p.volume ?? 0));
  const index = Math.min(focus ?? candles.length - 1, candles.length - 1), selected = candles[index];
  const time = (v: number) => new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(v);
  return <div className="candlestick-panel" ref={container}>
    <div className="candle-readout" aria-live="polite"><strong>{time(selected.time)}</strong><span>开 {price(selected.open, currency, false)}</span><span>高 {price(selected.high, currency, false)}</span><span>低 {price(selected.low, currency, false)}</span><span>收 {price(selected.close, currency, false)}</span><span>量 {compact(selected.volume)}</span><span>{selected.confirmed === false ? "本根未收盘" : "已收盘"}</span></div>
    <svg viewBox={`0 0 ${width} 354`} role="img" aria-label="15 分钟 K 线与成交量，左右方向键逐根查看" tabIndex={0} style={{ width: "100%", display: "block" }}
      onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setFocus(Math.max(0, Math.min(candles.length - 1, index + (e.key === "ArrowLeft" ? -1 : 1)))); } }}
      onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(); setFocus(Math.max(0, Math.min(candles.length - 1, Math.floor(((e.clientX - rect.left) / rect.width * width - left) / step)))); }} onPointerLeave={() => setFocus(null)}>
      {[0, 1, 2, 3, 4].map(i => { const value = max - (max - min) * i / 4, yy = y(value); return <g key={i}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#29313a" strokeDasharray="3 5"/><text x={width - right + 10} y={yy + 4} fill="#8593a3" fontSize="12">{price(value, currency, false)}</text></g>; })}
      <text x={left} y={256} fill="#8593a3" fontSize="12">成交量 · 每根 15 分钟</text>
      {candles.map((p, i) => { const color = p.close >= p.open! ? "#00c087" : "#f6465d", xx = x(i), w = Math.max(1, step * .65), volume = (p.volume ?? 0) / volMax * 58; return <g key={p.time} opacity={p.confirmed === false ? .72 : 1}><line x1={xx} x2={xx} y1={y(p.high!)} y2={y(p.low!)} stroke={color}/><rect x={xx - w / 2} y={Math.min(y(p.open!), y(p.close))} width={w} height={Math.max(1, Math.abs(y(p.open!) - y(p.close)))} fill={color}/><rect x={xx - w / 2} y={322 - volume} width={w} height={Math.max(.5, volume)} fill={color} opacity={.6}/></g>; })}
      <line x1={x(index)} x2={x(index)} y1={10} y2={323} stroke="#8593a3" strokeDasharray="3 3"/>
      {[0, Math.floor(candles.length / 2), candles.length - 1].map(i => <text key={i} x={x(i)} y={346} textAnchor={i === 0 ? "start" : i === candles.length - 1 ? "end" : "middle"} fill="#8593a3" fontSize="12">{time(candles[i].time)}</text>)}
    </svg>
  </div>;
}
