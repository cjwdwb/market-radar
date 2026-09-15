import test from 'node:test';
import assert from 'node:assert/strict';
import { marketJson, MarketRequestError } from '../lib/market-request.ts';
import { getOKXTickers, getOKXHistory, getOKXQuote } from '../lib/okx.ts';
import { getQuote } from '../lib/market-data.ts';

const url=new URL('https://query1.finance.yahoo.com/test');
const reset=()=>new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});
const options={timeoutMs:12000,attempts:2};
test('transport and interrupted body retry once; successful payload is unchanged',async t=>{
 for(const bodyFailure of [false,true]){
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;if(calls===1){if(bodyFailure)return {ok:true,json:async()=>{throw reset();}};throw reset();}return Response.json({price:123,timestamp:42});});
  assert.deepEqual(await marketJson(url,options),{price:123,timestamp:42});assert.equal(calls,2);t.mock.restoreAll();
 }
});
test('HTTP errors, invalid JSON and sandbox denials are not transport retries',async t=>{
 for(const mode of ['429','404','500','json','permission']){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;if(mode==='permission')throw new TypeError('fetch failed',{cause:{code:'EACCES'}});return mode==='json'?new Response('{'):new Response('',{status:Number(mode),headers:{'Retry-After':'120'}});});
  await assert.rejects(marketJson(url,options),error=>{assert.ok(error instanceof MarketRequestError);if(mode==='429')assert.ok(error.retryAt>=Date.now()+119000);if(mode==='permission')assert.ok(error.blocked);return true;});assert.equal(calls,1);t.mock.restoreAll();
 }
});
test('Retry-After date and failed body cancellation preserve the rate limit',async t=>{
 const now=Date.now(),date=new Date(now+180000).toUTCString();
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status:429,headers:new Headers({'Retry-After':date}),body:{cancel:async()=>{throw reset();}}}));
 await assert.rejects(marketJson(url,options),e=>e.status===429&&e.retryAt===Date.parse(date));
});
test('transport retries share a total deadline and never exceed two attempts',async t=>{
 let now=1000,calls=0;t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async()=>{calls++;now+=12001;throw reset();});
 await assert.rejects(marketJson(url,options));assert.equal(calls,1);
 now=1000;calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw reset();});
 await assert.rejects(marketJson(url,{...options,attempts:20}));assert.equal(calls,2);
});
test('OKX concurrent ticker consumers share a request; transport failure uses official fallback',async t=>{
 let calls=0;const origins=[];
 t.mock.method(globalThis,'fetch',async input=>{calls++;origins.push(input.origin);if(calls===1)throw reset();return Response.json({code:'0',data:[{instId:'BTC-USDT',last:'101'}]});});
 const results=await Promise.all(Array.from({length:8},()=>getOKXTickers()));
 assert.equal(calls,2);assert.deepEqual(origins,['https://openapi.okx.com','https://www.okx.com']);assert.ok(results.every(result=>result['BTC-USDT'].last==='101'));
});
test('OKX ticker rate limit suppresses mirror retry and subsequent same-endpoint calls',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});});
 await assert.rejects(getOKXTickers());await assert.rejects(getOKXTickers());assert.equal(calls,1);
});
test('OKX history fallback stays within 24s, leaving room for the 6s monitor proxy',async t=>{
 let now=1000;const start=now,paths=[],budgets=[];
 t.mock.method(Date,'now',()=>now);
 t.mock.method(AbortSignal,'timeout',ms=>{budgets.push(ms);return new AbortController().signal;});
 t.mock.method(globalThis,'fetch',async input=>{paths.push(input.pathname);now+=budgets.at(-1);throw new DOMException('Timeout','TimeoutError');});
 await assert.rejects(getOKXHistory('ETH-USDT','15m'));
 assert.equal(now-start,24000);assert.deepEqual(budgets,[8000,8000,8000]);
 assert.deepEqual(paths,['/api/v5/market/candles','/api/v5/market/candles','/api/v5/market/history-candles']);
 assert.ok(now-start+6000<35000);
});
test('concurrent OKX limits retain the longest wait and allow requests after recovery',async t=>{
 let now=1000,calls=0;const pending=[];
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Promise(resolve=>pending.push(resolve));});
 const first=assert.rejects(getOKXQuote('BTC-USDT',false));
 const second=assert.rejects(getOKXQuote('ETH-USDT',false));
 pending[0](new Response('',{status:429,headers:{'Retry-After':'120'}}));await first;
 pending[1](new Response('',{status:429,headers:{'Retry-After':'60'}}));await second;
 now=62000;await assert.rejects(getOKXQuote('LTC-USDT',false));assert.equal(calls,2);
 now=122000;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'0',data:[{instId:'LTC-USDT',last:'110',open24h:'100',ts:String(now)}]});});
 const quote=await getOKXQuote('LTC-USDT',false);assert.equal(quote.price,110);assert.equal(calls,3);
});
test('OKX business rate limit on candle endpoints is also remembered',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'50011',data:[]});});
 await assert.rejects(getOKXHistory('ETH-USDT','15m'));await assert.rejects(getOKXHistory('BTC-USDT','15m'));assert.equal(calls,2,'each independent endpoint is attempted once, across symbols');
});
test('Yahoo retries a reset, coalesces consumers and preserves cached quote time',async t=>{
 let calls=0;const timestamp=1789372800;
 t.mock.method(globalThis,'fetch',async()=>{calls++;if(calls===1)throw reset();return Response.json({chart:{result:[{meta:{regularMarketPrice:110,regularMarketTime:timestamp,chartPreviousClose:100,currency:'USD'}}]}});});
 const quotes=await Promise.all([getQuote('NVDA'),getQuote('NVDA')]);
 assert.equal(calls,2);assert.ok(quotes.every(q=>q.timestamp===timestamp*1000&&q.source==='Yahoo Finance'&&q.change===10));
 await getQuote('NVDA');assert.equal(calls,2);
});
test('Yahoo honors rate limit across symbols',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:429});});
 await assert.rejects(getQuote('MSFT'));await assert.rejects(getQuote('AAPL'));assert.equal(calls,1);
});
