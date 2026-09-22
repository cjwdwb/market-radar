"use client";

import type { AssetStateV2 } from "@/lib/radar/asset-state-v2";
import { useState } from "react";
import { AssetStateEvidence } from "./asset-state";

const availability = { available: "可用", waiting: "等待", insufficient: "样本不足", unsupported: "不适用", invalid: "数据无效", stale: "已过期", paused: "已暂停", offline: "离线" };
function time(at: number) { return new Date(at).toISOString().replace("T", " ").slice(5, 16) + " UTC"; }

export function WatchlistState({ state }: { state: AssetStateV2 }) {
  const [expanded,setExpanded] = useState(false);
  const short = state.horizons.short, medium = state.horizons.medium;
  const transitions = [...Object.values(state.transitions.short), ...Object.values(state.transitions.medium)];
  return <div className="watch-state" data-state-symbol={state.symbol}>
    <dl className="watch-state-glance">
      {([['方向', 'direction'], ['RMS', 'volatility']] as const).map(([label, key]) => <div key={key}><dt>{label}</dt><dd><span data-watch-dimension={`short.${key}`}>90m · {short[key].availability === 'available' ? short[key].label : availability[short[key].availability]}</span><span data-watch-dimension={`medium.${key}`}>180m · {medium[key].availability === 'available' ? medium[key].label : availability[medium[key].availability]}</span></dd></div>)}
      <div><dt>相对表现 · 90m</dt><dd data-watch-dimension="relative">{state.relative.availability === 'available' ? state.relative.label : availability[state.relative.availability]}</dd></div>
      <div><dt>维度一致性</dt><dd data-watch-dimension="alignment">{state.alignment.label}{state.alignment.missing.length > 0 && <small>缺 {state.alignment.missing.length}/{state.alignment.required.length} 项</small>}</dd></div>
      <div className="watch-state-transition"><dt>历史相邻窗口比较</dt><dd>{transitions.filter(item => item.availability === 'available').length}/5 项可比较</dd></div>
    </dl>
    <p className="watch-state-time">{short.evidence ? <>90m 证据截至 <time dateTime={new Date(short.evidence.evidenceEndAt).toISOString()}>{time(short.evidence.evidenceEndAt)}</time> · {short.evidence.source}</> : short.direction.message}</p>
    <details className="watch-state-details" onToggle={event => setExpanded(event.currentTarget.open)}><summary>状态依据与限制 · {state.symbol}</summary>{expanded && <div className="asset-intelligence-details"><AssetStateEvidence state={state}/></div>}</details>
  </div>;
}
