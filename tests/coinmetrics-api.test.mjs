// 模拟响应测试；真实九月批次另存 outputs，不在 CI 请求外部接口。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CM_API_SEP, CM_API_BYTES, parseCoinMetricsApi, coinMetricsApiUrl } from '../collector/coinmetrics-api.mjs';
import { CoinMetricsArchive, collectCoinMetrics } from '../collector/coinmetrics-archive.mjs';
import { canonical, digest } from '../collector/store.mjs';
const DAY = 86400000, now = Date.parse('2026-10-03T02:00Z');
const rows = asset => Array.from({ length:30 }, (_,i) => ({
  asset, time:'2026-09-' + String(i+1).padStart(2,'0') + 'T00:00:00.000000000Z',
  PriceUSD: (100+i) + '.1234567890123456789',
}));
const bytes = (asset='btc') => Buffer.from(JSON.stringify({ data:rows(asset) }));
const parse = (body, more={}) => parseCoinMetricsApi(Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)),
  { manifest:CM_API_SEP.manifests[0], from:CM_API_SEP.from, cutoff:CM_API_SEP.cutoff, receivedAt:now, now, ...more });
function setup(t) {
  const dir=mkdtempSync(join(tmpdir(),'mr-cm-api-')), path=join(dir,'archive.sqlite');
  const store=new CoinMetricsArchive(path,{create:true,batch:CM_API_SEP.batch,fixture:CM_API_SEP.manifests});
  t.after(()=>{try{store.close();}catch{/* already closed */}});
  return {dir,path,store};
}
async function fill(f, extra={}) {
  let tick=now;
  return collectCoinMetrics(f.store,{clock:()=>tick,wait:async ms=>{tick+=ms;},
    fetchImpl:async url=>new Response(bytes(new URL(url).searchParams.get('assets'))),...extra});
}
test('API fixed contract: exact USD strings, UTC day-end, no Git/PIT/minute claims',()=>{
  const q=parse(bytes()), url=new URL(coinMetricsApiUrl(CM_API_SEP.manifests[0]));
  assert.equal(url.origin,'https://community-api.coinmetrics.io');
  assert.equal(url.searchParams.get('end_inclusive'),'false');assert.equal(url.searchParams.get('frequency'),'1d');
  assert.equal(url.searchParams.get('page_size'),'100'); assert.equal(url.searchParams.get('assets'),'btc');
  assert.equal(url.searchParams.has('api_key'),false);
  assert.equal(q.points.length,30);assert.equal(q.points[0].price,'100.1234567890123456789');
  assert.equal(q.points[0].evidenceEndAt,CM_API_SEP.from+DAY);assert.equal(q.points.at(-1).evidenceEndAt,CM_API_SEP.cutoff);
  assert.equal(q.identity,'reconstructed');assert.equal(q.vintage,'current_vintage');assert.equal(q.provenance.sourcePublishedAt,null);
  assert.equal(q.provenance.transport,'community_api');assert.equal('commit' in q.provenance,false);
  assert.equal(q.analysis.short90m,'unsupported_frequency');assert.equal(q.coverage.status,'date_grid_present');
  assert.throws(()=>coinMetricsApiUrl({asset:'sol',transport:'community_api'}),/MANIFEST/);
  assert.throws(()=>parse(bytes(),{from:CM_API_SEP.from-DAY}),/RANGE/);
  assert.throws(()=>parse(bytes(),{receivedAt:now+1}),/RANGE/);
  assert.throws(()=>parse(bytes(),{receivedAt:CM_API_SEP.cutoff-1}),/RANGE/);
});
test('API missing date/value/empty response remains partial, never zero-priced',()=>{
  const data=rows('btc');data.splice(1,1);data[1].PriceUSD=null;data[2].PriceUSD='';
  const q=parse({data});
  assert.equal(q.points.length,27);assert.deepEqual(q.coverage.missing.map(m=>m.reason),['missing_date','missing_value','missing_value']);
  const empty=parse({data:[]});assert.equal(empty.points.length,0);assert.equal(empty.coverage.missing.length,30);
});
test('API rejects continuation, incorrect identity/time/order/price and hostile shape',()=>{
  const changes=[
    r=>{r.next_page_token='later';},r=>{r.next_page_url='http://127.0.0.1/';},r=>{r.next_page_token=false;},
    r=>{r.data.push(r.data[0]);},r=>{r.data[1]=r.data[0];},r=>{r.data.reverse();},
    r=>{r.data[0].asset='eth';},r=>{r.data[0].time='2026-08-31T00:00:00Z';},
    r=>{r.data.at(-1).time='2026-10-01T00:00:00Z';},r=>{r.data[0].time='2026-09-01T01:00:00Z';},
    r=>{r.data[0].time='2026-09-01T00:00:00+00:00';},r=>{r.data[0].PriceUSD=100;},
    r=>{r.data[0].PriceUSD='0';},r=>{r.data[0].PriceUSD='Infinity';},r=>{r.data[0].PriceUSD='1e5';},
    r=>{r.data[0].PriceUSD='9'.repeat(81);},r=>{r.data[0].frequency='5m';},r=>{r.error='bad';},
  ];
  for(const edit of changes){const r={data:rows('btc')};edit(r);assert.throws(()=>parse(r));}
  assert.throws(()=>parse(Buffer.from([255])),/JSON/);
  assert.throws(()=>parse(Buffer.alloc(CM_API_BYTES+1)),/SIZE/);
  assert.equal(parse({data:rows('btc'),next_page_token:null,next_page_url:''}).points.length,30);
});
test('API commits complete month, limits ledger to 128KiB/request, persists source pacing and idempotence',async t=>{
  const f=setup(t);let count=0,tick=now;
  await fill(f,{clock:()=>tick,wait:async ms=>{tick+=ms;},fetchImpl:async(url,init)=>{
    assert.equal(init.redirect,'manual');assert.equal(init.headers.Accept,'application/json');count++;
    return new Response(bytes(new URL(url).searchParams.get('assets')));
  }});
  assert.equal(count,2);assert.equal(tick,now+1000);assert.equal(f.store.status().points,60);
  assert.equal(f.store.status().reservedBytes,2*CM_API_BYTES);assert.equal(f.store.query('btc').identity,'fixture');
  await collectCoinMetrics(f.store,{clock:()=>tick,fetchImpl:()=>{throw Error('MUST_NOT_FETCH');}});
  assert.equal(f.store.status().requests.length,2);
  const q=f.store.query('btc',CM_API_SEP.from+DAY,CM_API_SEP.cutoff,f.store.query('btc').version);
  assert.equal(q.points.length,29);assert.equal(q.coverage.presentValues,30);
});
test('API across reopen uses persistent cooling, pending leases and four-attempt total',t=>{
  const f=setup(t);const id=f.store.reserve('btc',now);f.store.failure(id,now,{bytes:0});
  f.store.close();const other=new CoinMetricsArchive(f.path);
  try{
    assert.throws(()=>other.reserve('eth',now+999),/COOLDOWN/);
    other.reserve('eth',now+1000);assert.throws(()=>other.reserve('btc',now+2000),/IN_PROGRESS/);
    other.reserve('btc',now+32000);other.reserve('btc',now+63000);
    assert.equal(other.status().reservedBytes,4*CM_API_BYTES);
    assert.throws(()=>other.reserve('eth',now+94000),/BUDGET/);
  }finally{other.close();}
});
test('API rejects oversized, paginated or unpersisted raw without committing; retry can resume accepted asset',async t=>{
  const f=setup(t);let tick=now;
  await assert.rejects(fill(f,{fetchImpl:async()=>new Response(bytes(),{headers:{'content-length':String(CM_API_BYTES+1)}})}),/LIMIT/);
  assert.equal(f.store.status().points,0);
  tick+=1000;
  await assert.rejects(fill(f,{clock:()=>tick,fetchImpl:async()=>new Response(JSON.stringify({data:rows('btc'),next_page_token:'x'}))}),/PAGINATION/);
  tick+=1000;
  await assert.rejects(fill(f,{clock:()=>tick,saveRaw:()=>{throw Error('DISK_TEST');}}),/DISK_TEST/);
  assert.equal(f.store.catalog().series.length,0);assert.equal(f.store.status().requests.length,3);
  const second=setup(t);let n=0;
  await assert.rejects(fill(second,{saveRaw:()=>{if(++n===2)throw Error('DISK_TEST');}}),/DISK_TEST/);
  assert.equal(second.store.query('btc').points.length,30);
  let resumed=0;
  await fill(second,{clock:()=>now+3000,fetchImpl:async url=>{resumed++;assert.equal(new URL(url).searchParams.get('assets'),'eth');return new Response(bytes('eth'));}});
  assert.equal(resumed,1);assert.equal(second.store.status().points,60);assert.equal(second.store.status().requests.length,3);
});
test('API rate limits and authorization denial stop before second asset and survive new process/store',async t=>{
  for(const status of [302,401,403,429]){
    const f=setup(t);let count=0;
    await assert.rejects(fill(f,{fetchImpl:async()=>{count++;return new Response('',{status,headers:{'Retry-After':'120'}});}}),new RegExp('HTTP_'+status));
    assert.equal(count,1);f.store.close();const reopened=new CoinMetricsArchive(f.path);
    try{assert.throws(()=>reopened.reserve('eth',now+1001),status===429?/COOLDOWN/:/DISABLED/);}finally{reopened.close();}
  }
});
test('API backup/restoration preserves decimal/version/source, disabled collection and consumed quota',async t=>{
  const f=setup(t);await fill(f);const path=join(f.dir,'restored.sqlite'), text=f.store.exportSnapshot();
  const status=CoinMetricsArchive.restore(path,text);assert.equal(status.enabled,false);assert.equal(status.reservedBytes,2*CM_API_BYTES);
  const restored=new CoinMetricsArchive(path);
  try{
    assert.deepEqual(restored.query('btc'),f.store.query('btc'));assert.deepEqual(restored.query('eth'),f.store.query('eth'));
    assert.throws(()=>restored.reserve('btc',now+10000),/DISABLED/);
  }finally{restored.close();}
  const edits=[
    b=>{b.requests[0].bytes=CM_API_BYTES+1;},
    b=>{const x=JSON.parse(b.files[0].body);x.provenance.commit='a'.repeat(40);b.files[0].body=canonical(x);},
    b=>{const x=JSON.parse(b.files[0].body);x.sourceUrl='https://evil.example';b.files[0].body=canonical(x);},
    b=>{const x=JSON.parse(b.files[0].body);x.coverage.sourceRows=0;b.files[0].body=canonical(x);},
    b=>{b.meta.retry_at=0;},b=>{b.requests[0].finished++;},
  ];
  for(let i=0;i<edits.length;i++){
    const {checksum,...body}=JSON.parse(text);void checksum;edits[i](body);
    for(const file of body.files)file.hash=digest({...JSON.parse(file.body),points:body.points.filter(p=>p.asset===file.asset).map(p=>({sourceDate:p.day,periodStartAt:p.start,evidenceEndAt:p.end,price:p.price}))});
    const target=join(f.dir,'bad-'+i+'.sqlite');
    assert.throws(()=>CoinMetricsArchive.restore(target,canonical({...body,checksum:digest(body)})));
    assert.equal(existsSync(target),false);
  }
});

test('oversize decoded stream records actual delivered bytes rather than clamping to reservation',async t=>{
  const f=setup(t), n=CM_API_BYTES+1;
  await assert.rejects(fill(f,{fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(n));c.close();}}))}),/RESPONSE_LIMIT/);
  assert.equal(f.store.status().requests[0].status,'oversized');
  assert.equal(f.store.status().actualBytes,n);assert.equal(f.store.status().reservedBytes,CM_API_BYTES);
  assert.equal(f.store.status().points,0);
  const target=join(f.dir,'oversized-restored.sqlite');
  CoinMetricsArchive.restore(target,f.store.exportSnapshot());
  const restored=new CoinMetricsArchive(target,{readOnly:true});
  try{assert.equal(restored.status().actualBytes,n);assert.equal(restored.status().enabled,false);}finally{restored.close();}
});
