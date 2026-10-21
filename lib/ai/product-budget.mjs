import { DatabaseSync } from 'node:sqlite';
import { lstatSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { REAL_AI, DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from './real-config.ts';

const utcMonth = now => new Date(now).toISOString().slice(0, 7);
const integer = n => Number.isSafeInteger(n) && n >= 0;
const profiles = { openai: REAL_AI, deepseek: DEEPSEEK_AI };
export const REAL_CONTEXT_BATCH_ID = 'MR-30B-REAL-CONTEXT-001';
const batchVersion = 'real-context-batch-v1';
const identityText = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,180}$/.test(value);
const batchDefinitions = {
  real_context_batches: `CREATE TABLE real_context_batches (
    id TEXT PRIMARY KEY CHECK(id='${REAL_CONTEXT_BATCH_ID}'), pilot TEXT NOT NULL CHECK(pilot='${SYNTHETIC_PILOT_ID}'),
    authorization_id TEXT NOT NULL, policy_version TEXT NOT NULL, activated_at INTEGER NOT NULL CHECK(activated_at>=0),
    max_calls INTEGER NOT NULL CHECK(max_calls=3), stopped INTEGER NOT NULL CHECK(stopped IN (0,1)), stop_reason TEXT,
    CHECK((stopped=0 AND stop_reason IS NULL) OR (stopped=1 AND stop_reason IS NOT NULL)))`,
  real_context_requests: `CREATE TABLE real_context_requests (
    request_id TEXT PRIMARY KEY REFERENCES requests(id), batch_id TEXT NOT NULL REFERENCES real_context_batches(id),
    snapshot_id TEXT NOT NULL, scope_hash TEXT NOT NULL)`,
  real_context_batch_no_replace: `CREATE TRIGGER real_context_batch_no_replace BEFORE INSERT ON real_context_batches
    WHEN EXISTS(SELECT 1 FROM real_context_batches)
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
  real_context_batch_immutable: `CREATE TRIGGER real_context_batch_immutable BEFORE UPDATE ON real_context_batches
    WHEN NEW.id IS NOT OLD.id OR NEW.pilot IS NOT OLD.pilot OR NEW.authorization_id IS NOT OLD.authorization_id
      OR NEW.policy_version IS NOT OLD.policy_version OR NEW.activated_at IS NOT OLD.activated_at OR NEW.max_calls IS NOT OLD.max_calls
      OR OLD.stopped=1 OR NEW.stopped<>1 OR NEW.stop_reason IS NULL
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
  real_context_batch_no_delete: `CREATE TRIGGER real_context_batch_no_delete BEFORE DELETE ON real_context_batches
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
  real_context_request_guard: `CREATE TRIGGER real_context_request_guard BEFORE INSERT ON real_context_requests
    WHEN NEW.batch_id<>'${REAL_CONTEXT_BATCH_ID}'
      OR EXISTS(SELECT 1 FROM real_context_requests WHERE request_id=NEW.request_id)
      OR NOT EXISTS(SELECT 1 FROM real_context_batches b JOIN requests r ON r.id=NEW.request_id
        WHERE b.id=NEW.batch_id AND b.stopped=0 AND r.pilot=b.pilot AND r.created_at>=b.activated_at)
      OR (SELECT COUNT(*) FROM real_context_requests)>=3
    BEGIN SELECT RAISE(ABORT,'batch_reservation_invalid'); END`,
  real_context_request_no_update: `CREATE TRIGGER real_context_request_no_update BEFORE UPDATE ON real_context_requests
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
  real_context_request_no_delete: `CREATE TRIGGER real_context_request_no_delete BEFORE DELETE ON real_context_requests
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
  real_context_parent_no_delete: `CREATE TRIGGER real_context_parent_no_delete BEFORE DELETE ON requests
    WHEN EXISTS(SELECT 1 FROM real_context_requests WHERE request_id=OLD.id)
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
  real_context_parent_no_replace: `CREATE TRIGGER real_context_parent_no_replace BEFORE INSERT ON requests
    WHEN EXISTS(SELECT 1 FROM real_context_requests WHERE request_id=NEW.id)
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
  real_context_parent_identity: `CREATE TRIGGER real_context_parent_identity BEFORE UPDATE ON requests
    WHEN EXISTS(SELECT 1 FROM real_context_requests WHERE request_id=OLD.id)
      AND (NEW.id IS NOT OLD.id OR NEW.pilot IS NOT OLD.pilot OR NEW.created_at IS NOT OLD.created_at)
    BEGIN SELECT RAISE(ABORT,'batch_identity_immutable'); END`,
};
const normalizedSql = sql => sql?.replace(/\s+/g, ' ').trim().replace(/;$/, '');
/** 专用本地产品预算库。普通打开绝不静默创建/恢复；每个派发先持久预留。 */
export class ProductBudget {
  constructor(path, { initialize = false, feeMultiplier = 2 } = {}) {
    if (!Number.isFinite(feeMultiplier) || feeMultiplier < 2 || feeMultiplier > 10) throw new Error('billing_bound_invalid');
    this.feeMultiplier = feeMultiplier;
    this.path = resolve(path);
    const parent = realpathSync(dirname(this.path));
    if (parent !== dirname(this.path)) throw new Error('budget_path_invalid');
    let exists = false;
    try { const stat = lstatSync(this.path); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('budget_path_invalid'); exists = true; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const marker = `${this.path}.initialized`;
    if (!exists && !initialize) throw new Error('budget_unavailable');
    if (!exists) {
      // 单独的首次初始化标记：丢失账本时不得以“初始化”悄悄重置当月消耗。
      try { writeFileSync(marker, 'market-radar-product-budget-v1', { flag: 'wx', mode: 0o600 }); }
      catch { throw new Error('budget_unavailable'); }
    } else {
      try { if (!lstatSync(marker).isFile() || lstatSync(marker).isSymbolicLink() || readFileSync(marker, 'utf8') !== 'market-radar-product-budget-v1') throw new Error(); }
      catch { throw new Error('budget_unavailable'); }
    }
    this.db = new DatabaseSync(this.path);
    try {
      this.db.exec('PRAGMA busy_timeout=1000; PRAGMA synchronous=FULL;');
      if (!exists && initialize) this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE metadata (id INTEGER PRIMARY KEY CHECK(id=1), identity TEXT NOT NULL, fee_multiplier REAL NOT NULL);
        INSERT INTO metadata VALUES(1,'market-radar-product-budget-v1',${feeMultiplier});
        CREATE TABLE requests (id TEXT PRIMARY KEY, month TEXT NOT NULL, pilot TEXT, reserved INTEGER NOT NULL CHECK(reserved>=0),
          charged INTEGER, usage_cost INTEGER, state TEXT NOT NULL CHECK(state IN ('reserved','unknown','settled')), created_at INTEGER NOT NULL,
          ended_at INTEGER, outcome TEXT, response_id TEXT, input_tokens INTEGER, output_tokens INTEGER, model TEXT NOT NULL);
        CREATE INDEX request_month ON requests(month);
        CREATE INDEX request_pilot ON requests(pilot);
        COMMIT;`);
      const meta = this.db.prepare('SELECT * FROM metadata WHERE id=1').get();
      if (!['market-radar-product-budget-v1', 'market-radar-product-budget-v2'].includes(meta?.identity) || meta.fee_multiplier !== feeMultiplier || this.db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('budget_unavailable');
      // 不能靠重新启动、修改倍率或损坏负数行减小已占用金额。
      const rows = this.db.prepare('SELECT * FROM requests').all();
      if (rows.some(r => !integer(r.reserved) || r.charged !== null && !integer(r.charged) || !['reserved','unknown','settled'].includes(r.state) || r.state === 'settled' && r.charged === null)) throw new Error('budget_unavailable');
      this.profileSchema = meta.identity === 'market-radar-product-budget-v2';
      if (this.profileSchema) this.validateProfiles();
      this.validateRealContextBatch(false);
    } catch { this.db.close(); throw new Error('budget_unavailable'); }
  }
  validateProfiles() {
    const rows = this.db.prepare('SELECT r.id,r.model AS request_model,p.* FROM requests r LEFT JOIN request_profiles p ON p.request_id=r.id').all();
    if (this.db.prepare('SELECT COUNT(*) AS n FROM request_profiles').get().n !== rows.length) throw new Error('budget_unavailable');
    for (const row of rows) {
      const profile = profiles[row.provider];
      if (!profile || row.request_model !== profile.model || row.model !== profile.model || row.price_version !== profile.priceVersion
        || row.adapter_version !== profile.adapterVersion || row.billing_profile !== profile.billingProfile
        || row.input_nano !== profile.cacheWriteNanoPerToken || row.output_nano !== profile.outputNanoPerToken
        || row.fee_multiplier !== this.feeMultiplier) throw new Error('budget_unavailable');
    }
  }
  /** 显式添加式迁移。旧金额与ID不改；inspect/普通开库不偷偷迁移。 */
  enableProviderProfiles() {
    this.transaction(() => {
      const identity = this.db.prepare('SELECT identity FROM metadata WHERE id=1').get().identity;
      if (identity === 'market-radar-product-budget-v2') { this.validateProfiles(); return; }
      if (identity !== 'market-radar-product-budget-v1' || this.db.prepare("SELECT COUNT(*) AS n FROM requests WHERE state='reserved'").get().n) throw new Error('budget_recovery_required');
      if (this.db.prepare('SELECT COUNT(*) AS n FROM requests WHERE model<>?').get(REAL_AI.model).n) throw new Error('budget_unavailable');
      this.db.exec(`CREATE TABLE request_profiles (
        request_id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, price_version TEXT NOT NULL,
        adapter_version TEXT NOT NULL, billing_profile TEXT NOT NULL,
        input_nano INTEGER NOT NULL CHECK(input_nano>=0), output_nano INTEGER NOT NULL CHECK(output_nano>=0),
        fee_multiplier REAL NOT NULL CHECK(fee_multiplier>=2));`);
      this.db.prepare(`INSERT INTO request_profiles SELECT id,?,?,?,?,?,?,?,? FROM requests`).run(
        REAL_AI.provider, REAL_AI.model, REAL_AI.priceVersion, REAL_AI.adapterVersion, REAL_AI.billingProfile,
        REAL_AI.cacheWriteNanoPerToken, REAL_AI.outputNanoPerToken, this.feeMultiplier);
      // 已打开的旧v1进程也不能绕过profile写入。新预留在同一事务先写profile再写request。
      this.db.exec(`CREATE TRIGGER require_request_profile BEFORE INSERT ON requests
        WHEN NOT EXISTS(SELECT 1 FROM request_profiles WHERE request_id=NEW.id)
        BEGIN SELECT RAISE(ABORT,'budget_profile_required'); END;`);
      this.db.prepare("UPDATE metadata SET identity='market-radar-product-budget-v2' WHERE id=1").run();
      this.validateProfiles();
    });
    this.profileSchema = true;
  }
  /** 添加式显式启用；标记使丢表不能被误认为尚未启用，旧v2价格与请求不改。 */
  enableRealContextBatch({ authorizationId, policyVersion, activatedAt }) {
    if (!identityText(authorizationId) || !identityText(policyVersion) || !integer(activatedAt)) throw new Error('batch_identity_invalid');
    return this.transaction(() => {
      const meta = this.db.prepare('SELECT * FROM metadata WHERE id=1').get();
      if (meta.identity !== 'market-radar-product-budget-v2') throw new Error('budget_profile_migration_required');
      this.validateProfiles();
      const existing = this.validateRealContextBatch(false);
      if (existing) {
        if (existing.authorization_id !== authorizationId || existing.policy_version !== policyVersion) throw new Error('batch_identity_mismatch');
        return this.inspectRealContextBatch();
      }
      if (this.db.prepare("SELECT COUNT(*) AS n FROM requests WHERE state='reserved'").get().n) throw new Error('budget_recovery_required');
      if (!Object.hasOwn(meta, 'real_context_batch_version')) this.db.exec('ALTER TABLE metadata ADD COLUMN real_context_batch_version TEXT');
      for (const sql of Object.values(batchDefinitions)) this.db.exec(sql);
      this.db.prepare('INSERT INTO real_context_batches VALUES(?,?,?,?,?,3,0,NULL)').run(REAL_CONTEXT_BATCH_ID, SYNTHETIC_PILOT_ID, authorizationId, policyVersion, activatedAt);
      this.db.prepare('UPDATE metadata SET real_context_batch_version=? WHERE id=1').run(batchVersion);
      return this.inspectRealContextBatch();
    });
  }
  validateRealContextBatch(required = true) {
    try {
      const meta = this.db.prepare('SELECT * FROM metadata WHERE id=1').get();
      const objects = this.db.prepare(`SELECT name,sql FROM sqlite_master WHERE name IN (${Object.keys(batchDefinitions).map(() => '?').join(',')})`).all(...Object.keys(batchDefinitions));
      if (!Object.hasOwn(meta, 'real_context_batch_version') && !objects.length) {
        if (required) throw new Error('batch_unavailable');
        return null;
      }
      if (meta.identity !== 'market-radar-product-budget-v2' || meta.real_context_batch_version !== batchVersion || objects.length !== Object.keys(batchDefinitions).length
        || objects.some(row => normalizedSql(row.sql) !== normalizedSql(batchDefinitions[row.name]))) throw new Error('budget_unavailable');
      const rows = this.db.prepare('SELECT * FROM real_context_batches').all(), batch = rows[0];
      if (rows.length !== 1 || batch.id !== REAL_CONTEXT_BATCH_ID || batch.pilot !== SYNTHETIC_PILOT_ID || batch.max_calls !== 3
        || !identityText(batch.authorization_id) || !identityText(batch.policy_version) || !integer(batch.activated_at)
        || ![0, 1].includes(batch.stopped) || (batch.stopped ? !/^[a-z_]{1,60}$/.test(batch.stop_reason) : batch.stop_reason !== null)) throw new Error('budget_unavailable');
      const links = this.db.prepare(`SELECT b.*,r.id AS parent_id,r.pilot,r.created_at FROM real_context_requests b LEFT JOIN requests r ON r.id=b.request_id`).all();
      if (links.length > 3 || links.some(row => !row.parent_id || row.batch_id !== batch.id || row.pilot !== batch.pilot
        || !integer(row.created_at) || row.created_at < batch.activated_at || !identityText(row.snapshot_id) || !/^[a-f0-9]{64}$/.test(row.scope_hash))) throw new Error('budget_unavailable');
      return { ...batch, calls: links.length };
    } catch (error) { throw new Error(error.message === 'batch_unavailable' ? error.message : 'budget_unavailable'); }
  }
  inspectRealContextBatch() {
    const batch = this.validateRealContextBatch();
    return { id: batch.id, calls: batch.calls, limit: 3, stopped: Boolean(batch.stopped), authorizationId: batch.authorization_id, policyVersion: batch.policy_version };
  }
  stopRealContextBatch(reason) {
    if (typeof reason !== 'string' || !/^[a-z_]{1,60}$/.test(reason)) throw new Error('batch_identity_invalid');
    return this.transaction(() => {
      const batch = this.validateRealContextBatch();
      if (!batch.stopped) this.db.prepare('UPDATE real_context_batches SET stopped=1,stop_reason=? WHERE id=?').run(reason, REAL_CONTEXT_BATCH_ID);
      return this.inspectRealContextBatch();
    });
  }
  // Called only inside settlement/unknown's existing write transaction: the global
  // reserved lock must never be released before a failed real batch is stopped.
  stopLinkedRealContextBatch(id, reason) {
    const batch = this.validateRealContextBatch(false);
    if (batch && !batch.stopped && this.db.prepare('SELECT 1 FROM real_context_requests WHERE request_id=?').get(id)) {
      this.db.prepare('UPDATE real_context_batches SET stopped=1,stop_reason=? WHERE id=?').run(reason, REAL_CONTEXT_BATCH_ID);
    }
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  inspect(now, pilot) {
    const month = utcMonth(now);
    const totals = filter => this.db.prepare(`SELECT COUNT(*) AS calls,
      COALESCE(SUM(CASE WHEN state='settled' THEN charged ELSE reserved END),0) AS occupied,
      COALESCE(SUM(CASE WHEN state='settled' THEN charged ELSE 0 END),0) AS settled,
      COALESCE(SUM(CASE WHEN state!='settled' THEN reserved ELSE 0 END),0) AS reserved FROM requests ${filter}`).get(...(filter.includes('month') ? [month] : [pilot]));
    const monthly = totals('WHERE month=?'), batch = totals('WHERE pilot=?');
    if ([monthly, batch].some(v => Object.values(v).some(n => !integer(n)))) throw new Error('budget_unavailable');
    return { month, monthly, pilot: batch, dispatchRemainingNano: Math.max(0, REAL_AI.dispatchNano - monthly.occupied),
      pilotRemainingNano: Math.max(0, REAL_AI.pilotNano - batch.occupied), billedCost: null, feeMultiplier: this.feeMultiplier,
      active: this.db.prepare("SELECT COUNT(*) AS count FROM requests WHERE state='reserved'").get().count };
  }
  reserve({ now, pilot, maximumNano, model = REAL_AI.model, provider = 'openai', batch }) {
    const profile = profiles[provider];
    if (!profile || !integer(now) || !integer(maximumNano) || maximumNano <= 0 || maximumNano > REAL_AI.pilotNano || model !== profile.model || !/^[a-zA-Z0-9_-]{1,80}$/.test(pilot)) throw new Error('budget_request_invalid');
    return this.transaction(() => {
      const identity = this.db.prepare('SELECT identity FROM metadata WHERE id=1').get().identity;
      if (identity === 'market-radar-product-budget-v2') { this.profileSchema = true; this.validateProfiles(); }
      else if (identity !== 'market-radar-product-budget-v1' || provider !== 'openai') throw new Error('budget_profile_migration_required');
      const realBatch = this.validateRealContextBatch(batch !== undefined);
      if (batch !== undefined) {
        if (!batch || typeof batch !== 'object' || Array.isArray(batch) || Object.keys(batch).sort().join(' ') !== 'authorizationId id policyVersion scopeHash snapshotId'
          || batch.id !== REAL_CONTEXT_BATCH_ID || pilot !== SYNTHETIC_PILOT_ID || batch.authorizationId !== realBatch.authorization_id
          || batch.policyVersion !== realBatch.policy_version || !identityText(batch.snapshotId) || !/^[a-f0-9]{64}$/.test(batch.scopeHash)
          || now < realBatch.activated_at) throw new Error('batch_identity_mismatch');
        if (realBatch.stopped) throw new Error('batch_stopped');
        if (realBatch.calls >= 3) throw new Error('batch_exhausted');
      }
      const view = this.inspect(now, pilot);
      if (view.active) throw new Error('busy');
      if (view.monthly.occupied + maximumNano > REAL_AI.dispatchNano || view.pilot.calls >= REAL_AI.pilotCalls || view.pilot.occupied + maximumNano > REAL_AI.pilotNano) throw new Error('budget_exhausted');
      const id = randomUUID();
      if (this.profileSchema) this.db.prepare('INSERT INTO request_profiles VALUES(?,?,?,?,?,?,?,?,?)').run(id, provider, model, profile.priceVersion,
        profile.adapterVersion, profile.billingProfile, profile.cacheWriteNanoPerToken, profile.outputNanoPerToken, this.feeMultiplier);
      this.db.prepare('INSERT INTO requests(id,month,pilot,reserved,state,created_at,model) VALUES(?,?,?,?,?,?,?)').run(id, view.month, pilot, maximumNano, 'reserved', now, model);
      if (batch !== undefined) this.db.prepare('INSERT INTO real_context_requests VALUES(?,?,?,?)').run(id, REAL_CONTEXT_BATCH_ID, batch.snapshotId, batch.scopeHash);
      return { id, reservedNano: maximumNano, month: view.month };
    });
  }
  settle(id, { now, usageCostNano, usage, outcome, responseId = null }) {
    if (!integer(now) || !integer(usageCostNano) || !usage || !integer(usage.inputTokens) || !integer(usage.outputTokens) || !/^[a-z_]{1,60}$/.test(outcome)) throw new Error('invalid_usage');
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      if (!row) throw new Error('budget_unavailable');
      const profile = this.db.prepare('SELECT identity FROM metadata WHERE id=1').get().identity === 'market-radar-product-budget-v2'
        ? this.db.prepare('SELECT * FROM request_profiles WHERE request_id=?').get(id) : null;
      if (this.profileSchema && !profile) throw new Error('budget_unavailable');
      const charged = Math.ceil(usageCostNano * (profile?.fee_multiplier ?? this.feeMultiplier));
      if (!integer(charged) || charged > row.reserved) throw new Error('reservation_exceeded');
      if (row.state === 'settled') {
        if (row.usage_cost !== usageCostNano || row.outcome !== outcome) throw new Error('settlement_conflict');
        if (outcome !== 'completed') this.stopLinkedRealContextBatch(id, outcome);
        return row.charged;
      }
      if (profile) {
        this.validateProfiles();
        if (usageCostNano !== usage.inputTokens * profile.input_nano + usage.outputTokens * profile.output_nano) throw new Error('invalid_usage');
      }
      this.db.prepare("UPDATE requests SET charged=?,usage_cost=?,state='settled',ended_at=?,outcome=?,response_id=?,input_tokens=?,output_tokens=? WHERE id=?").run(charged, usageCostNano, now, outcome, responseId, usage.inputTokens, usage.outputTokens, id);
      if (outcome !== 'completed') this.stopLinkedRealContextBatch(id, outcome);
      return charged;
    });
  }
  unknown(id, now, outcome = 'unknown') {
    if (!integer(now) || !/^[a-z_]{1,60}$/.test(outcome)) throw new Error('budget_request_invalid');
    this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      if (!row) throw new Error('budget_unavailable');
      if (row.state !== 'settled') this.db.prepare("UPDATE requests SET state='unknown',ended_at=?,outcome=? WHERE id=?").run(now, outcome, id);
      this.stopLinkedRealContextBatch(id, outcome);
    });
  }
  close() { this.db.close(); }
}
