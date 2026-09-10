import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCandles, getOKXQuote, getOKXHistory } from '../lib/okx.ts';
import { alertMatches, assetFor, price } from '../lib/market.ts';
import { validConfig } from '../monitor/worker.mjs';

test('candles sort oldest first, preserve OHLC and volume, distinguish the open candle',()=>{
  const result=parseCandles([['2000','10','13','9','12','5','0','0','0'],['1000','11','12','8','10','3','0','0','1'],['3000','10','9','11','12','0','0','0','1']]);
  assert.equal(result.length,2);assert.equal(result[0].time,1000);assert.equal(result[0].volume,3);assert.equal(result[0].confirmed,true);assert.equal(result[1].confirmed,false);assert.equal(result[1].high,13);
});
test('USDT is explicit and legacy USD remains a separate symbol',()=>{
  assert.equal(assetFor('BTC-USDT').market,'crypto');assert.equal(assetFor('BTC-USD').market,'crypto');assert.equal(price(12,'USDT'),'12.00 USDT');
});
test('K-line requests fall back to the official historical endpoint when rate limited',async()=>{
  const original=fetch,paths=[];globalThis.fetch=async url=>{const path=new URL(url).pathname;paths.push(path);return path.endsWith('/history-candles')?Response.json({code:'0',data:[['2000','10','13','9','12','5','0','0','0'],['1000','11','12','8','10','3','0','0','1']]}):new Response('',{status:429});};
  try{const result=await getOKXHistory('BTC-USDT','15m');assert.equal(result.points.length,2);assert.equal(result.currency,'USDT');assert.deepEqual(paths,['/api/v5/market/candles','/api/v5/market/candles','/api/v5/market/history-candles']);}finally{globalThis.fetch=original;}
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
