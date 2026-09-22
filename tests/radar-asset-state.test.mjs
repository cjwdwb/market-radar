import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetState, ASSET_STATE_RULES as rules } from '../lib/radar/asset-state.ts';
import { scanRadar } from '../lib/radar/engine.ts';
import { emptyRadarStore } from '../lib/radar/types.ts';

const now=1_789_372_800_000;
function fixture({symbol='BTC-USDT', count=22, closes, end=now}={}) {
  const interval=symbol.endsWith('-USDT')?900000:300000;
  const prices=closes??Array.from({length:count},(_,i)=>100+i*.04);
  const points=prices.map((close,i)=>({time:end-(prices.length-i)*interval,open:close,close,high:close,low:close,volume:100,confirmed:true}));
  const quote={symbol,price:prices.at(-1),points,currency:symbol.endsWith('-USDT')?'USDT':'USD',source:symbol.endsWith('-USDT')?'OKX 欧易':'Yahoo Finance',session:'open',delayMinutes:0,timestamp:now,fetchedAt:now};
  return {symbols:[symbol],quotes:{[symbol]:quote},histories:{[symbol]:{points,intervalMs:interval,source:quote.source,currency:quote.currency,fetchedAt:now}}};
}
const state=(snapshot=fixture(), overrides={})=>buildAssetState({snapshot,symbol:snapshot.symbols[0],now,enabled:true,online:true,...overrides});
function fromReturns(values, symbol='BTC-USDT') { const closes=[100,100];for(const r of values)closes.push(closes.at(-1)*(1+r/100));return fixture({symbol,closes}); }
function frozen(value){if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;}

test('state is deterministic, immutable and has complete real-interval provenance',()=>{
  const input=frozen(fixture()),a=state(input);assert.deepEqual(a,state(input));
  assert.equal(a.ruleVersion,'asset-state-v1');assert.equal(a.symbol,'BTC-USDT');
  assert.equal(a.direction.methodId,'direction-v1');assert.equal(a.volatility.methodId,'rms-v1');
  assert.equal(a.evidence.closeEndAt-a.evidence.closeStartAt,20*900000);
  assert.equal(a.evidence.pointCount,21);assert.equal(a.evidence.validatedPointCount,22);
  assert.equal(a.evidence.quoteAt,now);assert.equal(a.evidence.historyFetchedAt,now);
  assert.equal(a.volatility.metrics.baselineEndAt,a.volatility.metrics.currentStartAt);
  const stock=state(fixture({symbol:'NVDA'}));assert.equal(stock.evidence.intervalMs,300000);assert.equal(stock.evidence.closeEndAt-stock.evidence.closeStartAt,100*60000);
});
test('slow one-way movement has direction without an anomaly or event vote',()=>{
  const input=fixture();assert.equal(scanRadar(emptyRadarStore(),input,now).signals.length,0);
  assert.equal(state(input).direction.classification,'upward');
  assert.equal(state(fixture({closes:Array.from({length:22},(_,i)=>100-i*.04)})).direction.classification,'downward');
  const baseline=state(input);
  for(const extras of [{events:[{},{}]},{events:[],watchlist:['BTC-USDT'],alertCount:3},{chartRange:'3m',coverage:[],events:[{symbol:'NVDA'}]}])assert.deepEqual(state(input,extras),baseline);
});
test('back-and-forth and flat prices are not mislabeled as trending or low risk',()=>{
  assert.equal(state(fixture({closes:Array.from({length:22},(_,i)=>100+i%2)})).direction.classification,'no_direction');
  const flat=state(fixture({closes:Array(22).fill(100)}));assert.equal(flat.direction.classification,'no_direction');assert.equal(flat.direction.metrics.efficiency,0);
  assert.equal(flat.volatility.classification,null);assert.equal(flat.volatility.reason,'baseline_too_small');assert.equal(flat.volatility.metrics.ratio,null);assert.equal(flat.volatility.metrics.currentRmsPercent,0);
});
test('net change thresholds apply on both sides; stock and crypto floors differ',()=>{
  for(const symbol of ['BTC-USDT','NVDA'])for(const sign of [-1,1]){
    const floor=symbol==='NVDA'?.3:.6;
    for(const [offset,expected] of [[-1e-7,'no_direction'],[1e-7,sign===1?'upward':'downward']]){
      const closes=[100,...Array.from({length:21},(_,i)=>100*(1+sign*(floor+offset)*i/2000))];
      assert.equal(state(fixture({symbol,closes})).direction.classification,expected);
    }
  }
});
test('path efficiency boundary is inclusive, independent of net magnitude',()=>{
  // Last 21 closes: 100 -> 99 -> 103, net 3, path 5, efficiency exactly .6.
  for(const [dip,expected] of [[.999999,'upward'],[1,'upward'],[1.000001,'no_direction']]){
    const closes=[100,100,100-dip,...Array(19).fill(103)];const result=state(fixture({closes}));
    assert.equal(result.direction.classification,expected);if(dip===1)assert.equal(result.direction.metrics.efficiency,.6);
  }
});
test('RMS uses 4 current and 16 previous non-overlapping returns with inclusive ratio limits',()=>{
  for(const [b,c,expected,ratio] of [[100,150,'higher',1.5],[150,100,'lower',2/3],[100,100,'similar',1],[100,0,'lower',0]]){
    const result=state(fromReturns([...Array(16).fill(b),...Array(4).fill(c)]));
    assert.equal(result.volatility.classification,expected);assert.equal(result.volatility.metrics.ratio,ratio);
    assert.equal(result.volatility.metrics.currentRmsPercent,c);assert.equal(result.volatility.metrics.baselineRmsPercent,b);
  }
  for(const [c,expected] of [[149.9999,'similar'],[150.0001,'higher'],[66.6666,'lower'],[66.6667,'similar']])assert.equal(state(fromReturns([...Array(16).fill(100),...Array(4).fill(c)])).volatility.classification,expected);
});
test('near-zero reference refuses a ratio; a valid direction can survive that failure',()=>{
  const result=state(fromReturns([...Array(16).fill(1e-7),...Array(4).fill(.3)]));
  assert.equal(result.direction.classification,'upward');assert.equal(result.volatility.reason,'baseline_too_small');
  assert.equal(result.volatility.metrics.ratio,null);assert.ok(result.volatility.metrics.currentRmsPercent>0);
  assert.equal(state(fromReturns([...Array(16).fill(2e-6),...Array(4).fill(2e-6)])).volatility.availability,'available');
});
test('minimum continuous sample gate is 22; extra older valid samples do not change windows',()=>{
  for(const count of [0,1,20,21]){const f=fixture({count});f.quotes['BTC-USDT'].price=100;assert.equal(state(f).direction.reason,'insufficient_contiguous_bars');}
  assert.equal(state().direction.availability,'available');
  const f=fixture(),h=f.histories['BTC-USDT'];h.points.unshift(...Array.from({length:5},(_,i)=>({...h.points[0],time:h.points[0].time-(5-i)*900000})));
  assert.deepEqual(state(f).direction,state().direction);
});
test('bad quotes, source/currency, history fetch and unsupported intervals fail closed',()=>{
  for(const [mutate,reason] of [
    [f=>delete f.quotes['BTC-USDT'],'awaiting_quote'],[f=>f.quotes['BTC-USDT'].symbol='ETH-USDT','quote_failed'],[f=>f.quotes['BTC-USDT'].error='unavailable','quote_failed'],[f=>f.quotes['BTC-USDT'].price=NaN,'invalid_quote'],
    [f=>f.quotes['BTC-USDT'].timestamp=now-180001,'stale_quote'],[f=>f.quotes['BTC-USDT'].fetchedAt=now-120001,'stale_quote'],[f=>delete f.histories['BTC-USDT'],'awaiting_history'],
    [f=>f.histories['BTC-USDT'].currency='USD','source_currency_mismatch'],[f=>f.histories['BTC-USDT'].source='other','source_currency_mismatch'],[f=>f.histories['BTC-USDT'].fetchedAt=now-120001,'stale_history'],[f=>f.histories['BTC-USDT'].intervalMs=3600000,'unsupported_interval'],
    [f=>f.histories['BTC-USDT'].points[10].close=0,'invalid_history'],[f=>f.histories['BTC-USDT'].points[10].close=Infinity,'invalid_history']
  ]){const f=fixture();mutate(f);const r=state(f);assert.equal(r.direction.reason,reason);assert.equal(r.volatility.classification,null);assert.equal(r.evidence,null);}
});
test('unfinished and future candles never form current evidence',()=>{
  const f=fixture();f.histories['BTC-USDT'].points.at(-1).confirmed=false;assert.equal(state(f).direction.reason,'insufficient_contiguous_bars');
  const future=fixture({end:now+30000});future.quotes['BTC-USDT'].timestamp=now+30000;
  assert.equal(state(future).direction.reason,'future_evidence');
  const complete=fixture();complete.histories['BTC-USDT'].points.push({...complete.histories['BTC-USDT'].points.at(-1),time:now,close:1000});
  assert.deepEqual(state(complete),state());
});
test('latest continuous suffix, duplicate and unordered times do not interpolate a gap',()=>{
  for(const adjust of [-900000,900000,1]){const f=fixture({count:30});f.histories['BTC-USDT'].points[20].time+=adjust;assert.equal(state(f).direction.reason,'insufficient_contiguous_bars');}
  const f=fixture({count:40});f.histories['BTC-USDT'].points[3].time-=1;assert.equal(state(f).direction.availability,'available');assert.equal(state(f).evidence.validatedPointCount,36);
});
test('explicit clock expiration is independent of a fresh fetch or fresh quote',()=>{
  const f=fixture({end:now-960000});assert.equal(state(f).direction.availability,'available');
  assert.equal(state(f,{now:now+1}).direction.reason,'stale_evidence');
  const r=state(fixture(),{now:now+120001});assert.equal(r.direction.reason,'stale_quote');
  const newQuote=fixture({end:now-960001});newQuote.quotes['BTC-USDT'].timestamp=now;assert.equal(state(newQuote).direction.reason,'stale_evidence');
});
test('offline, pause and absent clock remove current classifications; recovery recomputes',()=>{
  for(const [overrides,reason] of [[{online:false,enabled:false},'offline'],[{enabled:false},'paused'],[{now:undefined},'awaiting_clock'],[{now:NaN},'awaiting_clock']]){
    const result=state(fixture(),overrides);assert.equal(result.direction.reason,reason);assert.equal(result.direction.classification,null);assert.equal(result.evidence,null);
    assert.equal(result.direction.methodId,'direction-v1');assert.equal(result.volatility.methodId,'rms-v1');
  }
  assert.equal(state().direction.availability,'available');
});
test('unknown stock benchmark and mismatched benchmark affect no approved dimension',()=>{
  const f=fixture({symbol:'NVDA'}),original=state(f);f.quotes.QQQ={...f.quotes.NVDA,symbol:'QQQ',timestamp:0,currency:'HKD',session:'closed'};
  assert.deepEqual(state(f),original);assert.equal(state(fixture({symbol:'UNKNOWN'})).direction.availability,'available');
  assert.equal(state(f,{symbol:'ETH-USDT'}).symbol,'ETH-USDT');assert.equal(state(f,{symbol:'ETH-USDT'}).direction.reason,'awaiting_quote');
  f.quotes.NVDA.session='closed';assert.equal(state(f).direction.reason,'session_unavailable');
});
test('overflow has numeric priority and never publishes non-finite metrics',()=>{
  const f=fixture({closes:[...Array(20).fill(1e-300),1e300,1e300]});const result=state(f);
  assert.equal(result.direction.reason,'invalid_numeric');assert.equal(result.volatility.reason,'invalid_numeric');
  assert.equal(result.direction.metrics,null);assert.equal(result.volatility.metrics,null);
  assert.ok(Object.isFrozen(rules));
});
