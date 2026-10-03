import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPublishedReference, queryPublishedReference } from "../lib/history/published-reference.ts";
import { packageDigest } from "../lib/history/package.ts";
import { GET } from "../app/api/reference-history/route.ts";
const fixture = JSON.parse(fs.readFileSync(new URL("../data/published/coinmetrics-sep2026.json",import.meta.url),"utf8"));
const now = fixture.exportedAt;
const from = Date.parse("2026-09-01T00:00:00Z"), cutoff = Date.parse("2026-10-01T00:00:00Z");
async function reseal(p) { const body={...p};delete body.checksum; p.checksum=await packageDigest(body); return p; }
test("approved publication reproduces both source decimal strings, UTC boundaries and archive versions",async()=>{
 const data=await loadPublishedReference(fixture,now);
 assert.equal(data.catalog.series.length,2);
 for(const source of fixture.sources){
  const slice=queryPublishedReference(data,{asset:source.asset,from,cutoff,version:source.version});
  const raw=JSON.parse(source.raw).data;
  assert.equal(slice.points.length,30);
  assert.equal(slice.identity,"reconstructed");assert.equal(slice.vintage,"current_vintage");
  assert.equal(slice.version,source.version);
  assert.equal(slice.provenance.receivedAt,source.receivedAt);
  for(let i=0;i<30;i++){assert.equal(slice.points[i].price,raw[i].PriceUSD);assert.equal(slice.points[i].periodStartAt,from+i*86400000);assert.equal(slice.points[i].evidenceEndAt,from+(i+1)*86400000);}
 }
});
test("publication rejects checksum, archive mismatch, fixtures, unexpected identity, future time and oversized content",async()=>{
 const cases=[
  p=>{p.checksum="0".repeat(64);return p;},
  async p=>{p.sources[0].version="0".repeat(64);return reseal(p);},
  async p=>{p.sources[0].asset="fixture";return reseal(p);},
  async p=>{p.sources[0].extra=true;return reseal(p);},
  async p=>{p.exportedAt=now+1;return reseal(p);},
  async p=>{p.sources[0].receivedAt=now+1;return reseal(p);},
  async p=>{p.sources[0].raw+=" ".repeat(32768);return reseal(p);},
  async p=>{const r=JSON.parse(p.sources[0].raw);r.next_page_url="https://example.com";p.sources[0].raw=JSON.stringify(r);return reseal(p);},
 ];
 for(const edit of cases)await assert.rejects(loadPublishedReference(await edit(structuredClone(fixture)),now));
});
test("fixed snapshot queries reject wrong ranges/versions and return independent bounded copies",async()=>{
 const data=await loadPublishedReference(fixture,now), params={asset:"btc",from,cutoff,version:fixture.sources[0].version};
 for(const change of [{asset:"eth",version:params.version},{asset:"BTC-USDT"},{from:from-86400000},{from:from+1},{cutoff:cutoff+86400000},{cutoff:from},{from:NaN},{version:"bad"},{extra:true}])assert.throws(()=>queryPublishedReference(data,{...params,...change}));
 const first=queryPublishedReference(data,{...params,cutoff:from+86400000});
 assert.equal(first.points.length,1);first.points[0].price="0";
 assert.notEqual(queryPublishedReference(data,params).points[0].price,"0");
 const last=queryPublishedReference(data,{...params,from:cutoff-86400000});
 assert.equal(last.points.length,1);assert.equal(last.points[0].evidenceEndAt,cutoff);
});
test("read-only route supplies private catalog and strict versioned queries",async()=>{
 const req=query=>GET(new Request("http://localhost/api/reference-history"+query));
 const catalog=await req("");assert.equal(catalog.status,200);assert.equal(catalog.headers.get("cache-control"),"private, no-store");
 const current=await catalog.json();assert.equal(current.series.length,2);assert.equal(current.batch,"CM-LONG-20261003-001");
 const params=new URLSearchParams({asset:"btc",from:String(from),cutoff:String(cutoff),version:current.series[0].version});
 const good=await req("?"+params);assert.equal(good.status,200);assert.equal((await good.json()).points.length,30);
 for(const tail of ["?asset=btc","?x=1","?asset=btc&asset=eth","?"+params+"&extra=x","?"+params.toString().replace(String(from),"1e12")]) assert.equal((await req(tail)).status,400);
 params.set("version","0".repeat(64));assert.equal((await req("?"+params)).status,409);
});
