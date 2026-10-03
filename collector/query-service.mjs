// 本地只读固定快照；没有provider、采集或实时snapshot写入。
import { setImmediate as yieldPage } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { ArchiveStore, canonical, digest } from './store.mjs';
import { openQuerySnapshot } from './snapshot.mjs';
import { createResearchScan, replayHistory } from '../lib/history/replay.ts';

const DAY = 86400000, SEGMENT = 31 * DAY;
export const QUERY_LIMITS = Object.freeze({ years: 10, rows: 120000, pages: 3000, ms: 20000, series: 100 });
const fail = reason => { throw Error(reason); };
const int = (n, min = 1, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const keys = (o, expected) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join(' ') === expected.split(' ').sort().join(' ');
const latest = `NOT EXISTS(SELECT 1 FROM archive_facts n WHERE n.owner=f.owner AND n.source=f.source AND n.asset=f.asset AND n.kind=f.kind AND n.logical_key=f.logical_key AND (n.revision>f.revision OR n.revision=f.revision AND n.id>f.id))`;

export class ArchiveQueryService {
  constructor(folder, owner, { limits = {}, now = Date.now } = {}) {
    this.handle = openQuerySnapshot(folder, owner); this.owner = owner; this.now = now;
    this.limits = { ...QUERY_LIMITS, ...limits };
    for (const k of Object.keys(this.limits)) if (!int(this.limits[k], 1, QUERY_LIMITS[k])) { this.handle.close(); fail('INVALID_QUERY_BUDGET'); }
    this.store = Object.create(ArchiveStore.prototype); this.store.db = this.handle.db;
    const { db, manifest: m } = this.handle;
    try {
      const rows = db.prepare(`SELECT f.source,f.asset,json_extract(f.payload,'$.intervalMs') AS interval,
        min(f.occurred_at) AS firstOpenAt,max(f.occurred_at)+json_extract(f.payload,'$.intervalMs') AS lastCloseAt,count(*) AS records
        FROM archive_facts f WHERE f.owner=? AND f.kind='bar' AND ${latest} GROUP BY f.source,f.asset,interval LIMIT ?`).all(owner, this.limits.series + 1);
      if (rows.length > this.limits.series) fail('SERIES_LIMIT');
      this.series = rows.map(row => {
        if (!row.source.startsWith('fixture:') || ![300000, 900000].includes(row.interval)) fail('PRICE_SOURCE_NOT_APPROVED');
        const config = JSON.parse(db.prepare('SELECT r.config FROM archive_runs r JOIN archive_facts f ON f.owner=r.owner AND f.run_id=r.run_id WHERE f.owner=? AND f.source=? AND f.asset=? LIMIT 1').get(owner, row.source, row.asset).config);
        const a = config.assets.find(a => a.id === row.asset), asset = Object.fromEntries(['id','market','venue','providerId','currency','adjustment'].map(k => [k, a[k]]));
        return { key: digest([row.source, asset, row.interval, 'fixture_only']), source: row.source, asset, intervalMs: row.interval, firstOpenAt: row.firstOpenAt, lastCloseAt: row.lastCloseAt, records: row.records, identity: 'fixture', coverage: 'not_verified' };
      });
      this.catalog = { format: 'archive-catalog-v1', snapshot: m.sha256, readRevision: m.readRevision, createdAt: m.createdAt, series: this.series, limitation: '仅当前快照的模拟价格；首尾及条数不证明市场完整覆盖。日线/小时及真实价格尚未准入。' };
    } catch (e) { this.handle.close(); throw e; }
  }
  close() { this.handle.close(); }
  selection(q) {
    if (!keys(q, 'snapshot series from to asOf') || q.snapshot !== this.catalog.snapshot) fail('SNAPSHOT_MISMATCH');
    const series = this.series.find(s => s.key === q.series);
    if (!series || !int(q.from) || !int(q.to, q.from + 1, this.handle.manifest.createdAt) || q.to - q.from > this.limits.years * 366 * DAY || !int(q.asOf, q.from, q.to)) fail('INVALID_ARCHIVE_SELECTION');
    return series;
  }
  row(row) {
    const { intervalMs, open, high, low, close, volume } = row.payload;
    if (row.identity !== 'fixture' || row.occurred_at + intervalMs > row.received_at || row.received_at > this.catalog.createdAt) fail('INVALID_ARCHIVE_TIME');
    const first = this.handle.db.prepare('SELECT min(received_at) AS at FROM archive_facts WHERE owner=? AND source=? AND asset=? AND kind=? AND logical_key=?').get(this.owner, row.source, row.asset, row.kind, row.logical_key).at;
    return { time: row.occurred_at, open, high, low, close, volume, version: row.revision, receivedAt: row.received_at, firstReceivedAt: first };
  }
  chunk(series, from, to, limit = 200, cursor = null) {
    return this.store.query({ owner: this.owner, source: series.source, asset: series.asset.id, kind: 'bar', from, to, intervalMs: series.intervalMs, readRevision: this.catalog.readRevision, limit, cursor });
  }
  navigation(q) {
    const s = this.selection(q), { db } = this.handle;
    const row = db.prepare(`SELECT max(CASE WHEN f.occurred_at+?<? THEN f.occurred_at+? END) AS previous,
      min(CASE WHEN f.occurred_at+?>? THEN f.occurred_at+? END) AS next,
      max(CASE WHEN f.occurred_at+?=? THEN f.occurred_at+? END) AS displayedAt
      FROM archive_facts f WHERE f.owner=? AND f.source=? AND f.asset=? AND f.kind='bar'
      AND json_extract(f.payload,'$.intervalMs')=? AND f.occurred_at>=? AND f.occurred_at+?<=? AND ${latest}`)
      .get(s.intervalMs,q.asOf,s.intervalMs,s.intervalMs,q.asOf,s.intervalMs,s.intervalMs,q.asOf,s.intervalMs,this.owner,s.source,s.asset.id,s.intervalMs,q.from,s.intervalMs,q.to);
    return { ...row, suggested: row.displayedAt === null ? row.previous : null };
  }
  pricePage(q, cursor = null) {
    const s = this.selection(q), signature = digest(q);
    let p = { from: q.from, cursor: null, signature };
    if (cursor !== null) {
      if (typeof cursor !== 'string' || cursor.length > 6000) fail('INVALID_PRICE_CURSOR');
      try { p = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { fail('INVALID_PRICE_CURSOR'); }
      if (!keys(p, 'from cursor signature') || p.signature !== signature || !int(p.from, q.from, q.to - 1) || (p.from - q.from) % SEGMENT || !(p.cursor === null || typeof p.cursor === 'string')) fail('INVALID_PRICE_CURSOR');
    }
    // 一次只读一个有界月段；空段也显式返回下一游标，不在浏览器保留全库。
    const to = Math.min(q.to, p.from + SEGMENT), page = this.chunk(s, p.from, to, 100, p.cursor);
    const records = page.records.filter(r => r.occurred_at + s.intervalMs <= q.to).map(r => this.row(r));
    const next = page.nextCursor ? { ...p, cursor: page.nextCursor } : to < q.to ? { ...p, from: to, cursor: null } : null;
    return { records, nextCursor: next ? Buffer.from(canonical(next)).toString('base64url') : null };
  }
  replay(q) {
    const s = this.selection(q), from = Math.max(q.from, q.asOf - 37 * s.intervalMs);
    const records = q.asOf > from ? this.chunk(s, from, q.asOf, 100).records.filter(r => r.occurred_at + s.intervalMs <= q.asOf).map(r => this.row(r)) : [];
    const digestValue = digest({ snapshot: q.snapshot, series: q.series, from: q.from, to: q.to });
    const p = { format: 'history-package-v1', identity: 'fixture', vintage: 'current_vintage', source: s.source, asset: s.asset, intervalMs: s.intervalMs,
      sessionEvidence: 'fixture_only', readRevision: this.catalog.readRevision, range: { from: q.from, cutoff: q.to }, exportedAt: this.catalog.createdAt, coverage: 'not_verified', bars: records, digest: digestValue };
    const calculatedAt = this.now();
    if (calculatedAt < this.catalog.createdAt) fail('INVALID_SERVER_TIME');
    return { p, replay: replayHistory(p, q.asOf, calculatedAt), calculatedAt };
  }
  outcome(record, now) {
    const s = this.series.find(s => s.key === record.series.key);
    const base = { snapshot: this.catalog.snapshot, readRevision: this.catalog.readRevision, snapshotCreatedAt: this.catalog.createdAt, sourcePublishedAt: null, publicationPrecision: 'unknown', method: 'exact-contiguous-close-simple-return-30m', startPrice: null, endPrice: null, returnPercent: null, firstReceivedAt: null, versionReceivedAt: null };
    const unavailable = reason => ({ ...base, status: 'unavailable', reason });
    if (!s || canonical(s.asset) !== canonical(record.series.asset) || s.source !== record.series.source) return unavailable('series_unavailable');
    if (record.targetEnd > now || this.catalog.createdAt > now) fail('OUTCOME_NOT_MATURE');
    if (record.targetEnd > this.catalog.createdAt) return unavailable('snapshot_before_target');
    const bars = this.chunk(s, record.inputCutoff - s.intervalMs, record.targetEnd, 100).records.map(r => this.row(r));
    if (bars.length !== 30 * 60000 / s.intervalMs + 1 || bars[0]?.time + s.intervalMs !== record.inputCutoff || bars.at(-1)?.time + s.intervalMs !== record.targetEnd || bars.some((b, i) => b.receivedAt > now || i > 0 && b.time !== bars[i - 1].time + s.intervalMs)) return unavailable('missing_contiguous_outcome');
    const startPrice = bars[0].close, endPrice = bars.at(-1).close, returnPercent = (endPrice / startPrice - 1) * 100;
    if (!Number.isFinite(returnPercent)) return unavailable('invalid_numeric');
    return { ...base, status: 'available', reason: null, startPrice, endPrice, returnPercent, firstReceivedAt: Math.min(...bars.map(b => b.firstReceivedAt)), versionReceivedAt: Math.max(...bars.map(b => b.receivedAt)) };
  }
  async analyze(q, { signal, pageSize = 200 } = {}) {
    const s = this.selection(q);
    if (!int(pageSize, 1, 200)) fail('INVALID_PAGE_SIZE');
    const { p, replay, calculatedAt } = this.replay(q), started = performance.now();
    const scan = { status: 'complete', reason: null, requestedFrom: q.from, requestedTo: q.asOf, checkedTo: q.from, rows: 0, pages: 0, elapsedMs: 0, gapCount: 0, gaps: [] };
    let previousCloseAt = null;
    const core = createResearchScan(p, q.asOf, calculatedAt);
    if (replay.horizons[0].direction?.availability !== 'available' || replay.horizons[0].volatility?.availability !== 'available') { scan.status = 'not_run'; scan.reason = 'query_unavailable'; }
    outer: if (scan.status === 'complete') for (let from = q.from; from < q.asOf; from += SEGMENT) {
      const to = Math.min(q.asOf, from + SEGMENT); let cursor = null;
      do {
        if (signal?.aborted) fail('QUERY_CANCELLED');
        if (scan.pages >= this.limits.pages || performance.now() - started >= this.limits.ms) { scan.status = 'partial'; scan.reason = scan.pages >= this.limits.pages ? 'page_budget' : 'time_budget'; break outer; }
        const page = this.chunk(s, from, to, pageSize, cursor); scan.pages++;
        for (const row of page.records) {
          if (row.occurred_at + s.intervalMs > q.asOf) continue;
          if (scan.rows >= this.limits.rows) { scan.status = 'partial'; scan.reason = 'row_budget'; break outer; }
          if (previousCloseAt !== null && row.occurred_at > previousCloseAt) { scan.gapCount++; if (scan.gaps.length < 10) scan.gaps.push({ from: previousCloseAt, to: row.occurred_at }); }
          core.push(this.row(row)); scan.rows++; scan.checkedTo = row.occurred_at + s.intervalMs; previousCloseAt = scan.checkedTo;
        }
        cursor = page.nextCursor;
        await yieldPage();
      } while (cursor);
      scan.checkedTo = to;
    }
    if (signal?.aborted) fail('QUERY_CANCELLED');
    const output = core.finish(), navigation = this.navigation(q);
    scan.elapsedMs = performance.now() - started;
    const research = scan.status === 'partial' ? { ...output, status: 'partial', statistics: null } : output;
    return { format: 'archive-analysis-v1', selection: q, series: s, snapshotCreatedAt: this.catalog.createdAt,
      requestedAt: q.asOf, displayedAt: navigation.displayedAt, navigation, replay, research, scan, prices: this.pricePage(q),
      input: { digest: p.digest, vintage: 'current_vintage', publicationPrecision: 'unknown', sourcePublishedAt: null,
        evidenceFirstReceivedAt: p.bars.length ? Math.min(...p.bars.map(b => b.firstReceivedAt)) : null,
        evidenceVersionReceivedAt: p.bars.length ? Math.max(...p.bars.map(b => b.receivedAt)) : null, bars: p.bars } };
  }
}
