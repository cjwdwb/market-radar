// 固定模拟数据，不对CI发起外部请求。真实回补证据另存outputs/coverage29。
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {CoinMetricsArchive,collectCoinMetrics} from '../collector/coinmetrics-archive.mjs';
import {CM_LONG_PLAN,CM_LONG_BATCHES,DAILY_MS as DAY} from '../collector/coinmetrics-series.mjs';
import {coinMetricsDailyUrl,parseCoinMetricsDailyPage,CM_API_BYTES} from '../collector/coinmetrics-api.mjs';
import {canonical,digest} from '../collector/store.mjs';
import {startWorkbench} from '../scripts/history-workbench.mjs';
const now=Date.parse('2026-10-03T01:00Z');
const asset='btc',manifest={asset,transport:'community_api'};
function data(url,edit){const u=new URL(url),from=Date.parse(u.searchParams.get('start_time')),to=Date.parse(u.searchParams.get('end_time'));const rows=[];
  for(let t=from;t<to;t+=DAY)rows.push({asset:u.searchParams.get('assets'),time:new Date(t).toISOString(),PriceUSD:String(100+(t-CM_LONG_PLAN.from)/DAY)+'.123456789012345'});
  edit?.(rows);return Buffer.from(JSON.stringify({data:rows}));}
function setup(t,root=tmpdir()){const dir=mkdtempSync(join(root,'cm-series-')),path=join(dir,'archive.sqlite');let s=new CoinMetricsArchive(path,{create:true,series:true,fixture:true}),tick=now;
  const f={dir,path,get s(){return s;},reopen(){s.close();s=new CoinMetricsArchive(path);},get now(){return tick;},advance(ms){tick+=ms;},
    async run(batch,edit,fetcher){tick+=1000;return collectCoinMetrics(s,{batch,clock:()=>tick,wait:async ms=>{tick+=ms;},fetchImpl:fetcher??(async url=>new Response(data(url,edit)))});}};
  t.after(()=>s.close());return f;}
async function backfill(f){for(const b of CM_LONG_BATCHES.filter(v=>v.action==='backfill'))await f.run(b.id);}
test('annual API keeps UTC half-open/leap-day and exact price strings; old monthly path remains separate',()=>{
  const from=Date.parse('2024-01-01Z'),cutoff=Date.parse('2025-01-01Z'),url=coinMetricsDailyUrl(manifest,from,cutoff);
  const q=parseCoinMetricsDailyPage(data(url),{manifest,from,cutoff,receivedAt:now,now});
  assert.equal(q.points.length,366);assert.equal(q.points.filter(p=>p.sourceDate==='2024-02-29').length,1);
  assert.equal(q.points.at(-1).sourceDate,'2024-12-31');assert.equal(q.points.at(-1).evidenceEndAt,cutoff);
  assert.match(q.points[0].price,/\.123456789012345$/);assert.equal(new URL(url).searchParams.get('page_size'),'1000');
  assert.equal(q.analysis.short90m,'unsupported_frequency');assert.equal(q.vintage,'current_vintage');
  assert.throws(()=>coinMetricsDailyUrl(manifest,from,cutoff+DAY),/RANGE/);
  assert.throws(()=>parseCoinMetricsDailyPage(data(url),{manifest,from,cutoff,receivedAt:cutoff-1,now}),/RANGE/);
});
test('unvisited dates differ from provider gaps/nulls; no zero fill or completed-future day',async t=>{
  const f=setup(t);await f.run('BACKFILL-2021',rows=>{rows.splice(1,1);rows[1].PriceUSD=null;});
  const q=f.s.query('btc');assert.deepEqual(q.coverage.missing.map(x=>x.reason),['missing_date','missing_value']);assert.equal(q.points.length,29);
  const c=f.s.catalog().series[0];assert.equal(c.coverage.gapCount,2);assert.equal(c.coverage.notBackfilledCount,1736);assert.equal(c.coverage.missingCount,1738);
  const unvisited=f.s.query('btc',Date.parse('2022-01-01Z'),Date.parse('2022-02-01Z'));assert.equal(unvisited.points.length,0);assert.ok(unvisited.coverage.missing.every(x=>x.reason==='not_backfilled'));
  assert.throws(()=>f.s.query('btc',CM_LONG_PLAN.from,CM_LONG_PLAN.cutoff+DAY),/RANGE/);
});
test('bounded incremental uses existing checkpoint and three-day overlap; fixed old version remains reproducible',async t=>{
  const f=setup(t);await assert.rejects(f.run('INCREMENTAL-20261003'),/CHECKPOINT/);assert.equal(f.s.status().newRequests,0);
  await backfill(f);const before=f.s.catalog();assert.equal(f.s.status().newRequests,12);assert.equal(before.series[0].count,1827);
  const old=before.series[0].version,from=Date.parse('2026-09-30Z');const q=f.s.query('btc',from,CM_LONG_PLAN.cutoff,old);
  assert.equal(q.points.length,2);assert.equal(q.coverage.missing[0].reason,'not_backfilled');
  const urls=[];await f.run('INCREMENTAL-20261003',null,async u=>{urls.push(u);return new Response(data(u));});
  assert.equal(f.s.status().newRequests,14);assert.equal(f.s.status().factVersions,3656);
  assert.ok(urls.every(u=>Date.parse(new URL(u).searchParams.get('start_time'))===from));
  assert.equal(f.s.catalog().series[0].count,1828);assert.equal(f.s.catalog().series[0].checkpointAt,CM_LONG_PLAN.cutoff);
  assert.deepEqual(f.s.query('btc',from,CM_LONG_PLAN.cutoff,old),q);
  await f.run('INCREMENTAL-20261003',null,()=>{throw Error('must not fetch');});assert.equal(f.s.status().newRequests,14);
  f.reopen();assert.equal(f.s.catalog().series[0].count,1828);f.s.validate();
});
test('A→B→A keeps revisions while same-value overlap creates no duplicate fact; missing revisions are explicit',async t=>{
  const f=setup(t);await backfill(f);await f.run('INCREMENTAL-20261003');const first=f.s.catalog().series[0].version;
  await f.run('REVISION-01',r=>{r[0].PriceUSD='42.000';r[1].PriceUSD=null;});const second=f.s.catalog().series[0].version;
  await f.run('REVISION-02');const last=f.s.catalog().series[0].version,from=Date.parse('2026-09-30Z');
  const a=f.s.query('btc',from,CM_LONG_PLAN.cutoff,first),b=f.s.query('btc',from,CM_LONG_PLAN.cutoff,second),c=f.s.query('btc',from,CM_LONG_PLAN.cutoff,last);
  assert.equal(b.points[0].price,'42.000');assert.equal(b.coverage.missingCount,1);assert.equal(c.points[0].price,a.points[0].price);
  assert.notEqual(c.points[0].versionReceivedAt,a.points[0].versionReceivedAt);assert.equal(c.points[0].firstReceivedAt,a.points[0].firstReceivedAt);
  assert.ok(c.points[0].sourceVersion);assert.equal(f.s.catalog().series[0].revisionCount,4);assert.equal(f.s.status().factVersions,3664);f.s.validate();
});
test('fixed dataset pages cross years without duplication and never transfer more than31 daily cells',async t=>{
  const f=setup(t);await backfill(f);await f.run('INCREMENTAL-20261003');const v=f.s.catalog().series[0].version;
  let from=CM_LONG_PLAN.from;const days=[];while(from<CM_LONG_PLAN.cutoff){const q=f.s.query('btc',from,CM_LONG_PLAN.cutoff,v);assert.ok(q.points.length<=31);assert.equal(q.version,v);days.push(...q.points.map(p=>p.sourceDate));from=q.page.nextFrom??CM_LONG_PLAN.cutoff;}
  assert.equal(days.length,1828);assert.equal(new Set(days).size,1828);assert.ok(days.includes('2024-02-29'));
  assert.throws(()=>f.s.query('btc',CM_LONG_PLAN.from,CM_LONG_PLAN.cutoff,'0'.repeat(64)),/VERSION/);
});
test('failure cannot move checkpoint; source rejection and Retry-After persist over reopen and restore',async t=>{
  for(const http of [403,429]){const f=setup(t);
    await assert.rejects(f.run('BACKFILL-2021',null,async()=>new Response('',{status:http,headers:{'Retry-After':'120'}})),new RegExp('HTTP_'+http));
    assert.equal(f.s.status().points,0);f.reopen();
    await assert.rejects(f.run('BACKFILL-2022'),http===403?/DISABLED/:/COOLDOWN/);assert.equal(f.s.status().newRequests,1);
    const file=join(f.dir,'restored.sqlite');CoinMetricsArchive.restore(file,f.s.exportSnapshot());const r=new CoinMetricsArchive(file,{readOnly:true});
    try{assert.equal(r.status().enabled,false);assert.equal(r.status().retryAt,f.s.status().retryAt);assert.deepEqual(r.status().requests,f.s.status().requests);}finally{r.close();}
  }
});
test('cancelled/invalid/oversized response does not commit facts; actual oversize bytes are preserved',async t=>{
  const f=setup(t);await assert.rejects(f.run('BACKFILL-2021',rows=>rows.reverse()),/ORDER/);assert.equal(f.s.status().factVersions,0);
  await assert.rejects(f.run('BACKFILL-2022',null,async()=>new Response(new Uint8Array(CM_API_BYTES+1))),/LIMIT/);
  assert.equal(f.s.status().actualBytes>CM_API_BYTES,true);assert.equal(f.s.status().requests.at(-1).status,'oversized');
  const c=new AbortController();c.abort();await assert.rejects(collectCoinMetrics(f.s,{batch:'BACKFILL-2023',signal:c.signal}),/CANCELLED/);assert.equal(f.s.status().newRequests,2);
  assert.equal(CoinMetricsArchive.restore(':memory:',f.s.exportSnapshot()).actualBytes,f.s.status().actualBytes);
});
test('shared plan budget survives batches/restarts; changing run/batch does not grant more requests',async t=>{
  const f=setup(t);let n=0;
  const fetcher=async u=>{n++;return n%2===1?new Response('',{status:500}):new Response(data(u));};
  for(const b of CM_LONG_BATCHES.filter(v=>v.action==='backfill').slice(0,5)){
    await assert.rejects(f.run(b.id,null,fetcher),/HTTP_500/);
    await assert.rejects(f.run(b.id,null,fetcher),/HTTP_500/);
    await f.run(b.id,null,fetcher);f.reopen();
  }
  assert.equal(n,20);await assert.rejects(f.run('BACKFILL-2026',null,fetcher),/PLAN_BUDGET/);assert.equal(n,20);
});
test('interrupted reservation keeps consumed budget; expired old operation cannot commit after resume',async t=>{
  const f=setup(t);let release;const pending=f.run('BACKFILL-2021',null,async()=>new Promise(r=>{release=r;}));
  await new Promise(r=>setImmediate(r));f.advance(30000);
  await f.run('BACKFILL-2021');release(new Response(data(coinMetricsDailyUrl(manifest,CM_LONG_BATCHES[0].from,CM_LONG_BATCHES[0].cutoff))));
  await assert.rejects(pending,/RESERVATION/);assert.equal(f.s.status().newRequests,3);assert.equal(f.s.status().requests[0].status,'interrupted');assert.equal(f.s.catalog().series[0].count,92);f.s.validate();
});
test('new-process restore replays raw/version chain; corrupted content rejected without creating target',async t=>{
  const f=setup(t);await backfill(f);await f.run('INCREMENTAL-20261003');const text=f.s.exportSnapshot();const backup=join(f.dir,'backup.json');writeFileSync(backup,text);
  const restored=join(f.dir,'restored.sqlite'),moduleUrl=new URL('../collector/coinmetrics-archive.mjs',import.meta.url).href;
  const script=`import fs from 'node:fs';import {CoinMetricsArchive} from ${JSON.stringify(moduleUrl)};CoinMetricsArchive.restore(process.argv[1],fs.readFileSync(process.argv[2],'utf8'));const s=new CoinMetricsArchive(process.argv[1],{readOnly:true});console.log(JSON.stringify(s.catalog()));s.close();`;
  const value=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script,restored,backup],{encoding:'utf8'}));assert.deepEqual(value,f.s.catalog());
  const r=new CoinMetricsArchive(restored);try{await assert.rejects(collectCoinMetrics(r,{batch:'REVISION-01'}),/DISABLED/);}finally{r.close();}
  const {checksum,...body}=JSON.parse(text);void checksum;body.facts[0].price='1';const bad=join(f.dir,'bad.sqlite');
  assert.throws(()=>CoinMetricsArchive.restore(bad,canonical({...body,checksum:digest(body)})),/REVISION_CHAIN/);assert.equal(existsSync(bad),false);
});

test('daily HTTP requires a disabled restored copy; source/version/page and session isolation remain enforced',async t=>{
  const root=resolve('work/state27');mkdirSync(root,{recursive:true});const f=setup(t,root);await f.run('BACKFILL-2021');
  const upstream=createServer((req,res)=>res.end('local fixture'));await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
  const spare=createServer();await new Promise(r=>spare.listen(0,'127.0.0.1',r));const port=spare.address().port;await new Promise(r=>spare.close(r));
  const token='fixture-only-daily-http-session',config={snapshotName:null,referenceName:relative(root,f.path),token,port,upstream:`http://127.0.0.1:${upstream.address().port}`};let session;
  try{
    await assert.rejects(startWorkbench(config),/RESTORED_COPY_REQUIRED/);
    const restored=join(f.dir,'http-restored.sqlite');CoinMetricsArchive.restore(restored,f.s.exportSnapshot());session=await startWorkbench({...config,referenceName:relative(root,restored)});
    const headers={Origin:session.url,'Content-Type':'application/json','X-Archive-Key':token};
    const call=(path,body={},overrides={})=>fetch(session.url+'/__archive/'+path,{method:'POST',headers:{...headers,...overrides},body:JSON.stringify(body)});
    assert.equal((await call('catalog',{}, {'X-Archive-Key':'invalid'})).status,403);
    assert.equal((await call('catalog',{}, {Origin:'https://example.invalid'})).status,403);
    const response=await call('catalog');assert.equal(response.headers.get('cache-control'),'no-store');const c=await response.json();assert.equal(c.series.length,0);
    const s=c.reference.series[0],body={asset:s.asset,version:s.version,from:s.range.from,cutoff:s.range.cutoff};
    const q=await(await call('reference-query',body)).json();assert.equal(q.points.length,31);assert.equal(q.page.nextFrom,Date.parse('2021-11-01Z'));assert.equal(q.version,s.version);assert.equal(q.analysis.short90m,'unsupported_frequency');
    for(const change of [{asset:'BTC-USDT'},{version:'0'.repeat(64)},{path:'arbitrary.sqlite'},{sql:'SELECT 1'},{url:'https://example.invalid'}])assert.equal((await call('reference-query',{...body,...change})).status,400);
    assert.equal((await call('collect')).status,400);assert.equal((await call('query',{selection:{}})).status,400);
  }finally{await session?.close();await new Promise(r=>upstream.close(r));}
});

test('response cleanup failure cannot discard a received 429 cooldown',async t=>{
  const f=setup(t);await assert.rejects(f.run('BACKFILL-2021',null,async()=>({status:429,headers:new Headers({'Retry-After':'120'}),body:{cancel:async()=>{throw Error('cleanup');}}})),/HTTP_429/);
  const r=f.s.status().requests[0];assert.equal(r.status,'rate_limited');assert.equal(r.retry_until,r.finished+120000);
  f.reopen();await assert.rejects(f.run('BACKFILL-2022'),/COOLDOWN/);
});
