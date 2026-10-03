// 所有网络响应均为模拟；真实下载证据另存在outputs，CI不访问第三方。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CoinMetricsArchive, collectCoinMetrics, CM_PILOT, CM_MAY_PILOT, reextractCoinMetricsMay } from '../collector/coinmetrics-archive.mjs';
import { canonical, digest } from '../collector/store.mjs';

const now = Date.parse('2026-10-03T02:00Z');
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mr-cm-test-')), path = join(dir, 'archive.sqlite');
  const bytes = Buffer.from('time,PriceUSD\n2026-09-01,100.1234567890123456789\n2026-09-02,101.0\n2026-09-03,\n');
  const manifests = ['btc','eth'].map(asset => ({ asset, commit: 'a'.repeat(40), blobSha: createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'), bytes: bytes.length }));
  const store = new CoinMetricsArchive(path, { create: true, fixture: manifests });
  t.after(() => { try { store.close(); } catch { /* already closed */ } });
  return { path, dir, bytes, store, manifests };
}
async function filled(t) {
  const f = setup(t); let requests = 0;
  await collectCoinMetrics(f.store, { clock: () => now, fetchImpl: async () => { requests++; return new Response(f.bytes); } });
  assert.equal(requests, 2); return f;
}
test('fixed source manifest is USD daily; query persisted decimal/date/coverage, no minute methods', async t => {
  const f = await filled(t), q = f.store.query('btc');
  assert.equal(q.identity, 'fixture'); assert.equal(q.series.currency, 'USD');
  assert.equal(q.points[0].price, '100.1234567890123456789');
  assert.equal(q.points[0].evidenceEndAt, CM_PILOT.from + 86400000);
  assert.equal(q.coverage.missing.find(m => m.sourceDate === '2026-09-03').reason, 'missing_value');
  assert.equal(q.coverage.missing.find(m => m.sourceDate === '2026-09-04').reason, 'missing_date');
  assert.equal(q.analysis.short90m, 'unsupported_frequency');
  assert.equal(f.store.status().points, 4);
  const subset = f.store.query('btc', CM_PILOT.from, CM_PILOT.from + 86400000, q.version);
  assert.equal(subset.points.length, 1); assert.equal(subset.coverageRange.cutoff, CM_PILOT.cutoff);
  assert.throws(() => f.store.query('btc', CM_PILOT.from, CM_PILOT.cutoff, 'bad'), /VERSION/);
  assert.throws(() => f.store.query('BTC-USDT'), /RANGE/);
  assert.throws(() => f.store.query('btc', CM_PILOT.from - 86400000), /RANGE/);
  await collectCoinMetrics(f.store, { clock: () => now, fetchImpl: () => { throw Error('MUST_NOT_FETCH'); } });
  assert.equal(f.store.status().requests.length, 2);
  assert.equal(f.store.query('btc').provenance.receivedAt, now);
});
test('budget reservation survives instances, crash and retry; no runID reset', t => {
  const f = setup(t), id = f.store.reserve('btc', now);
  assert.equal(id, 1); assert.throws(() => f.store.reserve('eth', now), /IN_PROGRESS/);
  f.store.close(); const reopened = new CoinMetricsArchive(f.path);
  try {
    for (let i = 1; i < 4; i++) reopened.reserve('btc', now + i * 31000);
    assert.equal(reopened.status().reservedBytes, 16 * 1024 ** 2);
    assert.throws(() => reopened.reserve('eth', now + 5 * 31000), /BUDGET/);
    assert.throws(() => reopened.accept(id, f.bytes, now + 31000), /RESERVATION/);
  } finally { reopened.close(); }
});
test('429 cooldown persists and 403 stops source; no automatic retry or second asset', async t => {
  const f = setup(t); let count = 0;
  await assert.rejects(collectCoinMetrics(f.store, { clock: () => now, fetchImpl: async () => { count++; return new Response('', { status:429, headers: { 'Retry-After':'120' } }); } }), /HTTP_429/);
  assert.equal(count, 1); assert.equal(f.store.status().retryAt, now + 120000);
  assert.throws(() => f.store.reserve('eth', now + 1000), /COOLDOWN/);
  await assert.rejects(collectCoinMetrics(f.store, { clock: () => now + 121000, fetchImpl: async () => new Response('', { status:403 }) }), /HTTP_403/);
  assert.throws(() => f.store.reserve('eth', now + 122000), /DISABLED/);
});
test('corrupt response or raw write failure publishes no facts/checkpoint, but consumes quota', async t => {
  const f = setup(t);
  await assert.rejects(collectCoinMetrics(f.store, { clock: () => now, fetchImpl: async () => new Response('wrong') }), /SIZE/);
  assert.equal(f.store.status().points, 0);
  await assert.rejects(collectCoinMetrics(f.store, { clock: () => now + 1, fetchImpl: async () => new Response(f.bytes), saveRaw: () => { throw Error('DISK_TEST'); } }), /DISK_TEST/);
  assert.equal(f.store.catalog().series.length, 0); assert.equal(f.store.status().requests.length, 2);
});
test('snapshot restores to new empty target, budgets/checkpoints kept, collection disabled; new process identical', async t => {
  const f = await filled(t), backup = f.store.exportSnapshot(), restoredPath = join(f.dir, 'restored.sqlite');
  const status = CoinMetricsArchive.restore(restoredPath, backup);
  assert.equal(status.enabled, false); assert.equal(status.requests.length, 2);
  const restored = new CoinMetricsArchive(restoredPath, { readOnly:true });
  try { assert.deepEqual(restored.query('btc'), f.store.query('btc')); assert.deepEqual(restored.query('eth'), f.store.query('eth')); } finally { restored.close(); }
  const writable = new CoinMetricsArchive(restoredPath);
  try { assert.throws(() => writable.reserve('eth', now + 1), /DISABLED/); } finally { writable.close(); }
  const moduleUrl = pathToFileURL(join(process.cwd(), 'collector/coinmetrics-archive.mjs')).href;
  const result = spawnSync(process.execPath, ['--input-type=module','-e', 'import {CoinMetricsArchive} from '+JSON.stringify(moduleUrl)+';const s=new CoinMetricsArchive(process.argv[1],{readOnly:true});console.log(JSON.stringify(s.query("btc")));s.close();', restoredPath], { encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), f.store.query('btc'));
  assert.throws(() => CoinMetricsArchive.restore(restoredPath, backup), /NEW_TARGET/);
});
test('backup checksum/shape/identity/time/checkpoint tampering rejected before target creation', async t => {
  const f = await filled(t), original = JSON.parse(f.store.exportSnapshot());
  const edits = [
    b => { b.points[0].price = '0'; },
    b => { b.points[0].end = b.points[0].start; },
    b => { b.requests[0].finished++; },
    b => { b.requests[0].bytes = 0; },
    b => { b.meta.config = canonical({ ...JSON.parse(b.meta.config), identity:'reconstructed' }); },
    b => { b.points.push(b.points[0]); },
    b => { b.files[0].request_id = 2; },
    b => { b.requests[0].asset = 'sol'; },
    b => { b.requests[0].started = b.requests[0].finished - 30001; },
    b => { b.requests[0].started = Date.now() + 86400000; },
  ];
  for (let i = 0; i < edits.length; i++) {
    const { checksum, ...body } = structuredClone(original); void checksum; edits[i](body);
    const text = canonical({ ...body, checksum:digest(body) }), path = join(f.dir, 'bad-'+i+'.sqlite');
    assert.throws(() => CoinMetricsArchive.restore(path, text));
    assert.equal(existsSync(path), false);
  }
  assert.throws(() => CoinMetricsArchive.restore(join(f.dir,'changed.sqlite'), f.store.exportSnapshot().replace('101.0','102.0')), /BACKUP/);
});
test('read-only session pins version even if other asset is committed later', t => {
  const f = setup(t); f.store.accept(f.store.reserve('btc', now), f.bytes, now);
  const reader = new CoinMetricsArchive(f.path, { readOnly:true });
  try {
    assert.equal(reader.catalog().series.length, 1);
    // SQLite rollback journal read锁阻止另一个writer提交；取消/关闭后才允许继续，不产生混合快照。
    assert.equal(reader.query('btc').provenance.receivedAt, now);
  } finally { reader.close(); }
  f.store.accept(f.store.reserve('eth', now + 1), f.bytes, now + 1);
  const fresh = new CoinMetricsArchive(f.path, { readOnly:true });
  try { assert.equal(fresh.catalog().series.length, 2); } finally { fresh.close(); }
});
test('redirect/forbidden/429 remain blocked even if response cleanup throws', async t => {
  for (const status of [302,403,429]) {
    const f = setup(t);
    await assert.rejects(collectCoinMetrics(f.store, { clock: () => now, fetchImpl: async () => ({ status, headers:new Headers({ 'Retry-After':'120' }), body:{ cancel:async () => { throw Error('CANCEL_TEST'); } } }) }), new RegExp('HTTP_'+status));
    assert.throws(() => f.store.reserve('eth', now + 1000), status === 429 ? /COOLDOWN/ : /DISABLED/);
  }
});
function maySource(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mr-cm-may-'));
  const bytes = Buffer.from('time,PriceUSD\n' + Array.from({length:24},(_,i)=>'2026-05-'+String(i+1).padStart(2,'0')+','+(100+i)+'.1234567890123456789').join('\n') + '\n2026-09-01,200.0\n');
  const fixture = ['btc','eth'].map(asset=>({asset,commit:'a'.repeat(40),blobSha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),bytes:bytes.length}));
  const store = new CoinMetricsArchive(join(dir,'sep.sqlite'),{create:true,fixture});
  for(const asset of ['btc','eth'])store.accept(store.reserve(asset,now),bytes,now);
  t.after(()=>store.close());
  return {dir,bytes,store};
}
test('May offline profile extracts 48 exact daily facts with original receipt/ledger and immutable September parent', async t=>{
  const f=maySource(t), before=f.store.exportSnapshot(), derivedAt=now+60000;
  const text=reextractCoinMetricsMay(f.store,{btc:f.bytes,eth:f.bytes},derivedAt);
  assert.equal(f.store.exportSnapshot(),before);
  assert.equal(reextractCoinMetricsMay(f.store,{btc:f.bytes,eth:f.bytes},derivedAt),text);
  const path=join(f.dir,'may.sqlite'), status=CoinMetricsArchive.restore(path,text);
  assert.equal(status.points,48);assert.equal(status.newRequests,0);
  assert.equal(status.requestAccounting,'inherited_from_CM-SEP2026-001');
  assert.deepEqual(status.requests,f.store.status().requests);assert.equal(status.enabled,false);
  const may=new CoinMetricsArchive(path);
  try {
    const q=may.query('btc');assert.equal(q.points.length,24);assert.equal(q.coverage.expectedDates,24);
    assert.equal(q.points[0].price,'100.1234567890123456789');
    assert.equal(q.points.at(-1).sourceDate,'2026-05-24');assert.equal(q.points.at(-1).evidenceEndAt,CM_MAY_PILOT.cutoff);
    assert.equal(q.provenance.receivedAt,now);assert.equal(q.derivation.derivedAt,derivedAt);
    assert.equal(q.derivation.parentVersion,f.store.query('btc').version);
    assert.equal(q.derivation.parentSnapshot,JSON.parse(before).checksum);
    assert.throws(()=>may.reserve('btc',Date.now()),/DISABLED/);
    await assert.rejects(collectCoinMetrics(may,{fetchImpl:()=>{throw Error('NETWORK_CALLED');}}),/DISABLED/);
    assert.throws(()=>may.query('btc',CM_PILOT.from,CM_PILOT.cutoff),/RANGE/);
    const backup=may.exportSnapshot(), restored=join(f.dir,'may-restored.sqlite');
    CoinMetricsArchive.restore(restored,backup);
    const other=new CoinMetricsArchive(restored,{readOnly:true});
    try{assert.deepEqual(other.query('eth'),may.query('eth'));}finally{other.close();}
  }finally{may.close();}
});
test('May reconstruction rejects incomplete source, corrupt raw and time backdating before writing a target',t=>{
  const f=maySource(t);
  assert.throws(()=>reextractCoinMetricsMay(f.store,{btc:f.bytes,eth:Buffer.from('bad')},now+1),/SIZE/);
  assert.throws(()=>reextractCoinMetricsMay(f.store,{btc:f.bytes,eth:f.bytes},now-1),/TIME/);
  assert.throws(()=>reextractCoinMetricsMay(f.store,{btc:f.bytes,eth:f.bytes},Date.now()+60000),/INPUT/);
  assert.throws(()=>reextractCoinMetricsMay(f.store,{btc:f.bytes},now+1),/INPUT/);
  const empty=setup(t);assert.throws(()=>reextractCoinMetricsMay(empty.store,{btc:empty.bytes,eth:empty.bytes},now+1),/INCOMPLETE/);
});
test('May backup lineage/ledger/receipt/date cannot be detached even with recomputed outer checksums',t=>{
  const f=maySource(t), baseline=JSON.parse(reextractCoinMetricsMay(f.store,{btc:f.bytes,eth:f.bytes},now+60000));
  const changes=[
    body=>{body.files=[];body.points=[];body.requests=[];},
    body=>{body.files=body.files.filter(f=>f.asset==='btc');body.points=body.points.filter(p=>p.asset==='btc');body.requests=body.requests.filter(r=>r.asset==='btc');},
    body=>{body.meta.enabled=1;},
    body=>{body.requests[0].started--;},
    body=>{const file=JSON.parse(body.files[0].body);file.derivation.parentSnapshot='0'.repeat(64);body.files[0].body=canonical(file);},
    body=>{const file=JSON.parse(body.files[0].body);file.derivation.parentVersion=JSON.parse(body.files[1].body).derivation.parentVersion;body.files[0].body=canonical(file);},
    body=>{const file=JSON.parse(body.files[0].body);file.derivation.derivedAt=now-1;body.files[0].body=canonical(file);},
    body=>{const file=JSON.parse(body.files[0].body);file.provenance.receivedAt++;body.requests[0].finished++;body.files[0].body=canonical(file);},
    body=>{body.points[0].day='2026-09-01';},
  ];
  for(let i=0;i<changes.length;i++){
    const {checksum,...body}=structuredClone(baseline);void checksum;changes[i](body);
    for(const file of body.files){
      const values=body.points.filter(p=>p.asset===file.asset).map(p=>({sourceDate:p.day,periodStartAt:p.start,evidenceEndAt:p.end,price:p.price}));
      file.hash=digest({...JSON.parse(file.body),points:values});
    }
    const text=canonical({...body,checksum:digest(body)}),target=join(f.dir,'tamper-'+i+'.sqlite');
    assert.throws(()=>CoinMetricsArchive.restore(target,text));assert.equal(existsSync(target),false);
  }
});