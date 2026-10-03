import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ArchiveStore,validateConfig} from '../collector/store.mjs';
import {FED} from '../collector/source-policy.mjs';
import {runBatch} from '../collector/runner.mjs';
import {createFedAdapter,parseFedFeed} from '../collector/fed-source.mjs';
import {fedConfig} from '../scripts/fed-history.mjs';
import {GET} from '../app/api/information/route.ts';
const day=86400000,now=Date.parse('2026-10-03T12:00:00Z');
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');

test('FED current snapshot survives the 31-day boundary without rewriting the September contract',()=>{
  for(const at of [FED.start+day,FED.start+31*day,FED.start+31*day+1,now,Date.parse('2027-01-01T00:00:00Z')]){
    const c=validateConfig(fedConfig(at,'bounded'));
    assert.equal(c.from,Math.max(FED.start,at-31*day));assert.equal(c.cutoff,at);assert.equal(c.createdAt,at);
    assert.ok(c.cutoff-c.from<=31*day);assert.equal(c.limits.requests,1);assert.equal(c.identity,'reconstructed');
  }
  assert.equal(fedConfig(Date.parse('2026-09-22T12:00:00Z')).from,FED.start);
  assert.throws(()=>validateConfig(fedConfig(FED.start-1)),/RANGE/);
  assert.throws(()=>validateConfig({...fedConfig(now),cutoff:now+1}),/RANGE/);
});

test('publication route is bounded, private, and never fetches a provider',async()=>{
  const previous=globalThis.fetch;let requests=0;globalThis.fetch=()=>{requests++;throw Error('network forbidden');};
  try{
    const r=await GET(new Request('https://example.invalid/api/information'));
    assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');
    const data=await r.json();assert.equal(data.identity,'reconstructed');assert.equal(data.vintage,'current');
    assert.ok(data.records.length<=200);assert.ok(data.records.every(row=>!('owner'in row)&&!('runId'in row)));
    for(const query of ['?url=https://example.invalid','?path=/tmp/data','?from=2020-01-01'])assert.equal((await GET(new Request('https://example.invalid/api/information'+query))).status,400);
    assert.equal(requests,0);
  }finally{globalThis.fetch=previous;}
});

test('publication preparation reads an isolated fixture read-only and preserves the old publication on failure',async t=>{
  const root=mkdtempSync(join(tmpdir(),'market-radar-information29-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const file of ['collector/store.mjs','collector/schema.sql','collector/source-policy.mjs','collector/runner.mjs','collector/fed-source.mjs','scripts/history-local.mjs','scripts/fed-history.mjs','scripts/prepare-information.mjs','lib/information/fed-view.mjs']){
    mkdirSync(dirname(join(root,file)),{recursive:true});copyFileSync(new URL('../'+file,import.meta.url),join(root,file));
  }
  const dbPath=join(root,'work/state27/fed-monetary/archive.sqlite');mkdirSync(dirname(dbPath),{recursive:true});
  const s=new ArchiveStore(dbPath),c=fedConfig(now,'fixture-response');s.createRun(c);
  const link='https://www.federalreserve.gov/newsevents/pressreleases/monetary20261002a.htm';
  const xml=`<rss version="2.0"><channel><item><title>Fixture only announcement</title><link>${link}</link><guid>${link}</guid><pubDate>Fri, 02 Oct 2026 18:00:00 GMT</pubDate><category>Monetary Policy</category></item></channel></rss>`;
  assert.equal(parseFedFeed(xml,c).records.length,1);
  await runBatch({store:s,owner:FED.owner,runId:c.runId,now:()=>now+10,adapter:createFedAdapter({fetchImpl:async()=>new Response(xml,{headers:{'content-type':'text/xml'}})})});s.close();
  const initial=digest(dbPath),output=join(root,'data/published/fed-monetary.json');
  const run=(args=[])=>spawnSync(process.execPath,[join(root,'scripts/prepare-information.mjs'),...args],{cwd:root,encoding:'utf8'});
  const first=run();assert.equal(first.status,0,first.stderr);const data=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(data.records[0].title,'Fixture only announcement');assert.equal(JSON.parse(first.stdout).externalRequests,0);assert.equal(digest(dbPath),initial);
  const saved=digest(output);writeFileSync(output+'.pending','unrelated in-progress preparation',{flag:'wx'});
  assert.notEqual(run().status,0);assert.equal(digest(output),saved);assert.equal(readFileSync(output+'.pending','utf8'),'unrelated in-progress preparation');
  assert.notEqual(run(['../outside']).status,0);assert.equal(digest(output),saved);
  const edit=new ArchiveStore(dbPath);edit.db.prepare("UPDATE archive_runs SET status='paused'").run();edit.close();
  assert.match(run().stderr,/NO_COMPLETED_SOURCE_BATCH/);assert.equal(digest(output),saved);
});
