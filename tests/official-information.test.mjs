import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {OfficialArchive,refreshOfficial} from '../collector/official-information.mjs';
import {OFFICIAL_SOURCES,normalizeReleases,parseOfficialView,queryOfficialView} from '../lib/information/official.mjs';
import {viewDigest} from '../lib/information/fed-view.mjs';
import {GET} from '../app/api/asset-information/route.ts';
import {officialFile,main} from '../scripts/official-information.mjs';
const NOW=Date.parse('2026-10-03T00:00:00Z');
const raw=(repo='bitcoin/bitcoin',tag='v1',id=1)=>({id,tag_name:tag,html_url:`https://github.com/${repo}/releases/tag/${tag}`,published_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-02T12:00:00Z',prerelease:false,draft:false,body:'Must never be stored',author:{email:'fixture-private@example.invalid'}});
const memory=t=>{const s=new OfficialArchive();t.after(()=>s.close());return s;};
test('operator paths remain inside official-information for backup, restore and companion files',async()=>{
 assert.match(officialFile('new-backup.sqlite'),/[\\/]official-information[\\/]new-backup.sqlite$/);
 for(const name of ['../fed-monetary/official-copy.sqlite','..\\fed-monetary\\official-copy.sqlite','..','/tmp/out.sqlite','C:\\out.sqlite','\\\\host\\share\\out.sqlite']){
  assert.throws(()=>officialFile(name));
  await assert.rejects(main(['restore',name,'new.sqlite']));
  await assert.rejects(main(['restore','backup.sqlite',name]));
 }
});
test('official facts preserve repository identity and source prerelease flag without ingesting prose or author',()=>{
 const r=normalizeReleases('bitcoin-core',[raw()],NOW)[0];assert.deepEqual(Object.keys(r),['id','tag','url','publishedAt','sourceUpdatedAt','prerelease']);
 assert.equal(normalizeReleases('agave',[raw('anza-xyz/agave','v1-rc.1')],NOW)[0].prerelease,false);
 for(const changed of [{draft:true},{id:NaN},{tag_name:'<script>'},{html_url:'https://evil.invalid/tag/v1'},{html_url:'https://github.com/other/repo/releases/tag/v1'},{published_at:'2026-10-04T00:00:00Z'},{updated_at:'2026-09-01T00:00:00Z'},{prerelease:'false'},{published_at:'2026-02-30T12:00:00Z'}])assert.throws(()=>normalizeReleases('bitcoin-core',[{...raw(),...changed}],NOW));
 assert.throws(()=>normalizeReleases('unknown',[raw()],NOW));assert.throws(()=>normalizeReleases('bitcoin-core',[raw(),raw()],NOW));assert.throws(()=>normalizeReleases('bitcoin-core',Array.from({length:6},(_,i)=>raw('bitcoin/bitcoin','v'+i,i+1)),NOW));
});
test('identical capture is idempotent; A B A appends revisions and old snapshot keeps exact facts',async t=>{
 const s=memory(t),a=await s.ingest('bitcoin-core',[raw()],NOW,NOW+1);
 assert.equal((await s.ingest('bitcoin-core',[raw()],NOW,NOW+2)).reused,true);
 const again=await s.ingest('bitcoin-core',[raw()],NOW+100,NOW+101);assert.equal(again.added,0);assert.equal((await s.view(NOW+102)).sources[0].records[0].firstSavedAt,NOW+1);
 await s.ingest('bitcoin-core',[raw('bitcoin/bitcoin','v2')],NOW+200,NOW+201);
 await s.ingest('bitcoin-core',[raw()],NOW+300,NOW+301);
 assert.equal(s.db.prepare('SELECT count(*) AS n FROM info_versions').get().n,3);
 const current=await s.view(NOW+500),old=await s.view(NOW+500,{snapshots:{'bitcoin-core':a.id}});
 assert.equal(current.sources[0].records[0].version,3);assert.equal(old.sources[0].records[0].version,1);assert.equal(old.sources[0].records[0].fact.tag,'v1');
 await assert.rejects(s.ingest('bitcoin-core',[raw()],NOW-1,NOW+500),/OLDER/);assert.throws(()=>s.reserve('x',0),/BAD_REQUEST/);
});
test('public package rejects changed content/snapshot identity; unknown assets remain unavailable',async t=>{
 const s=memory(t);await s.ingest('bitcoin-core',[raw()],NOW,NOW+1);const v=await s.view(NOW+2);
 assert.equal(queryOfficialView(v,{symbol:'ETH-USDT'}).collected,false);assert.equal(queryOfficialView(v,{symbol:'AAPL'}).covered,false);assert.equal(queryOfficialView(v,{symbol:'BTC-USD'}).records.length,1);
 for(const change of [v=>v.sources[0].sourceId='powertoys',v=>v.sources[0].snapshotId='0'.repeat(64),v=>v.sources[0].records[0].fact.url='javascript:1',v=>v.sources[0].records[0].firstSavedAt=NOW+100]){
  const altered=structuredClone(v);change(altered);const {viewId,...body}=altered;assert.equal(typeof viewId,'string');altered.viewId=await viewDigest(body);await assert.rejects(parseOfficialView(JSON.stringify(altered),NOW+2));
 }
 await assert.rejects(parseOfficialView(' '.repeat(128*1024+1),NOW));
});
test('existing investigation requests are inherited; new run does not reset 12/day budget',t=>{
 const s=memory(t);s.seedInvestigation(Array.from({length:14},(_,i)=>({id:'sample-'+String.fromCharCode(97+i),at:NOW+i,status:200,bytes:100})));
 assert.throws(()=>s.reserve('new-run',NOW+5000),/DAILY_BUDGET/);assert.equal(s.db.prepare('SELECT count(*) AS n FROM info_requests').get().n,14);
 s.reserve('next-day',NOW+86400100);s.finish('next-day',429,0,NOW+86400100,'7200');assert.throws(()=>s.reserve('another-run',NOW+86405100),/COOLDOWN/);
});
test('source rejection and invalid responses count once, stop, and do not replace prior snapshot',async t=>{
 for(const kind of ['429','bad-json','large','cancel']){
  const s=memory(t);await s.ingest('bitcoin-core',[raw()],NOW,NOW+1);const old=(await s.view(NOW+10)).sources[0].snapshotId;let calls=0;const controller=new AbortController();if(kind==='cancel')controller.abort();
  await assert.rejects(refreshOfficial(s,{now:()=>NOW+5000,sleep:async()=>{},signal:controller.signal,fetchImpl:async()=>{calls++;return kind==='429'?new Response('denied',{status:429,headers:{'retry-after':'3600'}}):new Response(kind==='large'?' '.repeat(2*1024**2+1):'broken');}}));
  assert.equal(calls,kind==='cancel'?0:1);assert.equal(s.db.prepare('SELECT count(*) AS n FROM info_requests').get().n,calls);assert.equal((await s.view(NOW+6000)).sources[0].snapshotId,old);
 }
});
test('bounded refresh contacts only five approved endpoints, sequentially, no credentials or follow redirects',async t=>{
 const s=memory(t);let now=NOW,calls=0;const report=await refreshOfficial(s,{now:()=>now,sleep:async ms=>{now+=ms;},fetchImpl:async(url,options)=>{
  const source=OFFICIAL_SOURCES[calls++];assert.equal(url,`https://api.github.com/repos/${source.repo}/releases?per_page=5`);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);return Response.json([raw(source.repo)]);
 }});assert.equal(calls,5);assert.equal(report.length,5);assert.equal((await s.view(now+1)).sources.reduce((n,x)=>n+x.records.length,0),5);
});
test('consistent backup restores versions, source snapshots, requests/cooldown; restore disables collection',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'market-radar-official-')),s=new OfficialArchive(join(folder,'source.sqlite'));let restored;t.after(()=>{restored?.close();s.close();rmSync(folder,{recursive:true,force:true});});
 await s.ingest('bitcoin-core',[raw()],NOW,NOW+1);s.reserve('charged',NOW+2000);s.finish('charged',429,23,NOW+2001,'60');
 const backup=join(folder,'backup.sqlite'),target=join(folder,'restored.sqlite');s.backup(backup);const before=await s.view(NOW+3000);await OfficialArchive.restore(backup,target,NOW+3000);
 const r=new OfficialArchive(target);restored=r;assert.deepEqual(await r.view(NOW+3000),before);
 assert.deepEqual(r.db.prepare('SELECT * FROM info_requests').all(),s.db.prepare('SELECT * FROM info_requests').all());assert.equal(r.db.prepare('SELECT cooldown FROM info_meta').get().cooldown,s.db.prepare('SELECT cooldown FROM info_meta').get().cooldown);assert.throws(()=>r.reserve('resume',NOW+86400000),/DISABLED/);
 await assert.rejects(OfficialArchive.restore(backup,target,NOW+3000),/NEW_RESTORE/);
 const manifest=JSON.parse(readFileSync(backup+'.manifest.json','utf8'));manifest.sha256='0'.repeat(64);writeFileSync(backup+'.manifest.json',JSON.stringify(manifest));await assert.rejects(OfficialArchive.restore(backup,join(folder,'invalid.sqlite'),NOW+3000),/CHECKSUM/);
});
test('published API validates real public pack and rejects URL/path inputs without network',async()=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('No network');};try{
  const r=await GET(new Request('https://test.invalid/api/asset-information'));assert.equal(r.status,200);const v=await r.json();assert.equal(v.sources.length,5);assert.equal(v.sources.reduce((n,s)=>n+s.records.length,0),25);
  assert.equal((await GET(new Request('https://test.invalid/api/asset-information?path=private'))).status,400);
 }finally{globalThis.fetch=oldFetch;}
});
