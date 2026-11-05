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
