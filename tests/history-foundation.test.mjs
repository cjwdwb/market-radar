// Synthetic fixture only; no network, current user list, production resource or source-license claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ArchiveStore, canonical, digest, EXPORT_LIMITS } from '../collector/store.mjs';
import { runBatch } from '../collector/runner.mjs';
import { main as cli } from '../scripts/history-local.mjs';

const start=Date.parse('2026-09-01T00:00:00Z'),cutoff=start+86400000,received=cutoff+1000;
const asset={id:'fixture:US:XNAS:NVDA:USD',market:'us',venue:'XNAS',providerId:'fixture:NVDA',currency:'USD',adjustment:'raw',role:'asset'};
const helper={...asset,id:'fixture:US:XNAS:QQQ:USD',providerId:'fixture:QQQ',role:'helper'};
const config=(id='r1',extra={})=>({owner:'owner-a',runId:id,source:'fixture:approved-test',universeVersion:'fixture-universe-v1',assets:[asset,helper],from:start,cutoff,createdAt:received,identity:'fixture',limits:{},...extra});
const bar=(i=0,close=100,which=asset.id)=>({asset:which,kind:'bar',occurredAt:start+i*300000,payload:{intervalMs:300000,currency:'USD',adjustment:'raw',open:close,high:close+1,low:close-1,close,volume:100,complete:true,sessionEvidence:'fixture_only'}});
const info=(precision='second')=>({asset:asset.id,kind:'information',occurredAt:precision==='second'?start+1000:null,payload:{sourceRecordId:'filing-1',title:'Synthetic filing',publisher:'Fixture issuer',url:'https://example.invalid/filing-1',publication:{precision,at:precision==='second'?start+1000:null,date:precision==='day'?'2026-09-01':null,timezone:'UTC'},informationType:'filing'}});
const query=(extra={})=>({owner:'owner-a',source:'fixture:approved-test',asset:asset.id,kind:'bar',from:start,to:cutoff,...extra});
function page(store,id,records,{nextCursor=null,done=true,fault,at=received}={}){
  const r=store.requireRun('owner-a',id),reservation=store.reserveRequest('owner-a',id,at);assert.equal(reservation.ok,true);
  store.chargeBytes('owner-a',id,Buffer.byteLength(canonical(records))+10);
  try{return store.commitPage('owner-a',id,{expectedCursor:r.cursor,nextCursor,records,receivedAt:at,traversalDone:done,leaseToken:reservation.leaseToken},fault);}
  finally{store.releaseRequest('owner-a',id,reservation.leaseToken);}
}
function memory(t){const store=new ArchiveStore();t.after(()=>store.close());return store;}
const adapter=(pageFn)=>({identity:'fixture',source:'fixture:approved-test',page:pageFn});

test('history: empty archive has no seed, default universe or automatic collection',t=>{
  const s=memory(t);assert.equal(s.query(query()).records.length,0);assert.equal(s.getRun('owner-a','r1'),null);
  for(const patch of [{identity:'observed_live'},{source:'SEC'},{assets:[]},{assets:[asset,asset]},{cutoff:received+1},{limits:{requests:21}},{assets:[{...asset,providerId:undefined}]}])assert.throws(()=>s.createRun(config('bad',patch)));
  assert.throws(()=>s.createRun(config('secret',{secret:'never-stored'})),/FIXTURE_SCOPE/);
});
test('history: duplicate retry, source correction and A-B-A return have distinct stable versions',t=>{
  const s=memory(t);
  for(const [id,close] of [['a',100],['b',101],['a2',100],['a3',100]]){s.createRun(config(id));page(s,id,[bar(0,close)]);}
  const rows=s.db.prepare('SELECT hash,received_at FROM archive_facts ORDER BY id').all();assert.equal(rows.length,3);assert.equal(rows[0].hash,rows[2].hash);assert.notEqual(rows[0].hash,rows[1].hash);
  assert.equal(s.query(query()).records[0].payload.close,100);assert.equal(s.getRun('owner-a','a3').writes,0);
});
test('history: fixed-revision pagination does not mix later corrections',t=>{
  const s=memory(t);s.createRun(config());page(s,'r1',[bar(0),bar(1),bar(2)]);
  const first=s.query(query({limit:1}));s.createRun(config('correction'));page(s,'correction',[bar(1,120)]);
  const second=s.query(query({limit:1,cursor:first.nextCursor}));assert.equal(second.records[0].payload.close,100);assert.equal(second.readRevision,first.readRevision);
  assert.equal(s.query(query()).records[1].payload.close,120);
  assert.throws(()=>s.query(query({limit:1,cursor:first.nextCursor,owner:'owner-b'})),/INVALID_CURSOR/);
});
test('history: owner, asset, query limit and range are isolated',t=>{
  const s=memory(t);s.createRun(config());page(s,'r1',[bar()]);
  assert.equal(s.query(query({owner:'owner-b'})).records.length,0);assert.throws(()=>s.reserveRequest('owner-b','r1',received),/RUN_NOT_FOUND/);
  for(const patch of [{limit:201},{from:0},{to:start+32*86400000},{cursor:'garbage'},{asset:"x' OR 1=1--"}])assert.throws(()=>s.query(query(patch)));
  assert.equal(JSON.parse(s.exportSnapshot('owner-b')).data.tables.archive_facts.length,0);
});
test('history: faults after facts or checkpoint roll back both and preserve consumed budget',t=>{
  const s=memory(t);s.createRun(config());
  for(const stage of ['after_facts','after_checkpoint'])assert.throws(()=>page(s,'r1',[bar()],{fault:where=>{if(where===stage)throw Error('crash');}}),/crash/);
  assert.equal(s.query(query()).records.length,0);assert.equal(s.getRun('owner-a','r1').cursor,null);assert.equal(s.getRun('owner-a','r1').requests,2);
  assert.ok(s.getRun('owner-a','r1').bytes>0);page(s,'r1',[bar()]);assert.equal(s.query(query()).records.length,1);
});
test('history: duplicate keys, repeated pages and cursor cycles cannot advance checkpoint',t=>{
  const s=memory(t);s.createRun(config());assert.throws(()=>page(s,'r1',[bar(),bar()],{nextCursor:'p2',done:false}),/DUPLICATE_PAGE_KEYS/);
  page(s,'r1',[bar()],{nextCursor:'p2',done:false});
  assert.throws(()=>page(s,'r1',[bar()],{nextCursor:'p3',done:false}),/REPEATED_PAGE/);
  assert.throws(()=>page(s,'r1',[bar(1)],{nextCursor:'p2',done:false}),/NO_PROGRESS/);
  page(s,'r1',[bar(1)],{nextCursor:'p3',done:false});assert.throws(()=>page(s,'r1',[bar(2)],{nextCursor:'p2',done:false}),/CURSOR_CYCLE/);
  assert.equal(s.getRun('owner-a','r1').cursor,'p3');
});
test('history: cutoff, native interval, OHLC, completed and universe validations reject bad bars',t=>{
  const s=memory(t);s.createRun(config());
  const invalid=[{...bar(),occurredAt:cutoff},bar(0,100,'another:asset'),{...bar(),occurredAt:start-300000},...[{intervalMs:60000},{complete:false},{high:99},{close:NaN},{currency:'USDT'},{adjustment:'adjusted'},{sessionEvidence:'real-market'}].map(p=>({...bar(),payload:{...bar().payload,...p}}))];
  for(const [i,b] of invalid.entries()){s.createRun(config(`invalid-${i}`));assert.throws(()=>page(s,`invalid-${i}`,[b]));}assert.equal(s.query(query()).records.length,0);
});
test('history: day precision stays unknown intraday and repeated batches do not invent revisions',t=>{
  const s=memory(t);s.createRun(config());page(s,'r1',[info('day')]);
  s.createRun(config('r2',{cutoff:cutoff+300000,createdAt:received+300000}));page(s,'r2',[info('day')],{at:received+300000});
  const result=s.query(query({kind:'information'}));assert.equal(result.records.length,1);assert.equal(result.records[0].occurred_at,null);assert.equal(result.records[0].sortBasis,'publication_day_upper_bound');assert.equal(s.getRun('owner-a','r2').writes,0);
  assert.equal(s.query(query({kind:'information',to:start+3600000})).records.length,0);
});
test('history: unsafe links, raw HTML, impossible publication and extra fields are rejected',t=>{
  const s=memory(t);s.createRun(config());
  let invalidIndex=0;for(const patch of [{url:'javascript:alert(1)'},{url:'https://127.0.0.1/a'},{url:'https://example.invalid/a?token=x'},{title:'<script>x</script>'},{body:'raw unlicensed fulltext'},{publication:{precision:'second',at:received+1,date:null,timezone:'UTC'}},{publication:{precision:'day',at:null,date:'2026-02-31',timezone:'UTC'}}]){const id=`invalid-${invalidIndex++}`;s.createRun(config(id));assert.throws(()=>page(s,id,[{...info(),payload:{...info().payload,...patch}}]));}
  page(s,'r1',[info()]);assert.equal(s.query(query({kind:'information'})).records[0].payload.title,'Synthetic filing');
});
test('history: cancelled or exhausted runs require explicit resume and cannot reset budgets',t=>{
  const s=memory(t);s.createRun(config('r1',{limits:{requests:1}}));const reservation=s.reserveRequest('owner-a','r1',received);assert.equal(reservation.ok,true);s.releaseRequest('owner-a','r1',reservation.leaseToken);assert.equal(s.reserveRequest('owner-a','r1',received).reason,'budget_requests');assert.throws(()=>s.resumeRun('owner-a','r1',received),/BUDGET_EXHAUSTED/);
  s.createRun(config('cancel'));s.stopRun('owner-a','cancel');assert.equal(s.reserveRequest('owner-a','cancel',received).ok,false);s.resumeRun('owner-a','cancel',received);assert.equal(s.reserveRequest('owner-a','cancel',received).ok,true);
  s.createRun(config('old'));assert.equal(s.reserveRequest('owner-a','old',received+60000).reason,'budget_time');
});
test('history: oversized response is durably counted and pauses before checkpoint',async t=>{
  const s=memory(t);s.createRun(config('r1',{limits:{pageBytes:100}}));
  const result=await runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>received,adapter:adapter(async()=>({records:[bar()],nextCursor:null,traversalDone:true,bytes:500}))});
  assert.equal(result.reason,'budget_bytes');assert.ok(result.bytes>=500);assert.equal(result.pages,0);assert.equal(s.query(query()).records.length,0);
});
test('history: 429 retry-after is honored, retries charged, finite success',async t=>{
  const s=memory(t);s.createRun(config());let time=received,calls=0;const waits=[];
  const result=await runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>time,sleep:async ms=>{waits.push(ms);time+=ms;},adapter:adapter(async()=>{calls++;if(calls<3)throw Object.assign(Error('busy'),{status:429,retryAfterMs:50,bytes:25});return {records:[bar()],nextCursor:null,traversalDone:true};})});
  assert.equal(result.status,'traversed');assert.equal(result.requests,3);assert.deepEqual(waits,[50,50]);assert.ok(result.bytes>50);
});
test('history: long Retry-After does not retry early and repeated failures stop',async t=>{
  const s=memory(t);s.createRun(config());let calls=0;
  const long=await runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>received,adapter:adapter(async()=>{calls++;throw Object.assign(Error('rate'),{status:429,retryAfterMs:60000});})});assert.equal(calls,1);assert.equal(long.reason,'retry_after');
  s.createRun(config('r2'));let time=received;const failed=await runBatch({store:s,owner:'owner-a',runId:'r2',now:()=>time,sleep:async ms=>{time+=ms;},adapter:adapter(async()=>{throw Object.assign(Error('unavailable'),{status:503});})});assert.equal(failed.requests,3);assert.equal(failed.reason,'retry_exhausted');
});
test('history: cancelled in-flight response never commits, no external adapter accepted',async t=>{
  const s=memory(t);s.createRun(config());const controller=new AbortController();
  const result=await runBatch({store:s,owner:'owner-a',runId:'r1',signal:controller.signal,now:()=>received,adapter:adapter(async()=>{controller.abort();return {records:[bar()],nextCursor:null,traversalDone:true};})});assert.equal(result.reason,'cancelled');assert.equal(result.pages,0);
  await assert.rejects(()=>runBatch({store:s,owner:'owner-a',runId:'r1',adapter:{identity:'real',source:'SEC',page:()=>{throw Error('must not run');}}}),/FIXTURE_ADAPTER_REQUIRED/);
});
test('history: repeated and empty non-terminal pages pause, independent source failures remain local',async t=>{
  const s=memory(t);s.createRun(config());let n=0;
  const result=await runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>received,adapter:adapter(async()=>({records:[bar()],nextCursor:`p${++n}`,traversalDone:false}))});assert.equal(result.reason,'no_progress');assert.equal(result.pages,1);
  s.createRun(config('other'));const empty=await runBatch({store:s,owner:'owner-a',runId:'other',now:()=>received,adapter:adapter(async()=>({records:[],nextCursor:'p2',traversalDone:false}))});assert.equal(empty.reason,'invalid_page');assert.equal(s.getRun('owner-a','r1').pages,1);
});
test('history: export preserves revisions and restores exact query into new empty store',t=>{
  const s=memory(t),restored=memory(t);s.createRun(config());page(s,'r1',[bar(),bar(1),info()]);s.createRun(config('r2'));page(s,'r2',[bar(1,102)]);
  const exported=s.exportSnapshot('owner-a'),result=restored.restoreSnapshot(exported);assert.equal(result.rows,8);assert.deepEqual(restored.query(query()),s.query(query()));assert.equal(restored.exportSnapshot('owner-a'),exported);
  assert.throws(()=>restored.restoreSnapshot(exported),/REQUIRES_EMPTY/);
});
test('history: corrupt, oversized and structurally inconsistent exports reject atomically',t=>{
  const s=memory(t);s.createRun(config());page(s,'r1',[bar(),bar(1)]);const baseline=JSON.parse(s.exportSnapshot('owner-a'));
  const mutations=[e=>{e.data.tables.archive_facts[0].id=-1;},e=>{e.data.tables.archive_runs[0].status='ready';},e=>{e.data.tables.archive_runs[0].requests=0;},e=>{e.data.tables.archive_runs[0].bytes=0;},e=>{e.data.tables.archive_facts[0].owner='other';},e=>{e.data.tables.archive_facts[0].received_at=1;},e=>{e.data.tables.archive_facts[0].payload='{}';}];
  for(const mutate of mutations){const d=memory(t),copy=structuredClone(baseline);mutate(copy);copy.checksum=digest(copy.data);assert.throws(()=>d.restoreSnapshot(canonical(copy)));assert.equal(d.query(query()).records.length,0);}
  const d=memory(t);baseline.checksum='wrong';assert.throws(()=>d.restoreSnapshot(canonical(baseline)),/INVALID_EXPORT/);assert.throws(()=>d.restoreSnapshot(' '.repeat(EXPORT_LIMITS.bytes+1)),/BYTE_LIMIT/);
});
test('history: file persistence survives process exit and supports restoration in a separate process',t=>{
  const folder=mkdtempSync(join(tmpdir(),'radar-history-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const db=join(folder,'fixture.sqlite'),backup=join(folder,'snapshot.json'),target=join(folder,'restored.sqlite');const s=new ArchiveStore(db);s.createRun(config());page(s,'r1',[bar(),bar(1)]);writeFileSync(backup,s.exportSnapshot('owner-a'));s.close();
  const moduleUrl=new URL('../collector/store.mjs',import.meta.url).href;
  const code=`import {ArchiveStore} from ${JSON.stringify(moduleUrl)};import{readFileSync}from'node:fs';const s=new ArchiveStore(process.argv[1]);const old=s.query(JSON.parse(process.argv[4]));s.close();const d=new ArchiveStore(process.argv[2]);d.restoreSnapshot(readFileSync(process.argv[3],'utf8'));console.log(JSON.stringify({old,restored:d.query(JSON.parse(process.argv[4]))}));d.close();`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code,db,target,backup,JSON.stringify(query())],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);assert.deepEqual(output.old,output.restored);assert.equal(output.old.records.length,2);assert.ok(statSync(db).size>0);
});
test('history: CLI confines paths and refuses to overwrite databases or backup files',t=>{
  assert.throws(()=>cli(['init','../../outside.sqlite']),/OUTSIDE/);assert.throws(()=>cli(['init','Z:/outside.sqlite']),/OUTSIDE/);
  const folder=resolve('work/state27/cli-fixture-'+Date.now());const name=folder.split(/[\\/]/).at(-1);t.after(()=>rmSync(folder,{recursive:true,force:true}));
  assert.equal(cli(['init',`${name}/db.sqlite`]).externalCollection,'disabled');assert.throws(()=>cli(['init',`${name}/db.sqlite`]),/NEW_DATABASE/);
  assert.equal(cli(['export',`${name}/db.sqlite`,'owner-a',`${name}/export.json`]).format,'history-local-v1');assert.throws(()=>cli(['export',`${name}/db.sqlite`,'owner-a',`${name}/export.json`]),/EEXIST/);
  assert.equal(cli(['restore',`${name}/restored.sqlite`,`${name}/export.json`]).rows,0);
});

test('history: process termination during transaction rolls back, committed cursor survives restart',t=>{
  const folder=mkdtempSync(join(tmpdir(),'radar-crash-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));const db=join(folder,'fixture.sqlite');
  const s=new ArchiveStore(db);s.createRun(config());s.close();const moduleUrl=new URL('../collector/store.mjs',import.meta.url).href;
  for(const [attempt,stage] of ['after_facts','after_checkpoint','committed'].entries()){
    const at=received+attempt*9000;
    const code=`import {ArchiveStore} from ${JSON.stringify(moduleUrl)};const s=new ArchiveStore(process.argv[1]);const r=s.reserveRequest('owner-a','r1',${at});s.chargeBytes('owner-a','r1',1000);s.commitPage('owner-a','r1',{expectedCursor:null,nextCursor:'p2',records:${JSON.stringify([bar()])},receivedAt:${at},traversalDone:false,leaseToken:r.leaseToken},stage=>{if(stage===process.argv[2])process.exit(77)});process.exit(0);`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',code,db,stage],{encoding:'utf8',windowsHide:true});assert.equal(child.status,stage==='committed'?0:77,child.stderr);
    const check=new ArchiveStore(db);assert.equal(check.query(query()).records.length,stage==='committed'?1:0);assert.equal(check.getRun('owner-a','r1').cursor,stage==='committed'?'p2':null);check.close();
  }
  const reopened=new ArchiveStore(db);assert.equal(reopened.getRun('owner-a','r1').requests,3);page(reopened,'r1',[bar(1)],{at:received+27000});assert.equal(reopened.getRun('owner-a','r1').status,'traversed');assert.equal(reopened.query(query()).records.length,2);reopened.close();
});
test('history: request timeout and invalid non-JSON response stop without clearing costs',async t=>{
  const s=memory(t);s.createRun(config('timeout',{limits:{durationMs:5}}));
  const timed=await runBatch({store:s,owner:'owner-a',runId:'timeout',now:()=>received,adapter:adapter(()=>new Promise(()=>{}))});assert.equal(timed.reason,'timeout');assert.equal(timed.requests,1);
  s.createRun(config('invalid'));const invalid=await runBatch({store:s,owner:'owner-a',runId:'invalid',now:()=>received,adapter:adapter(async()=>({records:[{x:NaN}],bytes:3000}))});assert.equal(invalid.reason,'invalid_page');assert.equal(invalid.bytes,3000);assert.equal(invalid.pages,0);
});
test('history: page, write and cumulative byte limits cannot be bypassed by pagination',async t=>{
  const s=memory(t);
  for(const [id,limits,reason] of [['pages',{pages:1},'budget_pages'],['writes',{writes:1},'budget_writes'],['bytes',{bytes:600},'budget_bytes']]){
    // Separate synthetic source per budget case: prior-case dedupe must not reduce this case's writes.
    s.createRun(config(id,{limits,source:`fixture:${id}`}));let n=0;
    const r=await runBatch({store:s,owner:'owner-a',runId:id,now:()=>received,adapter:{...adapter(async()=>({records:[bar(n++)],nextCursor:String(n),traversalDone:false,bytes:500})),source:`fixture:${id}`}});assert.equal(r.reason,reason);assert.ok(r.pages<=1);
  }
});

test('history: unknown-publication repeated page is stable across receive times',t=>{
  const s=memory(t);s.createRun(config());page(s,'r1',[info('unknown')],{nextCursor:'p2',done:false});
  assert.throws(()=>page(s,'r1',[info('unknown')],{nextCursor:'p3',done:false,at:received+1}),/REPEATED_PAGE/);
  assert.equal(s.getRun('owner-a','r1').cursor,'p2');assert.equal(s.getRun('owner-a','r1').pages,1);
});
test('history: canonical asset identity is immutable across runs and restore, role/universe may change',t=>{
  const s=memory(t);s.createRun(config());page(s,'r1',[bar()]);
  for(const change of [{providerId:'other-issuer'},{market:'crypto'},{venue:'other'},{currency:'USDT'},{adjustment:'split-adjusted'}])assert.throws(()=>s.createRun(config('conflict',{assets:[{...asset,...change}]})),/ASSET_IDENTITY_CONFLICT/);
  s.createRun(config('changed-universe',{universeVersion:'fixture-v2',assets:[{...asset,role:'helper'}]}));
  const e=JSON.parse(s.exportSnapshot('owner-a'));e.data.tables.archive_runs[1].config=canonical({...JSON.parse(e.data.tables.archive_runs[1].config),assets:[{...asset,providerId:'different'}]});e.checksum=digest(e.data);
  const d=memory(t);assert.throws(()=>d.restoreSnapshot(canonical(e)),/ASSET_IDENTITY_CONFLICT/);assert.equal(d.query(query()).records.length,0);
});
test('history: concurrent runner is fenced and stale request cannot commit after lease expiry',async t=>{
  const s=memory(t);s.createRun(config());let resolvePage,calls=0;
  const a=adapter(()=>{calls++;return new Promise(resolve=>{resolvePage=resolve;});});
  const first=runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>received,adapter:a});await Promise.resolve();await Promise.resolve();
  await runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>received,adapter:a});assert.equal(calls,1);assert.equal(s.getRun('owner-a','r1').requests,1);
  resolvePage({records:[bar()],nextCursor:null,traversalDone:true});assert.equal((await first).status,'traversed');
  s.createRun(config('lease'));const old=s.reserveRequest('owner-a','lease',received);assert.equal(s.reserveRequest('owner-a','lease',received+1).reason,'in_flight');
  const current=s.reserveRequest('owner-a','lease',received+8000);assert.equal(current.ok,true);s.chargeBytes('owner-a','lease',1000);
  const body={expectedCursor:null,nextCursor:null,records:[bar()],receivedAt:received+8001,traversalDone:true};
  assert.throws(()=>s.commitPage('owner-a','lease',{...body,leaseToken:old.leaseToken}),/FENCED_REQUEST/);
  s.commitPage('owner-a','lease',{...body,leaseToken:current.leaseToken});assert.equal(s.getRun('owner-a','lease').requests,2);
});
test('history: retry exhaustion and Retry-After survive export, reopen and explicit resume',async t=>{
  const s=memory(t);s.createRun(config());let time=received;
  await runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>time,sleep:async ms=>{time+=ms;},adapter:adapter(async()=>{throw Object.assign(Error('busy'),{status:503});})});
  const d=memory(t);d.restoreSnapshot(s.exportSnapshot('owner-a'));assert.throws(()=>d.resumeRun('owner-a','r1',time),/PAGE_ATTEMPTS_EXHAUSTED/);assert.equal(d.getRun('owner-a','r1').requests,3);
  s.createRun(config('rate'));await runBatch({store:s,owner:'owner-a',runId:'rate',now:()=>received,adapter:adapter(async()=>{throw Object.assign(Error('rate'),{status:429,retryAfterMs:60000});})});
  assert.throws(()=>s.resumeRun('owner-a','rate',received),/RETRY_NOT_BEFORE/);assert.throws(()=>s.resumeRun('owner-a','rate',received+60000),/RUN_DEADLINE/);assert.equal(s.getRun('owner-a','rate').requests,1);
});
test('history: cancelling during long Retry-After promptly saves cancelled state',async t=>{
  const s=memory(t);s.createRun(config());const controller=new AbortController();let entered;
  const sleeping=new Promise(resolve=>{entered=resolve;});
  const running=runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>received,signal:controller.signal,sleep:()=>{entered();return new Promise(()=>{});},adapter:adapter(async()=>{throw Object.assign(Error('rate'),{status:429,retryAfterMs:50000});})});
  await sleeping;controller.abort();const result=await running;assert.equal(result.reason,'cancelled');assert.equal(result.status,'paused');assert.equal(result.requests,1);assert.equal(result.lease_token,null);
});
test('history: late executor cannot pause successor with invalid data or failure',async t=>{
  for(const lateError of [false,true]){
    const s=memory(t);s.createRun(config());let time=received;const pending=[];
    const a=adapter(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
    const first=runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>time,adapter:a});await Promise.resolve();await Promise.resolve();
    time+=8001;const second=runBatch({store:s,owner:'owner-a',runId:'r1',now:()=>time,adapter:a});await Promise.resolve();await Promise.resolve();assert.equal(pending.length,2);
    if(lateError)pending[0].reject(Object.assign(Error('late bad response'),{status:503,bytes:100}));else pending[0].resolve({records:[],nextCursor:'invalid-empty',traversalDone:false});
    await first;assert.equal(s.getRun('owner-a','r1').status,'ready');assert.equal(s.getRun('owner-a','r1').lease_token,2);
    pending[1].resolve({records:[bar()],nextCursor:null,traversalDone:true});const result=await second;assert.equal(result.status,'traversed');assert.equal(result.pages,1);assert.equal(result.writes,1);assert.ok(result.bytes>0);
  }
});
