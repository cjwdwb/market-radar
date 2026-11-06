import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker,{run} from '../monitor/worker.mjs';
crypto.subtle.timingSafeEqual=(a,b)=>timingSafeEqual(Buffer.from(a),Buffer.from(b));
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../monitor/schema.sql',import.meta.url),'utf8'));
 const wrap=(sql,params=[])=>({bind(...args){return wrap(sql,args);},async first(){return sqlite.prepare(sql).get(...params)??null;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async run(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};}});
 return {prepare:wrap,async batch(queries){sqlite.exec('BEGIN');try{const results=[];for(const q of queries)results.push(await q.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
test('cloud records one trigger, preserves it on stale sync, rearms and pauses safely',async()=>{
 const original=fetch;
 globalThis.fetch=async()=>Response.json({code:'0',data:[{instId:'BTC-USDT',last:'110',open24h:'100',ts:String(Date.now()),high24h:'115',low24h:'95',volCcy24h:'5000'}]});
 const env={DB:database(),MONITOR_TOKEN:'test-token'},alert={id:'a',symbol:'BTC-USDT',target:100,direction:'above',enabled:true,createdAt:1};
 const save=async(config)=>{const response=await worker.fetch(new Request('https://monitor.test/',{method:'PUT',headers:{Authorization:'Bearer test-token'},body:JSON.stringify(config)}),env);assert.equal(response.status,200);return response.json();};
 const state=async()=>{const response=await worker.fetch(new Request('https://monitor.test/',{headers:{Authorization:'Bearer test-token'}}),env);return response.json();};
 try{
  assert.equal((await worker.fetch(new Request('https://monitor.test/'),env)).status,401);
  const config={enabled:true,watchlist:['BTC-USDT'],alerts:[alert]};await save(config);await run(env);
  const first=await state();assert.equal(first.alerts[0].triggeredPrice,110);assert.equal(first.alerts[0].enabled,false);
  await save(config);await run(env);assert.equal((await state()).alerts[0].triggeredAt,first.alerts[0].triggeredAt);
  await save({...config,alerts:[{...alert,createdAt:2}]});assert.equal((await state()).alerts[0].triggeredAt,undefined);
  await save({...config,enabled:false,alerts:[{...alert,createdAt:2}]});await run(env);assert.equal((await state()).alerts[0].triggeredAt,undefined);
  await save({...config,alerts:[]});assert.equal((await state()).alerts.length,0);
 }finally{globalThis.fetch=original;}
});

test('monitor history preserves forwarded trace and expired absolute deadline without dispatch',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({});});
 const traceId='12345678-1234-4234-8234-123456789abc';
 const request=new Request('https://monitor.test/history?symbol=BTC-USDT&range=1d',{headers:{Authorization:'Bearer test-token','X-Market-Deadline':String(Date.now()-1),'X-Market-Trace':traceId}});
 const response=await worker.fetch(request,{MONITOR_TOKEN:'test-token'});const body=await response.json();
 assert.equal(response.status,504);assert.equal(body.errorInfo.code,'timeout');assert.equal(body.errorInfo.traceId,traceId);assert.equal(calls,0);
});

test('only authenticated history emits bounded diagnostics and fixed failure logs without reading settings',async t=>{
 let now=2_000_000_000_000,calls=0;const logs=[];
 t.mock.method(Date,'now',()=>now);t.mock.method(console,'warn',value=>logs.push(JSON.parse(value)));
 const env={MONITOR_TOKEN:'test-token',get DB(){assert.fail('history must not read settings or alerts');}};
 const request=authorized=>new Request('https://monitor.test/history?symbol=ETH-USDT&range=15m',{headers:authorized?{Authorization:'Bearer test-token','X-Market-Trace':'private invalid trace'}:{}});
 t.mock.method(globalThis,'fetch',async()=>{calls++;assert.fail('unauthorized request must not dispatch');});
 const denied=await worker.fetch(request(false),env);assert.equal(denied.status,401);assert.equal((await denied.json()).diagnostic,undefined);assert.equal(calls,0);assert.equal(logs.length,0);
 for(const status of [429,200,202]){
  now+=1000000;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return status===429?new Response('private provider body',{status,headers:{'Retry-After':'120'}}):Response.json({code:'50011',msg:'private provider message',data:[]},{status});});
  const response=await worker.fetch(request(true),env),body=await response.json();
  const expected={version:1,kind:status===429?'http':'business',httpStatus:status,...(status===429?{}:{businessCode:'50011'}),endpoint:'candles',attempts:1,observedAt:now};
  assert.equal(response.status,429);assert.equal(body.errorInfo.upstreamStatus,429);assert.deepEqual(body.diagnostic,expected);assert.equal(body.errorInfo.rateLimitDiagnostic,undefined);assert.equal(JSON.stringify(body).includes('private'),false);
  assert.deepEqual(logs.at(-1).rateLimitDiagnostic,expected);assert.equal(logs.at(-1).diagnosticSource,'local');assert.equal(logs.at(-1).observedAttempts,1);
  now+=10;const cooldown=await worker.fetch(request(true),env),blocked=await cooldown.json();
  assert.equal(cooldown.status,429);assert.deepEqual(blocked.diagnostic,{version:1,kind:'cooldown',attempts:0,observedAt:now});assert.equal(logs.at(-1).observedAttempts,0);assert.equal(logs.at(-1).rateLimitDiagnostic.httpStatus,undefined);assert.equal(logs.at(-1).upstreamBusinessCode,undefined);
 }
 assert.equal(calls,3);assert.equal(logs.length,6);assert.equal(JSON.stringify(logs).includes('private'),false);assert.equal(JSON.stringify(logs).includes('test-token'),false);
});
