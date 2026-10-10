import { DatabaseSync } from 'node:sqlite';
import { lstatSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { REAL_AI } from './real-config.ts';

const utcMonth = now => new Date(now).toISOString().slice(0, 7);
const integer = n => Number.isSafeInteger(n) && n >= 0;
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
      if (meta?.identity !== 'market-radar-product-budget-v1' || meta.fee_multiplier !== feeMultiplier || this.db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('budget_unavailable');
      // 不能靠重新启动、修改倍率或损坏负数行减小已占用金额。
      const rows = this.db.prepare('SELECT * FROM requests').all();
      if (rows.some(r => !integer(r.reserved) || r.charged !== null && !integer(r.charged) || !['reserved','unknown','settled'].includes(r.state) || r.state === 'settled' && r.charged === null)) throw new Error('budget_unavailable');
    } catch { this.db.close(); throw new Error('budget_unavailable'); }
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
  reserve({ now, pilot, maximumNano, model = REAL_AI.model }) {
    if (!integer(now) || !integer(maximumNano) || maximumNano <= 0 || maximumNano > REAL_AI.pilotNano || model !== REAL_AI.model || !/^[a-zA-Z0-9_-]{1,80}$/.test(pilot)) throw new Error('budget_request_invalid');
    return this.transaction(() => {
      const view = this.inspect(now, pilot);
      if (view.active) throw new Error('busy');
      if (view.monthly.occupied + maximumNano > REAL_AI.dispatchNano || view.pilot.calls >= REAL_AI.pilotCalls || view.pilot.occupied + maximumNano > REAL_AI.pilotNano) throw new Error('budget_exhausted');
      const id = randomUUID();
      this.db.prepare('INSERT INTO requests(id,month,pilot,reserved,state,created_at,model) VALUES(?,?,?,?,?,?,?)').run(id, view.month, pilot, maximumNano, 'reserved', now, model);
      return { id, reservedNano: maximumNano, month: view.month };
    });
  }
  settle(id, { now, usageCostNano, usage, outcome, responseId = null }) {
    if (!integer(now) || !integer(usageCostNano) || !usage || !integer(usage.inputTokens) || !integer(usage.outputTokens) || !/^[a-z_]{1,60}$/.test(outcome)) throw new Error('invalid_usage');
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      if (!row) throw new Error('budget_unavailable');
      const charged = Math.ceil(usageCostNano * this.feeMultiplier);
      if (!integer(charged) || charged > row.reserved) throw new Error('reservation_exceeded');
      if (row.state === 'settled') {
        if (row.usage_cost !== usageCostNano || row.outcome !== outcome) throw new Error('settlement_conflict');
        return row.charged;
      }
      this.db.prepare("UPDATE requests SET charged=?,usage_cost=?,state='settled',ended_at=?,outcome=?,response_id=?,input_tokens=?,output_tokens=? WHERE id=?").run(charged, usageCostNano, now, outcome, responseId, usage.inputTokens, usage.outputTokens, id);
      return charged;
    });
  }
  unknown(id, now, outcome = 'unknown') {
    if (!integer(now) || !/^[a-z_]{1,60}$/.test(outcome)) throw new Error('budget_request_invalid');
    this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      if (!row) throw new Error('budget_unavailable');
      if (row.state !== 'settled') this.db.prepare("UPDATE requests SET state='unknown',ended_at=?,outcome=? WHERE id=?").run(now, outcome, id);
    });
  }
  close() { this.db.close(); }
}
