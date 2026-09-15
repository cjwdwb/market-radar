import test from 'node:test';
import assert from 'node:assert/strict';
import { scanRadar } from '../lib/radar/engine.ts';
import { emptyRadarStore } from '../lib/radar/types.ts';
import { buildRadarIntelligence, CLUSTER_WINDOW_MS } from '../lib/radar/intelligence.ts';

const now=1_789_372_800_000,interval=900000;
function snapshot(move=3,volume=500){
 const points=Array.from({length:70},(_,i)=>{const close=i===69?100*(1+move/100):100+(i%2)*.02;return {time:now-(70-i)*interval,open:close,close,high:close+.02,low:close-.02,volume:i===69?volume:100,confirmed:true};});
 return {symbols:['BTC-USDT'],quotes:{'BTC-USDT':{symbol:'BTC-USDT',price:points.at(-1).close,currency:'USDT',source:'OKX 欧易',timestamp:now,fetchedAt:now,session:'open',delayMinutes:0,points}},histories:{'BTC-USDT':{points,source:'OKX 欧易',currency:'USDT',fetchedAt:now,intervalMs:interval}}};
}
const raw=()=>scanRadar(emptyRadarStore(),snapshot(),now).signals;
test('related active raw signals form one cluster without mutating or losing raw signals',()=>{
 const signals=raw(),serialized=JSON.stringify(signals),result=buildRadarIntelligence(signals,['BTC-USDT'],now);
 assert.ok(result.events.some(event=>event.kind!=='signal'&&event.signals.length>1));
 const presented=result.events.flatMap(event=>event.signals.map(signal=>signal.id));assert.equal(presented.length,signals.length);assert.equal(new Set(presented).size,signals.length);
 assert.equal(JSON.stringify(signals),serialized);assert.equal(result.summary.watchlistAssets,1);
});
test('confidence is deterministic, separate from severity and explains every decision',()=>{
 const signal=raw()[0],first=buildRadarIntelligence([signal],[],now).events[0],second=buildRadarIntelligence([signal],[],now).events[0];
 assert.deepEqual(first.confidence,second.confidence);assert.ok(['high','medium'].includes(first.confidence.level));assert.equal(first.confidence.reasons.length,3);assert.equal(first.severity,signal.severity);
 const boundary={...signal,id:'boundary',evidence:{...signal.evidence,freshnessRatio:.9,sampleSize:signal.evidence.minimumSamples,strength:1.01}};
 assert.equal(buildRadarIntelligence([boundary],[],now).events[0].confidence.level,'low');
});
test('different assets, incompatible directions, old windows and resolved signals never join an active cluster',()=>{
 const [a,b,...rest]=raw(),cases=[
  [a,{...b,id:'other',symbol:'ETH-USDT'}],
  [a,{...b,id:'opposite',direction:a.direction==='up'?'down':'up'}],
  [a,{...b,id:'old',evidenceAt:a.evidenceAt-CLUSTER_WINDOW_MS-1}],
  [a,{...b,id:'resolved',status:'resolved'}],
 ];
 for(const signals of cases)assert.ok(buildRadarIntelligence(signals,[],now).events.every(event=>event.kind==='signal'));
 const all=raw(),breakout=all.find(signal=>signal.type==='breakout'),volatility=all.find(signal=>signal.type==='volatility_spike');
 assert.ok(buildRadarIntelligence([breakout,volatility],[],now).events.every(event=>event.kind==='signal'));
 const up=all.find(signal=>signal.type==='price_move'&&signal.direction==='up');const down={...up,id:'down',fingerprint:'down',direction:'down'};const neutral={...volatility,id:'new-neutral',fingerprint:'new-neutral',evidenceAt:up.evidenceAt+1};
 assert.ok(buildRadarIntelligence([neutral,up,down],[],now).events.every(event=>new Set(event.signals.filter(signal=>signal.direction!=='neutral').map(signal=>signal.direction)).size<=1));
 assert.ok(rest.length);
});
test('ranking is stable and lexicographically prioritizes watchlist active clusters',()=>{
 const signals=raw(),other=signals.map(signal=>({...signal,id:'other:'+signal.id,fingerprint:'other:'+signal.fingerprint,symbol:'ETH-USDT'}));
 const result=buildRadarIntelligence([...other,...signals],['BTC-USDT'],now);
 assert.equal(result.events[0].symbol,'BTC-USDT');assert.match(result.events[0].rankingReason,/My Radar/);
 assert.deepEqual(buildRadarIntelligence([...other,...signals],['BTC-USDT'],now),result);
});
test('120 raw history records remain bounded and present as singleton history without active clustering',()=>{
 const sample=raw()[0],signals=Array.from({length:120},(_,i)=>({...sample,id:`old:${i}`,fingerprint:`old:${i}`,status:i%2?'expired':'resolved',detectedAt:now-i}));
 const result=buildRadarIntelligence(signals,[],now);assert.equal(result.events.length,120);assert.ok(result.events.every(event=>event.kind==='signal'));assert.equal(result.summary.activeEvents,0);
});
