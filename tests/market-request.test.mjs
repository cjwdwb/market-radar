import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {marketJson,marketScope,SharedMarketRequests,errorInfo,publicError,marketError,errorResponse} from '../lib/market-request.ts';
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

test('only opted-in monitor errors preserve standard codes with local trace and no retries',async t=>{
 const standards=[['invalid_parameter'],['unsupported_asset',404],['timeout'],['upstream_denied',403],['upstream_denied',401],['upstream_denied',451],['invalid_data'],['environment_denied'],['transport_error'],['upstream_unavailable',503],['unexpected_content_type'],['invalid_json'],['upstream_business_error'],['upstream_business_error',302],['empty'],['insufficient']];
 for(const [code,upstreamStatus] of standards){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return errorResponse(marketError(code,{traceId:'remote-trace'},{upstreamStatus}));});
  const scope=marketScope({traceId:'site-trace'},1000,2);
  await assert.rejects(marketJson(url,{...scope,timeoutMs:1000,attempts:2,stage:'proxy',monitorErrors:true}),error=>{
   assert.equal(error.code,code);assert.equal(error.status,upstreamStatus);assert.equal(error.traceId,'site-trace');assert.equal(error.stage,'proxy');assert.equal(error.validatedMonitorError,true);assert.equal(error.message,publicError(marketError(code)));return true;
  });assert.equal(calls,1,code);assert.equal(scope.budget.used,1);
 }
 let reads=0;t.mock.method(globalThis,'fetch',async()=>({ok:false,status:504,headers:new Headers({'Content-Type':'application/json'}),body:{getReader(){reads++;throw Error('must not read');},cancel:async()=>{}}}));
 await assert.rejects(marketJson(url,{timeoutMs:1000}),error=>error.code==='upstream_unavailable'&&!error.validatedMonitorError);assert.equal(reads,0);
});

test('monitor rejects mismatched code/status and invalid standard shapes using original HTTP cause',async t=>{
 const valid={error:'untrusted free text',errorInfo:{code:'timeout',stage:'upstream',traceId:'remote'}};
 const cases=[
  [503,valid],[503,{error:'old monitor: rate limit 429'}],[503,{error:'busy',errorInfo:{code:'rate_limited',retryAt:now+180000}}],
  [502,{...valid,errorInfo:{code:'not_a_code'}}],[502,{...valid,errorInfo:{code:'proxy_auth_error'}}],
  [502,{...valid,errorInfo:{code:'upstream_denied',upstreamStatus:503}}],[502,{...valid,errorInfo:{code:'upstream_unavailable',upstreamStatus:403}}],
  [502,{...valid,errorInfo:{code:'invalid_data',upstreamStatus:200}}],[502,{...valid,errorInfo:{code:'upstream_denied',upstreamStatus:'403'}}],
  [502,{...valid,errorInfo:{code:'invalid_data',retryAt:now+180000}}],[502,{...valid,errorInfo:{code:'invalid_data',stage:'unknown'}}],
  [502,{...valid,errorInfo:{code:'invalid_data',traceId:42}}],[502,{errorInfo:{code:'invalid_data'}}],
  [502,{error:42,errorInfo:{code:'invalid_data'}}],[502,{error:'oops',errorInfo:[]}],[502,null],[502,[]],
  [499,{...valid,errorInfo:{code:'caller_cancelled'}}],[499,{...valid,errorInfo:{code:'superseded'}}],
 ];
 for(const [status,body] of cases){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(body,{status});});
  await assert.rejects(marketJson(url,{timeoutMs:1000,attempts:2,monitorErrors:true}),error=>error.code===(status>=500?'upstream_unavailable':'upstream_business_error')&&error.status===status&&!error.validatedMonitorError);assert.equal(calls,1);
 }
});

test('monitor error body limits, malformed JSON and interrupted streams retain HTTP failure without retry',async t=>{
 for(const mode of ['html','json','declared-size','stream-size','caller-size','stream-failure']){
  let calls=0,cancelled=0;
  t.mock.method(globalThis,'fetch',async()=>{
   calls++;
   if(mode==='html')return new Response('<html>429</html>',{status:503,headers:{'Content-Type':'text/html'}});
   if(mode==='json')return new Response('{',{status:503,headers:{'Content-Type':'application/json'}});
   return new Response(new ReadableStream({pull(controller){if(mode==='stream-failure')controller.error(reset());else controller.enqueue(new Uint8Array(mode==='caller-size'?64:8193));},cancel(){cancelled++;}}),{status:503,headers:{'Content-Type':'application/json',...(mode==='declared-size'?{'Content-Length':'8193'}:{})}});
  });
  await assert.rejects(marketJson(url,{timeoutMs:1000,attempts:2,monitorErrors:true,maxBytes:mode==='caller-size'?32:512*1024}),error=>error.code==='upstream_unavailable'&&error.status===503&&!error.validatedMonitorError);assert.equal(calls,1,mode);
  if(['declared-size','stream-size','caller-size'].includes(mode))assert.equal(cancelled,1,mode);
 }
});

test('monitor error parsing retains the original body deadline, cancellation and attempt budget',async t=>{
 for(const mode of ['deadline','timer','caller_cancelled','superseded']){
  let calls=0,cancelled=0;const controller=new AbortController();
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(new ReadableStream({pull(stream){if(mode==='deadline'){now+=101;stream.enqueue(new TextEncoder().encode('{}'));}},cancel(){cancelled++;}}),{status:502,headers:{'Content-Type':'application/json'}});});
  const scope=marketScope({signal:controller.signal,deadline:now+100},1000,1);
  const pending=marketJson(url,{...scope,timeoutMs:mode==='timer'?10:1000,attempts:2,monitorErrors:true});
  if(['caller_cancelled','superseded'].includes(mode)){await turn();controller.abort(mode==='superseded'?'superseded':undefined);}
  await assert.rejects(pending,error=>error.code===(['deadline','timer'].includes(mode)?'timeout':mode));assert.equal(calls,1);assert.equal(cancelled,1);assert.equal(scope.budget.used,1);
 }
 const scope=marketScope({},1000,0);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({});});
 await assert.rejects(marketJson(url,{...scope,timeoutMs:1000,monitorErrors:true}),error=>error.code==='upstream_unavailable');assert.equal(calls,0);
});

test('monitor 429 takes the longest safe typed/header/default cooldown without trusting malformed fields',async t=>{
 for(const [retryAt,header,expected,validated] of [
  [now+180000,'120',now+180000,true],[now+120000,'180',now+180000,true],[now-1000,'0',now+60000,true],
  [now+120000,new Date(now+240000).toUTCString(),now+240000,true],
  [Number.MAX_SAFE_INTEGER,'0',Number.MAX_SAFE_INTEGER,true],[now+120000,'9'.repeat(400),Number.MAX_SAFE_INTEGER,true],
  [Number.MAX_SAFE_INTEGER+1,'180',now+180000,false],['2000000000000','180',now+180000,false],[-1,'180',now+180000,false],[now+0.5,'180',now+180000,false],
 ]){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:'remote-secret',errorInfo:{code:'rate_limited',stage:'upstream',retryAt,upstreamStatus:429,traceId:'remote'}},{status:429,headers:{'Retry-After':header}});});
  await assert.rejects(marketJson(url,{timeoutMs:1000,attempts:2,monitorErrors:true,traceId:'site'}),error=>error.code==='rate_limited'&&error.retryAt===expected&&error.validatedMonitorError===validated&&error.traceId==='site'&&!error.message.includes('remote-secret'));assert.equal(calls,1);
 }
});

test('known proxy HTTP denial and rate limits survive unusable details while caller cancellation still wins',async t=>{
 for(const status of [401,403]){
  let reads=0;t.mock.method(globalThis,'fetch',async()=>({ok:false,status,headers:new Headers({'Content-Type':'application/json'}),body:{getReader(){reads++;throw Error('must not read');},cancel:async()=>{}}}));
  await assert.rejects(marketJson(url,{timeoutMs:1000,monitorErrors:true}),error=>error.code==='upstream_denied'&&error.status===status&&!error.validatedMonitorError);assert.equal(reads,0);
 }
 for(const mode of ['deadline','timer','caller_cancelled','html','json','size']){
  let calls=0,cancelled=0;const controller=new AbortController();
  t.mock.method(globalThis,'fetch',async()=>{
   calls++;const headers={'Content-Type':mode==='html'?'text/html':'application/json','Retry-After':'180'};
   if(mode==='html'||mode==='json')return new Response(mode==='html'?'<html>':'{',{status:429,headers});
   return new Response(new ReadableStream({pull(stream){if(mode==='deadline'){now+=101;stream.enqueue(new TextEncoder().encode('{}'));}if(mode==='size')stream.enqueue(new Uint8Array(8193));},cancel(){cancelled++;}}),{status:429,headers});
  });
  const until=now+180000;const pending=marketJson(url,{timeoutMs:mode==='timer'?10:1000,deadline:now+100,attempts:2,monitorErrors:true,signal:controller.signal});
  if(mode==='caller_cancelled'){await turn();controller.abort();}
  await assert.rejects(pending,error=>mode==='caller_cancelled'?error.code==='caller_cancelled':error.code==='rate_limited'&&error.retryAt>=until&&error.retryAt<=now+180000);assert.equal(calls,1,mode);
  if(!['html','json'].includes(mode))assert.equal(cancelled,1,mode);
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
test('Yahoo transport retry and newly queued symbols honor another request cooldown without spending attempts',async t=>{
 const pending=new Map(),calls=[];let recovering=false;
 t.mock.method(globalThis,'fetch',async input=>{
  const symbol=input.pathname.split('/').at(-1);calls.push(symbol);
  if(recovering||pending.has(symbol))return Response.json(yahoo(symbol));
  return new Promise((resolve,reject)=>pending.set(symbol,{resolve,reject}));
 });
 const firstScope=marketScope({},12000,2),secondScope=marketScope({},12000,2),queuedScope=marketScope({},12000,2),until=now+180000;
 const first=assert.rejects(getQuote('YRETRYA',false,firstScope),error=>error.code==='rate_limited'&&error.retryAt===until);
 const second=assert.rejects(getQuote('YRETRYB',false,secondScope),error=>error.code==='rate_limited'&&error.retryAt===until&&error.traceId===secondScope.traceId);
 await turn();assert.deepEqual(calls,['YRETRYA','YRETRYB']);
 pending.get('YRETRYA').resolve(new Response('',{status:429,headers:{'Retry-After':'180'}}));await first;
 await assert.rejects(getQuote('YRETRYC',false,queuedScope),error=>error.code==='rate_limited'&&error.retryAt===until);
 pending.get('YRETRYB').reject(reset());await second;
 assert.deepEqual(calls,['YRETRYA','YRETRYB']);assert.deepEqual(firstScope.budget,{remaining:1,used:1});assert.deepEqual(secondScope.budget,{remaining:1,used:1});assert.deepEqual(queuedScope.budget,{remaining:2,used:0});
 now=until+1;recovering=true;assert.equal((await getQuote('YRETRYB',false)).price,110);assert.deepEqual(calls,['YRETRYA','YRETRYB','YRETRYB']);
});
test('concurrent Yahoo rate responses retain the longest provider cooldown',async t=>{
 const pending=[];let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Promise(resolve=>pending.push(resolve));});
 const until=now+180000;
 const first=assert.rejects(getQuote('YLONGA'),error=>error.code==='rate_limited'&&error.retryAt===until);
 const second=assert.rejects(getQuote('YLONGB'),error=>error.code==='rate_limited');await turn();
 pending[0](new Response('',{status:429,headers:{'Retry-After':'180'}}));await first;
 pending[1](new Response('',{status:429,headers:{'Retry-After':'60'}}));await second;
 now+=61000;await assert.rejects(getQuote('YLONGC'),error=>error.code==='rate_limited'&&error.retryAt===until);assert.equal(calls,2);
});
test('Yahoo cancellation during a concurrent cooldown stays cancellation and does not retry',async t=>{
 const pending=new Map();let calls=0;t.mock.method(globalThis,'fetch',async input=>{calls++;return new Promise((resolve,reject)=>pending.set(input.pathname.split('/').at(-1),{resolve,reject}));});
 const controller=new AbortController(),scope=marketScope({signal:controller.signal},12000,2);
 const first=assert.rejects(getQuote('YCANCELA'),error=>error.code==='rate_limited');
 const second=assert.rejects(getQuote('YCANCELB',false,scope),error=>error.code==='caller_cancelled');await turn();
 pending.get('YCANCELA').resolve(new Response('',{status:429,headers:{'Retry-After':'180'}}));await first;
 controller.abort();pending.get('YCANCELB').reject(reset());await second;await turn();
 assert.equal(calls,2);assert.deepEqual(scope.budget,{remaining:1,used:1});
});
test('provider attempt guards cannot mask caller cancellation or an expired deadline',async t=>{
 let checks=0,calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw reset();});
 const beforeAttempt=scope=>{checks++;throw marketError('rate_limited',scope,{retryAt:now+180000});};
 for(const code of ['caller_cancelled','timeout']){
  const controller=new AbortController();if(code==='caller_cancelled')controller.abort();
  const scope=marketScope({signal:controller.signal,...(code==='timeout'?{deadline:now}: {})},12000,2);
  await assert.rejects(marketJson(url,{...scope,timeoutMs:12000,attempts:2,beforeAttempt}),error=>error.code===code);
  assert.deepEqual(scope.budget,{remaining:2,used:0});
 }
 assert.equal(checks,0);assert.equal(calls,0);
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
