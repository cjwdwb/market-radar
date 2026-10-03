import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { canonical, digest } from './store.mjs';
import { RESEARCH_PROTOCOL } from '../lib/history/replay.ts';

const schema = readFileSync(new URL('./research-schema.sql', import.meta.url), 'utf8');
export const JOURNAL_LIMITS = Object.freeze({ bytes: 32 * 1024 ** 2, recordBytes: 256 * 1024, records: 1000, outcomes: 4000 });
const fail = reason => { throw Error(reason); };
const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x1f]/.test(v);
const integer = v => Number.isSafeInteger(v) && v > 0;
const schemaHash = db => digest(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
function expected() { const d = new DatabaseSync(':memory:'); try { d.exec(schema); return schemaHash(d); } finally { d.close(); } }
const expectedHash = expected();

export class ResearchJournal {
  constructor(path, owner) {
    if (!text(owner, 160)) fail('INVALID_OWNER');
    const exists = existsSync(path);
    if (exists && statSync(path).size > JOURNAL_LIMITS.bytes) fail('JOURNAL_SIZE_LIMIT');
    this.db = new DatabaseSync(path); this.owner = owner;
    try {
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=1000;');
      if (!exists) { this.db.exec(schema); this.db.prepare('INSERT INTO journal_meta VALUES(1,1,?)').run(owner); }
      const meta = this.db.prepare('SELECT * FROM journal_meta').all();
      if (schemaHash(this.db) !== expectedHash || meta.length !== 1 || meta[0].owner !== owner || meta[0].schema_version !== 1) fail('JOURNAL_IDENTITY');
      if (Object.values(this.db.prepare('PRAGMA integrity_check(1)').get())[0] !== 'ok') fail('JOURNAL_INTEGRITY');
      this.budget();
    } catch (e) { this.db.close(); throw e; }
  }
  close() { this.db.close(); }
  budget() {
    if (this.db.prepare('PRAGMA page_count').get().page_count * this.db.prepare('PRAGMA page_size').get().page_size > JOURNAL_LIMITS.bytes || this.db.prepare('SELECT count(*) AS n FROM research_records').get().n > JOURNAL_LIMITS.records || this.db.prepare('SELECT count(*) AS n FROM research_outcomes').get().n > JOURNAL_LIMITS.outcomes) fail('JOURNAL_BUDGET');
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); this.budget(); this.db.exec('COMMIT'); return r; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  decode(row) {
    if (!row || Buffer.byteLength(row.body) > JOURNAL_LIMITS.recordBytes) fail('RECORD_NOT_FOUND');
    const body = JSON.parse(row.body);
    if (digest(body) !== row.hash) fail('RECORD_CORRUPT');
    return { id: row.id, ...body };
  }
  get(id) { if (!text(id, 64)) fail('INVALID_RECORD_ID'); return this.decode(this.db.prepare('SELECT * FROM research_records WHERE id=?').get(id)); }
  existing(requestKey, intent) {
    if (!text(requestKey, 100)) fail('INVALID_REQUEST_KEY');
    const row = this.db.prepare('SELECT * FROM research_records WHERE request_key=?').get(requestKey);
    if (!row) return null;
    if (row.intent_hash !== digest(intent)) fail('IDEMPOTENCY_CONFLICT');
    return this.decode(row);
  }
  register({ requestKey, mode, question, correctionOf = null, analysis, service }, now) {
    if (!service || service.owner !== this.owner || service.catalog.snapshot !== analysis?.selection?.snapshot) fail('REGISTRATION_SCOPE_MISMATCH');
    if (!integer(now) || !['historical', 'prospective'].includes(mode) || !text(question, 500) || !(correctionOf === null || text(correctionOf, 64))) fail('INVALID_REGISTRATION');
    const { selection, series, replay, research, snapshotCreatedAt, input } = analysis;
    if (analysis.format !== 'archive-analysis-v1' || series.identity !== 'fixture' || !series.source.startsWith('fixture:') || input.vintage !== 'current_vintage' || research.protocol !== RESEARCH_PROTOCOL.id || replay.calculatedAt > now || research.createdAt > now || snapshotCreatedAt > now || selection.asOf > now || input.bars.some(b => b.receivedAt > now || b.time + series.intervalMs > selection.asOf)) fail('INVALID_REGISTRATION_INPUT');
    const intent = { mode, question, correctionOf, selection }, existing = this.existing(requestKey, intent);
    if (existing) return existing;
    if (correctionOf && this.get(correctionOf).series.key !== series.key) fail('CORRECTION_SERIES_MISMATCH');
    const start = input.bars.find(b => b.time + series.intervalMs === selection.asOf), targetEnd = selection.asOf + RESEARCH_PROTOCOL.targetMs;
    if (mode === 'prospective' && (targetEnd <= now || !start || replay.horizons[0].direction?.availability !== 'available' || replay.horizons[0].volatility?.availability !== 'available')) fail('PROSPECTIVE_INPUT_UNAVAILABLE');
    const body = { identity: mode === 'historical' ? 'fixture_historical_simulation' : 'fixture_prospective', vintage: 'current_vintage', question, correctionOf,
      registeredAt: now, inputCutoff: selection.asOf, calculatedAt: replay.calculatedAt, protocol: RESEARCH_PROTOCOL.id, series, selection,
      snapshotCreatedAt, input, targetEnd: mode === 'prospective' ? targetEnd : null, registeredStartPrice: mode === 'prospective' ? start.close : null,
      analysis: mode === 'historical' ? { replay, research, scan: analysis.scan } : { replay }, limitation: '模拟数据记录；current-vintage不证明严格当时可知，不是方向预测或投资结论。' };
    const serialized = canonical(body);
    if (Buffer.byteLength(serialized) > JOURNAL_LIMITS.recordBytes) fail('RECORD_SIZE_LIMIT');
    return this.transaction(() => {
      const prior = this.existing(requestKey, intent); if (prior) return prior;
      const hash = digest(body), id = digest([this.owner, requestKey, hash]);
      this.db.prepare('INSERT INTO research_records VALUES(?,?,?,?,?,?,?,?)').run(id, requestKey, digest(intent), now, body.identity, correctionOf, serialized, hash);
      return { id, ...body };
    });
  }
  evaluate(id, service, now) {
    if (service.owner !== this.owner) fail('OUTCOME_OWNER_MISMATCH');
    const record = this.get(id);
    if (record.identity !== 'fixture_prospective' || !integer(now) || now < record.registeredAt) fail('INVALID_OUTCOME_CHECK');
    if (now < record.targetEnd) return { status: 'pending', targetEnd: record.targetEnd, checkedAt: now };
    const outcome = service.outcome(record, now);
    const body = { identity: 'fixture_prospective_result', vintage: 'current_vintage', recordId: id, protocol: record.protocol,
      observedWindow: { from: record.inputCutoff, to: record.targetEnd }, registeredStartPrice: record.registeredStartPrice, ...outcome };
    if (!['available','unavailable'].includes(body.status)) fail('INVALID_OUTCOME_STATUS');
    const hash = digest(body), key = digest([id, hash]);
    return this.transaction(() => {
      const prior = this.db.prepare('SELECT * FROM research_outcomes WHERE record_id=? AND hash=?').get(id, hash);
      if (prior) return { id: prior.id, evaluatedAt: prior.evaluated_at, ...JSON.parse(prior.body) };
      const serialized = canonical(body);
      if (Buffer.byteLength(serialized) > JOURNAL_LIMITS.recordBytes) fail('RECORD_SIZE_LIMIT');
      this.db.prepare('INSERT INTO research_outcomes VALUES(?,?,?,?,?)').run(key, id, now, serialized, hash);
      return { id: key, evaluatedAt: now, ...body };
    });
  }
  list(offset = 0) {
    if (!Number.isInteger(offset) || offset < 0 || offset > JOURNAL_LIMITS.records) fail('INVALID_RECORD_PAGE');
    const rows = this.db.prepare('SELECT * FROM research_records ORDER BY registered_at DESC,id DESC LIMIT 21 OFFSET ?').all(offset);
    return { records: rows.slice(0, 20).map(row => {
      const r = this.decode(row), outcomes = this.db.prepare('SELECT id,evaluated_at,body FROM research_outcomes WHERE record_id=? ORDER BY evaluated_at DESC,id DESC LIMIT 5').all(r.id);
      return { id: r.id, identity: r.identity, question: r.question, correctionOf: r.correctionOf, registeredAt: r.registeredAt, inputCutoff: r.inputCutoff, targetEnd: r.targetEnd, series: r.series.asset.id, snapshot: r.selection.snapshot, outcomes: outcomes.map(o => ({ id: o.id, evaluatedAt: o.evaluated_at, ...JSON.parse(o.body) })) };
    }), nextOffset: rows.length > 20 ? offset + 20 : null };
  }
}
