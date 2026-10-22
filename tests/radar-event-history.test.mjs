import test from 'node:test';
import assert from 'node:assert/strict';
import { captureEventHistory, decodeEventHistory, encodeEventHistory, mergeEventHistory, syncEventHistory, EVENT_HISTORY_KEY, EVENT_HISTORY_LIMIT, EVENT_HISTORY_MAX_CHARS, EVENT_HISTORY_TTL } from '../lib/radar/event-history.ts';
import { scanRadar } from '../lib/radar/engine.ts';
import { emptyRadarStore } from '../lib/radar/types.ts';

const now = 1_789_372_800_000;
function signal(offset=0, status='active') {
  const at=now-offset, fingerprint='BTC-USDT:price_move:15m:fixture:900000:up';
  return {id:`${fingerprint}:${at}`,fingerprint,symbol:'BTC-USDT',market:'crypto',type:'price_move',title:'模拟价格异动',description:'测试专用',metric:'+3%',direction:'up',severity:'high',status,detectedAt:at,updatedAt:at,quoteAt:at,fetchedAt:at,evidenceAt:at,expiresAt:at+2700000,source:'fixture',currency:'USDT',metrics:{returnPercent:3},evidence:{reason:'明确的模拟阈值证据',items:[{label:'变化',value:3,unit:'%',threshold:1}],sampleSize:40,minimumSamples:22,strength:3,freshnessRatio:0}};
}
function storage(raw=null) { return {raw,writes:0,getItem(key){assert.equal(key,EVENT_HISTORY_KEY);return this.raw;},setItem(key,value){assert.equal(key,EVENT_HISTORY_KEY);this.writes++;this.raw=value;}}; }

test('round trip preserves original evidence, times and active-as-observed status; never mutates input',()=>{
  const s=signal(),before=JSON.stringify(s),a=captureEventHistory([], [s], now);
  assert.deepEqual(decodeEventHistory(encodeEventHistory(a),now+1000),a);
  assert.equal(a[0].signal.status,'active');assert.equal(JSON.stringify(s),before);
});
test('no changes reuse identity and perform zero additional writes, including clock-only ticks',()=>{
  const s=signal(),store=storage(),a=syncEventHistory([], [s],now,()=>store);
  const b=syncEventHistory(a.observations,[s],now+10000,()=>store);
  assert.equal(b.observations,a.observations);assert.equal(store.writes,1);
});
test('same ID lifecycle update replaces observation without duplicate or detection time drift',()=>{
  const s=signal(10000),a=captureEventHistory([], [s],now-10000),ended={...s,status:'resolved',updatedAt:now};
  const b=captureEventHistory(a,[ended],now);
  assert.equal(b.length,1);assert.equal(b[0].signal.status,'resolved');assert.equal(b[0].signal.detectedAt,s.detectedAt);assert.equal(b[0].observedAt,now);
  const restarted={...s,detectedAt:now+1000,updatedAt:now+1000};
  const c=captureEventHistory(b,[restarted],now+1000);assert.equal(c[0].signal.status,'resolved');assert.equal(c[0].signal.detectedAt,s.detectedAt);
});
test('expired and resolved remain actual observed lifecycle states, never manufactured on reload',()=>{
  for(const status of ['active','resolved','expired']){
    const s=signal(3600000,status),a=captureEventHistory([], [s],now);
    assert.equal(decodeEventHistory(encodeEventHistory(a),now+1000)[0].signal.status,status);
  }
});
test('a rescan of the same active evidence preserves first detection, regardless of tab merge order',()=>{
  const original=signal(1000),refreshed={...original,detectedAt:now,updatedAt:now};
  const old=captureEventHistory([], [original],now-1000),fresh=captureEventHistory([], [refreshed],now);
  for(const observations of [mergeEventHistory(old,fresh,now),mergeEventHistory(fresh,old,now)]){
    assert.equal(observations.length,1);assert.equal(observations[0].signal.detectedAt,now-1000);
    assert.equal(observations[0].signal.updatedAt,now);
  }
});
test('7-day retention boundary uses detection time and reading never renews it',()=>{
  const a=captureEventHistory([], [signal(EVENT_HISTORY_TTL),signal(EVENT_HISTORY_TTL-1),signal()],now);
  assert.equal(a.length,2);assert.equal(mergeEventHistory(a,[],now+1).length,1);
});
test('120-entry cap is stable, chronological, and independent of insertion order',()=>{
  const signals=Array.from({length:150},(_,i)=>signal(i*1000));
  const a=captureEventHistory([],signals,now),b=captureEventHistory([],signals.toReversed(),now);
  assert.equal(a.length,EVENT_HISTORY_LIMIT);assert.deepEqual(a,b);assert.equal(a[0].signal.detectedAt,now);
});
test('corrupt, unknown version, oversized, nonfinite and forged temporal identities are rejected',()=>{
  for(const raw of ['broken',JSON.stringify({version:2,observations:[]}), ' '.repeat(EVENT_HISTORY_MAX_CHARS+1)])assert.throws(()=>decodeEventHistory(raw,now));
  for(const field of ['detectedAt','updatedAt','quoteAt','evidenceAt','expiresAt']){
    const s=signal();s[field]=Infinity;assert.throws(()=>decodeEventHistory(encodeEventHistory([{signal:s,observedAt:now}]),now));
  }
  for(const mutation of [s=>s.id='fake',s=>s.evidenceAt++,s=>s.updatedAt=now+1,s=>s.symbol='ETH-USDT',s=>s.evidence.items[0].value=null]){
    const s=signal();mutation(s);assert.throws(()=>decodeEventHistory(encodeEventHistory([{signal:s,observedAt:now}]),now));
  }
});
test('future cross-tab records are not silently discarded and overwritten with an older clock',()=>{
  const store=storage(encodeEventHistory(captureEventHistory([], [signal()],now)));
  const result=syncEventHistory([],[],now-1,()=>store);assert.equal(result.storage,'invalid');assert.equal(store.writes,0);
  assert.equal(syncEventHistory([],[],now,()=>store).observations.length,1);
});
test('size bound preserves newest records without unbounded browser data',()=>{
  const a=captureEventHistory([],Array.from({length:120},(_,i)=>({...signal(i*1000),description:'x'.repeat(1200),evidence:{...signal().evidence,items:Array.from({length:24},()=>({label:'x'.repeat(1200),value:1}))}})),now);
  const raw=encodeEventHistory(a);assert.ok(raw.length<=EVENT_HISTORY_MAX_CHARS);
  const read=decodeEventHistory(raw,now);assert.ok(read.length<a.length);assert.equal(read[0].signal.id,a[0].signal.id);
});
test('failed read/write preserves in-session history without claiming persistence',()=>{
  const s=signal();
  for(const access of [()=>{throw Error('disabled')},()=>({getItem(){throw Error('denied')}}),()=>({getItem(){return null},setItem(){throw Error('quota')}})]){
    const r=syncEventHistory([], [s],now,access);assert.equal(r.storage,'unavailable');assert.equal(r.observations.length,1);
  }
});
test('invalid stored contents are preserved and do not block current session records',()=>{
  const store=storage('broken'),r=syncEventHistory([], [signal()],now,()=>store);
  assert.equal(r.storage,'invalid');assert.equal(r.observations.length,1);assert.equal(store.raw,'broken');assert.equal(store.writes,0);
});
test('two tabs merge independent observations and lifecycle without erasing each other',()=>{
  const store=storage(),a=syncEventHistory([], [signal()],now,()=>store);
  const b=syncEventHistory([], [signal(1000,'resolved')],now,()=>store);
  const c=syncEventHistory(a.observations,[],now,()=>store);assert.equal(c.observations.length,2);
  assert.deepEqual(c.observations,b.observations);assert.equal(store.writes,2);
});
test('empty startup is not written before restoration and archive never changes supplied live signals',()=>{
  const store=storage(),empty=[];assert.equal(syncEventHistory([],empty,now,()=>store).observations.length,0);assert.equal(store.writes,0);
  store.raw=encodeEventHistory(captureEventHistory([], [signal()],now));
  const r=syncEventHistory([],empty,now,()=>store);assert.equal(r.observations.length,1);assert.deepEqual(empty,[]);
});
test('real Engine output within existing 60s quote clock tolerance always round-trips',()=>{
  const symbol='BTC-USDT',at=now+30000,intervalMs=900000;
  const points=Array.from({length:70},(_,i)=>{const close=i===69?103:100+(i%2)*.02;return {time:at-(70-i)*intervalMs,open:close,high:close+.02,low:close-.02,close,volume:i===69?500:100,confirmed:true};});
  const snapshot={symbols:[symbol],quotes:{[symbol]:{symbol,price:103,currency:'USDT',source:'fixture',timestamp:at,fetchedAt:now,session:'open',delayMinutes:0,points:[]}},histories:{[symbol]:{points,source:'fixture',currency:'USDT',fetchedAt:now,intervalMs}}};
  const signals=scanRadar(emptyRadarStore(),snapshot,now).signals;assert.ok(signals.length>0);assert.ok(signals.some(s=>s.evidenceAt>now));
  const store=storage(),a=syncEventHistory([],signals,now,()=>store),b=syncEventHistory(a.observations,signals,now+120000,()=>store);
  assert.equal(a.storage,'saved');assert.equal(b.storage,'saved');assert.equal(b.observations.length,signals.length);assert.equal(store.writes,1);
});
test('conflicting equal-time terminal observations converge and stop cross-tab write ping-pong',()=>{
  const a=captureEventHistory([], [signal(1000,'resolved')],now),b=captureEventHistory([], [signal(1000,'expired')],now);
  assert.deepEqual(mergeEventHistory(a,b,now),mergeEventHistory(b,a,now));
  const store=storage();let left=a,right=b;
  for(let i=0;i<4;i++){left=syncEventHistory(left,[],now,()=>store).observations;right=syncEventHistory(right,[],now,()=>store).observations;}
  assert.deepEqual(left,right);const writes=store.writes;
  for(let i=0;i<3;i++){left=syncEventHistory(left,[],now,()=>store).observations;right=syncEventHistory(right,[],now,()=>store).observations;}
  assert.equal(store.writes,writes);
});
test('first detection normalization does not change version ordering across grouped merges',()=>{
  const observations=['A','B','C'].map((metric,i)=>[{signal:{...signal(1000,'resolved'),metric,detectedAt:now-900+i*100,updatedAt:now},observedAt:now}]);
  const [a,b,c]=observations;
  const left=mergeEventHistory(mergeEventHistory(a,c,now),b,now),right=mergeEventHistory(a,mergeEventHistory(c,b,now),now);
  assert.deepEqual(left,right);assert.equal(left[0].signal.detectedAt,now-900);assert.equal(left[0].signal.metric,'C');
});
