// 固定批准批次的日频参考价库；不迁移旧ArchiveStore，不生成OHLC或实时行情。
import { DatabaseSync } from 'node:sqlite';
import { existsSync, statSync, openSync, closeSync, fsyncSync, linkSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { canonical, digest } from './store.mjs';
import { CM_DAILY, coinMetricsFile, parseCoinMetricsCsv } from './coinmetrics-source.mjs';

import { CM_API_SEP, CM_API_BYTES, CM_API_NOTICE, coinMetricsApiUrl, parseCoinMetricsApi } from './coinmetrics-api.mjs';
const isApi = config => config.batch === CM_API_SEP.batch;
const byteLimit = config => isApi(config) ? CM_API_BYTES : FILE_BYTES;
const sourceUrl = (config, manifest) => isApi(config) ? coinMetricsApiUrl(manifest) : coinMetricsFile(manifest);
const parseSource = (config, bytes, options) => isApi(config) ? parseCoinMetricsApi(bytes, options) : parseCoinMetricsCsv(bytes, options);

const DAY = 86400000, FILE_BYTES = 4 * 1024 ** 2;
const commit = 'f1a36afb962731c387bb03982758ab0103063da5';
export const CM_PILOT = Object.freeze({
  batch: 'CM-SEP2026-001', identity: 'reconstructed',
  from: Date.parse('2026-09-01T00:00:00Z'), cutoff: Date.parse('2026-10-01T00:00:00Z'),
  manifests: Object.freeze([
    Object.freeze({ asset: 'btc', commit, blobSha: '5e50f336d268e1f3a38e9885b5aaef36de529700', bytes: 2482497 }),
    Object.freeze({ asset: 'eth', commit, blobSha: 'd8e4f389b37626f432a923805e5cc5fa2ad5490b', bytes: 2121732 }),
  ]),
});
export const CM_MAY_PILOT = Object.freeze({
  ...CM_PILOT, batch: 'CM-MAY2026-OFFLINE-001',
  from: Date.parse('2026-05-01T00:00:00Z'), cutoff: Date.parse('2026-05-25T00:00:00Z'),
});
const schema = `
CREATE TABLE cm_meta(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL CHECK(version=1), config TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), blocked INTEGER NOT NULL CHECK(blocked IN(0,1)), retry_at INTEGER NOT NULL);
CREATE TABLE cm_requests(id INTEGER PRIMARY KEY, asset TEXT NOT NULL, started INTEGER NOT NULL, finished INTEGER, status TEXT NOT NULL, bytes INTEGER);
CREATE TABLE cm_files(asset TEXT PRIMARY KEY, body TEXT NOT NULL, hash TEXT NOT NULL, request_id INTEGER NOT NULL UNIQUE REFERENCES cm_requests(id));
CREATE TABLE cm_points(asset TEXT NOT NULL REFERENCES cm_files(asset), day TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, price TEXT NOT NULL, PRIMARY KEY(asset,day));
`;
const fail = code => { throw Error(code); };
const int = (n, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(' ') === keys.split(' ').sort().join(' ');
const hashSchema = db => digest(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
const memory = new DatabaseSync(':memory:'); memory.exec(schema); const expectedSchema = hashSchema(memory); memory.close();
function configFor(fixture, batch = CM_PILOT.batch) {
  const base = batch === CM_PILOT.batch ? CM_PILOT : batch === CM_MAY_PILOT.batch ? CM_MAY_PILOT : batch === CM_API_SEP.batch ? CM_API_SEP : null;
  if (!base) fail('CM_BATCH_NOT_APPROVED');
  if (!fixture) return JSON.parse(canonical(base));
  // 模拟manifest永远带fixture身份；生产CLI没有这个入口。
  if (!Array.isArray(fixture) || fixture.length !== 2 || fixture[0].asset !== 'btc' || fixture[1].asset !== 'eth') fail('CM_FIXTURE_CONFIG');
  if (isApi(base)) {
    if (canonical(fixture) !== canonical(base.manifests)) fail('CM_FIXTURE_CONFIG');
  } else fixture.forEach(coinMetricsFile);
  return { ...base, identity: 'fixture', manifests: fixture };
}
function validateSlice(body, points, config, asset) {
  const manifest = config.manifests.find(m => m.asset === asset);
  if (!manifest || !exact(body, 'format source sourceUrl series identity vintage attribution license licenseUrl notice provenance range coverage analysis' + (config.batch === CM_MAY_PILOT.batch ? ' derivation' : '')) ||
      body.format !== 'coinmetrics-reference-slice-v1' || body.identity !== config.identity ||
      body.source !== CM_DAILY.source || body.sourceUrl !== sourceUrl(config, manifest) ||
      body.vintage !== 'current_vintage' || body.license !== CM_DAILY.license || body.licenseUrl !== CM_DAILY.licenseUrl ||
      body.attribution !== CM_DAILY.attribution || body.notice !== (isApi(config) ? CM_API_NOTICE : CM_DAILY.notice) ||
      canonical(body.range) !== canonical({ from: config.from, cutoff: config.cutoff }) ||
      canonical(body.analysis) !== canonical({ short90m: 'unsupported_frequency', medium180m: 'unsupported_frequency', forward30m: 'unsupported_frequency' })) fail('CM_SLICE_INVALID');
  if (canonical(body.series) !== canonical({ id: 'crypto:coinmetrics:' + asset + ':PriceUSD:USD:1d', providerId: asset, market: 'crypto', venue: 'composite_reference', currency: 'USD', metric: 'PriceUSD', frequency: '1d', periodConvention: 'utc_date_end', adjustment: 'provider_reference', type: 'reference_price' })) fail('CM_SERIES_INVALID');
  const p = body.provenance, c = body.coverage, days = (config.cutoff - config.from) / DAY;
  if ((isApi(config) ?
      !exact(p, 'transport sha256 bytes receivedAt sourcePublishedAt publicationPrecision authentication') || p.transport !== 'community_api' || !int(p.bytes, 1, CM_API_BYTES) :
      !exact(p, 'commit blobSha sha256 bytes receivedAt sourcePublishedAt publicationPrecision authentication') ||
      p.commit !== manifest.commit || p.blobSha !== manifest.blobSha || p.bytes !== manifest.bytes) ||
      typeof p.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.sha256) || !int(p.receivedAt, config.cutoff) ||
      p.sourcePublishedAt !== null || p.publicationPrecision !== 'unknown' || p.authentication !== 'not_proven_by_checksum') fail('CM_PROVENANCE_INVALID');
  if (!exact(c, 'status expectedDates presentValues missing sourceRows excludedOutsideRange excludedIncomplete limitation') ||
      c.expectedDates !== days || c.presentValues !== points.length || !Array.isArray(c.missing) || c.missing.length + points.length !== days ||
      c.status !== (c.missing.length ? 'partial' : 'date_grid_present') || !int(c.sourceRows, isApi(config) ? 0 : 1, isApi(config) ? 30 : 10000) ||
      !int(c.excludedOutsideRange, 0, 10000) || !int(c.excludedIncomplete, 0, 1) ||
      typeof c.limitation !== 'string' || c.limitation.length > 300) fail('CM_COVERAGE_INVALID');
  if (isApi(config) && (c.excludedOutsideRange !== 0 || c.excludedIncomplete !== 0 ||
      c.sourceRows !== points.length + c.missing.filter(m => m.reason === 'missing_value').length)) fail('CM_COVERAGE_INVALID');
  if (config.batch === CM_MAY_PILOT.batch) {
    const d = body.derivation;
    if (!exact(d, 'method derivedAt parentBatch parentSnapshot parentVersion parentEvidence') ||
        d.method !== 'offline_reextract' || d.parentBatch !== CM_PILOT.batch ||
        !int(d.derivedAt, p.receivedAt, Date.now()) ||
        typeof d.parentSnapshot !== 'string' || !/^[a-f0-9]{64}$/.test(d.parentSnapshot) ||
        typeof d.parentVersion !== 'string' || !/^[a-f0-9]{64}$/.test(d.parentVersion)) fail('CM_DERIVATION_INVALID');
    const parent = d.parentEvidence;
    if (!exact(parent, 'format meta requests files points checksum') || !exact(parent.meta, 'id version config enabled blocked retry_at') ||
        canonical(JSON.parse(parent.meta.config)) !== canonical(configFor(config.identity === 'fixture' ? config.manifests : null)) ||
        parent.checksum !== d.parentSnapshot || !Array.isArray(parent.files) || parent.files.length !== 2 ||
        !Array.isArray(parent.requests) || parent.requests.some(r => r.status === 'reserved')) fail('CM_PARENT_EVIDENCE_INVALID');
    // 有界父证据保留在备份中；恢复脱离原库仍能验证账本、时间和版本关系。
    CoinMetricsArchive.restore(':memory:', canonical(parent));
    const originalRow = parent.files.find(row => row.asset === asset);
    if (!originalRow || originalRow.hash !== d.parentVersion ||
        canonical(JSON.parse(originalRow.body).provenance) !== canonical(p)) fail('CM_PARENT_EVIDENCE_MISMATCH');
  }
  const dates = new Set();
  for (const point of points) {
    if (!exact(point, 'sourceDate periodStartAt evidenceEndAt price') ||
        !int(point.periodStartAt, config.from, config.cutoff - DAY) || point.periodStartAt % DAY ||
        point.evidenceEndAt !== point.periodStartAt + DAY || point.sourceDate !== new Date(point.periodStartAt).toISOString().slice(0, 10) ||
        typeof point.price !== 'string' || point.price.length > 80 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(point.price) ||
        !Number.isFinite(Number(point.price)) || Number(point.price) <= 0 || dates.has(point.sourceDate)) fail('CM_POINT_INVALID');
    dates.add(point.sourceDate);
  }
  for (const missing of c.missing) {
    if (!exact(missing, 'sourceDate reason') || !['missing_value','missing_date'].includes(missing.reason) ||
        typeof missing.sourceDate !== 'string' || !int(Date.parse(missing.sourceDate + 'T00:00:00Z'), config.from, config.cutoff - DAY) ||
        new Date(Date.parse(missing.sourceDate + 'T00:00:00Z')).toISOString().slice(0,10) !== missing.sourceDate ||
        dates.has(missing.sourceDate)) fail('CM_MISSING_INVALID');
    dates.add(missing.sourceDate);
  }
}
export class CoinMetricsArchive {
  constructor(path, { create = false, fixture = null, readOnly = false, batch = CM_PILOT.batch } = {}) {
    const exists = existsSync(path);
    if (create && exists || !create && !exists) fail(create ? 'CM_NEW_TARGET_REQUIRED' : 'CM_ARCHIVE_NOT_FOUND');
    if (exists && statSync(path).size > 2 * 1024 ** 2) fail('CM_DB_LIMIT');
    this.db = new DatabaseSync(path, { readOnly });
    try {
      this.db.exec('PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000;');
      if (create) {
        this.db.exec(schema);
        this.db.prepare('INSERT INTO cm_meta VALUES(1,1,?,?,0,0)').run(canonical(configFor(fixture, batch)), +(batch !== CM_MAY_PILOT.batch));
      }
      if (hashSchema(this.db) !== expectedSchema) fail('CM_SCHEMA_MISMATCH');
      const rows = this.db.prepare('SELECT * FROM cm_meta').all();
      if (rows.length !== 1 || rows[0].version !== 1) fail('CM_SCHEMA_MISMATCH');
      this.config = JSON.parse(rows[0].config);
      if (canonical(this.config) !== canonical(configFor(this.config.identity === 'fixture' ? this.config.manifests : null, this.config.batch))) fail('CM_CONFIG_MISMATCH');
      if (Object.values(this.db.prepare('PRAGMA integrity_check(1)').get())[0] !== 'ok') fail('CM_DB_INTEGRITY');
      if (readOnly) this.db.exec('BEGIN');
      this.validate(); // 固定本会话读取快照；查询不追随随后写入。
    } catch (e) { this.db.close(); throw e; }
  }
  close() { this.db.close(); }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  meta() { return this.db.prepare('SELECT * FROM cm_meta').get(); }
  status() {
    const requests = this.db.prepare('SELECT * FROM cm_requests ORDER BY id').all(), files = this.db.prepare('SELECT asset FROM cm_files ORDER BY asset').all();
    const meta = this.meta();
    return { batch: this.config.batch, identity: this.config.identity, requestAccounting: this.config.batch === CM_MAY_PILOT.batch ? 'inherited_from_CM-SEP2026-001' : 'direct', newRequests: this.config.batch === CM_MAY_PILOT.batch ? 0 : requests.length, requests, files: files.map(x => x.asset), reservedBytes: requests.length * byteLimit(this.config), reservedMs: requests.length * 30000, actualBytes: requests.reduce((n, r) => n + (r.bytes ?? 0), 0), points: this.db.prepare('SELECT count(*) AS n FROM cm_points').get().n, enabled: !!meta.enabled, blocked: !!meta.blocked, retryAt: meta.retry_at };
  }
  reserve(asset, now) {
    if (this.config.batch === CM_MAY_PILOT.batch) fail('CM_COLLECTION_DISABLED');
    if (!int(now, this.config.cutoff) || !this.config.manifests.some(m => m.asset === asset)) fail('CM_REQUEST_INVALID');
    return this.transaction(() => {
      const s = this.status();
      if (!s.enabled || s.blocked) fail('CM_COLLECTION_DISABLED');
      if (s.retryAt > now) fail('CM_SOURCE_COOLDOWN');
      if (s.files.includes(asset)) return null;
      if (s.requests.some(r => r.status === 'reserved' && now < r.started + 30000)) fail('CM_REQUEST_IN_PROGRESS');
      if (s.requests.length >= 4) fail('CM_BATCH_BUDGET');
      this.db.prepare("UPDATE cm_requests SET status='interrupted' WHERE status='reserved'").run();
      if (isApi(this.config)) this.db.prepare('UPDATE cm_meta SET retry_at=?').run(now + 1000);
      return Number(this.db.prepare("INSERT INTO cm_requests(asset,started,status) VALUES(?,?,'reserved')").run(asset, now).lastInsertRowid);
    });
  }
  failure(id, now, { status = 'failed', bytes = null, retryAt = 0, blocked = false } = {}) {
    if (!['failed','rejected','rate_limited','invalid','oversized'].includes(status) || !int(now) || bytes !== null && !int(bytes, 0, status === 'oversized' ? Number.MAX_SAFE_INTEGER : byteLimit(this.config)) || status === 'oversized' && !int(bytes, byteLimit(this.config) + 1) || !int(retryAt) || typeof blocked !== 'boolean') fail('CM_FAILURE_INVALID');
    this.transaction(() => {
      const r = this.db.prepare('SELECT * FROM cm_requests WHERE id=?').get(id);
      if (!r || r.status !== 'reserved' || now < r.started) fail('CM_RESERVATION_INVALID');
      this.db.prepare('UPDATE cm_requests SET status=?,finished=?,bytes=? WHERE id=?').run(status, now, bytes, id);
      this.db.prepare('UPDATE cm_meta SET blocked=max(blocked,?),retry_at=max(retry_at,?)').run(+blocked, retryAt);
    });
  }
  accept(id, bytes, receivedAt) {
    const req = this.db.prepare('SELECT * FROM cm_requests WHERE id=?').get(id);
    if (!req || req.status !== 'reserved' || !int(receivedAt, req.started, req.started + 30000)) fail('CM_RESERVATION_INVALID');
    const manifest = this.config.manifests.find(m => m.asset === req.asset);
    const slice = parseSource(this.config, bytes, { manifest, from: this.config.from, cutoff: this.config.cutoff, receivedAt, now: receivedAt });
    slice.identity = this.config.identity;
    const { points, ...body } = slice;
    validateSlice(body, points, this.config, req.asset);
    this.transaction(() => {
      if (this.db.prepare('SELECT status FROM cm_requests WHERE id=?').get(id).status !== 'reserved' || this.db.prepare('SELECT 1 FROM cm_files WHERE asset=?').get(req.asset)) fail('CM_CHECKPOINT_CONFLICT');
      this.db.prepare('INSERT INTO cm_files VALUES(?,?,?,?)').run(req.asset, canonical(body), digest(slice), id);
      const put = this.db.prepare('INSERT INTO cm_points VALUES(?,?,?,?,?)');
      for (const p of points) put.run(req.asset, p.sourceDate, p.periodStartAt, p.evidenceEndAt, p.price);
      this.db.prepare("UPDATE cm_requests SET status='accepted',finished=?,bytes=? WHERE id=?").run(receivedAt, bytes.length, id);
    });
    return slice;
  }
  query(asset, from = this.config.from, cutoff = this.config.cutoff, version = null) {
    if (!['btc','eth'].includes(asset) || !int(from, this.config.from, this.config.cutoff - DAY) || from % DAY ||
        !int(cutoff, from + DAY, this.config.cutoff) || cutoff % DAY) fail('CM_QUERY_RANGE');
    const row = this.db.prepare('SELECT * FROM cm_files WHERE asset=?').get(asset);
    if (!row) fail('CM_SERIES_NOT_COLLECTED');
    const body = JSON.parse(row.body);
    const allPoints = this.db.prepare('SELECT day AS sourceDate,start AS periodStartAt,end AS evidenceEndAt,price FROM cm_points WHERE asset=? ORDER BY start').all(asset).map(p => ({ ...p }));
    if (digest({ ...body, points: allPoints }) !== row.hash || version !== null && version !== row.hash) fail('CM_QUERY_VERSION');
    const points = allPoints.filter(p => p.periodStartAt >= from && p.periodStartAt < cutoff);
    return { ...body, points, version: row.hash, queryRange: { from, cutoff }, coverageRange: body.range };
  }
  catalog() {
    return { format: 'reference-catalog-v1', batch: this.config.batch, identity: this.config.identity, series: this.status().files.map(asset => {
      const q = this.query(asset);
      return { asset, id: q.series.id, version: q.version, range: q.range, count: q.points.length, coverage: q.coverage, receivedAt: q.provenance.receivedAt };
    }) };
  }
  validate(now = Date.now()) {
    const s = this.status();
    if (s.requests.length > 4 || s.files.length > 2 || s.points > (this.config.cutoff - this.config.from) / DAY * 2 || !int(s.retryAt)) fail('CM_ARCHIVE_BUDGET');
    if (this.config.batch === CM_MAY_PILOT.batch && s.enabled) fail('CM_OFFLINE_COLLECTION_FORBIDDEN');
    for (let i = 0; i < s.requests.length; i++) {
      const r = s.requests[i];
      if (r.id !== i + 1 || !['btc','eth'].includes(r.asset) || !int(r.started, this.config.cutoff, now) ||
          !['reserved','accepted','interrupted','failed','rejected','rate_limited','invalid','oversized'].includes(r.status) ||
          r.finished !== null && !int(r.finished, r.started, now) || r.status === 'accepted' && (!int(r.finished, r.started, r.started + 30000) || r.bytes === null) || r.bytes !== null && !int(r.bytes, 0, r.status === 'oversized' ? Number.MAX_SAFE_INTEGER : byteLimit(this.config)) || r.status === 'oversized' && !int(r.bytes, byteLimit(this.config) + 1)) fail('CM_REQUEST_LEDGER_INVALID');
    }
    if (isApi(this.config) && s.requests.length && s.retryAt < Math.max(...s.requests.map(r => r.started)) + 1000) fail('CM_COOLDOWN_LEDGER_INVALID');
    const rows = this.db.prepare('SELECT * FROM cm_files ORDER BY asset').all();
    for (const row of rows) {
      const q = this.query(row.asset), { points, version, queryRange, coverageRange, ...body } = q;
      void version; void queryRange; void coverageRange;
      validateSlice(body, points, this.config, row.asset);
      if (this.config.batch === CM_MAY_PILOT.batch) {
        const parent = body.derivation.parentEvidence;
        if (canonical(s.requests) !== canonical(parent.requests) || this.meta().blocked !== parent.meta.blocked ||
            this.meta().retry_at !== parent.meta.retry_at ||
            row.request_id !== parent.files.find(f => f.asset === row.asset)?.request_id ||
            rows.some(f => JSON.parse(f.body).derivation?.parentSnapshot !== parent.checksum)) fail('CM_INHERITED_LEDGER_MISMATCH');
      }
      const req = s.requests.find(r => r.id === row.request_id);
      if (!req || req.status !== 'accepted' || req.asset !== row.asset || req.bytes !== body.provenance.bytes ||
          req.finished !== body.provenance.receivedAt) fail('CM_CHECKPOINT_INVALID');
    }
    if (s.requests.filter(r => r.status === 'accepted').length !== rows.length || this.db.prepare('PRAGMA foreign_key_check').all().length) fail('CM_CHECKPOINT_INVALID');
  }
  exportSnapshot() {
    this.db.exec('SAVEPOINT cm_export');
    try {
      this.validate();
      const body = { format: 'coinmetrics-local-snapshot-v1', meta: this.meta(), requests: this.db.prepare('SELECT * FROM cm_requests ORDER BY id').all(), files: this.db.prepare('SELECT * FROM cm_files ORDER BY asset').all(), points: this.db.prepare('SELECT * FROM cm_points ORDER BY asset,day').all() };
      const output = canonical({ ...body, checksum: digest(body) });
      if (Buffer.byteLength(output) > 1024 ** 2) fail('CM_BACKUP_LIMIT');
      return output;
    } finally { this.db.exec('RELEASE cm_export'); }
  }
  static restore(path, text) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 ** 2) fail('CM_BACKUP_LIMIT');
    const envelope = JSON.parse(text);
    if (!exact(envelope, 'format meta requests files points checksum')) fail('CM_BACKUP_INVALID');
    const { checksum, ...body } = envelope;
    if (body.format !== 'coinmetrics-local-snapshot-v1' || checksum !== digest(body) ||
        !exact(body.meta, 'id version config enabled blocked retry_at') || body.meta.id !== 1 || body.meta.version !== 1 ||
        ![0,1].includes(body.meta.enabled) || ![0,1].includes(body.meta.blocked) || !int(body.meta.retry_at) ||
        !Array.isArray(body.requests) || body.requests.length > 4 || !Array.isArray(body.files) || body.files.length > 2 || !Array.isArray(body.points) || body.points.length > 60) fail('CM_BACKUP_INVALID');
    const config = JSON.parse(body.meta.config), fixture = config.identity === 'fixture' ? config.manifests : null;
    if (canonical(config) !== canonical(configFor(fixture, config.batch))) fail('CM_CONFIG_MISMATCH');
    if (config.batch === CM_MAY_PILOT.batch && body.meta.enabled !== 0) fail('CM_OFFLINE_COLLECTION_FORBIDDEN');
    // 恢复离线批次必须保留两份来源文件和父账本；价格缺值可以存在，来源身份不可删空。
    if (config.batch === CM_MAY_PILOT.batch && (body.files.length !== 2 ||
        !['btc','eth'].every(asset => body.files.some(file => file?.asset === asset)))) fail('CM_OFFLINE_SOURCES_INCOMPLETE');
    for (const r of body.requests) if (!exact(r, 'id asset started finished status bytes')) fail('CM_BACKUP_INVALID');
    for (const r of body.files) if (!exact(r, 'asset body hash request_id')) fail('CM_BACKUP_INVALID');
    for (const r of body.points) if (!exact(r, 'asset day start end price')) fail('CM_BACKUP_INVALID');
    // 在内存中新库完整预演，验证失败不留下目标文件。
    const staged = new CoinMetricsArchive(':memory:', { create: true, fixture, batch: config.batch });
    const load = store => store.transaction(() => {
      store.db.prepare('UPDATE cm_meta SET enabled=0,blocked=?,retry_at=?').run(body.meta.blocked, body.meta.retry_at);
      for (const r of body.requests) store.db.prepare('INSERT INTO cm_requests VALUES(?,?,?,?,?,?)').run(r.id,r.asset,r.started,r.finished,r.status === 'reserved' ? 'interrupted' : r.status,r.bytes);
      for (const r of body.files) store.db.prepare('INSERT INTO cm_files VALUES(?,?,?,?)').run(r.asset,r.body,r.hash,r.request_id);
      for (const r of body.points) store.db.prepare('INSERT INTO cm_points VALUES(?,?,?,?,?)').run(r.asset,r.day,r.start,r.end,r.price);
      store.validate();
    });
    let result;
    try { load(staged); result = staged.status(); } finally { staged.close(); }
    if (path === ':memory:') return result;
    if (existsSync(path)) fail('CM_NEW_TARGET_REQUIRED');
    const pending = path + '.pending-' + randomUUID();
    try {
      const restored = new CoinMetricsArchive(pending, { create: true, fixture, batch: config.batch });
      try { load(restored); result = restored.status(); } finally { restored.close(); }
      const fd = openSync(pending, 'r+');
      try { fsyncSync(fd); } finally { closeSync(fd); }
      // link为不存在的最终路径原子发布，绝不覆盖并发创建的目标；失败只清理本次临时文件。
      linkSync(pending, path);
      return result;
    } finally { if (existsSync(pending)) unlinkSync(pending); }
  }
}

/** 一次调用只执行有限批次；无自动重试，错误后由操作者显式续跑。 */
export async function collectCoinMetrics(store, { fetchImpl = fetch, clock = Date.now, saveRaw = () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (store.config.batch === CM_MAY_PILOT.batch) fail('CM_COLLECTION_DISABLED');
  const started = clock();
  for (const manifest of store.config.manifests) {
    if (clock() - started >= 120000) fail('CM_RUN_DEADLINE');
    if (store.status().files.includes(manifest.asset)) continue;
    if (isApi(store.config)) {
      const pause = store.status().retryAt - clock();
      if (pause > 1000) fail('CM_SOURCE_COOLDOWN');
      if (pause > 0) await wait(pause);
    }
    const id = store.reserve(manifest.asset, clock()); if (id === null) continue;
    let bytesSeen = 0;
    try {
      const response = await fetchImpl(sourceUrl(store.config, manifest), { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { Accept: isApi(store.config) ? 'application/json' : 'text/csv' } });
      if (response.status !== 200) {
        const now = clock(), header = response.headers.get('retry-after');
        const retry = header && /^\d+$/.test(header) ? now + Number(header) * 1000 : Date.parse(header ?? '');
        const retryAt = response.status === 429 ? Math.max(now + 60000, Number.isSafeInteger(retry) ? retry : now + DAY) : 0;
        store.failure(id, now, { status: response.status === 429 ? 'rate_limited' : 'rejected', bytes: 0, retryAt, blocked: [401,403].includes(response.status) || response.status >= 300 && response.status < 400 });
        try { await response.body?.cancel(); } catch { /* 已持久化源状态，清理失败不能解除拒绝或冷却。 */ }
        fail('CM_HTTP_' + response.status);
      }
      const declared = response.headers.get('content-length');
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > byteLimit(store.config))) { await response.body?.cancel(); fail('CM_RESPONSE_LIMIT'); }
      const chunks = [];
      for await (const chunk of response.body) { bytesSeen += chunk.length; if (bytesSeen > byteLimit(store.config)) fail('CM_RESPONSE_LIMIT'); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks), receivedAt = clock();
      // 原始文件先可靠写入；事实与成功检查点只在accept同事务中公开。
      parseSource(store.config, bytes, { manifest, from: store.config.from, cutoff: store.config.cutoff, receivedAt, now: receivedAt });
      await saveRaw(manifest, bytes, receivedAt, id);
      store.accept(id, bytes, receivedAt);
    } catch (e) {
      if (store.status().requests.find(r => r.id === id)?.status === 'reserved') store.failure(id, clock(), { status: bytesSeen > byteLimit(store.config) ? 'oversized' : 'failed', bytes: bytesSeen });
      throw e;
    }
  }
  return store.status();
}
/** 已批准五月范围的离线重提。继承来源账本，不伪造网络请求或当时观察。 */
export function reextractCoinMetricsMay(source, rawByAsset, derivedAt = Date.now()) {
  if (!(source instanceof CoinMetricsArchive) || source.config.batch !== CM_PILOT.batch ||
      !exact(rawByAsset, 'btc eth') || !int(derivedAt, CM_PILOT.cutoff, Date.now())) fail('CM_REEXTRACT_INPUT');
  const parent = JSON.parse(source.exportSnapshot());
  if (parent.files.length !== 2 || parent.requests.some(r => r.status === 'reserved')) fail('CM_PARENT_INCOMPLETE');
  const config = configFor(source.config.identity === 'fixture' ? source.config.manifests : null, CM_MAY_PILOT.batch);
  const files = [], points = [];
  for (const manifest of source.config.manifests) {
    const asset = manifest.asset, raw = rawByAsset[asset], row = parent.files.find(f => f.asset === asset);
    if (!row) fail('CM_PARENT_INCOMPLETE');
    const original = JSON.parse(row.body), receivedAt = original.provenance.receivedAt;
    if (derivedAt < receivedAt) fail('CM_REEXTRACT_TIME');
    const prior = parseCoinMetricsCsv(raw, { manifest, from: source.config.from, cutoff: source.config.cutoff, receivedAt, now: derivedAt });
    prior.identity = source.config.identity;
    if (digest(prior) !== row.hash) fail('CM_PARENT_CONTENT_MISMATCH');
    const slice = parseCoinMetricsCsv(raw, { manifest, from: config.from, cutoff: config.cutoff, receivedAt, now: derivedAt });
    slice.identity = source.config.identity;
    slice.derivation = { method: 'offline_reextract', derivedAt, parentBatch: source.config.batch, parentSnapshot: parent.checksum, parentVersion: row.hash, parentEvidence: parent };
    const { points: values, ...body } = slice;
    validateSlice(body, values, config, asset);
    files.push({ asset, body: canonical(body), hash: digest(slice), request_id: row.request_id });
    for (const p of values) points.push({ asset, day: p.sourceDate, start: p.periodStartAt, end: p.evidenceEndAt, price: p.price });
  }
  const body = { format: parent.format, meta: { ...parent.meta, config: canonical(config), enabled: 0 }, requests: parent.requests, files, points };
  const text = canonical({ ...body, checksum: digest(body) });
  if (Buffer.byteLength(text) > 1024 ** 2) fail('CM_BACKUP_LIMIT');
  return text;
}