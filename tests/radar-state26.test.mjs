import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildAssetState, directionForWindow } from '../lib/radar/asset-state.ts';
import { scanRadar,radarCoverage } from '../lib/radar/engine.ts';
import { buildRadarIntelligence } from '../lib/radar/intelligence.ts';
import { emptyRadarStore } from '../lib/radar/types.ts';
import { buildAssetStateV2,buildStateAlignment,ASSET_STATE_V2_RULES } from '../lib/radar/asset-state-v2.ts';
import { BASELINE_SHA,NOW,MINUTE,BENCHMARKS,fixture,paired,pointsFor,fromReturns,freeze,canonical,legacyCases,legacyResult } from './fixtures/state26-fixtures.mjs';

const state=(snapshot=fixture(),overrides={})=>buildAssetStateV2({snapshot,symbol:snapshot.symbols[0],now:NOW,enabled:true,online:true,...overrides});
const near=(actual,expected,epsilon=1e-9)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
const duration={short:90*MINUTE,medium:180*MINUTE};
const intervalOf=symbol=>(symbol.endsWith('-USDT')?15:5)*MINUTE;
const legacy=JSON.parse(readFileSync(new URL('./fixtures/state26-legacy-oracle.json',import.meta.url),'utf8'));
const oldApi={buildAssetState,scanRadar,radarCoverage,buildRadarIntelligence,emptyRadarStore};
assert.equal(legacy.baseline,BASELINE_SHA);
assert.deepEqual(legacy.cases.map(row=>row.name),legacyCases().map(row=>row.name));
for(const row of legacyCases())test(`2.5 full-output oracle: ${row.name}`,()=>{
  const actual=createHash('sha256').update(JSON.stringify(canonical(legacyResult(oldApi,row)))).digest('hex');
  assert.equal(actual,legacy.cases.find(expected=>expected.name===row.name).sha256,'Legacy output/message/null/precedence changed against clean 09338aa');
});

test('oracle exercises the legacy readiness/detector tail difference rather than normalizing it away',()=>{
  const row=legacyCases().find(row=>row.name==='relative-detector-older-paired-tail');
  const result=legacyResult(oldApi,row);
  assert.equal(result.state.direction.reason,'future_evidence');
  assert.equal(result.coverage[0].relativeEligible,false);
  assert.ok(result.scan.signals.some(s=>s.type==='relative_strength'));
});

for(const symbol of ['BTC-USDT','NVDA'])for(const horizonId of ['short','medium'])test(`elapsed ${symbol} ${horizonId}: exact N+1 points and RMS 1:2`,()=>{
  const interval=intervalOf(symbol),n=duration[horizonId]/interval,c=n/3,b=2*n/3;
  const result=state(fixture({symbol})).horizons[horizonId],e=result.evidence;
  assert.equal(result.direction.availability,'available');assert.equal(result.volatility.availability,'available');
  assert.equal(result.horizonId,horizonId);assert.equal(result.durationMs,duration[horizonId]);
  assert.equal(result.configId,horizonId==='short'?'short90-v1':'medium180-v1');
  assert.equal(e.pointCount,n+1);assert.equal(e.returnCount,n);assert.equal(e.currentReturnCount,c);assert.equal(e.baselineReturnCount,b);
  assert.equal(e.intervalMs,interval);assert.equal(e.closeStartAt,NOW-duration[horizonId]);assert.equal(e.closeEndAt,NOW);
  assert.equal(e.firstCandleStartAt,e.closeStartAt-interval);assert.equal(e.evidenceEndAt,NOW);
  assert.equal(e.currentStartAt,NOW-duration[horizonId]/3);assert.equal(e.baselineStartAt,NOW-duration[horizonId]);assert.equal(e.baselineEndAt,e.currentStartAt);
  assert.equal(result.direction.methodId,'direction-v1');assert.equal(result.volatility.methodId,'rms-v1');
  assert.equal(result.volatility.metrics.currentStartAt,e.currentStartAt);assert.equal(result.volatility.metrics.baselineEndAt,e.baselineEndAt);
});

test('old 22-point gate remains stricter than the mathematical short/crypto needs',()=>{
  for(const symbol of ['BTC-USDT','NVDA'])for(const count of [0,1,7,13,19,21,22,36,37]){
    const result=state(fixture({symbol,count}));
    assert.equal(result.horizons.short.direction.availability,count>=22?'available':'insufficient',`${symbol}/${count}/short`);
    assert.equal(result.horizons.medium.direction.availability,count>=(symbol==='NVDA'?37:22)?'available':'insufficient',`${symbol}/${count}/medium`);
    if(count<22)assert.equal(result.horizons.short.direction.reason,'insufficient_contiguous_bars');
  }
});

test('stock lunch/overnight reset and real session lengths preserve structural insufficiency',()=>{
  for(const symbol of ['600519.SS','0700.HK'])for(const count of [24,30,36]){
    const result=state(fixture({symbol,count}));assert.equal(result.horizons.short.direction.availability,'available');
    assert.equal(result.horizons.medium.direction.availability,'insufficient');
  }
  for(const gap of [90*MINUTE,18*60*MINUTE]){
    const f=fixture({symbol:'600519.SS',count:70});pointsFor(f).slice(0,-21).forEach(p=>p.time-=gap);
    assert.equal(state(f).horizons.short.direction.reason,'insufficient_contiguous_bars');
  }
  const f=fixture({symbol:'NVDA',count:100});const result=state(f);
  assert.equal(result.horizons.short.evidence.validatedPointCount,80);
  assert.equal(result.horizons.medium.evidence.validatedPointCount,80);
});

for(const symbol of ['BTC-USDT','NVDA'])for(const horizonId of ['short','medium'])test(`Direction thresholds and efficiency ${symbol}/${horizonId}`,()=>{
  const interval=intervalOf(symbol),n=duration[horizonId]/interval;
  const floor=(symbol==='BTC-USDT'?.30:.15)*(horizonId==='medium'?2:1);
  for(const sign of [-1,1])for(const offset of [-1e-7,1e-7]){
    const close=100*(1+sign*(floor+offset)/100);
    const prices=[...Array(80-n).fill(100),...Array(n).fill(close)];
    const result=state(fixture({symbol,closes:prices})).horizons[horizonId].direction;
    assert.equal(result.metrics.minimumNetPercent,floor);assert.equal(result.metrics.minimumEfficiency,.6);
    assert.equal(result.classification,offset<0?'no_direction':sign>0?'upward':'downward');
    near(result.metrics.netPercent,sign*(floor+offset));assert.equal(result.metrics.efficiency,1);
  }
  for(const [dip,expected] of [[.999999,'upward'],[1,'upward'],[1.000001,'no_direction']]){
    const prices=[...Array(80-n).fill(100),100-dip,...Array(n-1).fill(103)];
    const result=state(fixture({symbol,closes:prices})).horizons[horizonId].direction;
    assert.equal(result.classification,expected);if(dip===1)assert.equal(result.metrics.efficiency,.6);
  }
});

test('shared direction math uses >= at the exact representable net threshold, without decimal rounding assumptions',()=>{
  // .15/.30% are not generally exactly representable after division and *100.
  // The pure method's configured boundary is deliberately the exact double below.
  const prices=[{close:100,time:1},{close:100.3,time:2}],actual=(100.3/100-1)*100;
  assert.equal(directionForWindow(prices,actual-1e-10,'test').classification,'upward');
  assert.equal(directionForWindow(prices,actual,'test').classification,'upward');
  assert.equal(directionForWindow(prices,actual+1e-10,'test').classification,'no_direction');
});

for(const symbol of ['BTC-USDT','NVDA'])for(const horizonId of ['short','medium'])test(`RMS exact boundaries ${symbol}/${horizonId}`,()=>{
  const n=duration[horizonId]/intervalOf(symbol),c=n/3,b=2*n/3;
  for(const [baseline,current,expected,ratio] of [[100,150,'higher',1.5],[150,100,'lower',2/3],[100,100,'similar',1],[100,0,'lower',0]]){
    const result=state(fromReturns([...Array(b).fill(baseline),...Array(c).fill(current)],{symbol})).horizons[horizonId].volatility;
    assert.equal(result.classification,expected);assert.equal(result.metrics.ratio,ratio);
    assert.equal(result.metrics.currentRmsPercent,current);assert.equal(result.metrics.baselineRmsPercent,baseline);
  }
  for(const [current,expected] of [[149.9999,'similar'],[150.0001,'higher'],[66.6666,'lower'],[66.6667,'similar']]){
    assert.equal(state(fromReturns([...Array(b).fill(100),...Array(c).fill(current)],{symbol})).horizons[horizonId].volatility.classification,expected);
  }
  const zero=state(fromReturns([...Array(b).fill(0),...Array(c).fill(1)],{symbol})).horizons[horizonId];
  assert.equal(zero.direction.availability,'available');assert.equal(zero.volatility.reason,'baseline_too_small');assert.equal(zero.volatility.metrics.ratio,null);
});

test('bad input, quote skew, unfinished evidence and freshness preserve State failure precedence',()=>{
  const input=fixture();
  for(const [overrides,reason] of [[{online:false,enabled:false,now:undefined},'offline'],[{enabled:false,now:undefined},'paused'],[{now:undefined},'awaiting_clock'],[{now:NaN},'awaiting_clock']]){
    const result=state(input,overrides);for(const h of Object.values(result.horizons)){assert.equal(h.direction.reason,reason);assert.equal(h.direction.classification,null);assert.equal(h.evidence,null);}
  }
  const future=fixture({end:NOW+60000});future.quotes['BTC-USDT'].timestamp=NOW+60000;
  assert.equal(state(future).horizons.short.direction.reason,'future_evidence');
  const ignored=fixture();pointsFor(ignored).push({...pointsFor(ignored).at(-1),time:NOW,close:999});assert.deepEqual(state(ignored),state(input));
  for(const adjust of [-900000,900000,1]){const f=fixture({count:30});pointsFor(f)[20].time+=adjust;assert.equal(state(f).horizons.short.direction.reason,'insufficient_contiguous_bars');}
  const expired=fixture({end:NOW-960001});assert.equal(state(expired).horizons.short.direction.reason,'stale_evidence');
  assert.equal(state(fixture({end:NOW-960000})).horizons.short.direction.availability,'available');
});

test('v2 numeric overflow never leaks non-finite values and does not turn null into zero',()=>{
  const f=fixture({closes:[...Array(78).fill(1e-300),1e300,1e300]}),result=state(f);
  for(const h of Object.values(result.horizons))for(const dimension of [h.direction,h.volatility]){assert.equal(dimension.reason,'invalid_numeric');assert.equal(dimension.classification,null);assert.equal(dimension.metrics,null);}
  const visit=v=>{if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(result);
});

test('Relative uses only the existing exact benchmark mapping, including all configured symbols',()=>{
  for(const [symbol,benchmark] of Object.entries(BENCHMARKS)){
    const result=state(paired({symbol})).relative;assert.equal(result.benchmarkSymbol,benchmark);assert.equal(result.availability,'available');
    assert.equal(result.methodId,'relative-window-v1');assert.equal(result.configId,'short90-v1');assert.equal(result.horizonId,'short');
    assert.equal(result.evidence.asset.latestEndAt,NOW);assert.equal(result.evidence.benchmark.latestEndAt,NOW);
    assert.equal(result.evidence.pointCount,symbol.endsWith('-USDT')?7:19);assert.equal(result.evidence.returnCount,symbol.endsWith('-USDT')?6:18);
  }
  for(const symbol of ['BTC-USDT','QQQ','000300.SS','^HSI','XOM','CUSTOM-USDT']){
    const result=state(fixture({symbol}));assert.equal(result.relative.availability,'unsupported');assert.equal(result.relative.reason,'no_benchmark');assert.equal(result.relative.classification,null);
    assert.equal(result.horizons.short.direction.availability,'available');
  }
});

test('Relative independently computes percentage-point returns over exact 90-minute endpoints',()=>{
  for(const symbol of ['NVDA','ETH-USDT']){
    const benchmark=BENCHMARKS[symbol],n=90*MINUTE/intervalOf(symbol),f=paired({symbol});
    pointsFor(f,symbol).slice(-n-1).forEach((p,i)=>p.close=i===0?100:102);
    pointsFor(f,benchmark).slice(-n-1).forEach((p,i)=>p.close=i===0?200:202);
    const r=state(f).relative;near(r.metrics.assetReturnPercent,2);near(r.metrics.benchmarkReturnPercent,1);near(r.metrics.deltaPercentagePoints,1);
    assert.equal(r.classification,'stronger');assert.equal(r.metrics.unit,'percentage_points');
    assert.equal(r.evidence.closeStartAt,NOW-90*MINUTE);assert.equal(r.evidence.closeEndAt,NOW);
    assert.equal(r.evidence.asset.quoteAt,NOW);assert.equal(r.evidence.benchmark.quoteFetchedAt,NOW);assert.equal(r.evidence.benchmark.historyFetchedAt,NOW);
    for(const sign of [-1,1])for(const offset of [-1e-7,0,1e-7]){
      const threshold=symbol==='NVDA'?.15:.30,delta=sign*(threshold+offset);
      const sample=paired({symbol,asset:{step:0},reference:{step:0}});pointsFor(sample).at(-1).close=100*(1+delta/100);
      const r=state(sample).relative,computed=(pointsFor(sample).at(-1).close/100-1)*100;
      assert.equal(r.metrics.thresholdPercentagePoints,threshold);near(r.metrics.deltaPercentagePoints,delta);
      // Nominal decimal equality retains the same finite double arithmetic as the method.
      assert.equal(r.classification,computed>=threshold?'stronger':computed<=-threshold?'underperforming':'similar');
    }
  }
});

test('benchmark failures are local and preserve their input reason',()=>{
  const mutations=[
    [f=>delete f.quotes.QQQ,'waiting','awaiting_quote'],[f=>f.quotes.QQQ.error='unavailable','invalid','quote_failed'],
    [f=>f.quotes.QQQ.fetchedAt=NOW-120001,'stale','stale_quote'],[f=>f.quotes.QQQ.session='closed','insufficient','session_unavailable'],
    [f=>f.quotes.QQQ.points=f.quotes.QQQ.points.slice(-21),'insufficient','insufficient_contiguous_bars'],
  ];
  for(const [mutate,availability,inputReason] of mutations){const f=paired(),before=state(f);mutate(f);const result=state(f);
    assert.deepEqual(result.horizons,before.horizons);assert.equal(result.relative.classification,null);assert.equal(result.relative.availability,availability);
    assert.equal(result.relative.reason,'benchmark_input_failed');assert.equal(result.relative.inputReason,inputReason);assert.equal(result.relative.failedSide,'benchmark');
  }
  for(const [field,value,reason] of [['source','Other','source_mismatch'],['currency','EUR','currency_mismatch']]){
    const f=paired();f.quotes.QQQ[field]=value;assert.equal(state(f).relative.reason,reason);assert.equal(state(f).relative.availability,'invalid');
  }
});

test('crypto benchmark history gates retain nested causes and current State survives each failure',()=>{
  const changes=[
    [f=>delete f.histories['BTC-USDT'],'waiting','awaiting_history'],
    [f=>f.histories['BTC-USDT'].source='Other','invalid','source_currency_mismatch'],
    [f=>f.histories['BTC-USDT'].currency='USD','invalid','source_currency_mismatch'],
    [f=>f.histories['BTC-USDT'].fetchedAt=NOW-120001,'stale','stale_history'],
    [f=>f.histories['BTC-USDT'].intervalMs=5*MINUTE,'unsupported','unsupported_interval'],
    [f=>{f.histories['BTC-USDT'].points=f.histories['BTC-USDT'].points.slice(-22);f.histories['BTC-USDT'].points.at(-1).confirmed=false;},'insufficient','insufficient_contiguous_bars'],
    [f=>{f.quotes['BTC-USDT'].timestamp=NOW+60000;pointsFor(f,'BTC-USDT').forEach(p=>p.time+=60000);},'invalid','future_evidence'],
  ];
  for(const [change,availability,inputReason] of changes){
    const f=paired({symbol:'ETH-USDT'}),before=state(f);change(f);const after=state(f);
    assert.deepEqual(after.horizons,before.horizons);assert.equal(after.relative.reason,'benchmark_input_failed');
    assert.equal(after.relative.availability,availability);assert.equal(after.relative.inputReason,inputReason);assert.equal(after.relative.metrics,null);
    assert.equal(after.transitions.short.relative.reason,'current_unavailable');
  }
});

test('near-zero RMS reference fails only that metric and the result always stays finite',()=>{
  for(const symbol of ['BTC-USDT','NVDA'])for(const horizonId of ['short','medium']){
    const n=duration[horizonId]/intervalOf(symbol),c=n/3,b=2*n/3;
    for(const [baseline,available] of [[1e-7,false],[.999e-6,false],[1.001e-6,true],[2e-6,true]]){
      const result=state(fromReturns([...Array(b).fill(baseline),...Array(c).fill(1)],{symbol})).horizons[horizonId];
      assert.equal(result.direction.availability,'available');assert.equal(result.volatility.availability,available?'available':'insufficient');
      assert.equal(result.volatility.metrics.minimumBaselinePercent,1e-6);
      if(!available){assert.equal(result.volatility.reason,'baseline_too_small');assert.equal(result.volatility.metrics.ratio,null);}
      for(const value of Object.values(result.volatility.metrics))if(typeof value==='number')assert.ok(Number.isFinite(value));
    }
  }
});

test('Relative requires the exact pair start, every internal point and the same latest tail',()=>{
  for(const symbol of ['NVDA','ETH-USDT']){
    const benchmark=BENCHMARKS[symbol],n=90*MINUTE/intervalOf(symbol);
    for(const offset of [-n-1,-Math.ceil(n/2),-1]){
      const f=paired({symbol});pointsFor(f,benchmark).splice(offset,1);const result=state(f);
      assert.equal(result.horizons.short.direction.availability,'available');assert.equal(result.relative.classification,null);
      if(offset===-1)assert.equal(result.relative.reason,'tail_mismatch');else assert.equal(result.relative.inputReason,'insufficient_contiguous_bars');
    }
    const shifted=paired({symbol});pointsFor(shifted,benchmark).forEach(p=>p.time-=1);
    const shiftedResult=state(shifted).relative;
    assert.equal(shiftedResult.classification,null,'No nearest/rounded-grid matching is permitted');
    assert.equal(shiftedResult.availability,'invalid');assert.equal(shiftedResult.reason,'pair_grid_mismatch');
    const assetMissing=paired({symbol});pointsFor(assetMissing).splice(-1,1);
    assert.equal(state(assetMissing).relative.reason,'tail_mismatch');
  }
});

function alignmentInput(short='upward',medium='upward',relative='stronger') {
  const horizon=(id,classification)=>({horizonId:id,durationMs:duration[id],configId:id==='short'?'short90-v1':'medium180-v1',direction:{availability:classification?'available':'insufficient',classification,reason:classification?null:'insufficient_contiguous_bars',label:'test',message:'test',metrics:null,methodId:'direction-v1'},volatility:{availability:'available',classification:'higher',methodId:'rms-v1'},evidence:{closeStartAt:NOW-duration[id],closeEndAt:NOW}});
  return [{short:horizon('short',short),medium:horizon('medium',medium)},{horizonId:'short',durationMs:duration.short,configId:'short90-v1',methodId:'relative-window-v1',availability:relative?'available':'waiting',classification:relative,reason:relative?null:'benchmark_input_failed',message:'test',evidence:relative?{closeStartAt:NOW-duration.short,closeEndAt:NOW}:null}];
}

test('Alignment complete truth table has no RMS vote, score or confidence',()=>{
  const dirs=['upward','downward','no_direction'],rels=['stronger','underperforming','similar'];
  const expected=[
    [['aligned','mixed','neutral'],['mixed','mixed','mixed'],['mixed','mixed','mixed']],
    [['mixed','mixed','mixed'],['mixed','aligned','neutral'],['mixed','mixed','mixed']],
    [['mixed','mixed','mixed'],['mixed','mixed','mixed'],['neutral','neutral','neutral']],
  ];
  dirs.forEach((s,i)=>dirs.forEach((m,j)=>rels.forEach((r,k)=>{
    const input=alignmentInput(s,m,r),result=buildStateAlignment(...input);assert.equal(result.classification,expected[i][j][k],`${s}/${m}/${r}`);
    assert.equal(result.evaluated.length,3);assert.equal(result.missing.length,0);assert.equal(result.closeEndAt,NOW);
    assert.deepEqual(result.required,['short.direction','medium.direction','short.relative']);
    input[0].short.volatility.classification='lower';input[0].medium.volatility={availability:'invalid',classification:null};assert.deepEqual(buildStateAlignment(...input),result);
    for(const key of ['score','confidence','weight'])assert.equal(Object.hasOwn(result,key),false);
  })));
});

test('Alignment known disagreements survive missing and incompatible participants',()=>{
  for(const [s,m,r,expected] of [['upward','downward',null,'mixed'],['upward',null,'underperforming','mixed'],['upward','upward',null,'insufficient'],[null,null,'stronger','insufficient'],[null,null,null,'insufficient']]){
    const result=buildStateAlignment(...alignmentInput(s,m,r));assert.equal(result.classification,expected);assert.ok(result.missing.length>0);
  }
  const same=alignmentInput();same[0].medium.evidence.closeEndAt-=5*MINUTE;same[1].evidence.closeEndAt-=10*MINUTE;
  assert.equal(buildStateAlignment(...same).classification,'insufficient');
  const mixed=alignmentInput('upward','downward','stronger');mixed[1].evidence.closeEndAt-=5*MINUTE;
  const r=buildStateAlignment(...mixed);assert.equal(r.classification,'mixed');assert.equal(r.missing[0].reason,'incompatible_evidence');
});

test('derivation is immutable/deterministic and independent of event/store/user/chart inputs',()=>{
  const snapshot=freeze(paired()),before=JSON.stringify(snapshot),base=state(snapshot);assert.deepEqual(state(snapshot),base);
  for(const extras of [{events:[{symbol:'NVDA',confidence:'high'}],signals:[{}]},{watchlist:[],alertCount:8,store:{signals:[{}]}},{chartRange:'3m',chartViewport:[1,2],coverage:[{relativeEligible:true}]}])assert.deepEqual(state(snapshot,extras),base);
  assert.equal(JSON.stringify(snapshot),before);assert.ok(Object.isFrozen(ASSET_STATE_V2_RULES));
  assert.ok(Object.isFrozen(ASSET_STATE_V2_RULES.short));assert.ok(Object.isFrozen(ASSET_STATE_V2_RULES.medium));
});

for(const symbol of ['BTC-USDT','NVDA'])for(const horizonId of ['short','medium'])test(`Transition adjacent evidence and shared-baseline arithmetic ${symbol}/${horizonId}`,()=>{
  const result=state(fixture({symbol})),h=duration[horizonId],c=h/3;
  for(const dimension of ['direction','volatility']){
    const t=result.transitions[horizonId][dimension],shift=dimension==='direction'?h:c;
    assert.equal(t.status,'unchanged');assert.equal(t.availability,'available');assert.equal(t.reason,null);assert.equal(t.inputReason,null);
    assert.equal(t.methodId,'historical-adjacent-v1');assert.equal(t.horizonId,horizonId);assert.equal(t.dimension,dimension);
    assert.equal(t.shiftMs,shift);assert.equal(t.returnOverlapMs,0);assert.equal(t.baselineOverlapMs,dimension==='volatility'?c:0);
    assert.deepEqual(t.currentWindow.dependency,{closeStartAt:NOW-h,closeEndAt:NOW});
    assert.deepEqual(t.previousWindow.dependency,{closeStartAt:NOW-h-shift,closeEndAt:NOW-shift});
    assert.deepEqual(t.currentWindow.observation,{closeStartAt:NOW-shift,closeEndAt:NOW});
    assert.deepEqual(t.previousWindow.observation,{closeStartAt:NOW-2*shift,closeEndAt:NOW-shift});
    assert.equal(t.previousWindow.observation.closeEndAt,t.currentWindow.observation.closeStartAt);
    if(dimension==='direction'){assert.equal(t.currentWindow.baseline,null);assert.equal(t.previousWindow.baseline,null);}
    else {
      assert.deepEqual(t.currentWindow.baseline,{closeStartAt:NOW-h,closeEndAt:NOW-c});
      assert.deepEqual(t.previousWindow.baseline,{closeStartAt:NOW-h-c,closeEndAt:NOW-2*c});
      assert.equal(Math.min(t.currentWindow.baseline.closeEndAt,t.previousWindow.baseline.closeEndAt)-Math.max(t.currentWindow.baseline.closeStartAt,t.previousWindow.baseline.closeStartAt),c);
      assert.match(t.overlapMessage,/基线/);
    }
    assert.deepEqual(t.current.windows,t.currentWindow);assert.deepEqual(t.previous.windows,t.previousWindow);
    for(const side of [t.current,t.previous]){
      assert.equal(side.intervalMs,intervalOf(symbol));assert.equal(side.configId,horizonId==='short'?'short90-v1':'medium180-v1');
      assert.equal(side.methodId,dimension==='direction'?'direction-v1':'rms-v1');
      assert.equal(side.source,symbol==='BTC-USDT'?'OKX 欧易':'Yahoo Finance');assert.equal(side.currency,symbol==='BTC-USDT'?'USDT':'USD');
    }
    for(const key of ['shiftAt','reversalAt','strengthening','weakening','eventId'])assert.equal(Object.hasOwn(t,key),false);
  }
});

test('Transition minimums are 2N+1 for Direction and N+C/interval+1 for RMS, still gated by 22',()=>{
  for(const symbol of ['BTC-USDT','NVDA'])for(const horizonId of ['short','medium'])for(const dimension of ['direction','volatility']){
    const n=duration[horizonId]/intervalOf(symbol),needed=Math.max(22,(dimension==='direction'?2*n:n+n/3)+1);
    for(const count of [needed-1,needed,needed+1]){
      const result=state(fixture({symbol,count})),t=result.transitions[horizonId][dimension];
      assert.equal(t.status==='unavailable',count<needed,`${symbol}/${horizonId}/${dimension}/${count}`);
      if(count>=Math.max(22,n+1))assert.equal(result.horizons[horizonId][dimension].availability,'available');
      if(count<needed&&count>=Math.max(22,n+1)){assert.equal(t.reason,'insufficient_previous');assert.equal(t.previous,null);assert.ok(t.current);}
    }
  }
});

test('Transition Direction and Relative use adjacent disjoint returns and detect a hand-built down-to-up change',()=>{
  for(const symbol of ['ETH-USDT','NVDA'])for(const horizonId of ['short','medium']){
    const n=duration[horizonId]/intervalOf(symbol),prices=Array(80-2*n-1).fill(200);
    for(let i=0;i<=2*n;i++)prices.push(i<=n?200-100*i/n:100+100*(i-n)/n);
    const f=paired({symbol,asset:{closes:prices},reference:{step:0}}),result=state(f),t=result.transitions[horizonId].direction;
    assert.equal(t.status,'changed');assert.equal(t.previous.classification,'downward');assert.equal(t.current.classification,'upward');
    near(t.previous.metrics.netPercent,-50);near(t.current.metrics.netPercent,100);assert.equal(t.previous.metrics.efficiency,1);assert.equal(t.current.metrics.efficiency,1);
    if(horizonId==='short'){
      const relative=result.transitions.short.relative;assert.equal(relative.status,'changed');assert.equal(relative.previous.classification,'underperforming');assert.equal(relative.current.classification,'stronger');
      near(relative.previous.metrics.deltaPercentagePoints,-50);near(relative.current.metrics.deltaPercentagePoints,100);
      assert.equal(relative.shiftMs,90*MINUTE);assert.equal(relative.returnOverlapMs,0);
      assert.deepEqual(relative.currentWindow.observation,{closeStartAt:NOW-90*MINUTE,closeEndAt:NOW});
      assert.deepEqual(relative.previousWindow.observation,{closeStartAt:NOW-180*MINUTE,closeEndAt:NOW-90*MINUTE});
      assert.equal(relative.previous.configId,'short90-v1');assert.equal(relative.current.methodId,'relative-window-v1');
    }
  }
});

test('Transition RMS previous gets its own baseline, including exact higher/lower boundary changes',()=>{
  for(const symbol of ['BTC-USDT','NVDA'])for(const horizonId of ['short','medium']){
    const c=duration[horizonId]/intervalOf(symbol)/3;
    for(const [oldReturn,newReturn,newClass,ratio] of [[100,150,'higher',1.5],[150,100,'lower',2/3]]){
      const f=fromReturns([...Array(3*c).fill(oldReturn),...Array(c).fill(newReturn)],{symbol}),result=state(f),t=result.transitions[horizonId].volatility;
      assert.equal(t.status,'changed');assert.equal(t.previous.classification,'similar');assert.equal(t.current.classification,newClass);
      assert.equal(t.previous.metrics.currentRmsPercent,oldReturn);assert.equal(t.previous.metrics.baselineRmsPercent,oldReturn);assert.equal(t.previous.metrics.ratio,1);
      assert.equal(t.current.metrics.currentRmsPercent,newReturn);assert.equal(t.current.metrics.baselineRmsPercent,oldReturn);assert.equal(t.current.metrics.ratio,ratio);
      assert.deepEqual(t.current.metrics,result.horizons[horizonId].volatility.metrics);
    }
  }
});

test('Transition previous numerical/zero-baseline failure never clears valid current or other dimensions',()=>{
  const f=fromReturns([0,0,0,0,100,100,100,100]),result=state(f),rms=result.transitions.short.volatility;
  assert.equal(result.horizons.short.volatility.availability,'available');assert.equal(rms.status,'unavailable');assert.equal(rms.reason,'previous_unavailable');assert.equal(rms.inputReason,'baseline_too_small');
  assert.equal(rms.previous,null);assert.ok(rms.current);assert.notEqual(result.transitions.short.direction.status,'unavailable');
  const prices=[...Array(73).fill(1e-300),...Array(7).fill(1e300)],overflow=state(paired({symbol:'ETH-USDT',asset:{closes:prices},reference:{step:0}}));
  assert.equal(overflow.horizons.short.direction.availability,'available');assert.equal(overflow.transitions.short.direction.reason,'previous_unavailable');
  assert.equal(overflow.transitions.short.direction.inputReason,'invalid_numeric');assert.equal(overflow.relative.availability,'available');assert.equal(overflow.transitions.short.relative.inputReason,'invalid_numeric');
});

test('Transition cannot backfill an unavailable current from historical or other valid states',()=>{
  for(const overrides of [{online:false},{enabled:false},{now:undefined}]){
    const result=state(paired(),overrides);
    for(const t of [...Object.values(result.transitions.short),...Object.values(result.transitions.medium)]){
      assert.equal(t.status,'unavailable');assert.equal(t.reason,'current_unavailable');assert.equal(t.current,null);assert.equal(t.previous,null);
    }
  }
  const f=paired();f.quotes.QQQ.error='failed';const result=state(f);
  assert.equal(result.transitions.short.relative.status,'unavailable');assert.equal(result.transitions.short.relative.reason,'current_unavailable');
  assert.notEqual(result.transitions.short.direction.status,'unavailable');assert.notEqual(result.transitions.short.volatility.status,'unavailable');
  assert.notEqual(result.transitions.medium.direction.status,'unavailable');
});

test('Transition previous result never consumes prices after its historical endpoint',()=>{
  for(const symbol of ['ETH-USDT','NVDA'])for(const horizonId of ['short','medium'])for(const dimension of ['direction','volatility']){
    const f=paired({symbol}),before=state(f).transitions[horizonId][dimension];assert.ok(before.previous);
    const end=before.previousWindow.observation.closeEndAt,interval=intervalOf(symbol);
    pointsFor(f).filter(p=>p.time+interval>end).forEach((p,i)=>p.close*=1.01+i*.001);
    const after=state(f).transitions[horizonId][dimension];assert.deepEqual(after.previous,before.previous,`${symbol}/${horizonId}/${dimension}`);
    assert.notDeepEqual(after.current.metrics,before.current.metrics);
  }
  for(const symbol of ['ETH-USDT','NVDA']){
    const f=paired({symbol}),before=state(f).transitions.short.relative,interval=intervalOf(symbol),end=before.previousWindow.observation.closeEndAt;
    pointsFor(f).filter(p=>p.time+interval>end).forEach(p=>p.close*=1.02);
    pointsFor(f,BENCHMARKS[symbol]).filter(p=>p.time+interval>end).forEach(p=>p.close*=1.01);
    const after=state(f).transitions.short.relative;assert.deepEqual(after.previous,before.previous);assert.notDeepEqual(after.current.metrics,before.current.metrics);
  }
});

test('Relative Transition requires a complete previous pair grid on both sides',()=>{
  for(const symbol of ['ETH-USDT','NVDA']){
    const n=90*MINUTE/intervalOf(symbol),needed=Math.max(22,2*n+1);
    for(const side of ['asset','reference'])for(const count of [needed-1,needed,needed+1]){
      const f=paired({symbol,[side]:{count}}),result=state(f),t=result.transitions.short.relative;
      assert.equal(t.status==='unavailable',count<needed,`${symbol}/${side}/${count}`);
      if(count>=22)assert.equal(result.relative.availability,'available');
      if(count<needed&&count>=22)assert.equal(t.reason,'insufficient_previous');
    }
    const f=paired({symbol});pointsFor(f,BENCHMARKS[symbol]).splice(-2*n-1,1);const result=state(f);
    if(2*n>=22){assert.equal(result.relative.availability,'available');assert.equal(result.transitions.short.relative.reason,'insufficient_previous');}
    else assert.equal(result.relative.classification,null,'Old 22-point preparation gate takes precedence for crypto');
  }
});
