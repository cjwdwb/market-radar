import test from 'node:test';
import assert from 'node:assert/strict';
import { createControlledSnapshots, APPROVED_INFERENCE_RIGHTS } from '../lib/ai/snapshot.ts';
import { buildAssetStateV2 } from '../lib/radar/asset-state-v2.ts';
import { buildMarketContext } from '../lib/ai/context.ts';
const NOW=Date.UTC(2026,9,8,12),symbol='BTC-USDT',interval=900000;
function input(){const points=Array.from({length:80},(_,i)=>({time:NOW-(80-i)*interval,open:100+i*.1,high:100+i*.1,low:100+i*.1,close:100+i*.1,volume:1,confirmed:true}));
 const q={symbol,name:symbol,currency:'USDT',source:'fixture:controlled',price:points.at(-1).close,change:null,changePercent:null,previousClose:null,high:null,low:null,volume:null,timestamp:NOW,fetchedAt:NOW,points,timezone:'UTC',session:'open',delayMinutes:0};
 return {symbols:[symbol],quotes:{[symbol]:q},histories:{[symbol]:{points,intervalMs:interval,source:q.source,currency:q.currency,fetchedAt:NOW}}};}
const rights=()=>[{source:'fixture:controlled',version:'fixture-rights-v1',expiresAt:NOW+100000,inference:true,localInterpretation:true,publicDisplay:false,kinds:['quote','direction','rms']}];
test('3.0B default inference rights empty: denies before any real source request',async()=>{assert.equal(APPROVED_INFERENCE_RIGHTS.length,0);let calls=0;const s=createControlledSnapshots(async()=>{calls++;return input();},{symbols:[symbol],now:()=>NOW});await assert.rejects(s.create('owner',symbol,new AbortController().signal),/data_permission_unavailable/);assert.equal(calls,0);});
test('3.0B controlled snapshot State matches existing domain, absent events mean not_included, unauthorized fields excluded',async()=>{
 const data=input(),before=JSON.stringify(data),s=createControlledSnapshots(async()=>data,{symbols:[symbol],rights:rights(),now:()=>NOW,id:()=> 'fixed-owned-id'});
 const r=await s.create('owner',symbol,new AbortController().signal),state=buildAssetStateV2({symbol,snapshot:data,now:NOW,enabled:true,online:true});
 assert.equal(r.context.trust,'controlled');assert.equal(r.context.evidence.find(e=>e.id==='short.direction').classification,state.horizons.short.direction.classification);
 assert.equal(r.context.evidence.find(e=>e.id==='quote').availability,'available');assert.ok(r.context.limitations.some(x=>x.includes('not_included')));assert.equal(r.context.limitations.some(x=>x.includes('当前上下文没有活跃事件')),false);
 assert.ok(r.context.evidence.every(e=>['quote','direction','rms'].includes(e.kind)));assert.equal(JSON.stringify(data),before);
 r.context.evidence[0].source='tampered';assert.equal(s.get('owner',symbol,r.snapshotId).evidence[0].source,'fixture:controlled');
 assert.throws(()=>s.get('visitor',symbol,r.snapshotId),/snapshot_not_found/);assert.throws(()=>s.get('owner','ETH-USDT',r.snapshotId),/snapshot_not_found/);assert.throws(()=>s.get('owner',symbol,'forged'),/snapshot_not_found/);
});
test('3.0B snapshot cache checks permission changes, TTL and underlying data freshness independently',async()=>{
 let now=NOW;const p=rights(),data=input();data.quotes[symbol].fetchedAt=NOW-119000;
 const s=createControlledSnapshots(async()=>data,{symbols:[symbol],rights:p,now:()=>now,id:()=> 'fresh-check'}),r=await s.create('owner',symbol,new AbortController().signal);
 now+=2000;assert.throws(()=>s.get('owner',symbol,r.snapshotId),/context_expired/);now=NOW;p[0].inference=false;assert.throws(()=>s.get('owner',symbol,r.snapshotId),/context_expired/);
});
test('3.0B source denial, malformed asset and insufficient facts remain local failures',async()=>{
 const p=rights();p[0].kinds=['quote'];const s=createControlledSnapshots(async()=>input(),{symbols:[symbol],rights:p,now:()=>NOW});await assert.rejects(s.create('owner',symbol,new AbortController().signal),/insufficient_context/);await assert.rejects(s.create('owner','ETH-USDT',new AbortController().signal),/invalid_scope/);
 const bad=input();bad.quotes[symbol].symbol='ETH-USDT';const b=createControlledSnapshots(async()=>bad,{symbols:[symbol],rights:rights(),now:()=>NOW});await assert.rejects(b.create('owner',symbol,new AbortController().signal),/asset_mismatch/);
 const no=input();no.quotes[symbol].fetchedAt=NOW-3600000;const stale=createControlledSnapshots(async()=>no,{symbols:[symbol],rights:rights(),now:()=>NOW});await assert.rejects(stale.create('owner',symbol,new AbortController().signal),/insufficient_context/);
});
test('3.0B no Radar input does not manufacture no-event financial assertion',()=>{
 const data=input(),state=buildAssetStateV2({symbol,snapshot:data,now:NOW,enabled:true,online:true});const c=buildMarketContext({symbol,state,quote:data.quotes[symbol],now:NOW,enabled:true,online:true});assert.ok(c.limitations.some(x=>x.includes('not_included')));assert.equal(c.limitations.some(x=>x.includes('当前上下文没有活跃事件')),false);
});
test('3.0B retained relative and relative transition expire when only benchmark goes stale',async()=>{
 for(const kind of ['relative','transition']){
  let now=NOW;const data=input(),eth='ETH-USDT';data.symbols=[eth,symbol];data.quotes[eth]={...structuredClone(data.quotes[symbol]),symbol:eth,fetchedAt:NOW};data.histories[eth]=structuredClone(data.histories[symbol]);data.quotes[symbol].fetchedAt=NOW-119000;
  const p=rights();p[0].kinds.push(kind);const s=createControlledSnapshots(async()=>data,{symbols:[eth],rights:p,now:()=>now,id:()=> `dependency-${kind}`});
  const result=await s.create('owner',eth,new AbortController().signal);assert.ok(result.context.evidence.some(e=>kind==='relative'?e.kind==='relative':e.id==='short.relative.transition'));
  now+=2000;assert.equal(buildAssetStateV2({symbol:eth,snapshot:data,now,enabled:true,online:true}).relative.availability,'stale');assert.throws(()=>s.get('owner',eth,result.snapshotId),/context_expired/);
 }
});
