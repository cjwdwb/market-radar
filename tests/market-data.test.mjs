import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCandles, getOKXQuote, getOKXHistory } from '../lib/okx.ts';
import { alertMatches, alertQuoteStatus, quoteTiming, assetFor, price, chartPrice } from '../lib/market.ts';
import { validConfig } from '../monitor/worker.mjs';

test('candles sort oldest first, preserve OHLC and volume, distinguish the open candle',()=>{
  const result=parseCandles([['2000','10','13','9','12','5','0','0','0'],['1000','11','12','8','10','3','0','0','1'],['3000','10','9','11','12','0','0','0','1']]);
  assert.equal(result.length,2);assert.equal(result[0].time,1000);assert.equal(result[0].volume,3);assert.equal(result[0].confirmed,true);assert.equal(result[1].confirmed,false);assert.equal(result[1].high,13);
});
test('USDT is explicit and legacy USD remains a separate symbol',()=>{
  assert.equal(assetFor('BTC-USDT').market,'crypto');assert.equal(assetFor('BTC-USD').market,'crypto');assert.equal(price(12,'USDT'),'12.00 USDT');
});

test('quote time and pending reminder status use the trigger boundaries for each market',()=>{
  const now=1_800_000_000_000;
  const base={symbol:'ETH-USDT',price:200,timestamp:now,fetchedAt:now,session:'open'};
  const alert={symbol:base.symbol,direction:'above',target:100,enabled:true};
  for(const [overrides,status] of [
    [{timestamp:now-180_000,fetchedAt:now-120_000},'ready'],
    [{timestamp:now-180_001},'stale'],[{timestamp:now+60_000},'ready'],[{timestamp:now+60_001},'stale'],
    [{fetchedAt:now-120_001},'stale'],[{timestamp:NaN},'stale'],[{fetchedAt:NaN},'stale'],
    [{symbol:'BTC-USD',timestamp:now-180_001},'stale'],[{session:'unknown'},'ready'],
    [{symbol:'AAPL',timestamp:now-1_200_000},'ready'],[{symbol:'AAPL',timestamp:now-1_200_001},'stale'],
    [{symbol:'AAPL',session:'closed'},'closed'],[{symbol:'AAPL',session:'unknown'},'unknown_session'],
    [{error:'synthetic failure'},'failed'],[{price:NaN},'failed']
  ]) {
    const quote={...base,...overrides};
    assert.equal(alertQuoteStatus(quote,now),status);
    assert.equal(alertMatches({...alert,symbol:quote.symbol},quote,now),status==='ready');
  }
  assert.equal(alertQuoteStatus(undefined,now),'waiting');
  assert.equal(alertQuoteStatus(base,undefined),'waiting');
  assert.deepEqual(quoteTiming({...base,fetchedAt:now-120_001},now),{sourceStale:false,acquisitionStale:true});
  assert.deepEqual(quoteTiming({...base,timestamp:now-180_001},now),{sourceStale:true,acquisitionStale:false});
});

test('chart ticks preserve nonzero tiny prices, decimal quotes and compact large magnitudes',()=>{
  assert.equal(chartPrice(1.03e-8),'1.03E-8');assert.equal(chartPrice(1.01e-8),'1.01E-8');
  assert.equal(chartPrice(100.25),'100.25');assert.equal(chartPrice(.1234),'0.1234');
  assert.equal(chartPrice(1e12),'1E12');assert.equal(chartPrice(-1.03e-8),'-1.03E-8');
  const large=[1000000,1000100,1000200,1000300];
  assert.equal(new Set(large.map(chartPrice)).size,large.length);
  assert.deepEqual(large.map(value=>Number(chartPrice(value))),large);
  assert.notEqual(chartPrice(1e12+100),chartPrice(1e12+200));
  assert.equal(chartPrice(0),'0.00');assert.equal(chartPrice(NaN),'—');assert.equal(chartPrice(undefined),'—');
});
test('K-line rate limits never fall back to another origin or historical endpoint',async t=>{
  t.mock.method(Date,'now',()=>1_700_000_000_000);
  const original=fetch,paths=[];globalThis.fetch=async url=>{const path=new URL(url).pathname;paths.push(path);return path.endsWith('/history-candles')?Response.json({code:'0',data:[['2000','10','13','9','12','5','0','0','0'],['1000','11','12','8','10','3','0','0','1']]}):new Response('',{status:429});};
  try{await assert.rejects(getOKXHistory('BTC-USDT','15m'),error=>error.code==='rate_limited');assert.deepEqual(paths,['/api/v5/market/candles']);}finally{globalThis.fetch=original;}
});
test('OKX ticker uses 24-hour reference and quote currency',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({code:'0',data:[{instId:'BTC-USDT',last:'110',open24h:'100',ts:String(Date.now()),high24h:'115',low24h:'95',volCcy24h:'5000'}]});
  try{const q=await getOKXQuote('BTC-USDT',false);assert.equal(q.changePercent,10);assert.equal(q.currency,'USDT');assert.equal(q.source,'OKX 欧易');assert.equal(q.points.length,0);}finally{globalThis.fetch=original;}
});
test('alerts reject stale quotes and do not convert USD targets into USDT',()=>{
  const now=Date.now(),a={id:'x',symbol:'BTC-USD',enabled:true,target:100,direction:'above',createdAt:now};
  const q={symbol:'BTC-USDT',price:110,timestamp:now,fetchedAt:now,session:'open'};
  assert.equal(alertMatches(a,q,now),false);assert.equal(alertMatches({...a,symbol:'BTC-USDT'},q,now),true);assert.equal(alertMatches({...a,symbol:'BTC-USDT'},{...q,timestamp:now-181000},now),false);
});
test('monitor configuration rejects invalid symbols, duplicate IDs and unbounded lists',()=>{
  const a={id:'a',symbol:'BTC-USDT',target:100,direction:'above',enabled:true,createdAt:1},c={enabled:true,watchlist:['BTC-USDT'],alerts:[a]};
  assert.equal(validConfig(c),true);assert.equal(validConfig({...c,alerts:[a,a]}),false);assert.equal(validConfig({...c,watchlist:['https://evil.test']}),false);assert.equal(validConfig({...c,alerts:[{...a,target:NaN}]}),false);
});
