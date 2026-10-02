import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { ArchiveStore } from '../collector/store.mjs';
import { exportHistoryPackage } from '../scripts/history-package.mjs';
import { parseHistoryPackage, PACKAGE_LIMIT } from '../lib/history/package.ts';
import { replayHistory, researchHistory } from '../lib/history/replay.ts';
import { directionForWindow, volatilityForWindow } from '../lib/radar/asset-state.ts';
import { historyFixture, signed, start } from './fixtures/history28.mjs';

test('history28 package: strict identity, finite OHLC, chronological complete records and checksum', async () => {
  const p = await historyFixture({ count: 40 });
  assert.deepEqual(await parseHistoryPackage(JSON.stringify(p), p.exportedAt), p);
  const cases = [q => q.identity = 'observed_live', q => q.source = 'OKX', q => q.vintage = 'point_in_time', q => q.asset.currency = '', q => q.sessionEvidence = 'open', q => q.intervalMs = 60000, q => q.extra = 1, q => q.exportedAt++, q => q.bars.reverse(), q => q.bars[1].time = q.bars[0].time, q => q.bars[0].close = 0, q => q.bars[0].low = 1000, q => q.bars[0].volume = -1, q => q.bars[0].version = 2, q => q.bars[0].receivedAt = start, q => q.bars.at(-1).time = q.range.cutoff, q => q.bars[0].complete = false];
  for (const mutate of cases) { const q = structuredClone(p); mutate(q); await assert.rejects(parseHistoryPackage(JSON.stringify(await signed(q)), p.exportedAt)); }
  const q = structuredClone(p); q.bars[0].volume = 4; await assert.rejects(parseHistoryPackage(JSON.stringify(q), p.exportedAt), /校验/);
  await assert.rejects(parseHistoryPackage(' '.repeat(PACKAGE_LIMIT + 1), p.exportedAt));
});
test('history28 replay: exact old mathematics, independent of events, deterministic and immutable', async () => {
  for (const intervalMs of [300000, 900000]) {
    const p = await historyFixture({ count: 45, intervalMs, close: i => 100 * 1.0002 ** (i * intervalMs / 300000) }); const before = JSON.stringify(p), at = p.range.cutoff;
    const a = replayHistory(p, at, p.exportedAt), b = replayHistory(p, at, p.exportedAt); assert.deepEqual(a, b); assert.equal(JSON.stringify(p), before);
    for (const h of a.horizons) {
      const n = h.minutes * 60000 / intervalMs, points = p.bars.slice(-n - 1).map(({time,close}) => ({time,close}));
      const d = directionForWindow(points, h.id === 'short' ? .15 : .30, h.direction.message), v = volatilityForWindow(points, intervalMs, n/3, n*2/3, h.volatility.message);
      assert.deepEqual(h.direction, d); assert.deepEqual(h.volatility, v); assert.equal(h.evidence.closeEndAt - h.evidence.closeStartAt, h.minutes * 60000);
    }
    assert.equal(a.horizons[0].direction.classification, 'upward'); assert.equal(a.horizons[0].volatility.classification, 'similar');
  }
});
test('history28 replay: 21/22/37 samples, gap and precise cutoff failures remain dimension-local', async () => {
  for (const count of [21, 22, 36, 37]) {
    const p = await historyFixture({ count }), r = replayHistory(p, p.range.cutoff, p.exportedAt);
    assert.equal(r.horizons[0].reason, count < 22 ? 'insufficient_contiguous_bars' : null);
    assert.equal(r.horizons[1].reason, count < 37 ? 'insufficient_contiguous_bars' : null);
  }
  const p = await historyFixture({count:50}); p.bars.splice(28,1);
  assert.equal(replayHistory(p,p.range.cutoff,p.exportedAt).horizons[0].reason,'insufficient_contiguous_bars');
  assert.equal(replayHistory(p,p.range.cutoff-1,p.exportedAt).horizons[0].reason,'missing_endpoint');
  assert.throws(()=>replayHistory(p,p.range.cutoff+1,p.exportedAt)); assert.throws(()=>replayHistory(p,p.range.cutoff,p.exportedAt-1));
});
test('history28 replay: flat baseline is unavailable, oscillation is not inferred from empty events', async () => {
  const p = await historyFixture({ count: 50, close: () => 100 });
  const r = replayHistory(p,p.range.cutoff,p.exportedAt).horizons[0]; assert.equal(r.direction.classification,'no_direction'); assert.equal(r.volatility.reason,'baseline_too_small');
  assert.equal(researchHistory(p,p.range.cutoff,p.exportedAt).status,'query_unavailable');
  const q = await historyFixture({count:50,close:i=>i%2?100.5:100});
  assert.equal(replayHistory(q,q.range.cutoff,q.exportedAt).horizons[0].direction.classification,'no_direction');
});
test('history28 research: fixed protocol, mature nonoverlapping full dependencies, ledger and hand outcome', async () => {
  const p = await historyFixture(), r = researchHistory(p,p.range.cutoff,p.exportedAt);
  assert.equal(r.status,'available'); assert.ok(r.samples.length>=10); assert.equal(r.protocol,'same-asset-short90-forward30-v1');
  const ordered=[...r.samples].sort((a,b)=>a.asOf-b.asOf), query=replayHistory(p,p.range.cutoff,p.exportedAt).horizons[0];
  ordered.forEach((s,i)=>{ assert.ok(s.targetEnd < r.asOf); assert.ok(s.targetEnd<=query.evidence.dependencyStartAt); if(i)assert.ok(s.dependencyStartAt>=ordered[i-1].targetEnd); assert.ok(Math.abs(s.returnPercent-(1.0002**6-1)*100)<1e-10); });
  assert.equal(r.counts.candidates,Object.entries(r.counts).filter(([k])=>k!=='candidates').reduce((s,[,v])=>s+v,0));
  assert.ok(r.statistics.min<=r.statistics.median&&r.statistics.median<=r.statistics.max);
  const small=await historyFixture({count:100}); assert.equal(researchHistory(small,small.range.cutoff,small.exportedAt).status,'insufficient');
});
test('history28 research: modifying future bars cannot change query features or chosen outcomes', async () => {
  const p = await historyFixture(), at=start+700*p.intervalMs, q=structuredClone(p);
  for (const b of q.bars) if(b.time>=at) {b.close*=2;b.open=b.close;b.high=b.close+1;b.low=b.close-1;}
  const validated=await parseHistoryPackage(JSON.stringify(await signed(q)),p.exportedAt);
  assert.deepEqual(replayHistory(p,at,p.exportedAt).horizons,replayHistory(validated,at,p.exportedAt).horizons);
  const before=researchHistory(p,at,p.exportedAt),after=researchHistory(validated,at,p.exportedAt);
  assert.deepEqual(before.samples,after.samples);assert.deepEqual(before.counts,after.counts);assert.deepEqual(before.statistics,after.statistics);
});
test('history28 research: minimum ten is enforced at the full-dependency boundary',async()=>{
  for(const [count,retained,status]of [[301,9,'insufficient'],[302,10,'available']]){
    const p=await historyFixture({count}),r=researchHistory(p,p.range.cutoff,p.exportedAt);
    assert.equal(r.counts.retained,retained);assert.equal(r.status,status);assert.equal(r.statistics===null,status==='insufficient');
  }
});
test('history28 research: finite extreme outcomes cannot overflow the median',async()=>{
  const p=await historyFixture({count:302,close:i=>i%28===27?1e308:100*1.0002**(i%28)});
  const validated=await parseHistoryPackage(JSON.stringify(p),p.exportedAt),r=researchHistory(validated,p.range.cutoff,p.exportedAt);
  assert.equal(r.status,'available');assert.equal(r.samples.length,10);assert.ok(r.samples.every(s=>Number.isFinite(s.returnPercent)));
  assert.ok(Object.values(r.statistics).every(Number.isFinite));assert.ok(r.statistics.median>9e307);assert.equal(JSON.stringify(r).includes('"median":null'),false);
});

async function fill(store,count=250) {
  const p=await historyFixture({count}), asset={...p.asset,role:'asset'}, config={owner:'fixture-owner',runId:'fixture-run',source:p.source,universeVersion:'fixture-v1',assets:[asset],from:p.range.from,cutoff:p.range.cutoff,createdAt:p.exportedAt,identity:'fixture',limits:{}};
  store.createRun(config);
  const records=p.bars.map(b=>({asset:asset.id,kind:'bar',occurredAt:b.time,payload:{intervalMs:p.intervalMs,currency:asset.currency,adjustment:asset.adjustment,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume,complete:true,sessionEvidence:'fixture_only'}}));
  const lease=store.reserveRequest(config.owner,config.runId,p.exportedAt); assert.ok(lease.ok);store.chargeBytes(config.owner,config.runId,JSON.stringify(records).length);
  store.commitPage(config.owner,config.runId,{expectedCursor:null,nextCursor:null,records,receivedAt:p.exportedAt,traversalDone:true,leaseToken:lease.leaseToken});store.releaseRequest(config.owner,config.runId,lease.leaseToken);
  return {owner:config.owner,source:p.source,asset:asset.id,from:p.range.from,to:p.range.cutoff,exportedAt:p.exportedAt};
}
test('history28 archive: multipage fixed version, owner excluded, process restart and empty restore reproduce replay', async t => {
  const dir=mkdtempSync(join(tmpdir(),'mr-history28-')); t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const path=join(dir,'a.sqlite');let store=new ArchiveStore(path); const query=await fill(store), p=await exportHistoryPackage(store,query);
  assert.equal(p.bars.length,250);assert.equal(JSON.stringify(p).includes('fixture-owner'),false);
  const backup=store.exportSnapshot(query.owner);writeFileSync(join(dir,'backup.json'),backup);store.close();
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {ArchiveStore} from ${JSON.stringify(new URL('../collector/store.mjs',import.meta.url).href)};const s=new ArchiveStore(process.argv[1]);console.log(s.db.prepare('SELECT COUNT(*) AS n FROM archive_facts').get().n);s.close();`,path],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'250');
  store=new ArchiveStore(join(dir,'restored.sqlite'));store.restoreSnapshot(readFileSync(join(dir,'backup.json'),'utf8'));
  const restored=await exportHistoryPackage(store,query);assert.deepEqual(restored,p);assert.deepEqual(replayHistory(restored,p.range.cutoff,p.exportedAt),replayHistory(p,p.range.cutoff,p.exportedAt));
  await assert.rejects(exportHistoryPackage(store,{...query,owner:'other'}),/NO_ARCHIVED_BARS/);await assert.rejects(exportHistoryPackage(store,{...query,source:'OKX'}),/NOT_APPROVED/);
});
test('history28 bounded computation: report actual wall clock, no frozen-clock FPS claim',async t=>{
  const p=await historyFixture({count:2000});const times=[];
  for(let i=0;i<5;i++){const start=performance.now();replayHistory(p,p.range.cutoff,p.exportedAt);researchHistory(p,p.range.cutoff,p.exportedAt);times.push(performance.now()-start);}
  t.diagnostic(JSON.stringify({bars:2000,replayAndResearchMs:times}));assert.ok(times.every(Number.isFinite));
});
