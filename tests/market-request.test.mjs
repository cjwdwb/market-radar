import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {marketJson,marketScope,SharedMarketRequests,errorInfo,publicError} from '../lib/market-request.ts';
import {getOKXTickers,getOKXHistory,getOKXQuote} from '../lib/okx.ts';
import {getQuote,getHistory,getQuotes} from '../lib/market-data.ts';

let now=2_000_000_000_000,sequence=0;
beforeEach(t=>{now=2_000_000_000_000+(++sequence)*1_000_000;t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network call');});});
const url=new URL('https://example.test/market');
const reset=()=>new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const candleRows=()=>{const open=Math.floor(now/900000)*900000;return [[String(open),'10','13','9','12','5','0','0','0'],[String(open-900000),'11','12','8','10','3','0','0','1']];};
const ticker=(symbol='BTC-USDT')=>({instId:symbol,last:'110',open24h:'100',ts:String(now),high24h:'115',low24h:'95',volCcy24h:'5000'});
const yahoo=symbol=>({chart:{result:[{meta:{symbol,regularMarketPrice:110,regularMarketTime:Math.floor(now/1000),chartPreviousClose:100,currency:'USD'},timestamp:[Math.floor(now/1000)-600,Math.floor(now/1000)-300],indicators:{quote:[{close:[99,100],open:[98,99],high:[100,101],low:[97,98],volume:[1,2]}]}}]}});

test('transport and interrupted body retry once within one budget',async t=>{
 for(const bodyFailure of [false,true]){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;if(calls===1){if(bodyFailure)return new Response(new ReadableStream({start(controller){controller.error(reset());}}),{headers:{'Content-Type':'application/json'}});throw reset();}return Response.json({price:123,timestamp:42});});
  const scope=marketScope({},12000,2);assert.deepEqual(await marketJson(url,{...scope,timeoutMs:12000,attempts:20}),{price:123,timestamp:42});assert.equal(calls,2);assert.equal(scope.budget.used,2);
 }
});
test('HTTP, denial, HTML, malformed JSON and permission failures do not transport-retry',async t=>{
 for(const [mode,code] of [['429','rate_limited'],['403','upstream_denied'],['401','upstream_denied'],['451','upstream_denied'],['302','upstream_business_error'],['404','unsupported_asset'],['500','upstream_unavailable'],['json','invalid_json'],['html','unexpected_content_type'],['permission','environment_denied']]){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;if(mode==='permission')throw new TypeError('fetch failed',{cause:{code:'EACCES'}});return mode==='json'?new Response('{',{headers:{'Content-Type':'application/json'}}):mode==='html'?new Response('<html>',{headers:{'Content-Type':'text/html'}}):new Response('',{status:Number(mode)});});
  await assert.rejects(marketJson(url,{timeoutMs:12000,attempts:2}),error=>error.code===code);assert.equal(calls,1,mode);
 }
});
test('Retry-After seconds/date and unsuccessful cleanup preserve longest wait',async t=>{
 for(const header of ['120',new Date(now+180000).toUTCString()]){
  t.mock.method(globalThis,'fetch',async()=>({ok:false,status:429,headers:new Headers({'Retry-After':header}),body:{cancel:async()=>{throw reset();}}}));
  await assert.rejects(marketJson(url,{timeoutMs:100}),error=>error.retryAt===(header==='120'?now+120000:Date.parse(header)));
 }
});
test('bounded body and deadline cover body reading, with stream cancellation',async t=>{
 let cancelled=0;t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(100));},cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}}));
 await assert.rejects(marketJson(url,{timeoutMs:100,maxBytes:32}),error=>error.code==='invalid_data');assert.equal(cancelled,1);
 t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}}));
 await assert.rejects(marketJson(url,{timeoutMs:10}),error=>error.code==='timeout');assert.equal(cancelled,2);
});
test('caller cancellation differs from timeout and never retries',async t=>{
 const controller=new AbortController();let calls=0,signal;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{calls++;signal=options.signal;return new Promise(()=>{});});
 const pending=marketJson(url,{timeoutMs:1000,attempts:2,signal:controller.signal});controller.abort('superseded');
 await assert.rejects(pending,error=>error.code==='superseded');assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test('OKX full chain shares the absolute deadline and four physical attempts',async t=>{
 const paths=[];t.mock.method(globalThis,'fetch',async input=>{paths.push(input.pathname);return new Response('',{status:503});});
 const scope=marketScope();await assert.rejects(getOKXHistory('BTC-USDT','15m',scope),error=>error.code==='upstream_unavailable');assert.equal(scope.budget.used,4);assert.deepEqual(paths,['/api/v5/market/candles','/api/v5/market/candles','/api/v5/market/history-candles','/api/v5/market/history-candles']);
 paths.length=0;const deadline=now+100;t.mock.method(globalThis,'fetch',async input=>{paths.push(input.pathname);now+=101;throw reset();});
 await assert.rejects(getOKXHistory('ETH-USDT','15m',{deadline}),error=>error.code==='timeout');assert.equal(paths.length,1);
});
test('OKX 403, region, environment, JSON, business and cancellation never change endpoint/origin',async t=>{
 for(const mode of ['403','451','permission','json','business']){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;if(mode==='permission')throw new TypeError('fetch failed',{cause:{code:'EPERM'}});return mode==='json'?new Response('{',{headers:{'Content-Type':'application/json'}}):mode==='business'?Response.json({code:'51001',data:[]}):new Response('',{status:Number(mode)});});
  await assert.rejects(getOKXHistory('BTC-USDT','15m'));assert.equal(calls,1,mode);
 }
 const controller=new AbortController();controller.abort();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({});});await assert.rejects(getOKXHistory('BTC-USDT','15m',{signal:controller.signal}),error=>error.code==='caller_cancelled');assert.equal(calls,0);
});
test('OKX transport fallback retains actual historical endpoint and original acquisition',async t=>{
 const paths=[];t.mock.method(globalThis,'fetch',async input=>{paths.push(input.pathname);if(paths.length<=2)throw reset();return Response.json({code:'0',data:candleRows().map(row=>{row[8]='1';row[0]=String(Number(row[0])-900000);return row;})});});
 const history=await getOKXHistory('BTC-USDT','1d');assert.equal(paths.length,3);assert.equal(history.metadata.path,'history-candles');assert.ok(history.metadata.limitations.includes('historical_endpoint'));assert.equal(history.metadata.lastCompleteAt,history.points.at(-1).time+900000);
});
test('equivalent concurrent histories share underlying work but preserve requested range',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'0',data:candleRows()});});
 const [a,b]=await Promise.all([getOKXHistory('BTC-USDT','15m'),getOKXHistory('BTC-USDT','1d')]);assert.equal(calls,1);assert.equal(a.range,'15m');assert.equal(b.range,'1d');assert.equal(a.fetchedAt,b.fetchedAt);
});
test('OKX provider cooldown blocks all origins/endpoints/symbols and preserves longer wait',async t=>{
 const pending=[];let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Promise(resolve=>pending.push(resolve));});
 const a=assert.rejects(getOKXQuote('BTC-USDT',false),error=>error.code==='rate_limited');const b=assert.rejects(getOKXQuote('ETH-USDT',false),error=>error.code==='rate_limited');await turn();
 pending[0](new Response('',{status:429,headers:{'Retry-After':'120'}}));await a;pending[1](new Response('',{status:429,headers:{'Retry-After':'60'}}));await b;
 now+=61000;await assert.rejects(getOKXHistory('SOL-USDT','1d'),error=>error.retryAt>now);await assert.rejects(getOKXTickers());assert.equal(calls,2);
 now+=60000;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'0',data:[ticker('SOL-USDT')]});});assert.equal((await getOKXQuote('SOL-USDT',false)).price,110);assert.equal(calls,3);
});
test('OKX business rate limit is terminal across both historical endpoints',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'50011',data:[]});});await assert.rejects(getOKXHistory('ETH-USDT','15m'),error=>error.code==='rate_limited');await assert.rejects(getOKXHistory('BTC-USDT','1d'));await assert.rejects(getOKXTickers());assert.equal(calls,1);
});
test('shared waiters cancel independently and final waiter aborts downstream',async()=>{
 const pool=new SharedMarketRequests();let resolve,signal,calls=0;const a=new AbortController(),b=new AbortController();
 const operation=async scope=>{calls++;signal=scope.signal;return new Promise(done=>resolve=done);};
 const one=pool.run('same',marketScope({signal:a.signal}),operation),two=pool.run('same',marketScope({signal:b.signal}),operation);await turn();a.abort();await assert.rejects(one,error=>error.code==='caller_cancelled');assert.equal(signal.aborted,false);resolve(42);assert.equal(await two,42);assert.equal(calls,1);
 const c=new AbortController();const all=pool.run('same',marketScope({signal:c.signal}),operation);await turn();c.abort();await assert.rejects(all);assert.equal(signal.aborted,true);
});
test('old cancelled finally cannot delete a replacement sharing the same key',async()=>{
 const pool=new SharedMarketRequests();const controller=new AbortController();let calls=0,resolve;
 const operation=async()=>{calls++;return new Promise(done=>resolve=done);};
 const old=pool.run('key',marketScope({signal:controller.signal}),operation);await turn();controller.abort();
 const next=pool.run('key',marketScope(),operation);await assert.rejects(old);await turn();const joined=pool.run('key',marketScope(),operation);await turn();assert.equal(calls,2);resolve(7);assert.equal(await next,7);assert.equal(await joined,7);
});
test('shared failure releases entry so a later request can recover',async()=>{
 const pool=new SharedMarketRequests();await assert.rejects(pool.run('key',marketScope(),async()=>{throw reset();}));assert.equal(await pool.run('key',marketScope(),async()=>5),5);
});
test('Yahoo retries reset, coalesces, and cache reads preserve acquisition and data time',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;if(calls===1)throw reset();return Response.json(yahoo('NVDA'));});
 const first=now;const quotes=await Promise.all([getQuote('NVDA'),getQuote('NVDA')]);assert.equal(calls,2);assert.ok(quotes.every(q=>q.fetchedAt===first));
 now+=1000;const cached=await getQuote('NVDA');assert.equal(calls,2);assert.equal(cached.fetchedAt,first);assert.equal(cached.timestamp,quotes[0].timestamp);assert.equal(cached.readAt,now);assert.deepEqual(cached.cache,{hit:true,ageMs:1000});
 const history=await getHistory('NVDA','1d');assert.equal(history.fetchedAt,first);assert.equal(history.metadata.intervalMs,300000);assert.equal(history.points.at(-1).confirmed,undefined);assert.equal(history.points.at(-1).windowEnded,true);
});
test('Yahoo rate limit remains typed across symbols and longer cooldown',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'180'}});});await assert.rejects(getQuote('MSFT'),error=>error.code==='rate_limited');await assert.rejects(getQuote('AAPL'),error=>error.code==='rate_limited'&&error.retryAt===now+180000);assert.equal(calls,1);
});
test('batch preserves every requested asset and separates provider failures',async t=>{
 t.mock.method(globalThis,'fetch',async input=>input.hostname.includes('okx')?new Response('',{status:403}):Response.json(yahoo(decodeURIComponent(input.pathname.split('/').at(-1)))));
 const results=await getQuotes(['BTC-USDT','ETH-USDT','AAPL'],false);assert.equal(results.length,3);assert.equal(results[0].errorInfo.code,'upstream_denied');assert.equal(results[1].errorInfo.code,'upstream_denied');assert.equal(results[2].quote.price,110);
});
test('queued stocks respect shared deadline and at most four simultaneous requests',async t=>{
 let active=0,max=0,calls=0;const pending=[];t.mock.method(globalThis,'fetch',async input=>{calls++;active++;max=Math.max(max,active);return new Promise(resolve=>pending.push(()=>{active--;resolve(Response.json(yahoo(input.pathname.split('/').at(-1))));}));});
 const symbols=['AA','AB','AC','AD','AE','AF'];const deadline=now+100;const task=getQuotes(symbols,false,{deadline});await turn();assert.equal(calls,4);now+=101;for(const resolve of pending)resolve();const results=await task;assert.equal(max,4);assert.equal(calls,4);assert.deepEqual(results.map(r=>r.symbol),symbols);assert.ok(results.every(r=>r.errorInfo.code==='timeout'));
});
test('public errors never expose arbitrary upstream text',()=>{const raw=Error('行情 https://private.test secret');assert.equal(errorInfo(raw).code,'transport_error');assert.ok(!publicError(raw).includes('private'));});
