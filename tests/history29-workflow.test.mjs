import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { localHistoryFixture } from './fixtures/history29-local.mjs';
import { ArchiveQueryService } from '../collector/query-service.mjs';
import { ResearchJournal } from '../collector/research-journal.mjs';
import { researchHistory as original } from './fixtures/history-research-reference-v1.ts';
import { historyNavigation } from '../lib/history/query.ts';

const selection = (s, f) => ({ snapshot: s.catalog.snapshot, series: s.series.find(x => x.asset.id === f.asset.id && x.intervalMs === f.interval).key, from: f.from, to: f.end, asOf: f.end });

test('stage29 C query: fixed cross-month/year snapshot, series isolation and global paged research', async t => {
  const f = await localHistoryFixture(t, { count: 9500, second: true }), service = new ArchiveQueryService(f.snapshot, f.owner);
  try {
    assert.equal(service.series.length, 3);
    const q = selection(service, f), rows = []; let cursor = null;
    do { const p = service.pricePage(q, cursor); rows.push(...p.records); cursor = p.nextCursor; } while (cursor);
    assert.equal(rows.length, 9500); assert.equal(new Set(rows.map(r => r.time)).size, 9500);
    const { p } = service.replay(q), expected = original({ ...p, bars: rows }, q.asOf, service.catalog.createdAt + 10);
    for (const pageSize of [7, 200]) {
      service.now = () => service.catalog.createdAt + 10;
      const actual = await service.analyze(q, { pageSize });
      assert.equal(actual.scan.status, 'complete'); assert.equal(actual.scan.rows, 9500);
      assert.deepEqual(actual.research, expected);
      assert.equal(actual.prices.records.length, 100); assert.equal(actual.displayedAt, f.end);
      assert.ok(actual.input.bars.length <= 37);
    }
    const first = service.pricePage(q), changed = { ...q, series: service.series.find(s => s.intervalMs === 900000).key };
    assert.throws(() => service.pricePage(changed, first.nextCursor), /INVALID_PRICE_CURSOR/);
    assert.throws(() => service.selection({ ...q, snapshot: '0'.repeat(64) }), /SNAPSHOT_MISMATCH/);
    const writer = new DatabaseSync(join(f.snapshot, 'archive.sqlite')); writer.exec('PRAGMA busy_timeout=5;');
    assert.throws(() => writer.exec('UPDATE archive_facts SET payload=payload'), /locked/); writer.close();
    assert.deepEqual(service.pricePage(q), first);
  } finally { service.close(); }
});

test('stage29 C navigation: complete points independent of research eligibility, no silent nearest endpoint', async t => {
  const f = await localHistoryFixture(t, { count: 22 }), service = new ArchiveQueryService(f.snapshot, f.owner);
  try {
    const q = selection(service, f), valid = await service.analyze(q);
    assert.equal(valid.replay.horizons[0].reason, null); assert.equal(valid.replay.horizons[1].reason, 'insufficient_contiguous_bars');
    assert.equal(valid.research.status, 'insufficient');
    const missing = await service.analyze({ ...q, asOf: f.end - 1 });
    assert.equal(missing.requestedAt, f.end - 1); assert.equal(missing.displayedAt, null);
    assert.equal(missing.navigation.suggested, f.end - f.interval); assert.ok(missing.prices.records.length);
    assert.equal(missing.replay.horizons[0].reason, 'missing_endpoint');
    assert.deepEqual(historyNavigation(valid.input.bars, f.interval, f.end - 1), missing.navigation);
    const before = service.navigation({ ...q, asOf: f.from });
    assert.equal(before.previous, null); assert.equal(before.suggested, null); assert.equal(before.next, f.from + f.interval);
    assert.equal(historyNavigation(valid.input.bars, f.interval, f.from).suggested, null);
  } finally { service.close(); }
});

test('stage29 C query: partial budget does not claim all-range statistics; cancellation keeps service usable', async t => {
  const f = await localHistoryFixture(t), service = new ArchiveQueryService(f.snapshot, f.owner, { limits: { rows: 100 } });
  try {
    const q = selection(service, f), partial = await service.analyze(q);
    assert.equal(partial.scan.status, 'partial'); assert.equal(partial.scan.rows, 100); assert.ok(partial.scan.checkedTo < q.asOf);
    assert.equal(partial.research.status, 'partial'); assert.equal(partial.research.statistics, null);
    const controller = new AbortController(), originalChunk = service.chunk.bind(service); let reads = 0;
    service.chunk = (...args) => { const p = originalChunk(...args); if (++reads === 2) controller.abort(); return p; };
    await assert.rejects(service.analyze(q, { signal: controller.signal, pageSize: 7 }), /QUERY_CANCELLED/);
    service.chunk = originalChunk; assert.ok(service.pricePage(q).records.length);
  } finally { service.close(); }
});

test('stage29 C time: snapshot cannot admit future receivedAt via bypassing the file package validator', async t => {
  const f = await localHistoryFixture(t, { count: 22, receivedAt: Date.now() + 86400000 });
  assert.throws(() => new ArchiveQueryService(f.snapshot, f.owner), /SNAPSHOT_FUTURE_RECEIPT/);
});

test('stage29 C outcome: actual SQLite outcome reader requires exact continuous endpoints and source identity', async t => {
  const f = await localHistoryFixture(t), service = new ArchiveQueryService(f.snapshot, f.owner);
  try {
    // 仅隔离结果读取器输入，不把今天构造的历史时点宣称为过去登记的前瞻。
    const record = { series: service.series[0], inputCutoff: f.end - 1800000, targetEnd: f.end };
    const result = service.outcome(record, Date.now());
    assert.equal(result.status, 'available'); assert.equal(result.startPrice, f.records.at(-7).payload.close); assert.equal(result.endPrice, f.records.at(-1).payload.close);
    assert.equal(result.returnPercent, (result.endPrice / result.startPrice - 1) * 100);
    assert.equal(result.snapshot, service.catalog.snapshot); assert.ok(result.versionReceivedAt <= Date.now());
    assert.equal(service.outcome({ ...record, inputCutoff: record.inputCutoff - 1 }, Date.now()).status, 'unavailable');
    assert.equal(service.outcome({ ...record, series: { ...record.series, source: 'fixture:another-source' } }, Date.now()).reason, 'series_unavailable');
    assert.throws(() => service.outcome(record, record.targetEnd - 1), /OUTCOME_NOT_MATURE/);
  } finally { service.close(); }
});

test('stage29 C journal: immutable history, idempotency, linked correction and reopen', async t => {
  const f = await localHistoryFixture(t), service = new ArchiveQueryService(f.snapshot, f.owner), path = join(f.dir, 'research.sqlite');
  let journal = new ResearchJournal(path, f.owner);
  try {
    const analysis = await service.analyze(selection(service, f)), now = Date.now();
    const request = { requestKey: 'history-1', mode: 'historical', question: '模拟历史的30分钟样本分布', analysis, service };
    assert.throws(() => journal.register({ ...request, service: { owner: 'other', catalog: service.catalog } }, now), /REGISTRATION_SCOPE_MISMATCH/);
    assert.throws(() => journal.register({ ...request, service: { owner: f.owner, catalog: { snapshot: 'other' } } }, now), /REGISTRATION_SCOPE_MISMATCH/);
    const first = journal.register(request, now); assert.equal(first.identity, 'fixture_historical_simulation');
    assert.deepEqual(journal.register(request, now + 1), first);
    assert.throws(() => journal.register({ ...request, question: 'another' }, now + 1), /IDEMPOTENCY_CONFLICT/);
    assert.throws(() => journal.db.exec("UPDATE research_records SET body='{}'"), /APPEND_ONLY/);
    assert.throws(() => journal.db.exec('DELETE FROM research_records'), /APPEND_ONLY/);
    const second = journal.register({ ...request, requestKey: 'history-2', correctionOf: first.id, question: '关联修订问题' }, now + 1);
    assert.equal(second.correctionOf, first.id); assert.deepEqual(journal.get(first.id), first);
    journal.close(); journal = new ResearchJournal(path, f.owner); assert.equal(journal.list().records.length, 2);
    assert.deepEqual(journal.get(first.id), first);
    assert.throws(() => new ResearchJournal(path, 'different-owner'), /JOURNAL_IDENTITY/);
    assert.throws(() => journal.register({ ...request, requestKey: 'bad', mode: 'observed_live' }, now), /INVALID_REGISTRATION/);
  } finally { journal.close(); service.close(); }
});

test('stage29 C journal: genuine registration clock, pending then unavailable/available append without rewriting', async t => {
  const end = Math.floor(Date.now() / 300000) * 300000, f = await localHistoryFixture(t, { end }), service = new ArchiveQueryService(f.snapshot, f.owner), journal = new ResearchJournal(join(f.dir, 'journal.sqlite'), f.owner);
  try {
    const analysis = await service.analyze(selection(service, f)), now = Date.now();
    const request = { requestKey: 'future-1', mode: 'prospective', question: '模拟观察未来30分钟区间变化', analysis, service };
    const record = journal.register(request, now), originalRecord = journal.get(record.id);
    assert.equal(record.identity, 'fixture_prospective'); assert.equal(record.registeredAt, now);
    assert.equal(journal.evaluate(record.id, service, now).status, 'pending');
    assert.equal(journal.db.prepare('SELECT count(*) AS n FROM research_outcomes').get().n, 0);
    // 到期用显式模拟时钟，仅验证机制；旧快照不能长出尚未发生的真实终点。
    const unavailable = journal.evaluate(record.id, service, record.targetEnd);
    assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.returnPercent, null);
    assert.deepEqual(journal.evaluate(record.id, service, record.targetEnd + 1), unavailable);
    // 隔离领域stub模拟已获准新结果快照，不是实际成熟的市场记录。
    const later = { owner: f.owner, outcome: () => ({ status: 'available', reason: null, snapshot: 'fixture-later-version', startPrice: 100, endPrice: 101, returnPercent: 1, versionReceivedAt: record.targetEnd + 2 }) };
    assert.throws(() => journal.evaluate(record.id, { ...later, owner: 'another-owner' }, record.targetEnd + 3), /OUTCOME_OWNER_MISMATCH/);
    const available = journal.evaluate(record.id, later, record.targetEnd + 3); assert.equal(available.status, 'available');
    assert.equal(journal.db.prepare('SELECT count(*) AS n FROM research_outcomes').get().n, 2); assert.deepEqual(journal.get(record.id), originalRecord);
    assert.throws(() => journal.db.exec('UPDATE research_outcomes SET evaluated_at=1'), /APPEND_ONLY/);
    assert.throws(() => journal.register({ ...request, requestKey: 'too-late' }, record.targetEnd), /PROSPECTIVE_INPUT_UNAVAILABLE/);
    const bad = structuredClone(analysis); bad.input.bars[0].receivedAt = now + 1;
    assert.throws(() => journal.register({ ...request, requestKey: 'future-receipt', analysis: bad }, now), /INVALID_REGISTRATION_INPUT/);
  } finally { journal.close(); service.close(); }
});
