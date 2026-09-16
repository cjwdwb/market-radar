import test from 'node:test';
import assert from 'node:assert/strict';
import { scanRadar, radarCoverage, benchmarkFor, benchmarkSymbols } from '../lib/radar/engine.ts';
import { emptyRadarStore } from '../lib/radar/types.ts';
import { experienceForHash } from '../lib/radar/navigation.ts';
import { buildRadarIntelligence } from '../lib/radar/intelligence.ts';
import { assetRadarContext, chartRangeForEvent, enabledPriceAlertCounts, resolveRadarEvent, summarizeWatchlistCoverage } from '../lib/radar/workflow.ts';

const now=1_789_372_800_000;
function fixture({symbol='BTC-USDT',move=0,volume=100,at=now,count=70}={}) {
 const crypto=symbol.endsWith('-USDT'),interval=(crypto?15:5)*60_000;
 const points=Array.from({length:count},(_,i)=>{
  const close=i===count-1?100*(1+move/100):100+(i%2)*.02;
  return {time:at-(count-i)*interval,open:close,close,high:close+.02,low:close-.02,volume:i===count-1?volume:100,confirmed:true};
 });
 const source=crypto?'OKX 欧易':'Yahoo Finance',currency=crypto?'USDT':symbol.endsWith('.HK')?'HKD':/\.(SS|SZ)$/.test(symbol)?'CNY':'USD';
 const quote={symbol,name:symbol,price:points.at(-1).close,currency,source,timestamp:at,fetchedAt:at,session:'open',delayMinutes:0,points};
 return {quotes:{[symbol]:quote},histories:{[symbol]:{points,source,currency,fetchedAt:at,intervalMs:interval}},symbols:[symbol]};
}
function relativeFixture({symbol='NVDA',assetMove=-4,benchmarkMove=-.5,at=now}={}){
 const benchmark=benchmarkFor(symbol),asset=fixture({symbol,move:assetMove,at}),base=fixture({symbol:benchmark,move:benchmarkMove,at});
 return {symbols:[symbol],quotes:{...asset.quotes,...base.quotes},histories:{...asset.histories,...base.histories}};
}
test('quiet market produces no events; navigation has a stable Classic fallback and explicit hashes win',()=>{
 assert.equal(scanRadar(emptyRadarStore(),fixture(),now).signals.length,0);
 assert.equal(experienceForHash('', 'classic'),'classic');assert.equal(experienceForHash('', 'radar'),'radar');
 for(const hash of ['#overview','#watchlist','#price-alerts','#price-chart'])assert.equal(experienceForHash(hash,'radar'),'classic');
 assert.equal(experienceForHash('#radar','classic'),'radar');
});
test('real completed series triggers normalized price/range/volatility/volume events with provenance',()=>{
 const snapshot=fixture({move:3,volume:500}),result=scanRadar(emptyRadarStore(),snapshot,now);
 for(const type of ['price_move','breakout','volatility_spike','volume_spike'])assert.ok(result.signals.some(s=>s.type===type),type);
 for(const signal of result.signals){assert.equal(signal.source,'OKX 欧易');assert.equal(signal.quoteAt,now);assert.equal(signal.evidenceAt,now);assert.equal(signal.detectedAt,now);assert.ok(Number.isFinite(signal.metrics.close));}
 assert.equal(result.signals.find(s=>s.type==='volatility_spike').metrics.baselineBars,16);
 assert.ok(!result.signals.some(s=>s.type==='price_move'&&s.metrics.window==='5m'));
});
test('negative movement detects breakdown without conflating direction with severity',()=>{
 const signals=scanRadar(emptyRadarStore(),fixture({move:-3}),now).signals;
 assert.ok(signals.some(s=>s.type==='breakdown'&&s.direction==='down'));assert.ok(!signals.some(s=>s.type==='breakout'));
});
test('polling is deduplicated and deterministic, input store remains immutable',()=>{
 const snapshot=fixture({move:3,volume:500}),first=scanRadar(emptyRadarStore(),snapshot,now),serialized=JSON.stringify(first);
 const second=scanRadar(first,snapshot,now+5000);
 assert.deepEqual(second.signals,first.signals);assert.equal(JSON.stringify(first),serialized);
 assert.equal(second,first,'unchanged polling preserves store identity');
 assert.deepEqual(scanRadar(emptyRadarStore(),snapshot,now),first);
});

test('quiet scans reuse state while expiration still creates a new immutable state',()=>{
 const empty=emptyRadarStore();assert.equal(scanRadar(empty,fixture(),now),empty);
 const snapshot=fixture({move:3}),active=scanRadar(empty,snapshot,now);
 const expired=scanRadar(active,snapshot,now+46*60_000);
 assert.notEqual(expired,active);assert.ok(expired.signals.every(s=>s.status==='expired'));
 assert.ok(active.signals.every(s=>s.status==='active'));
 assert.equal(scanRadar(expired,snapshot,now+47*60_000),expired);
});
test('stale, errored, future, delayed, closed and mismatched quotes never trigger',()=>{
 for(const changes of [{timestamp:now-181000},{fetchedAt:now-121000},{timestamp:now+61000},{fetchedAt:now+61000},{error:'failed'},{symbol:'ETH-USDT'},{price:NaN}]){
  const snapshot=fixture({move:3});Object.assign(snapshot.quotes['BTC-USDT'],changes);assert.equal(scanRadar(emptyRadarStore(),snapshot,now).signals.length,0);
 }
 for(const changes of [{session:'closed'},{session:'unknown'},{delayMinutes:15}]){
  const snapshot=fixture({symbol:'NVDA',move:3});Object.assign(snapshot.quotes.NVDA,changes);assert.equal(scanRadar(emptyRadarStore(),snapshot,now).signals.length,0);
 }
});
test('all four market identities are preserved; stock volume and unsupplied benchmark signals are deferred',()=>{
 for(const [symbol,market] of [['BTC-USDT','crypto'],['NVDA','us'],['600519.SS','cn'],['0700.HK','hk']]){
  const signals=scanRadar(emptyRadarStore(),fixture({symbol,move:3,volume:500,count:22}),now).signals;
  assert.ok(signals.length);assert.ok(signals.every(s=>s.market===market));
  assert.ok(!signals.some(s=>s.type.startsWith('relative')));
  if(market!=='crypto')assert.ok(!signals.some(s=>s.type==='volume_spike'));
 }
});
test('volume requires finite candle volumes and a positive baseline, never quote turnover',()=>{
 for(const mode of ['missing','nan','zero']){
  const snapshot=fixture({volume:500}),points=snapshot.histories['BTC-USDT'].points;
  for(const p of points.slice(0,-1))p.volume=mode==='missing'?undefined:mode==='nan'?NaN:0;
  snapshot.quotes['BTC-USDT'].volume=999999999;
  assert.ok(!scanRadar(emptyRadarStore(),snapshot,now).signals.some(s=>s.type==='volume_spike'));
 }
});
test('history currency/source/freshness/interval mismatch fails closed',()=>{
 for(const changes of [{currency:'USD'},{source:'other'},{fetchedAt:now-121000},{intervalMs:3600000}]){
  const snapshot=fixture({move:3});Object.assign(snapshot.histories['BTC-USDT'],changes);assert.equal(scanRadar(emptyRadarStore(),snapshot,now).signals.length,0);
 }
});
test('incomplete candles cannot create events; current-session suffix excludes gaps and prior sessions',()=>{
 const snapshot=fixture({move:3,volume:500}),points=snapshot.histories['BTC-USDT'].points;
 points.at(-1).confirmed=false;assert.equal(scanRadar(emptyRadarStore(),snapshot,now).signals.length,0);
 const gap=fixture({move:3});gap.histories['BTC-USDT'].points.splice(-5,1);assert.equal(radarCoverage(gap,now)[0].eligible,false);
 const session=fixture({symbol:'600519.SS',move:3,count:45});
 for(const p of session.quotes['600519.SS'].points.slice(0,23))p.time-=3600000;
 assert.equal(radarCoverage(session,now)[0].eligible,true);
 assert.ok(scanRadar(emptyRadarStore(),session,now).signals.length);
});
test('recovery resolves an episode; cooldown and fresh evidence are required to rearm',()=>{
 const first=scanRadar(emptyRadarStore(),fixture({volume:500}),now);
 const recovered=scanRadar(first,fixture({at:now+900000}),now+900000);
 assert.equal(recovered.signals.find(s=>s.type==='volume_spike').status,'resolved');
 const early=scanRadar(recovered,fixture({volume:500,at:now+900001}),now+900001);
 assert.equal(early.signals.filter(s=>s.type==='volume_spike').length,1);
 const later=scanRadar(recovered,fixture({volume:500,at:now+1800000}),now+1800000);
 assert.equal(later.signals.filter(s=>s.type==='volume_spike').length,2);
});
test('expiry and paused/offline scans cannot regenerate an unrecovered episode',()=>{
 const first=scanRadar(emptyRadarStore(),fixture({volume:500}),now);
 const paused=scanRadar(first,fixture({volume:500}),now+10000,false);
 assert.ok(paused.signals.every(s=>s.status==='expired'));
 const resumed=scanRadar(paused,fixture({volume:500,at:now+3600000}),now+3600000);
 assert.equal(resumed.signals.length,1);assert.equal(resumed.signals[0].status,'expired');
 const stale=scanRadar(first,fixture({volume:500}),now+181000);
 assert.ok(stale.signals.every(s=>s.status==='expired'));
});
test('partial failure is isolated and bounded session history stays within 120 records',()=>{
 const valid=fixture({move:3});valid.symbols.push('NVDA');
 assert.ok(scanRadar(emptyRadarStore(),valid,now).signals.length);assert.equal(radarCoverage(valid,now).find(s=>s.symbol==='NVDA').eligible,false);
 const sample=scanRadar(emptyRadarStore(),fixture({volume:500}),now).signals[0];
 const store={signals:Array.from({length:140},(_,i)=>({...sample,id:`old-${i}`,status:'expired',detectedAt:now-i})),gates:{}};
 assert.equal(scanRadar(store,{quotes:{},histories:{},symbols:[]},now).signals.length,120);
});

test('unrecovered monitored volume anomaly does not reemit after 24 hours',()=>{
 let store=emptyRadarStore();
 for(let step=0;step<=100;step++){
  const at=now+step*900000,snapshot=fixture({at});
  snapshot.histories['BTC-USDT'].points.forEach((p,i)=>{p.volume=100*Math.pow(1.2,i+step);});
  store=scanRadar(store,snapshot,at);
 }
 assert.equal(store.signals.filter(s=>s.type==='volume_spike').length,1);
 assert.equal(Object.values(store.gates).filter(g=>!g.recovered).length,1);
});

test('sharp direction reversals resolve the old move and emit the opposite move independently',()=>{
 for(const direction of [1,-1]){
  const first=scanRadar(emptyRadarStore(),fixture({move:direction*3}),now);
  const next=fixture({move:-direction*3,at:now+900000});
  const prior=next.histories['BTC-USDT'].points.at(-2);prior.close=100*(1+direction*.03);prior.high=prior.close+.02;prior.low=prior.close-.02;
  const result=scanRadar(first,next,now+900000);
  const from=direction===1?'up':'down',to=direction===1?'down':'up';
  assert.ok(result.signals.some(s=>s.type==='price_move'&&s.direction===from&&s.status==='resolved'));
  assert.ok(result.signals.some(s=>s.type==='price_move'&&s.direction===to&&s.status==='active'));
  assert.ok(!result.signals.some(s=>s.type==='price_move'&&s.direction===from&&s.status==='active'));
 }
});

test('benchmark mapping is explicit and benchmark identities do not recursively benchmark',()=>{
 assert.equal(benchmarkFor('ETH-USDT'),'BTC-USDT');assert.equal(benchmarkFor('NVDA'),'QQQ');assert.equal(benchmarkFor('600519.SS'),'000300.SS');assert.equal(benchmarkFor('0700.HK'),'^HSI');
 for(const symbol of ['BTC-USDT','QQQ','SPY','^GSPC','^IXIC','000300.SS','000001.SS','^HSI','XOM','V','^DJI','CUSTOM-USDT'])assert.equal(benchmarkFor(symbol),undefined);
 assert.deepEqual(benchmarkSymbols(['ETH-USDT','SOL-USDT','NVDA','AAPL']),['BTC-USDT','QQQ']);
 const unsupported=fixture({symbol:'XOM'});assert.equal(radarCoverage(unsupported,now)[0].relativeEligible,false);assert.match(radarCoverage(unsupported,now)[0].relativeReason,/暂未配置可靠基准/);
});
test('relative confidence uses the least fresh side of the synchronized comparison',()=>{
 const snapshot=relativeFixture({assetMove:-4,benchmarkMove:-.5});snapshot.quotes.QQQ.fetchedAt=now-119000;
 const signal=scanRadar(emptyRadarStore(),snapshot,now).signals.find(s=>s.type==='relative_weakness');assert.ok(signal);
 assert.ok(signal.evidence.freshnessRatio>.98);
 const event=buildRadarIntelligence([signal],[],now).events[0];assert.notEqual(event.confidence.level,'high');assert.ok(event.confidence.reasons.some(reason=>reason.includes('新鲜度边界')));
});
test('synchronized real benchmark detects relative weakness and strength, while moving together stays quiet',()=>{
 const weak=scanRadar(emptyRadarStore(),relativeFixture({assetMove:-4,benchmarkMove:-.5}),now).signals.find(s=>s.type==='relative_weakness');
 assert.ok(weak);assert.equal(weak.evidence.benchmark.symbol,'QQQ');assert.ok(weak.metrics.relativeDeltaPercent<-3);assert.equal(weak.evidence.items[2].label,'相对差');
 const strong=scanRadar(emptyRadarStore(),relativeFixture({assetMove:4,benchmarkMove:.5}),now).signals.find(s=>s.type==='relative_strength');assert.ok(strong);
 const together=scanRadar(emptyRadarStore(),relativeFixture({assetMove:2,benchmarkMove:2}),now).signals;assert.ok(!together.some(s=>s.type.startsWith('relative_')));
 for(const signal of scanRadar(emptyRadarStore(),fixture({move:3,volume:500}),now).signals){assert.ok(signal.evidence.reason);assert.ok(signal.evidence.items.length);assert.ok(Number.isFinite(signal.fetchedAt));}
});
test('relative signals fail closed on missing, stale, mismatched, unsynchronized or insufficient benchmark data',()=>{
 const variants=[
  snapshot=>{delete snapshot.quotes.QQQ;},
  snapshot=>{snapshot.quotes.QQQ.fetchedAt=now-121000;},
  snapshot=>{snapshot.quotes.QQQ.session='closed';},
  snapshot=>{snapshot.quotes.QQQ.timestamp-=360000;},
  snapshot=>{snapshot.quotes.QQQ.source='Other';},
  snapshot=>{snapshot.quotes.QQQ.currency='EUR';},
  snapshot=>{snapshot.quotes.QQQ.points=snapshot.quotes.QQQ.points.slice(-12);},
 ];
 for(const change of variants){const snapshot=relativeFixture();change(snapshot);const result=scanRadar(emptyRadarStore(),snapshot,now);assert.ok(!result.signals.some(s=>s.type.startsWith('relative_')));assert.equal(radarCoverage(snapshot,now)[0].relativeEligible,false);}
 const staleAsset=relativeFixture();staleAsset.quotes.NVDA.fetchedAt=now-121000;assert.equal(scanRadar(emptyRadarStore(),staleAsset,now).signals.length,0);
 const crypto=relativeFixture({symbol:'ETH-USDT'});crypto.histories['BTC-USDT'].intervalMs=300000;assert.ok(!scanRadar(emptyRadarStore(),crypto,now).signals.some(s=>s.type.startsWith('relative_')));
});
test('workflow coverage summary is watchlist-only and distinguishes partial readiness',()=>{
 const coverage=[{symbol:'BTC-USDT',eligible:true,reason:'基线可用',relativeEligible:false,relativeReason:'当前标的暂未配置可靠基准'},{symbol:'NVDA',eligible:true,reason:'基线可用',relativeEligible:true,relativeReason:'同步基准可用'},{symbol:'AAPL',eligible:false,reason:'等待历史基线',relativeEligible:false,relativeReason:'等待历史基线'},{symbol:'QQQ',eligible:true,reason:'基线可用',relativeEligible:false,relativeReason:'基准'}];
 assert.deepEqual(summarizeWatchlistCoverage(coverage,['BTC-USDT','NVDA','AAPL']),{total:3,ready:1,partial:1,waiting:1,state:'partial'});
 assert.deepEqual(summarizeWatchlistCoverage(coverage,['QQQ']),{total:1,ready:0,partial:1,waiting:0,state:'partial'});
});
test('workflow chart context maps only supported signal intervals and preserves fallback',()=>{
 const event={signals:[{metrics:{intervalMinutes:60}}]};assert.equal(chartRangeForEvent(event,'15m'),'1d');
 assert.equal(chartRangeForEvent({signals:[{metrics:{intervalMinutes:5}}]},'1w'),'1d');
 assert.equal(chartRangeForEvent({signals:[{metrics:{intervalMinutes:30}}]},'1w'),'1w');
});

test('asset awareness uses current intelligence ordering and excludes other assets and inactive events',()=>{
 const raw=scanRadar(emptyRadarStore(),fixture({move:3,volume:500}),now).signals;
 const events=buildRadarIntelligence(raw,[],now).events;
 assert.equal(assetRadarContext(events,'AAPL').primaryEvent,undefined);
 const context=assetRadarContext(events,'BTC-USDT');assert.ok(context.activeEvents.length);assert.equal(context.primaryEvent,events[0]);
 const single=assetRadarContext([events[0]],'BTC-USDT');assert.equal(single.activeEvents.length,1);assert.equal(single.primaryEvent,events[0]);
 const inputs=[{...events[0],id:'resolved',status:'resolved'},{...events[0],id:'expired',status:'expired'},...events];
 assert.deepEqual(assetRadarContext(inputs,'BTC-USDT').activeEvents,events);
 for(const [i,event] of context.activeEvents.entries())assert.equal(event,events[i]);
});

test('relative awareness consumes exact current confidence and benchmark context without recomputing',()=>{
 const raw=scanRadar(emptyRadarStore(),relativeFixture(),now).signals;
 const intelligence=buildRadarIntelligence(raw,['NVDA'],now);
 const context=assetRadarContext(intelligence.events,'NVDA');
 assert.equal(context.primaryEvent,intelligence.events[0]);
 const relative=context.activeEvents.find(event=>event.signals.some(signal=>signal.type==='relative_weakness'));
 assert.ok(relative);assert.equal(relative.confidence,intelligence.events.find(event=>event.id===relative.id).confidence);
 assert.ok(relative.signals.some(signal=>signal.evidence.benchmark?.symbol==='QQQ'));
});

test('navigation references follow current lifecycle and refuse missing clusters or mismatched assets',()=>{
 const events=buildRadarIntelligence(scanRadar(emptyRadarStore(),fixture({move:3}),now).signals,[],now).events;
 const reference={symbol:'BTC-USDT',eventId:events[0].id};
 assert.equal(resolveRadarEvent(events,reference,'BTC-USDT'),events[0]);
 const updated={...events[0],status:'resolved',confidence:{level:'low',reasons:['updated']}};
 assert.equal(resolveRadarEvent([updated],reference,'BTC-USDT'),updated);
 assert.equal(assetRadarContext([updated],'BTC-USDT').activeEvents.length,0);
 assert.equal(resolveRadarEvent([{...updated,id:'new-cluster'}],reference,'BTC-USDT'),undefined);
 assert.equal(resolveRadarEvent(events,reference,'NVDA'),undefined);
 assert.equal(resolveRadarEvent([],reference,'BTC-USDT'),undefined);
 assert.equal(resolveRadarEvent(events,null,'BTC-USDT'),undefined);
});

test('watch/unwatch ranking propagates into derived asset context and alert counts stay independent',()=>{
 const a=scanRadar(emptyRadarStore(),fixture({move:3}),now).signals;
 const b=scanRadar(emptyRadarStore(),fixture({symbol:'NVDA',move:-3}),now).signals;
 const raw=[...a,...b],snapshot=JSON.stringify(raw);
 for(const watches of [['NVDA'],['BTC-USDT'],[]]){
  const events=buildRadarIntelligence(raw,watches,now).events;
  for(const symbol of ['NVDA','BTC-USDT'])assert.equal(assetRadarContext(events,symbol).primaryEvent,events.find(event=>event.symbol===symbol&&event.status==='active'));
 }
 assert.equal(JSON.stringify(raw),snapshot);
 const alerts=[{symbol:'BTC-USDT',enabled:true},{symbol:'BTC-USDT',enabled:false},{symbol:'NVDA',enabled:true}];
 assert.deepEqual([...enabledPriceAlertCounts(alerts)],[['BTC-USDT',1],['NVDA',1]]);
 assert.equal(enabledPriceAlertCounts(alerts.map(alert=>({...alert,enabled:false}))).size,0);
 assert.equal(enabledPriceAlertCounts([]).size,0);
});
