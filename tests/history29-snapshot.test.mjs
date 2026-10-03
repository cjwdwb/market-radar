// B-STORAGE-001仅合成隔离库，不读取真实用户档案或访问数据来源。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, rmSync, cpSync, watch } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { ArchiveStore, canonical } from '../collector/store.mjs';
import { runSnapshot } from '../scripts/history-snapshot.mjs';
import { localFile } from '../scripts/history-local.mjs';
import { exportHistoryPackage } from '../scripts/history-package.mjs';
import { replayHistory, researchHistory } from '../lib/history/replay.ts';
import { FED } from '../collector/source-policy.mjs';

const root = localFile('b-test-anchor').slice(0, -'b-test-anchor'.length);
const start = Date.parse('2025-12-01T00:00:00Z'), interval = 300000, owner = 'fixture-b-owner';
const asset = { id: 'fixture:CRYPTO:TEST:BBB-USDT:SPOT', market: 'crypto', venue: 'TEST', providerId: 'fixture:BBB-USDT', currency: 'USDT', adjustment: 'raw', role: 'asset' };
function context(t) {
  // mkdtemp需要父目录；既有localFile不负责创建根。
  const name = `b-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const dir = localFile(name);
  return import('node:fs').then(({ mkdirSync }) => {
    mkdirSync(dir, { recursive: true }); const folder = mkdtempSync(join(dir, 'fixture-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return { folder, name: suffix => relative(root, join(folder, suffix)) };
  });
}
const bar = (i, ms = interval, close = 100 * 1.0002 ** i) => ({ asset: asset.id, kind: 'bar', occurredAt: start + i * ms, payload: { intervalMs: ms, currency: 'USDT', adjustment: 'raw', open: close, high: close + .01, low: close - .01, close, volume: null, complete: true, sessionEvidence: 'fixture_only' } });
function page(s, runId, records, { at, from = records[0].occurredAt, cutoff = records.at(-1).occurredAt + records.at(-1).payload.intervalMs, next = null } = {}) {
  at ??= cutoff + 1000;
  s.createRun({ owner, runId, source: 'fixture:stage29b', universeVersion: 'fixture-b-v1', assets: [asset], from, cutoff, createdAt: at, identity: 'fixture', limits: {} });
  const r = s.reserveRequest(owner, runId, at); assert.equal(r.ok, true);
  s.chargeBytes(owner, runId, Buffer.byteLength(canonical(records)), r.leaseToken);
  return s.commitPage(owner, runId, { expectedCursor: null, nextCursor: next, records, receivedAt: at, traversalDone: next === null, leaseToken: r.leaseToken });
}
function pinned(s, from, to, readRevision, intervalMs = interval) {
  const all = []; let cursor = null;
  do { const p = s.query({ owner, source: 'fixture:stage29b', asset: asset.id, kind: 'bar', from, to, readRevision, intervalMs, limit: 200, cursor }); all.push(...p.records); cursor = p.nextCursor; } while (cursor);
  return all;
}
const argsFor = (c, command, source, target) => ({ command, sourceName: c.name(source), targetName: c.name(target), owner });

test('stage29 B: >16MiB/WAL consistent snapshot, cross-year pinned reads, separate-process restore and identical research', async t => {
  const c = await context(t), path = join(c.folder, 'source.sqlite'), s = new ArchiveStore(path);
  // 首轮24000根仅15.31MiB；扩大合成样本以实际跨过16MiB，不降低验收断言。
  const count = 30000, end = start + count * interval, at = end + 1000;
  s.db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
  let open = true; t.after(() => { if (open) s.close(); });
  for (let i = 0; i < count; i += 2000) page(s, `batch-${i}`, Array.from({ length: 2000 }, (_, j) => bar(i + j)), { at });
  assert.throws(() => s.exportSnapshot(owner), /EXPORT_ROW_LIMIT/);
  assert.ok(statSync(path + '-wal').size > 0);
  const revision = s.db.prepare('SELECT revision FROM archive_meta').get().revision;
  const fixed = [start, Date.parse('2026-01-01T00:00:00Z'), Date.parse('2026-02-01T00:00:00Z'), Date.parse('2026-03-01T00:00:00Z'), end];
  const before = fixed.slice(0, -1).map((from, i) => pinned(s, from, fixed[i + 1], revision));
  assert.equal(before.reduce((n, rows) => n + rows.length, 0), count);
  const query = { owner, source: 'fixture:stage29b', asset: asset.id, intervalMs: interval, readRevision: revision, from: end - 900 * interval, to: end, exportedAt: at + 1000 };
  const p = await exportHistoryPackage(s, query), replay = replayHistory(p, end, p.exportedAt), research = researchHistory(p, end, p.exportedAt);
  assert.equal(research.status, 'available');
  const began = performance.now(), backup = await runSnapshot(argsFor(c, 'create', 'source.sqlite', 'backup'));
  assert.equal(backup.facts, count); assert.equal(backup.readRevision, revision);
  assert.ok(backup.bytes > 16 * 1024 ** 2, `fixture actual bytes ${backup.bytes}`);
  assert.ok(existsSync(join(c.folder, 'backup/snapshot.json')));
  const originalHash = backup.sha256;
  page(s, 'later-correction', [bar(23000, interval, 999)], { at });
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM archive_facts').get().n, count + 1);
  s.close(); open = false;
  const moduleUrl = new URL('../scripts/history-snapshot.mjs', import.meta.url).href;
  const code = `import{runSnapshot}from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify(await runSnapshot(JSON.parse(process.argv[1]))));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(argsFor(c, 'restore', 'backup', 'restored'))], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(child.status, 0, child.stderr + child.stdout);
  assert.equal(JSON.parse(child.stdout).collectionEnabled, 0);
  const restored = new ArchiveStore(join(c.folder, 'restored/archive.sqlite'));
  try {
    for (let i = 0; i < before.length; i++) assert.deepEqual(pinned(restored, fixed[i], fixed[i + 1], revision), before[i]);
    const q = await exportHistoryPackage(restored, query); assert.deepEqual(q, p);
    assert.deepEqual(replayHistory(q, end, q.exportedAt), replay); assert.deepEqual(researchHistory(q, end, q.exportedAt), research);
    assert.equal(restored.db.prepare('SELECT count(*) AS n FROM archive_facts').get().n, count);
  } finally { restored.close(); }
  const reopened = new ArchiveStore(join(c.folder, 'restored/archive.sqlite'));
  assert.equal(reopened.db.prepare('SELECT collection_enabled FROM archive_meta').get().collection_enabled, 0); reopened.close();
  assert.equal(JSON.parse(readFileSync(join(c.folder, 'backup/snapshot.json'))).sha256, originalHash);
  t.diagnostic(JSON.stringify({ identity: 'fixture', facts: count, backupBytes: backup.bytes, bytesPerFact: backup.bytes / count, snapshotRestoreAndChecksMs: performance.now() - began, revision, researchSamples: research.samples.length }));
});

test('stage29 B: restored interrupted run loses execution lease, retains checkpoint, counters and cooldown', async t => {
  const c = await context(t), s = new ArchiveStore(join(c.folder, 'source.sqlite'));
  const at = start + 86400000, records = [bar(0), bar(1)];
  page(s, 'pending', records, { at, next: 'page-2' });
  const lease = s.reserveRequest(owner, 'pending', at + 1); assert.equal(lease.ok, true);
  s.deferRetry(owner, 'pending', lease.leaseToken, at + 2000);
  const before = s.requireRun(owner, 'pending');
  await runSnapshot(argsFor(c, 'create', 'source.sqlite', 'backup')); s.close();
  await runSnapshot(argsFor(c, 'restore', 'backup', 'restored'));
  const d = new ArchiveStore(join(c.folder, 'restored/archive.sqlite'));
  try {
    const after = d.requireRun(owner, 'pending');
    for (const key of ['cursor','requests','bytes','pages','writes','retry_not_before','page_attempts']) assert.equal(after[key], before[key], key);
    assert.equal(after.status, 'paused'); assert.equal(after.lease_token, null); assert.equal(after.lease_until, null);
    assert.equal(d.reserveRequest(owner, 'pending', at + 1).ok, false);
    assert.throws(() => d.resumeRun(owner, 'pending', at + 1), /RETRY_NOT_BEFORE/);
    // fixture的显式操作员接续，不属于真实源启用；新reservation继续旧消耗，不复用租约。
    d.resumeRun(owner, 'pending', at + 2000);
    const next = d.reserveRequest(owner, 'pending', at + 2000);
    assert.equal(next.requestNumber, before.requests + 1); assert.notEqual(next.leaseToken, before.lease_token);
  } finally { d.close(); }
});

test('stage29 B: source-specific FED ledger and cooldown survive restore; collection stays blocked', async t => {
  const c = await context(t), s = new ArchiveStore(join(c.folder, 'fed.sqlite')), at = Date.parse('2026-09-23T00:00:00Z');
  s.createRun({ owner: FED.owner, runId: 'fed-fixture-run', source: FED.source, universeVersion: FED.universeVersion, assets: [FED.asset], from: FED.start, cutoff: at, createdAt: at, identity: 'reconstructed', limits: FED.limits });
  // 只模拟调度账本，没有网络、公告或真实采集结果。
  const r = s.reserveRequest(FED.owner, 'fed-fixture-run', at);
  s.deferRetry(FED.owner, 'fed-fixture-run', r.leaseToken, at + 3000);
  const before = s.db.prepare('SELECT * FROM archive_sources').get();
  await runSnapshot({ ...argsFor(c, 'create', 'fed.sqlite', 'backup'), owner: FED.owner }); s.close();
  await runSnapshot({ ...argsFor(c, 'restore', 'backup', 'restored'), owner: FED.owner });
  const d = new ArchiveStore(join(c.folder, 'restored/archive.sqlite'));
  try {
    const source = d.db.prepare('SELECT * FROM archive_sources').get();
    assert.equal(source.retry_not_before, before.retry_not_before); assert.equal(source.last_dispatch, before.last_dispatch); assert.equal(source.lease_token, null);
    d.resumeRun(FED.owner, 'fed-fixture-run', at + 3000);
    assert.equal(d.reserveRequest(FED.owner, 'fed-fixture-run', at + 3000).reason, 'collection_disabled');
    assert.equal(d.db.prepare('SELECT count(*) AS n FROM archive_source_requests').get().n, 1);
  } finally { d.close(); }
});

test('stage29 B audit: a lease ending at deadline is valid, but restore cannot extend the run', async t => {
  const c = await context(t), s = new ArchiveStore(join(c.folder, 'source.sqlite')), at = start + 86400000;
  page(s, 'deadline', [bar(0)], { at, next: 'page-2' });
  const deadline = at + s.requireRun(owner, 'deadline').config.limits.durationMs;
  const lease = s.reserveRequest(owner, 'deadline', deadline - 1);
  assert.equal(lease.ok, true); assert.equal(lease.leaseUntil, deadline);
  await runSnapshot(argsFor(c, 'create', 'source.sqlite', 'backup')); s.close();
  await runSnapshot(argsFor(c, 'restore', 'backup', 'restored'));
  const d = new ArchiveStore(join(c.folder, 'restored/archive.sqlite'));
  try {
    assert.equal(d.requireRun(owner, 'deadline').lease_until, null);
    assert.throws(() => d.resumeRun(owner, 'deadline', deadline), /RUN_DEADLINE/);
  } finally { d.close(); }
});

test('stage29 B audit: restore preserves per-page budget stops even below total budget', async t => {
  const c = await context(t), s = new ArchiveStore(join(c.folder, 'source.sqlite')), at = start + 86400000;
  page(s, 'budget', [bar(0)], { at, next: 'page-2' });
  const lease = s.reserveRequest(owner, 'budget', at + 1), limits = s.requireRun(owner, 'budget').config.limits;
  assert.equal(s.chargeBytes(owner, 'budget', limits.pageBytes + 1, lease.leaseToken), false);
  s.releaseRequest(owner, 'budget', lease.leaseToken);
  const before = s.requireRun(owner, 'budget'); assert.ok(before.bytes < limits.bytes);
  assert.throws(() => s.resumeRun(owner, 'budget', at + 2), /BUDGET_EXHAUSTED/);
  await runSnapshot(argsFor(c, 'create', 'source.sqlite', 'backup')); s.close();
  await runSnapshot(argsFor(c, 'restore', 'backup', 'restored'));
  const d = new ArchiveStore(join(c.folder, 'restored/archive.sqlite'));
  try {
    assert.equal(d.requireRun(owner, 'budget').reason, 'budget_bytes');
    assert.equal(d.requireRun(owner, 'budget').bytes, before.bytes);
    assert.throws(() => d.resumeRun(owner, 'budget', at + 2), /BUDGET_EXHAUSTED/);
    assert.equal(d.reserveRequest(owner, 'budget', at + 2).ok, false);
  } finally { d.close(); }
});

test('stage29 B audit: invalid checkpoint cursor and fingerprint are rejected independently', async t => {
  const c = await context(t), base = join(c.folder, 'base.sqlite'), s = new ArchiveStore(base);
  page(s, 'checkpoint', [bar(0)], { next: 'page-2' }); s.close();
  const cases = [
    { cursor: 'x'.repeat(501) }, { cursor: 'bad\nnext' },
    { fingerprint: 'x' }, { fingerprint: 'x'.repeat(63) + '\n' },
  ];
  for (const [i, change] of cases.entries()) {
    const source = `invalid-${i}.sqlite`; cpSync(base, join(c.folder, source));
    const d = new DatabaseSync(join(c.folder, source));
    if (change.cursor) {
      d.prepare('UPDATE archive_runs SET cursor=?').run(change.cursor);
      d.prepare('UPDATE archive_pages SET after_cursor=?').run(change.cursor);
    } else d.prepare('UPDATE archive_pages SET fingerprint=?').run(change.fingerprint);
    d.close();
    await assert.rejects(runSnapshot(argsFor(c, 'create', source, `rejected-${i}`)), /SNAPSHOT_RUN|SNAPSHOT_CHECKPOINT_FORMAT/);
    assert.equal(existsSync(join(c.folder, `rejected-${i}/snapshot.json`)), false);
  }
});

test('stage29 B audit: cancellation at the manifest commit boundary cannot report a committed result as failure', async t => {
  const c = await context(t), s = new ArchiveStore(join(c.folder, 'source.sqlite'));
  page(s, 'first', [bar(0)]); s.close();
  for (const command of ['create', 'restore']) {
    const controller = new AbortController(), target = command === 'create' ? 'backup' : 'restored';
    const manifest = command === 'create' ? 'snapshot.json' : 'restore.json';
    const operation = runSnapshot({ ...argsFor(c, command, command === 'create' ? 'source.sqlite' : 'backup', target), signal: controller.signal });
    let watcher, timer;
    const committed = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(Error('MANIFEST_EVENT_NOT_OBSERVED')), 10000);
      watcher = watch(join(c.folder, target), (_, name) => {
        if (name === manifest && existsSync(join(c.folder, target, manifest))) { controller.abort(); resolve(); }
      });
    });
    try {
      const [result] = await Promise.all([operation, committed]);
      assert.equal(result.facts, 1); assert.equal(controller.signal.aborted, true);
      assert.equal(existsSync(join(c.folder, target, manifest)), true);
    } finally { watcher?.close(); clearTimeout(timer); }
  }
});

test('stage29 B: rejection of mixed owner, unknown schema, corrupt manifest and recomputed-checksum unapproved source', async t => {
  const c = await context(t), path = join(c.folder, 'source.sqlite'), s = new ArchiveStore(path);
  page(s, 'first', [bar(0), bar(1)]); s.close();
  await assert.rejects(runSnapshot({ ...argsFor(c, 'create', 'source.sqlite', 'wrong-owner'), owner: 'other' }), /SINGLE_OWNER/);
  await runSnapshot(argsFor(c, 'create', 'source.sqlite', 'backup'));
  const copy = name => { cpSync(join(c.folder, 'backup'), join(c.folder, name), { recursive: true, errorOnExist: true }); };
  copy('bad-manifest'); const bad = join(c.folder, 'bad-manifest/snapshot.json'), m = JSON.parse(readFileSync(bad)); m.sha256 = '0'.repeat(64); writeFileSync(bad, JSON.stringify(m));
  await assert.rejects(runSnapshot(argsFor(c, 'restore', 'bad-manifest', 'bad-result')), /INVALID_SNAPSHOT/);
  copy('unapproved'); const file = join(c.folder, 'unapproved/archive.sqlite'), d = new DatabaseSync(file);
  const row = d.prepare('SELECT config FROM archive_runs').get(), config = JSON.parse(row.config); config.source = 'OKX'; config.identity = 'reconstructed';
  d.prepare('UPDATE archive_runs SET config=?').run(canonical(config)); d.close();
  const mp = join(c.folder, 'unapproved/snapshot.json'), mm = JSON.parse(readFileSync(mp)); mm.bytes = statSync(file).size; mm.sha256 = createHash('sha256').update(readFileSync(file)).digest('hex'); writeFileSync(mp, JSON.stringify(mm));
  await assert.rejects(runSnapshot(argsFor(c, 'restore', 'unapproved', 'unapproved-result')), /FIXTURE_SCOPE_REQUIRED/);
  const altered = new DatabaseSync(path); altered.exec('CREATE TABLE unexpected(secret TEXT)'); altered.close();
  await assert.rejects(runSnapshot(argsFor(c, 'create', 'source.sqlite', 'bad-schema')), /SCHEMA_MISMATCH/);
  assert.equal(existsSync(join(c.folder, 'bad-schema/snapshot.json')), false);
});

test('stage29 B: cancellation/deadline leave no committed artifact and retry never overwrites a target', async t => {
  const c = await context(t), s = new ArchiveStore(join(c.folder, 'source.sqlite')); page(s, 'first', [bar(0)]); s.close();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runSnapshot({ ...argsFor(c, 'create', 'source.sqlite', 'cancelled'), signal: controller.signal }), /CANCELLED/);
  assert.equal(existsSync(join(c.folder, 'cancelled')), false);
  await assert.rejects(runSnapshot({ ...argsFor(c, 'create', 'source.sqlite', 'partial'), timeoutMs: 1 }), /TIMEOUT/);
  assert.equal(existsSync(join(c.folder, 'partial/snapshot.json')), false);
  await assert.rejects(runSnapshot(argsFor(c, 'restore', 'partial', 'partial-restore')), /INCOMPLETE/);
  await assert.rejects(runSnapshot(argsFor(c, 'create', 'source.sqlite', 'partial')), /NEW_SNAPSHOT_TARGET/);
  await runSnapshot(argsFor(c, 'create', 'source.sqlite', 'retry-new'));
  await assert.rejects(runSnapshot(argsFor(c, 'restore', 'retry-new', 'retry-new/nested')), /TARGET_MUST_BE_SEPARATE/);
  await assert.rejects(runSnapshot({ ...argsFor(c, 'create', 'source.sqlite', 'escape'), targetName: '../outside' }), /PATH_OUTSIDE/);
  for (const timeoutMs of [0, -1, 120001]) await assert.rejects(runSnapshot({ ...argsFor(c, 'create', 'source.sqlite', 'invalid'), timeoutMs }), /INVALID_SNAPSHOT_ARGUMENT/);
});
