// 获准公开日频包 + 明确模拟篡改/修订；CI不联网，不读个人SQLite。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CM_LONG_PLAN,DAILY_MS as DAY} from '../collector/coinmetrics-series-plan.mjs';
import {loadPublishedReference,queryPublishedReference} from '../lib/history/published-reference.ts';
import {packageDigest} from '../lib/history/package.ts';
import {GET} from '../app/api/reference-history/route.ts';
const publication=JSON.parse(readFileSync(new URL('../data/published/coinmetrics-long20261003.json',import.meta.url),'utf8'));
const now=publication.exportedAt;
async function reseal(p,version=false){
 if(version)p.version=await packageDigest({plan:CM_LONG_PLAN,responses:p.sources.map(s=>({revision:s.revision,sha:createHash('sha256').update(s.raw).digest('hex'),received_at:s.receivedAt}))});
 const body={...p};delete body.checksum;p.checksum=await packageDigest(body);return p;
}
const query=(data,asset='btc',from=CM_LONG_PLAN.from,cutoff=CM_LONG_PLAN.cutoff)=>queryPublishedReference(data,{asset,from,cutoff,version:data.catalog.series[0].version});

test('long publication reproduces all actual daily values and bounded pages, including year/leap boundaries',async()=>{
 const data=await loadPublishedReference(publication,now);
 for(const asset of ['btc','eth']){
  const expected=new Map();for(const s of publication.sources.filter(s=>s.asset===asset))for(const p of JSON.parse(s.raw).data)expected.set(p.time.slice(0,10),p.PriceUSD);
  const rows=[];let from=CM_LONG_PLAN.from,pages=0;
  while(from<CM_LONG_PLAN.cutoff){const p=query(data,asset,from);assert.ok(p.points.length<=31);assert.equal(p.version,publication.version);assert.equal(p.coverageRange.cutoff,p.page.cutoff);rows.push(...p.points);pages++;from=p.page.nextFrom??CM_LONG_PLAN.cutoff;}
  assert.equal(rows.length,1828);assert.equal(pages,59);assert.equal(new Set(rows.map(r=>r.sourceDate)).size,1828);
  for(const p of rows){assert.equal(p.price,expected.get(p.sourceDate));assert.equal(p.evidenceEndAt,p.periodStartAt+DAY);assert.ok(p.firstReceivedAt<=p.versionReceivedAt);assert.match(p.sourceVersion,/^[a-f0-9]{64}$/);}
  assert.ok(rows.some(r=>r.sourceDate==='2024-02-29'));assert.equal(rows.at(-1).sourceDate,'2026-10-02');
 }
 assert.equal(query(data).analysis.short90m,'unsupported_frequency');assert.equal(query(data).vintage,'current_vintage');assert.equal(query(data).identity,'reconstructed');
 assert.equal(query(data).provenance.responseDigests.length,14);
 const last=query(data,'btc',CM_LONG_PLAN.cutoff-DAY);assert.equal(last.points.length,1);assert.equal(last.page.nextFrom,null);
});

test('long publication rejects incomplete batch pairs, wrong identity, tampered provenance, future and oversize input',async()=>{
 const changes=[p=>{p.sources.pop();},p=>{p.sources.reverse();},p=>{p.sources[1].asset='btc';},p=>{p.sources[0].batch='BACKFILL-2020';},p=>{p.sources[0].revision=21;},p=>{p.sources[1].revision=p.sources[0].revision;},p=>{p.version='0'.repeat(64);},p=>{p.exportedAt=now+1;},p=>{p.sources[0].receivedAt=now+1;},p=>{p.sources[0].extra=true;},p=>{p.sources[0].raw+=' '.repeat(512*1024);}];
 for(const change of changes){const p=structuredClone(publication);change(p);await reseal(p);await assert.rejects(loadPublishedReference(p,now));}
 const bad=structuredClone(publication);bad.checksum='0'.repeat(64);await assert.rejects(loadPublishedReference(bad,now),/CHECKSUM/);
});

test('source gaps/nulls remain explicit, with no zero-fill; page and whole-series coverage stay distinct',async()=>{
 const p=structuredClone(publication),raw=JSON.parse(p.sources[0].raw);raw.data.splice(1,1);raw.data[1].PriceUSD=null;p.sources[0].raw=JSON.stringify(raw);await reseal(p,true);
 const data=await loadPublishedReference(p,now),page=query(data);
 assert.equal(data.catalog.series[0].count,1826);assert.equal(data.catalog.series[0].coverage.missingCount,2);
 assert.equal(page.points.length,29);assert.deepEqual(page.coverage.missing.map(m=>m.reason),['missing_date','missing_value']);assert.equal(page.coverage.notBackfilledCount,0);
 assert.ok(page.points.every(p=>p.price!=='0'));assert.equal(page.coverage.expectedDates,31);
});

test('A-B-A revisions retain first receipt and last changed receipt while same-value overlap does not refresh facts',async()=>{
 const p=structuredClone(publication),base=await loadPublishedReference(p,now),from=Date.parse('2026-09-30Z'),original=query(base,'btc',from).points;
 for(const [offset,batch] of [[0,'REVISION-01'],[2,'REVISION-02']])for(let i=0;i<2;i++){
  const s=structuredClone(publication.sources[12+i]);s.batch=batch;s.revision=15+offset+i;s.receivedAt=publication.sources.at(-1).receivedAt+(offset+i+1)*1000;
  if(offset===0){const raw=JSON.parse(s.raw);raw.data[0].PriceUSD='1.2345';s.raw=JSON.stringify(raw);}p.sources.push(s);
 }
 p.exportedAt=Math.max(now,p.sources.at(-1).receivedAt);await reseal(p,true);const data=await loadPublishedReference(p,p.exportedAt),points=query(data,'btc',from).points;
 assert.equal(points[0].price,original[0].price);assert.equal(points[0].firstReceivedAt,original[0].firstReceivedAt);assert.equal(points[0].versionReceivedAt,p.sources[16].receivedAt);
 // A再次出现来自新的3日响应；不能冒用最初年度响应的原始hash。
 assert.equal(points[0].sourceVersion,createHash('sha256').update(p.sources[16].raw).digest('hex'));
 assert.deepEqual(points[1],original[1]);assert.deepEqual(points[2],original[2]);assert.notEqual(data.catalog.series[0].version,base.catalog.series[0].version);
 assert.deepEqual(query(base,'btc',from).points,original);
});

test('public API keeps fixed versions, half-open range, asset isolation and at most31 dates',async()=>{
 const response=await GET(new Request('http://localhost/api/reference-history')),catalog=await response.json();assert.equal(response.status,200);
 assert.equal(catalog.series[0].count,1828);assert.ok(JSON.stringify(catalog).length<32768);
 const params=new URLSearchParams({asset:'btc',from:String(CM_LONG_PLAN.from),cutoff:String(CM_LONG_PLAN.cutoff),version:publication.version});
 const call=p=>GET(new Request('http://localhost/api/reference-history?'+p));const first=await(await call(params)).json();assert.equal(first.points.length,31);assert.ok(JSON.stringify(first).length<32768);
 for(const [key,value] of [['from',String(CM_LONG_PLAN.from-1)],['cutoff',String(CM_LONG_PLAN.cutoff+DAY)],['asset','BTC-USDT'],['asset','sol'],['from','NaN']]){const bad=new URLSearchParams(params);bad.set(key,value);assert.equal((await call(bad)).status,400);}
 params.set('version','0'.repeat(64));assert.equal((await call(params)).status,409);
 const data=await loadPublishedReference(publication,now),copy=query(data);copy.points[0].price='0';assert.notEqual(query(data).points[0].price,'0');
});
