// 本机受控物理快照；不增加来源许可，不是浏览器包，也不复制活动数据库主文件。
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, openSync, closeSync, readSync, fsyncSync, writeFileSync, renameSync, statSync, statfsSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { canonical, digest, validateConfig, validateFact } from './store.mjs';
import { FED, isFedConfig } from './source-policy.mjs';

export const SNAPSHOT_LIMITS = Object.freeze({ bytes: 256 * 1024 ** 2, facts: 400000, runs: 10000, pages: 50000, requests: 50000, manifestBytes: 65536, timeoutMs: 120000 });
const fail = code => { throw Error(code); };
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const token = v => typeof v === 'string' && /^[a-zA-Z0-9_.:/^-]{1,160}$/.test(v);
const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x1f]/.test(v);
const cursor = v => v === null || text(v, 500);
const tables = ['archive_meta', 'archive_runs', 'archive_pages', 'archive_facts', 'archive_sources', 'archive_source_requests'];
const schemaRows = db => db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
function expectedSchema() {
  const db = new DatabaseSync(':memory:');
  try { db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')); return digest(schemaRows(db)); }
  finally { db.close(); }
}
const schemaFingerprint = expectedSchema();
function openRead(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try { db.exec('PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=3000;'); return db; }
  catch (e) { db.close(); throw e; }
}
function sync(path) { const fd = openSync(path, 'r+'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function fileHash(path) {
  const h = createHash('sha256'), fd = openSync(path, 'r'), chunk = Buffer.alloc(65536);
  try { let n; while ((n = readSync(fd, chunk, 0, chunk.length, null))) h.update(chunk.subarray(0, n)); }
  finally { closeSync(fd); }
  return h.digest('hex');
}
function checkedSize(path) {
  const size = statSync(path).size;
  if (!integer(size, 1, SNAPSHOT_LIMITS.bytes)) fail('SNAPSHOT_BYTE_LIMIT');
  return size;
}
function preflight(db, path) {
  checkedSize(path);
  if (digest(schemaRows(db)) !== schemaFingerprint) fail('SNAPSHOT_SCHEMA_MISMATCH');
  const bytes = db.prepare('PRAGMA page_count').get().page_count * db.prepare('PRAGMA page_size').get().page_size;
  if (!integer(bytes, 1, SNAPSHOT_LIMITS.bytes)) fail('SNAPSHOT_BYTE_LIMIT');
  return bytes;
}
// 只使用可信固定表名；有限页保留statement引用，不重引入Node22临时迭代器问题。
function each(db, table, visit) {
  const statement = db.prepare(`SELECT rowid AS scan_id,* FROM ${table} WHERE rowid>? ORDER BY rowid LIMIT 100`);
  let after = 0;
  while (true) {
    const rows = statement.all(after);
    for (const { scan_id, ...row } of rows) { visit(row); after = scan_id; }
    if (rows.length < 100) return;
  }
}
function inspect(db, path, owner) {
  if (!token(owner)) fail('INVALID_OWNER');
  preflight(db, path);
  if (Object.values(db.prepare('PRAGMA integrity_check(1)').get())[0] !== 'ok' || db.prepare('SELECT * FROM pragma_foreign_key_check LIMIT 1').get()) fail('SNAPSHOT_INTEGRITY');
  const counts = Object.fromEntries(tables.map(t => [t, db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n]));
  if (counts.archive_meta !== 1 || counts.archive_facts > SNAPSHOT_LIMITS.facts || counts.archive_runs > SNAPSHOT_LIMITS.runs || counts.archive_pages > SNAPSHOT_LIMITS.pages || counts.archive_source_requests > SNAPSHOT_LIMITS.requests || counts.archive_sources > 1) fail('SNAPSHOT_ROW_LIMIT');
  for (const t of tables) if (db.prepare(`SELECT 1 FROM ${t} WHERE rowid<=0 LIMIT 1`).get()) fail('SNAPSHOT_ROW_ID');
  // 防止损坏/外来库以超大单行消耗内存；合法既有记录远低于此限额。
  if (db.prepare('SELECT 1 FROM archive_facts WHERE length(payload)>16384 LIMIT 1').get() || db.prepare('SELECT 1 FROM archive_runs WHERE length(config)>32768 LIMIT 1').get()) fail('SNAPSHOT_RECORD_LIMIT');
  const meta = db.prepare('SELECT * FROM archive_meta WHERE id=1').get();
  if (!meta || meta.schema_version !== 2 || !integer(meta.revision) || ![0, 1].includes(meta.collection_enabled)) fail('SNAPSHOT_META');
  for (const t of ['archive_runs', 'archive_pages', 'archive_facts', 'archive_source_requests']) {
    if (db.prepare(`SELECT 1 FROM ${t} WHERE owner<>? LIMIT 1`).get(owner)) fail('SNAPSHOT_SINGLE_OWNER_REQUIRED');
  }
  const identities = new Map(), cache = new Map();
  const runFor = id => {
    if (cache.has(id)) return cache.get(id);
    const row = db.prepare('SELECT * FROM archive_runs WHERE owner=? AND run_id=?').get(owner, id);
    if (!row) fail('SNAPSHOT_RUN_REFERENCE');
    const run = { ...row, config: validateConfig(JSON.parse(row.config)) };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(id, run); return run;
  };
  each(db, 'archive_runs', row => {
    const r = runFor(row.run_id), c = r.config;
    if (c.owner !== owner || c.runId !== row.run_id || !['ready', 'paused', 'traversed'].includes(r.status) || !cursor(r.cursor) || !['requests','bytes','pages','writes'].every(k => integer(r[k])) || !integer(r.page_attempts, 0, 3) || !integer(r.retry_not_before)) fail('SNAPSHOT_RUN');
    for (const a of c.assets) {
      const key = canonical([c.source, a.id]), value = canonical(Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'role')));
      if (identities.has(key) && identities.get(key) !== value) fail('ASSET_IDENTITY_CONFLICT');
      identities.set(key, value); if (identities.size > 2000) fail('SNAPSHOT_IDENTITY_LIMIT');
    }
    if (!(r.lease_token === null && r.lease_until === null || integer(r.lease_token, 1, r.requests) && integer(r.lease_until, c.createdAt, c.createdAt + c.limits.durationMs))) fail('SNAPSHOT_LEASE');
    const pages = db.prepare('SELECT * FROM archive_pages WHERE owner=? AND run_id=? ORDER BY page_number LIMIT 11').all(owner, row.run_id);
    if (pages.some(p => !cursor(p.before_cursor) || !cursor(p.after_cursor) || !text(p.fingerprint, 64) || p.fingerprint.length !== 64)) fail('SNAPSHOT_CHECKPOINT_FORMAT');
    if (pages.length !== r.pages || r.pages > c.limits.pages || r.writes > c.limits.writes || r.requests > c.limits.requests || r.requests < r.pages + r.page_attempts || pages.length > 0 && r.bytes === 0 || pages.some((p, i) => p.page_number !== i + 1 || p.before_cursor !== (i ? pages[i - 1].after_cursor : null) || !integer(p.revision, 1, meta.revision) || !integer(p.received_at, c.createdAt, c.createdAt + c.limits.durationMs - 1) || !integer(p.accepted) || !integer(p.duplicates) || !integer(p.revisions, 0, p.accepted))) fail('SNAPSHOT_CHECKPOINT');
    if (r.cursor !== (pages.at(-1)?.after_cursor ?? null) || r.writes !== pages.reduce((n, p) => n + p.accepted, 0) || r.writes !== db.prepare('SELECT count(*) AS n FROM archive_facts WHERE owner=? AND run_id=?').get(owner, r.run_id).n) fail('SNAPSHOT_CHECKPOINT');
    if ((pages.at(-1)?.traversal_done === 1) !== (r.status === 'traversed') || pages.slice(0, -1).some(p => p.traversal_done) || pages.some(p => Boolean(p.traversal_done) !== (p.after_cursor === null)) || r.status === 'traversed' && (r.page_attempts || r.retry_not_before || r.lease_token !== null)) fail('SNAPSHOT_CHECKPOINT');
    for (const p of pages) if (p.accepted !== db.prepare('SELECT count(*) AS n FROM archive_facts WHERE revision=?').get(p.revision).n) fail('SNAPSHOT_PAGE_COUNT');
    if (isFedConfig(c) && db.prepare('SELECT count(*) AS n FROM archive_source_requests WHERE owner=? AND run_id=?').get(owner, r.run_id).n !== r.requests) fail('SNAPSHOT_SOURCE_LEDGER');
  });
  each(db, 'archive_facts', row => {
    const r = runFor(row.run_id), f = validateFact({ asset: row.asset, kind: row.kind, occurredAt: row.occurred_at, payload: JSON.parse(row.payload) }, r.config, row.received_at);
    const page = db.prepare('SELECT owner,run_id,received_at FROM archive_pages WHERE revision=?').get(row.revision);
    if (!integer(row.id, 1) || row.source !== r.config.source || row.identity !== r.config.identity || !integer(row.revision, 1, meta.revision) || !integer(row.received_at, r.config.createdAt, r.config.createdAt + r.config.limits.durationMs - 1) || row.logical_key !== f.key || row.hash !== f.hash || row.sort_at !== f.sortAt || page?.owner !== owner || page?.run_id !== row.run_id || page?.received_at !== row.received_at) fail('SNAPSHOT_FACT');
  });
  each(db, 'archive_source_requests', row => {
    const r = runFor(row.run_id);
    if (row.source !== FED.source || !isFedConfig(r.config) || !integer(row.request_number, 1, r.requests) || !integer(row.requested_at, r.config.createdAt, r.config.createdAt + r.config.limits.durationMs - 1)) fail('SNAPSHOT_SOURCE_LEDGER');
  });
  each(db, 'archive_sources', s => {
    if (s.source !== FED.source || !integer(s.last_dispatch) || !integer(s.retry_not_before) || s.last_dispatch !== (db.prepare('SELECT max(requested_at) AS n FROM archive_source_requests').get().n ?? 0)) fail('SNAPSHOT_SOURCE_LEDGER');
    if (![s.lease_owner, s.lease_run, s.lease_token, s.lease_until].every(v => v === null)) {
      const r = runFor(s.lease_run);
      if (s.lease_owner !== owner || !isFedConfig(r.config) || s.lease_token !== r.lease_token || s.lease_until !== r.lease_until) fail('SNAPSHOT_SOURCE_LEASE');
    }
    if (db.prepare('SELECT 1 FROM archive_runs WHERE json_extract(config,\'$.source\')=? AND retry_not_before>? LIMIT 1').get(FED.source, s.retry_not_before)) fail('SNAPSHOT_SOURCE_COOLDOWN');
  });
  const hasFed = db.prepare('SELECT 1 FROM archive_runs WHERE json_extract(config,\'$.source\')=? LIMIT 1').get(FED.source);
  if (Boolean(hasFed) !== Boolean(counts.archive_sources)) fail('SNAPSHOT_SOURCE_LEDGER');
  // 物理VACUUM可改变隐式rowid/文件头；逻辑摘要依规范主键排序，不用文件字节比较逻辑版本。
  const state = createHash('sha256');
  const ordering = { archive_meta: ['id'], archive_runs: ['owner','run_id'], archive_pages: ['owner','run_id','page_number'], archive_facts: ['id'], archive_sources: ['source'], archive_source_requests: ['source','owner','run_id','request_number'] };
  for (const t of tables) {
    state.update(t + '\n');
    const keys = ordering[t], order = keys.join(',');
    const first = db.prepare(`SELECT * FROM ${t} ORDER BY ${order} LIMIT 100`);
    const next = db.prepare(`SELECT * FROM ${t} WHERE (${order})>(${keys.map(() => '?').join(',')}) ORDER BY ${order} LIMIT 100`);
    let rows = first.all();
    while (rows.length) {
      for (const row of rows) state.update(canonical(row) + '\n');
      if (rows.length < 100) break;
      rows = next.all(...keys.map(k => rows.at(-1)[k]));
    }
  }
  return { readRevision: meta.revision, counts, collectionEnabled: meta.collection_enabled, stateDigest: state.digest('hex') };
}
function reserveSpace(folder, bytes) {
  const stat = statfsSync(folder);
  if (stat.bavail * stat.bsize < bytes * 4 + 32 * 1024 ** 2) fail('SNAPSHOT_DISK_SPACE');
}
function copyConsistent(source, pending, folder) {
  const db = openRead(source);
  try { const size = preflight(db, source); reserveSpace(folder, size); db.exec('PRAGMA synchronous=FULL;'); db.prepare('VACUUM main INTO ?').run(pending); }
  finally { db.close(); }
  checkedSize(pending);
}
function preparePublication(folder, pending, name, body) {
  sync(pending);
  const final = join(folder, 'archive.sqlite'); renameSync(pending, final);
  const envelope = { ...body, bytes: checkedSize(final), sha256: fileHash(final) }, text = canonical(envelope);
  if (Buffer.byteLength(text) > SNAPSHOT_LIMITS.manifestBytes) fail('SNAPSHOT_MANIFEST_LIMIT');
  const temporary = join(folder, name + '.pending'); writeFileSync(temporary, text, { flag: 'wx', mode: 0o600 }); sync(temporary);
  // 这里只准备并刷盘；主线程在取消/超时的统一决策点最后发布manifest。
  return { format: body.format, bytes: envelope.bytes, sha256: envelope.sha256, readRevision: body.readRevision, facts: body.counts.archive_facts, collectionEnabled: body.collectionEnabled };
}
function create({ source, target, owner }) {
  const pending = join(target, 'archive.pending.sqlite');
  copyConsistent(source, pending, target);
  const db = openRead(pending); let info;
  try { info = inspect(db, pending, owner); } finally { db.close(); }
  return preparePublication(target, pending, 'snapshot.json', { format: 'archive-snapshot-v1', schemaVersion: 2, schemaFingerprint, owner, createdAt: Date.now(), ...info });
}
function manifestFor(source, owner) {
  const manifestPath = join(source, 'snapshot.json'), input = join(source, 'archive.sqlite');
  if (!existsSync(manifestPath) || statSync(manifestPath).size > SNAPSHOT_LIMITS.manifestBytes) fail('SNAPSHOT_INCOMPLETE_OR_OVERSIZE');
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (Object.keys(m).sort().join(' ') !== 'bytes collectionEnabled counts createdAt format owner readRevision schemaFingerprint schemaVersion sha256 stateDigest' || m.format !== 'archive-snapshot-v1' || m.schemaVersion !== 2 || m.schemaFingerprint !== schemaFingerprint || m.owner !== owner || !integer(m.createdAt, 1, Date.now()) || !/^[a-f0-9]{64}$/.test(m.sha256) || m.bytes !== checkedSize(input) || m.sha256 !== fileHash(input)) fail('INVALID_SNAPSHOT');
  return { m, input };
}
/** C只读会话：校验和后续所有分页共用同一读事务，revision不是外部改写保护。 */
export function openQuerySnapshot(source, owner) {
  const { m, input } = manifestFor(source, owner), db = openRead(input);
  try {
    db.exec('PRAGMA query_only=ON; BEGIN;');
    const info = inspect(db, input, owner);
    if (canonical(info) !== canonical({ readRevision: m.readRevision, counts: m.counts, collectionEnabled: m.collectionEnabled, stateDigest: m.stateDigest }) || fileHash(input) !== m.sha256) fail('SNAPSHOT_CHANGED_DURING_OPEN');
    if (db.prepare('SELECT 1 FROM archive_runs WHERE json_extract(config,\'$.createdAt\')>? LIMIT 1').get(m.createdAt) || db.prepare('SELECT 1 FROM archive_facts WHERE received_at>? OR (kind=\'bar\' AND occurred_at+json_extract(payload,\'$.intervalMs\')>received_at) LIMIT 1').get(m.createdAt)) fail('SNAPSHOT_FUTURE_RECEIPT');
    return { db, manifest: m, close: () => { db.exec('ROLLBACK'); db.close(); } };
  } catch (e) { db.close(); throw e; }
}
function restore({ source, target, owner }) {
  const { m, input } = manifestFor(source, owner);
  const db = openRead(input); let info;
  try { info = inspect(db, input, owner); } finally { db.close(); }
  if (canonical(info) !== canonical({ readRevision: m.readRevision, counts: m.counts, collectionEnabled: m.collectionEnabled, stateDigest: m.stateDigest })) fail('SNAPSHOT_MANIFEST_MISMATCH');
  const pending = join(target, 'archive.pending.sqlite');
  copyConsistent(input, pending, target);
  // 再校验副本，防止验证输入与复制之间被修改；物理hash不等于供应商签名。
  const copied = openRead(pending);
  try { if (canonical(inspect(copied, pending, owner)) !== canonical(info) || fileHash(input) !== m.sha256) fail('SNAPSHOT_CHANGED_DURING_RESTORE'); }
  finally { copied.close(); }
  const restored = new DatabaseSync(pending);
  try {
    restored.exec("PRAGMA trusted_schema=OFF; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; BEGIN IMMEDIATE; UPDATE archive_meta SET collection_enabled=0; UPDATE archive_runs SET status=CASE WHEN status='traversed' THEN status ELSE 'paused' END,reason=CASE WHEN status='traversed' THEN reason ELSE COALESCE(reason,'cancelled') END,lease_token=NULL,lease_until=NULL; UPDATE archive_sources SET lease_owner=NULL,lease_run=NULL,lease_token=NULL,lease_until=NULL; COMMIT;");
    info = inspect(restored, pending, owner);
  } finally { restored.close(); }
  return preparePublication(target, pending, 'restore.json', { format: 'archive-restore-v1', schemaVersion: 2, schemaFingerprint, owner, createdAt: Date.now(), sourceSha256: m.sha256, ...info });
}

if (!isMainThread) {
  try { parentPort.postMessage({ result: workerData.command === 'create' ? create(workerData) : workerData.command === 'restore' ? restore(workerData) : fail('INVALID_COMMAND') }); }
  catch (e) { parentPort.postMessage({ error: e.message }); }
}
