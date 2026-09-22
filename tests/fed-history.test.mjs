// Synthetic RSS/metadata unless the separate manual integration report explicitly says real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {ArchiveStore,canonical,digest} from '../collector/store.mjs';
import {FED} from '../collector/source-policy.mjs';
import {parseFedFeed,createFedAdapter} from '../collector/fed-source.mjs';
import {runBatch} from '../collector/runner.mjs';
import {fedConfig,publicView} from '../scripts/fed-history.mjs';
import {parseFedView,queryFedView,viewDigest,VIEW_LIMIT} from '../lib/information/fed-view.mjs';
const NOW=Date.parse('2026-09-22T12:00:00Z'),PUB=Date.parse('2026-09-16T18:00:00Z');
const url='https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm';
export const xml=(title='Fixture announcement',at=PUB,link=url)=>`<?xml version="1.0"?><rss version="2.0"><channel><item><title>${title}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${new Date(at).toUTCString()}</pubDate><category>Monetary Policy</category></item></channel></rss>`;
const response=body=>new Response(body,{headers:{'content-type':'text/xml; charset=utf-8'}});
const memory=t=>{const s=new ArchiveStore();t.after(()=>s.close());return s;};
const folder=t=>{const p=mkdtempSync(join(tmpdir(),'fed-archive-test-'));t.after(()=>rmSync(p,{recursive:true,force:true}));return p;};
async function ingest(s,id='a',at=NOW,body=xml()){
  const c=fedConfig(at,id);s.createRun(c);
  return runBatch({store:s,owner:FED.owner,runId:id,adapter:createFedAdapter({fetchImpl:async(request,options)=>{assert.equal(request,FED.endpoint);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return response(body);}}),now:()=>at+10});
}
const query=s=>s.query({owner:FED.owner,source:FED.source,asset:FED.asset.id,kind:'information',from:FED.start,to:NOW,limit:200});
test('approved profile is narrow, preserves minute publication, excludes cutoff and old records',()=>{
  const c=fedConfig(NOW,'x'),v=parseFedFeed(xml(),c);assert.equal(v.records[0].occurredAt,PUB);assert.equal(v.records[0].payload.publication.precision,'minute');assert.equal(v.records[0].payload.sourceRecordId,url);
  assert.equal(parseFedFeed(xml('Fixture',NOW),c).records.length,0);assert.equal(parseFedFeed(xml('Fixture',FED.start-60000),c).excludedOutOfRange,1);
  assert.throws(()=>parseFedFeed(xml(),{...c,source:'other'}));
});
test('RSS rejects unsafe links, HTML, DTD, custom entity, duplicate items, invalid timestamp and oversized input',()=>{
  const c=fedConfig(NOW,'x');
  for(const body of [xml('<b>title</b>'),xml('text &custom;'),xml('x',PUB,'https://evil.example/a'),xml().replace('</channel>',xml().match(/<item[\s\S]*<\/item>/)[0]+'</channel>'),xml().replace('Wed, 16','Tue, 16'),xml().replace('<rss','<!DOCTYPE rss SYSTEM "file:///etc/passwd"><rss'),xml('x'.repeat(501)),' '.repeat(FED.limits.pageBytes+1)])assert.throws(()=>parseFedFeed(body,c));
});
test('XML comments/CDATA cannot create records and unbalanced envelopes reject',()=>{
  const c=fedConfig(NOW,'xml'),item=xml().match(/<item[\s\S]*<\/item>/)[0];
  assert.equal(parseFedFeed(`<rss version="2.0"><channel><!-- ${item} --></channel></rss>`,c).records.length,0);
  assert.equal(parseFedFeed(`<rss version="2.0"><channel><description><![CDATA[${item}]]></description></channel></rss>`,c).records.length,0);
  for(const broken of [xml().replace('</channel>',''),xml().replace('</item>',''),xml().replace('<channel>','<channel><nested>'),xml().replace('version="2.0"','version=2.0')])assert.throws(()=>parseFedFeed(broken,c));
});
test('real profile cannot widen owner, assets, kind, budget or identity; fixture remains separate',t=>{
  const s=memory(t),c=fedConfig(NOW,'x');
  for(const change of [{identity:'observed_live'},{owner:'visitor'},{assets:[{...FED.asset,providerId:'other'}]},{limits:{...FED.limits,requests:4}},{source:'SEC'},{assets:[{...FED.asset,role:'asset'}]}])assert.throws(()=>s.createRun({...c,...change}));
  s.createRun(c);const lease=s.reserveRequest(FED.owner,'x',NOW);s.chargeBytes(FED.owner,'x',50,lease.leaseToken);
  assert.throws(()=>s.commitPage(FED.owner,'x',{expectedCursor:null,nextCursor:null,traversalDone:true,receivedAt:NOW+1,leaseToken:lease.leaseToken,records:[{...parseFedFeed(xml(),c).records[0],kind:'bar'}]}),/INFORMATION_ONLY/);
});
test('RSS single-digit day with CDATA remains valid; weekday and rollover errors still reject',()=>{
  const c=fedConfig(NOW,'date'),body=xml('Fixture',Date.parse('2026-09-09T18:00:00Z')).replace(/<pubDate>(.*?)<\/pubDate>/,(_,date)=>'<pubDate><![CDATA['+date.replace(', 09 ', ', 9 ')+']]></pubDate>');
  assert.equal(parseFedFeed(body,c).records[0].occurredAt,Date.parse('2026-09-09T18:00:00Z'));
  const old=xml('Old fixture',Date.parse('2026-07-09T19:00:00Z')).replace(', 09 ', ', 9 ');
  assert.equal(parseFedFeed(old,c).excludedOutOfRange,1);
  for(const bad of [body.replace('Wed, 9','Thu, 9'),body.replace('9 Sep','32 Sep'),body.replace('18:00:00','25:00:00')])assert.throws(()=>parseFedFeed(bad,c),/INVALID_RSS_DATE/);
});
test('old physical schema is rejected without DDL or mutation',t=>{
  const path=join(folder(t),'old.sqlite'),db=new DatabaseSync(path);db.exec('CREATE TABLE archive_meta(id INTEGER,schema_version INTEGER,revision INTEGER); INSERT INTO archive_meta VALUES(1,1,0)');db.close();const before=readFileSync(path);assert.throws(()=>new ArchiveStore(path),/NEW_DATABASE/);assert.deepEqual(readFileSync(path),before);
});
test('source is guarded before HTTP; one successful page stores real receipt identity and repeats are idempotent',async t=>{
  const s=memory(t);assert.equal((await ingest(s)).status,'traversed');const first=query(s).records[0];assert.equal(first.identity,'reconstructed');assert.equal(first.received_at,NOW+10);
  assert.equal((await ingest(s,'b',NOW+2000)).writes,0);assert.equal(query(s).records[0].id,first.id);
  assert.equal((await ingest(s,'c',NOW+4000,xml('Correction'))).writes,1);assert.equal((await ingest(s,'d',NOW+6000)).writes,1);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM archive_facts').get().n,3);assert.ok(query(s).records[0].revision>first.revision);
  await assert.rejects(()=>runBatch({store:s,owner:FED.owner,runId:'a',adapter:{identity:'reconstructed',source:FED.source,page:()=>{throw Error('must not dispatch');}}}),/ADAPTER_REQUIRED/);
});
test('cross-run/source quotas and source lease are durable across two connections and restart',async t=>{
  let a,b;t.after(()=>{a?.close();b?.close();});const path=join(folder(t),'quota.sqlite');a=new ArchiveStore(path);b=new ArchiveStore(path);
  a.createRun(fedConfig(NOW,'a'));b.createRun(fedConfig(NOW,'b'));const first=a.reserveRequest(FED.owner,'a',NOW);
  assert.equal(b.reserveRequest(FED.owner,'b',NOW+10).reason,'source_busy');a.releaseRequest(FED.owner,'a',first.leaseToken);
  b.resumeRun(FED.owner,'b',NOW+20);assert.equal(b.reserveRequest(FED.owner,'b',NOW+20).reason,'source_cooldown');
  for(let i=1;i<6;i++)await ingest(a,'run'+i,NOW+i*2000);
  const reopened=new ArchiveStore(path);try{reopened.createRun(fedConfig(NOW+15000,'last'));assert.equal(reopened.reserveRequest(FED.owner,'last',NOW+15000).reason,'budget_source');}finally{reopened.close();}
  assert.equal(a.db.prepare('SELECT count(*) AS n FROM archive_source_requests').get().n,6);
});
test('429 source Retry-After blocks a fresh run after reopen, even with unspent per-run requests',async t=>{
  const path=join(folder(t),'retry.sqlite');let s=new ArchiveStore(path);s.createRun(fedConfig(NOW,'a'));
  const result=await runBatch({store:s,owner:FED.owner,runId:'a',now:()=>NOW+1,adapter:createFedAdapter({fetchImpl:async()=>new Response('',{status:429,headers:{'retry-after':'120'}})})});assert.equal(result.reason,'retry_after');s.close();
  s=new ArchiveStore(path);try{s.createRun(fedConfig(NOW+5000,'b'));assert.equal(s.reserveRequest(FED.owner,'b',NOW+5000).reason,'source_cooldown');}finally{s.close();}
});
test('late 429 persists global cooldown after another run acquires the expired source lease',t=>{
  const s=memory(t);s.createRun(fedConfig(NOW,'a'));const a=s.reserveRequest(FED.owner,'a',NOW);
  s.createRun(fedConfig(NOW+8001,'b'));const b=s.reserveRequest(FED.owner,'b',NOW+8001);assert.equal(b.ok,true);
  s.deferRetry(FED.owner,'a',a.leaseToken,NOW+120000);assert.equal(s.db.prepare('SELECT lease_run FROM archive_sources').get().lease_run,'b');
  s.releaseRequest(FED.owner,'b',b.leaseToken);s.createRun(fedConfig(NOW+10001,'c'));assert.equal(s.reserveRequest(FED.owner,'c',NOW+10001).reason,'source_cooldown');
  memory(t).restoreSnapshot(s.exportSnapshot(FED.owner));
});
test('failed transport, malformed content and decompressed byte limit consume quota without checkpoint',async t=>{
  for(const [i,fetchImpl]of [async()=>{throw Error('offline');},async()=>response(xml('<b>bad</b>')),async()=>response('x'.repeat(FED.limits.pageBytes+1))].entries()){
    const s=memory(t),at=NOW+i*2000;s.createRun(fedConfig(at,'x'));const r=await runBatch({store:s,owner:FED.owner,runId:'x',now:()=>at+1,adapter:createFedAdapter({fetchImpl})});assert.equal(r.requests,1);assert.equal(r.pages,0);assert.equal(r.writes,0);assert.equal(s.db.prepare('SELECT count(*) AS n FROM archive_source_requests').get().n,1);if(i)assert.ok(r.bytes>0);
  }
});
test('real backup includes ledger; restored database can query but never collect; v1 cannot carry real data',async t=>{
  const s=memory(t);await ingest(s);const text=s.exportSnapshot(FED.owner),envelope=JSON.parse(text);assert.equal(envelope.format,'history-local-v2');assert.equal(envelope.data.tables.archive_source_requests.length,1);
  const target=memory(t);target.restoreSnapshot(text);assert.deepEqual(query(target),query(s));target.createRun(fedConfig(NOW+2000,'new'));assert.equal(target.reserveRequest(FED.owner,'new',NOW+2000).reason,'collection_disabled');
  for(const alter of [d=>d.tables.archive_source_requests=[],d=>d.tables.archive_sources[0].last_dispatch=0,d=>d.tables.archive_source_requests[0].requested_at=1]){const c=structuredClone(envelope);alter(c.data);c.checksum=digest(c.data);assert.throws(()=>memory(t).restoreSnapshot(canonical(c)));}
  const old=structuredClone(envelope);old.format='history-local-v1';old.data.schemaVersion=1;delete old.data.tables.archive_sources;delete old.data.tables.archive_source_requests;old.checksum=digest(old.data);assert.throws(()=>memory(t).restoreSnapshot(canonical(old)),/FIXTURE_SCOPE/);
});
test('successful commit atomically releases both leases even if runner finally never executes',t=>{
  const s=memory(t),c=fedConfig(NOW,'crash-after-commit');s.createRun(c);const lease=s.reserveRequest(FED.owner,c.runId,NOW);s.chargeBytes(FED.owner,c.runId,1000,lease.leaseToken);
  s.commitPage(FED.owner,c.runId,{...parseFedFeed(xml(),c),expectedCursor:null,receivedAt:NOW+1,leaseToken:lease.leaseToken});
  assert.equal(s.requireRun(FED.owner,c.runId).lease_token,null);assert.equal(s.db.prepare('SELECT lease_token FROM archive_sources').get().lease_token,null);
  const target=memory(t);target.restoreSnapshot(s.exportSnapshot(FED.owner));assert.deepEqual(query(target),query(s));
});
test('cross-process restart/restore yields identical public records and keeps collection disabled',async t=>{
  const dir=folder(t),path=join(dir,'db.sqlite'),backup=join(dir,'backup.json'),dest=join(dir,'restored.sqlite');const s=new ArchiveStore(path);await ingest(s);const before=await publicView(s,{from:FED.start,to:NOW,exportedAt:NOW+1000});writeFileSync(backup,s.exportSnapshot(FED.owner));s.close();
  const storeModule=new URL('../collector/store.mjs',import.meta.url).href,view=new URL('../scripts/fed-history.mjs',import.meta.url).href;
  const code=`import{ArchiveStore}from ${JSON.stringify(storeModule)};import{publicView}from ${JSON.stringify(view)};import{readFileSync}from'node:fs';const s=new ArchiveStore(process.argv[1]);s.restoreSnapshot(readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify(await publicView(s,{from:${FED.start},to:${NOW},exportedAt:${NOW+1000}})));s.close();`;
  const p=spawnSync(process.execPath,['--input-type=module','-e',code,dest,backup],{encoding:'utf8',windowsHide:true});assert.equal(p.status,0,p.stderr);assert.deepEqual(JSON.parse(p.stdout),before);
});
test('public view whitelist, identity, checksum, time and link rejection are independent of attacker checksum',async t=>{
  const s=memory(t);await ingest(s);const v=await publicView(s,{from:FED.start,to:NOW,exportedAt:NOW+1000});
  assert.equal(Object.hasOwn(v,'owner'),false);assert.ok(Object.isFrozen(v.records[0]));
  for(const mutate of [v=>v.owner='private',v=>v.records[0].url='javascript:alert(1)',v=>v.records[0].title='<img>',v=>v.identity='observed_live',v=>v.vintage='point_in_time',v=>v.records.push({...v.records[0]}),v=>v.records[0].versionReceivedAt=PUB-1,v=>v.range.cutoff=NOW+2000,v=>v.records[0].publishedAt=NOW]){
    const copy=structuredClone(v);mutate(copy);delete copy.viewId;copy.viewId=await viewDigest(copy);await assert.rejects(()=>parseFedView(JSON.stringify(copy),NOW+1000));
  }
  const bad={...v,viewId:'0'.repeat(64)};await assert.rejects(()=>parseFedView(JSON.stringify(bad),NOW+1000));await assert.rejects(()=>parseFedView(' '.repeat(VIEW_LIMIT+1),NOW));
});
test('offline queries are bounded and stable, exclude empty dates without inventing event absence',async t=>{
  const s=memory(t);await ingest(s);const v=await publicView(s,{from:FED.start,to:NOW,exportedAt:NOW+1000});
  assert.equal(queryFedView(v,{from:FED.start,to:NOW}).total,1);assert.equal(queryFedView(v,{from:FED.start,to:PUB}).total,0);
  for(const q of [{from:NaN,to:NOW},{from:FED.start-1,to:NOW},{from:NOW,to:NOW},{from:FED.start,to:NOW,page:1}])assert.throws(()=>queryFedView(v,q));
});
