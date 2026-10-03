// 仅隔离fixture；不启动provider，不是正式名单或历史回补。
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ArchiveStore, canonical } from '../../collector/store.mjs';
import { localFile } from '../../scripts/history-local.mjs';
import { runSnapshot } from '../../scripts/history-snapshot.mjs';

export async function localHistoryFixture(t, { count = 900, end = Date.parse('2026-01-02T00:00:00Z'), second = false, receivedAt = Date.now() } = {}) {
  const root = localFile('stage29c-fixtures'); mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'case-')); t?.after(() => rmSync(dir, { recursive: true, force: true }));
  const owner = 'fixture-stage29c', source = 'fixture:history29c', interval = 300000, from = end - count * interval;
  const asset = { id: 'fixture:us:TEST:C29-USD', market: 'us', venue: 'TEST', providerId: 'fixture:C29', currency: 'USD', adjustment: 'raw', role: 'asset' };
  const records = Array.from({ length: count }, (_, i) => { const close = 100 * 1.0002 ** i; return { asset: asset.id, kind: 'bar', occurredAt: from + i * interval, payload: { intervalMs: interval, currency: 'USD', adjustment: 'raw', open: close, high: close + .01, low: close - .01, close, volume: null, complete: true, sessionEvidence: 'fixture_only' } }; });
  const store = new ArchiveStore(join(dir, 'source.sqlite'));
  const add = (rows, a, suffix) => {
    for (let i = 0; i < rows.length; i += 2000) {
      const batch = rows.slice(i, i + 2000), runId = `${suffix}-${i}`;
      store.createRun({ owner, source, runId, universeVersion: 'fixture-c-v1', assets: [a], from: batch[0].occurredAt, cutoff: batch.at(-1).occurredAt + batch.at(-1).payload.intervalMs, createdAt: receivedAt, identity: 'fixture', limits: {} });
      const lease = store.reserveRequest(owner, runId, receivedAt);
      store.chargeBytes(owner, runId, Buffer.byteLength(canonical(batch)), lease.leaseToken);
      store.commitPage(owner, runId, { expectedCursor: null, nextCursor: null, records: batch, receivedAt, traversalDone: true, leaseToken: lease.leaseToken });
    }
  };
  try {
    add(records, asset, 'main');
    if (second) {
      add(records.filter(r => r.occurredAt % 900000 === 0 && r.occurredAt + 900000 <= end).map(r => ({ ...r, payload: { ...r.payload, intervalMs: 900000 } })), asset, '15m');
      const other = { ...asset, id: 'fixture:us:TEST:OTHER-USD', providerId: 'fixture:OTHER' };
      add(records.slice(-22).map(r => ({ ...r, asset: other.id })), other, 'other');
    }
  } finally { store.close(); }
  const isolatedRoot = localFile('anchor').slice(0, -'anchor'.length), name = suffix => relative(isolatedRoot, join(dir, suffix));
  await runSnapshot({ command: 'create', sourceName: name('source.sqlite'), owner, targetName: name('snapshot') });
  return { dir, name, owner, source, asset, records, from, end, interval, snapshot: join(dir, 'snapshot') };
}
