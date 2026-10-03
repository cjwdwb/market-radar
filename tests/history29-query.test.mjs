// Stage A前置查询验证：全部为合成fixture，无真实行情或来源许可声明。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ArchiveStore, canonical, digest } from '../collector/store.mjs';
import { exportHistoryPackage } from '../scripts/history-package.mjs';
import { replayHistory, researchHistory } from '../lib/history/replay.ts';

const start = Date.parse('2026-07-01T00:00:00Z'), cutoff = start + 86400000, received = cutoff + 1000;
const asset = { id: 'fixture:CRYPTO:TEST:AAA-USDT:SPOT', market: 'crypto', venue: 'TEST', providerId: 'fixture:AAA-USDT', currency: 'USDT', adjustment: 'raw', role: 'asset' };
const query = (extra = {}) => ({ owner: 'fixture-owner', source: 'fixture:stage29', asset: asset.id, kind: 'bar', from: start, to: cutoff, ...extra });
const bar = (i, intervalMs = 300000, close = 100 * 1.0002 ** i) => ({ asset: asset.id, kind: 'bar', occurredAt: start + i * intervalMs,
  payload: { intervalMs, currency: 'USDT', adjustment: 'raw', open: close, high: close + .01, low: close - .01, close, volume: null, complete: true, sessionEvidence: 'fixture_only' } });
function commit(store, runId, records) {
  store.createRun({ owner: 'fixture-owner', runId, source: 'fixture:stage29', universeVersion: 'fixture-v1', assets: [asset], from: start, cutoff, createdAt: received, identity: 'fixture', limits: {} });
  const lease = store.reserveRequest('fixture-owner', runId, received);
  assert.equal(lease.ok, true);
  store.chargeBytes('fixture-owner', runId, Buffer.byteLength(canonical(records)), lease.leaseToken);
  return store.commitPage('fixture-owner', runId, { expectedCursor: null, nextCursor: null, records, receivedAt: received, traversalDone: true, leaseToken: lease.leaseToken });
}
function memory(t) { const store = new ArchiveStore(); t.after(() => store.close()); return store; }
function collect(store, args) {
  const rows = []; let cursor = null;
  do { const page = store.query({ ...args, cursor }); rows.push(...page.records); cursor = page.nextCursor; } while (cursor);
  return rows;
}

test('stage29 query: same asset/open time has separate 5m and 15m series with bounded pages', t => {
  const s = memory(t);
  commit(s, 'mixed', [...Array.from({ length: 240 }, (_, i) => bar(i)), ...Array.from({ length: 80 }, (_, i) => bar(i, 900000, 200 + i))]);
  assert.equal(s.query(query({ limit: 200 })).records.length, 200);
  for (const [intervalMs, count] of [[300000, 240], [900000, 80]]) {
    const rows = collect(s, query({ intervalMs, limit: 37 }));
    assert.equal(rows.length, count);
    assert.ok(rows.every(row => row.payload.intervalMs === intervalMs && row.identity === 'fixture'));
    assert.equal(new Set(rows.map(row => row.occurred_at)).size, count);
    assert.equal(rows[0].occurred_at, start);
  }
  assert.equal(collect(s, query()).length, 320); // 旧缺省仍返回全部，导出负责拒绝混周期。
  assert.equal(s.query(query({ intervalMs: 300000, owner: 'another-owner' })).records.length, 0);
});

test('stage29 query: explicit revisions reproduce A/B/A after newer facts are committed', t => {
  const s = memory(t);
  commit(s, 'a', [bar(0), bar(1)]);
  commit(s, 'b', [bar(0, 300000, 110)]);
  commit(s, 'a-again', [bar(0)]);
  for (const [readRevision, expected] of [[1, 100], [2, 110], [3, 100]]) {
    const p = s.query(query({ intervalMs: 300000, readRevision }));
    assert.equal(p.readRevision, readRevision);
    assert.equal(p.records[0].payload.close, expected);
    assert.equal(p.records[1].revision, 1);
  }
  const empty = s.query(query({ readRevision: 0 }));
  assert.equal(empty.readRevision, 0); assert.deepEqual(empty.records, []);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM archive_facts').get().n, 4);
});

test('stage29 query: period and revision cannot change within pagination, omitted revision follows cursor', t => {
  const s = memory(t);
  commit(s, 'first', [bar(0), bar(1), bar(2), bar(0, 900000)]);
  const args = query({ intervalMs: 300000, readRevision: 1, limit: 1 });
  const first = s.query(args);
  commit(s, 'new', [bar(1, 300000, 140)]);
  const second = s.query({ ...args, cursor: first.nextCursor, readRevision: undefined });
  assert.equal(second.readRevision, 1); assert.equal(second.records[0].payload.close, bar(1).payload.close);
  assert.deepEqual(second, s.query({ ...args, cursor: first.nextCursor }));
  for (const patch of [{ intervalMs: 900000 }, { intervalMs: undefined }, { readRevision: 2 }, { owner: 'other' }, { source: 'fixture:other' }, { asset: 'fixture:other' }]) {
    assert.throws(() => s.query({ ...args, cursor: first.nextCursor, ...patch }), /INVALID_CURSOR/);
  }
});

test('stage29 query: original cursor encoding and latest-default behavior stay compatible', t => {
  const s = memory(t); commit(s, 'first', [bar(0), bar(1), bar(2)]);
  const args = query({ limit: 1 });
  const first = s.query(args), row = first.records[0];
  const oldCursor = Buffer.from(canonical({ revision: 1, afterTime: row.sort_at, afterId: row.id, signature: digest(args) })).toString('base64url');
  assert.equal(first.nextCursor, oldCursor);
  commit(s, 'new', [bar(1, 300000, 130)]);
  assert.equal(s.query({ ...args, cursor: oldCursor }).records[0].payload.close, bar(1).payload.close);
  assert.equal(s.query(query()).records[1].payload.close, 130);
  assert.equal(s.query({ ...args, cursor: oldCursor, readRevision: 1 }).readRevision, 1);
});

test('stage29 query: invalid interval/version and old size/date bounds fail explicitly', t => {
  const s = memory(t); commit(s, 'first', [bar(0)]);
  for (const intervalMs of [null, 60000, 3600000, '300000', 0, NaN]) assert.throws(() => s.query(query({ intervalMs })), /INVALID_QUERY_INTERVAL/);
  assert.throws(() => s.query(query({ kind: 'information', intervalMs: 300000 })), /INVALID_QUERY_INTERVAL/);
  for (const readRevision of [null, -1, 2, .5, '1', Infinity, NaN]) assert.throws(() => s.query(query({ readRevision })), /INVALID_READ_REVISION/);
  assert.equal(s.query(query({ to: start + 31 * 86400000, limit: 200 })).records.length, 1);
  for (const patch of [{ limit: 201 }, { to: start + 31 * 86400000 + 1 }]) assert.throws(() => s.query(query(patch)), /INVALID_QUERY/);
});

test('stage29 export: selected interval and pinned revision survive pagination without changing v1', async t => {
  const s = memory(t);
  commit(s, 'mixed', [...Array.from({ length: 240 }, (_, i) => bar(i)), ...Array.from({ length: 80 }, (_, i) => bar(i, 900000, 200 + i))]);
  commit(s, 'correction', [bar(220, 300000, 120)]);
  const args = { ...query(), exportedAt: received + 1000, readRevision: 1 };
  await assert.rejects(exportHistoryPackage(s, args), /MIXED_ASSET_OR_INTERVAL/);
  for (const [intervalMs, expected] of [[300000, 240], [900000, 80]]) {
    const p = await exportHistoryPackage(s, { ...args, intervalMs });
    assert.equal(p.bars.length, expected); assert.equal(p.intervalMs, intervalMs); assert.equal(p.readRevision, 1);
    assert.equal(p.identity, 'fixture'); assert.equal(p.format, 'history-package-v1');
    assert.ok(p.bars.every(b => b.version === 1));
    if (intervalMs === 300000) assert.equal(p.bars[220].close, bar(220).payload.close);
  }
  await assert.rejects(exportHistoryPackage(s, { ...args, source: 'OKX', intervalMs: 300000 }), /PRICE_SOURCE_NOT_APPROVED/);
});

test('stage29 restore: separate process restores old version, then another process repeats query/replay/research', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'mr29-fixture-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const original = join(folder, 'original.sqlite'), restored = join(folder, 'restored.sqlite'), backup = join(folder, 'backup.json');
  const s = new ArchiveStore(original);
  const args = { ...query({ intervalMs: 300000, readRevision: 1 }), exportedAt: received + 1000 };
  let expected;
  try {
    commit(s, 'first', Array.from({ length: 240 }, (_, i) => bar(i)));
    commit(s, 'new', [bar(220, 300000, 130)]);
    const p = await exportHistoryPackage(s, args), at = p.bars.at(-1).time + p.intervalMs;
    expected = { p, replay: replayHistory(p, at, p.exportedAt), research: researchHistory(p, at, p.exportedAt) };
    writeFileSync(backup, s.exportSnapshot('fixture-owner'));
  } finally { s.close(); }
  const storeUrl = new URL('../collector/store.mjs', import.meta.url).href;
  const restore = `import{ArchiveStore}from ${JSON.stringify(storeUrl)};import{readFileSync}from'node:fs';const s=new ArchiveStore(process.argv[1]);s.restoreSnapshot(readFileSync(process.argv[2],'utf8'));console.log(s.db.prepare('SELECT collection_enabled FROM archive_meta').get().collection_enabled);s.close();`;
  const first = spawnSync(process.execPath, ['--input-type=module', '-e', restore, restored, backup], { encoding: 'utf8', windowsHide: true });
  assert.equal(first.status, 0, first.stderr); assert.equal(first.stdout.trim(), '0');
  const read = `import{ArchiveStore}from ${JSON.stringify(storeUrl)};import{exportHistoryPackage}from ${JSON.stringify(new URL('../scripts/history-package.mjs', import.meta.url).href)};import{replayHistory,researchHistory}from ${JSON.stringify(new URL('../lib/history/replay.ts', import.meta.url).href)};const s=new ArchiveStore(process.argv[1]);const p=await exportHistoryPackage(s,JSON.parse(process.argv[2]));const at=p.bars.at(-1).time+p.intervalMs;console.log(JSON.stringify({p,replay:replayHistory(p,at,p.exportedAt),research:researchHistory(p,at,p.exportedAt)}));s.close();`;
  const second = spawnSync(process.execPath, ['--experimental-strip-types', '--import', new URL('./register-types.mjs', import.meta.url).href, '--input-type=module', '-e', read, restored, JSON.stringify(args)], { encoding: 'utf8', windowsHide: true, maxBuffer: 2 * 1024 ** 2 });
  assert.equal(second.status, 0, second.stderr); assert.deepEqual(JSON.parse(second.stdout), expected);
});
