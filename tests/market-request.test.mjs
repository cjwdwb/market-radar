import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {marketJson,marketScope,SharedMarketRequests,errorInfo,publicError,marketError,errorResponse,recordMarketFailure} from '../lib/market-request.ts';
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

test('HTTP diagnostics freeze actual observation and attempts without entering public errors',async t=>{
 const observedAt=now,scope=marketScope();let failure;
 t.mock.method(globalThis,'fetch',async()=>new Response('private response body',{status:429,headers:{'Retry-After':'120'}}));
 await assert.rejects(marketJson(url,{...scope,timeoutMs:1000,stage:'proxy'}),error=>{failure=error;return error.code==='rate_limited';});
 assert.deepEqual(failure.rateLimitDiagnostic,{version:1,kind:'http',httpStatus:429,attempts:1,observedAt});
 scope.budget.used=9;now+=1000;
 assert.equal(failure.rateLimitDiagnostic.attempts,1);assert.equal(failure.rateLimitDiagnostic.observedAt,observedAt);assert.equal(Object.isFrozen(failure.rateLimitDiagnostic),true);
 assert.equal(failure.stage,'proxy');assert.equal(errorInfo(failure).rateLimitDiagnostic,undefined);
 const body=await errorResponse(failure).json();assert.deepEqual(Object.keys(body).sort(),['error','errorInfo']);assert.equal(JSON.stringify(body).includes('diagnostic'),false);assert.equal(JSON.stringify(body).includes('private'),false);
});

test('OKX business diagnostics retain actual successful HTTP status and new cooldown has no HTTP observation',async t=>{
 let calls=0;
 for(const status of [200,202]){
  now+=100000;const observedAt=now,scope=marketScope();
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'50011',msg:'private upstream text',data:[]},{status});});
  await assert.rejects(getOKXHistory('ETH-USDT','15m',scope),error=>{
   assert.equal(errorInfo(error).upstreamStatus,429);
   assert.deepEqual(error.rateLimitDiagnostic,{version:1,kind:'business',httpStatus:status,businessCode:'50011',endpoint:'candles',attempts:1,observedAt});return true;
  });
  const queued=marketScope();now+=10;
  await assert.rejects(getOKXTickers(queued),error=>{
   assert.deepEqual(error.rateLimitDiagnostic,{version:1,kind:'cooldown',attempts:0,observedAt:now});assert.equal(error.businessCode,undefined);return true;
  });assert.equal(queued.budget.used,0);
 }
 assert.equal(calls,2);
});

test('shared historical failure carries owner operation attempts even for an unspent joining scope',async t=>{
 let calls=0,resolve;const owner=marketScope(),joiner=marketScope();
 t.mock.method(globalThis,'fetch',async()=>{calls++;return calls<3?new Response('',{status:503}):new Promise(done=>{resolve=done;});});
 const collect=promise=>promise.then(()=>assert.fail('expected rate limit'),error=>error);
 const first=collect(getOKXHistory('BTC-USDT','15m',owner));await turn();assert.equal(calls,3);
 const joined=collect(getOKXHistory('BTC-USDT','1d',joiner));await turn();assert.equal(calls,3);
 resolve(new Response('',{status:429}));const failures=await Promise.all([first,joined]);
 assert.equal(owner.budget.used,3);assert.equal(joiner.budget.used,0);
 for(const failure of failures)assert.deepEqual(failure.rateLimitDiagnostic,{version:1,kind:'http',httpStatus:429,endpoint:'history-candles',attempts:3,observedAt:now});
 let logged;t.mock.method(console,'warn',value=>{logged=JSON.parse(value);});
 recordMarketFailure(failures[1],joiner,{symbol:'BTC-USDT',source:'OKX',range:'1d',path:'direct',startedAt:now});
 assert.equal(logged.observedAttempts,0);assert.equal(logged.upstreamAttempts,0);assert.equal(logged.rateLimitDiagnostic.attempts,3);assert.equal(logged.diagnosticSource,'local');
});

test('validated monitor diagnostics preserve operation counts and local identity without changing public errors',async t=>{
 const diagnostics=[
  {kind:'http',httpStatus:429,endpoint:'history-candles',attempts:3},
  {kind:'business',httpStatus:200,businessCode:'50011',endpoint:'candles',attempts:2},
  {kind:'business',httpStatus:202,businessCode:'50011',attempts:1},
  {kind:'business',businessCode:'50011',attempts:1},
  {kind:'cooldown',attempts:0},{kind:'cooldown',attempts:1},
 ];
 for(const fields of diagnostics){
  const diagnostic={version:1,...fields,observedAt:now-100},scope=marketScope({traceId:'local-trace'});let failure,logged,calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:'private remote prose',errorInfo:{code:'rate_limited',upstreamStatus:429,retryAt:now+120000,traceId:'private remote trace',stage:'parse'},diagnostic},{status:429,headers:{'Retry-After':'180'}});});
  await assert.rejects(marketJson(url,{...scope,timeoutMs:1000,attempts:2,stage:'proxy',monitorErrors:true}),error=>{failure=error;return error.code==='rate_limited';});
  assert.deepEqual(failure.rateLimitDiagnostic,diagnostic);assert.equal(failure.retryAt,now+180000);assert.equal(failure.validatedMonitorError,true);assert.equal(failure.traceId,'local-trace');assert.equal(failure.stage,'proxy');assert.equal(calls,1);
  t.mock.method(console,'warn',value=>{logged=JSON.parse(value);});
  recordMarketFailure(failure,scope,{symbol:'ETH-USDT',source:'OKX',range:'15m',path:'monitor',startedAt:now});
  assert.equal(logged.observedAttempts,1);assert.equal(logged.upstreamAttempts,'UNKNOWN');assert.equal(logged.monitorErrorValidated,true);assert.equal(logged.diagnosticSource,'monitor');assert.deepEqual(logged.rateLimitDiagnostic,diagnostic);assert.equal(JSON.stringify(logged).includes('private'),false);
  assert.equal(logged.upstreamBusinessCode,fields.kind==='business'?'50011':undefined);
  const response=errorResponse(failure),body=await response.json();assert.equal(response.status,429);assert.deepEqual(Object.keys(body).sort(),['error','errorInfo']);assert.equal(body.errorInfo.upstreamStatus,429);assert.equal(JSON.stringify(body).includes('50011'),false);
 }
});

test('invalid optional monitor diagnostics are discarded without changing the typed error or longest cooldown',async t=>{
 const valid={version:1,kind:'http',httpStatus:429,attempts:3,observedAt:now};
 const diagnostics=[undefined,null,[],{...valid,version:2},{...valid,kind:'unknown'},
  ...['source','traceId','stage','url','headers','message','extra'].map(key=>({...valid,[key]:'private injected value'})),
  {...valid,endpoint:'private endpoint'}, {...valid,endpoint:'x'.repeat(1000)},
  ...[-1,17,1.5,'1',0].map(attempts=>({...valid,attempts})),
  ...[0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'1'].map(observedAt=>({...valid,observedAt})),
  {...valid,httpStatus:200},{...valid,businessCode:'50011'},
  {...valid,kind:'business',httpStatus:429,businessCode:'50011'}, {...valid,kind:'business',httpStatus:200,businessCode:'private'},
  {...valid,kind:'cooldown'}, {...valid,kind:'cooldown',httpStatus:undefined,businessCode:'50011'},
 ];
 for(const diagnostic of diagnostics){
  let calls=0,logged;const scope=marketScope();
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:'private remote text',errorInfo:{code:'rate_limited',upstreamStatus:429,retryAt:now+240000},diagnostic},{status:429,headers:{'Retry-After':'180'}});});
  await assert.rejects(marketJson(url,{...scope,timeoutMs:1000,attempts:2,monitorErrors:true}),error=>{
   assert.equal(error.rateLimitDiagnostic,undefined);assert.equal(error.code,'rate_limited');assert.equal(error.retryAt,now+240000);assert.equal(error.validatedMonitorError,true);
   t.mock.method(console,'warn',value=>{logged=JSON.parse(value);});recordMarketFailure(error,scope,{symbol:'ETH-USDT',source:'OKX',path:'monitor',startedAt:now});return true;
  });assert.equal(calls,1);assert.equal(logged.rateLimitDiagnostic,undefined);assert.equal(logged.diagnosticSource,undefined);assert.equal(logged.monitorErrorValidated,true);assert.equal(logged.upstreamAttempts,'UNKNOWN');assert.equal(JSON.stringify(logged).includes('private'),false);
 }
});

test('monitor diagnostics require a consistent validated standard envelope and never infer upstream counts from the proxy hop',async t=>{
 const diagnostic={version:1,kind:'http',httpStatus:429,attempts:3,observedAt:now};
 for(const [status,errorInfo,validated] of [[504,{code:'timeout'},true],[429,{code:'rate_limited'},true],[429,{code:'rate_limited',upstreamStatus:403},false],[503,{code:'rate_limited',upstreamStatus:429},false]]){
  const scope=marketScope();let logged;
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:'private',errorInfo,diagnostic},{status}));
  await assert.rejects(marketJson(url,{...scope,timeoutMs:1000,monitorErrors:true}),error=>{
   t.mock.method(console,'warn',value=>{logged=JSON.parse(value);});recordMarketFailure(error,scope,{symbol:'ETH-USDT',source:'OKX',path:'monitor',startedAt:now});
   return error.rateLimitDiagnostic===undefined&&error.validatedMonitorError===validated;
  });assert.equal(logged.monitorErrorValidated,validated);assert.equal(logged.upstreamAttempts,'UNKNOWN');assert.equal(logged.observedAttempts,1);
 }
 t.mock.method(globalThis,'fetch',async()=>new Response('private nonstandard response',{status:429}));
 await assert.rejects(marketJson(url,{timeoutMs:1000,monitorErrors:true}),error=>error.code==='rate_limited'&&error.rateLimitDiagnostic===undefined);
});

test('failure logs revalidate diagnostics and reject arbitrary business-code text',t=>{
 const scope=marketScope(),error=marketError('rate_limited',scope,{upstreamStatus:429,businessCode:'private\nsecret'});let logged;
 error.rateLimitDiagnostic={version:1,kind:'http',httpStatus:429,attempts:1,observedAt:now,url:'private URL'};
 t.mock.method(console,'warn',value=>{logged=JSON.parse(value);});
 recordMarketFailure(error,scope,{symbol:'ETH-USDT',source:'OKX',path:'direct',startedAt:now});
 assert.equal(logged.rateLimitDiagnostic,undefined);assert.equal(logged.upstreamBusinessCode,undefined);assert.equal(JSON.stringify(logged).includes('private'),false);
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

for(const order of ['rate-first','reset-first'])test(`OKX publishes a same-turn 429 before concurrent fallback (${order})`,async t=>{
 const pending=new Map(),calls=[];
 t.mock.method(globalThis,'fetch',input=>{
  const symbol=input.searchParams.get('instId');calls.push({symbol,origin:input.origin,path:input.pathname});
  if(pending.has(symbol))return Promise.resolve(Response.json({code:'0',data:candleRows()}));
  return new Promise((resolve,reject)=>pending.set(symbol,{resolve,reject}));
 });
 const firstScope=marketScope(),secondScope=marketScope(),queuedScope=marketScope(),until=now+180000;
 const collect=promise=>promise.then(value=>({value}),error=>({error}));
 const first=collect(getOKXHistory('BTC-USDT','15m',firstScope)),second=collect(getOKXHistory('ETH-USDT','15m',secondScope));await turn();
 const rate=()=>pending.get('BTC-USDT').resolve(new Response('',{status:429,headers:{'Retry-After':'180'}}));
 const fail=()=>pending.get('ETH-USDT').reject(reset());
 if(order==='rate-first'){rate();fail();}else{fail();rate();}
 const results=await Promise.all([first,second]);
 assert.deepEqual(calls,[{symbol:'BTC-USDT',origin:'https://openapi.okx.com',path:'/api/v5/market/candles'},{symbol:'ETH-USDT',origin:'https://openapi.okx.com',path:'/api/v5/market/candles'}]);
 for(const [index,result] of results.entries()){assert.equal(result.error?.code,'rate_limited');assert.equal(result.error?.retryAt,until);assert.equal(result.error?.traceId,[firstScope,secondScope][index].traceId);assert.equal(result.error?.rateLimitDiagnostic.kind,index===0?'http':'cooldown');assert.equal(result.error?.rateLimitDiagnostic.attempts,1);assert.equal(result.error?.rateLimitDiagnostic.httpStatus,index===0?429:undefined);}
 assert.deepEqual(firstScope.budget,{remaining:3,used:1});assert.deepEqual(secondScope.budget,{remaining:3,used:1});
 await assert.rejects(getOKXTickers(queuedScope),error=>error.code==='rate_limited'&&error.retryAt===until);
 assert.deepEqual(queuedScope.budget,{remaining:4,used:0});assert.equal(calls.length,2);
 now=until+1;assert.equal((await getOKXHistory('ETH-USDT','15m')).symbol,'ETH-USDT');assert.equal(calls.length,3);
});

test('OKX concurrent caller cancellation preserves the observed cooldown and never falls back',async t=>{
 const pending=new Map(),calls=[];t.mock.method(globalThis,'fetch',input=>{const symbol=input.searchParams.get('instId');calls.push(symbol);return new Promise((resolve,reject)=>pending.set(symbol,{resolve,reject}));});
 const controller=new AbortController(),scope=marketScope({signal:controller.signal}),until=now+180000;
 const first=assert.rejects(getOKXHistory('BTC-USDT','15m'),error=>error.code==='rate_limited'&&error.retryAt===until);
 const second=assert.rejects(getOKXHistory('ETH-USDT','15m',scope),error=>error.code==='caller_cancelled');await turn();
 pending.get('BTC-USDT').resolve(new Response('',{status:429,headers:{'Retry-After':'180'}}));await first;
 controller.abort();pending.get('ETH-USDT').reject(reset());await second;await turn();
 await assert.rejects(getOKXHistory('SOL-USDT','15m'),error=>error.code==='rate_limited'&&error.retryAt===until);
 assert.deepEqual(calls,['BTC-USDT','ETH-USDT']);assert.deepEqual(scope.budget,{remaining:3,used:1});
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
test('Yahoo observes a 429 before a concurrent transport retry settled in the same turn',async t=>{
 const pending=new Map(),calls=[];
 t.mock.method(globalThis,'fetch',async input=>{
  const symbol=input.pathname.split('/').at(-1);calls.push(symbol);
  if(pending.has(symbol))return Response.json(yahoo(symbol));
  return new Promise((resolve,reject)=>pending.set(symbol,{resolve,reject}));
 });
 const firstScope=marketScope({},12000,2),secondScope=marketScope({},12000,2),until=now+180000;
 const first=getQuote('YSAMEA',false,firstScope).then(value=>({value}),error=>({error}));
 const second=getQuote('YSAMEB',false,secondScope).then(value=>({value}),error=>({error}));await turn();
 pending.get('YSAMEA').resolve(new Response('',{status:429,headers:{'Retry-After':'180'}}));
 pending.get('YSAMEB').reject(reset());
 const results=await Promise.all([first,second]);
 assert.deepEqual(calls,['YSAMEA','YSAMEB']);
 for(const result of results){assert.equal(result.error?.code,'rate_limited');assert.equal(result.error?.retryAt,until);}
 assert.deepEqual(firstScope.budget,{remaining:1,used:1});assert.deepEqual(secondScope.budget,{remaining:1,used:1});
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
