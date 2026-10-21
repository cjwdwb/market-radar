import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Miniflare } from 'miniflare';
import { ProductBudget } from '../../lib/ai/product-budget.mjs';
import { REAL_AI, DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from '../../lib/ai/real-config.ts';
import { provisionMigrationTarget, openMigrationTarget } from '../../lib/ai/budget-migration.mjs';

export const NOW = Date.UTC(2026, 9, 21, 12), TARGET = 'fixture-migration-d1';
function directory(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const cleanup = () => {
    const target = realpathSync(dir);
    if (dirname(target) !== realpathSync(tmpdir()) || !basename(target).startsWith(prefix)) throw Error('fixture_cleanup_path');
    rmSync(target, { recursive: true, force: true });
  };
  return { dir, cleanup };
}
export function sourceFixture(t, { histories = true } = {}) {
  const { dir, cleanup } = directory('mr-migration-source-'), path = join(dir, 'fixture.sqlite');
  const ledger = new ProductBudget(path, { initialize: true });
  ledger.enableProviderProfiles();
  const handles = [ledger];
  t.after(() => { for (const handle of handles) handle.close(); cleanup(); });
  const rows = [];
  function history(provider, state, at) {
    const profile = provider === 'openai' ? REAL_AI : DEEPSEEK_AI;
    const reservation = ledger.reserve({ now: at, pilot: SYNTHETIC_PILOT_ID, maximumNano: 100000, model: profile.model, provider });
    const usage = { inputTokens: 10, outputTokens: 2 }, cost = 10 * profile.cacheWriteNanoPerToken + 2 * profile.outputNanoPerToken;
    if (state === 'settled') ledger.settle(reservation.id, { now: at + 1, usageCostNano: cost, usage, outcome: 'completed', responseId: `fixture-${provider}` });
    else if (state === 'unknown') ledger.unknown(reservation.id, at + 1, 'timeout');
    rows.push({ ...reservation, provider, usage, cost });
    return reservation;
  }
  if (histories) {
    history('openai', 'settled', Date.UTC(2026, 8, 20));
    history('deepseek', 'settled', NOW - 1000);
    history('deepseek', 'unknown', NOW - 100);
  }
  return { dir, path, ledger, rows, history, open() { const second = new ProductBudget(path); handles.push(second); return second; } };
}
export async function targetFixture(t, { provision = true, targetId = TARGET } = {}) {
  const { dir, cleanup } = directory('mr-migration-d1-');
  let runtime, db, capability, egress = 0;
  const start = async () => {
    runtime = new Miniflare({ d1Persist: dir, modules: true, script: 'export default {fetch(){return new Response("fixture only")}}',
      compatibilityDate: '2026-05-22', host: '127.0.0.1', d1Databases: { BUDGET: 'fixture-migration' },
      outboundService: () => { egress++; return new Response('blocked', { status: 503 }); } });
    db = await runtime.getD1Database('BUDGET');
  };
  t.after(async () => { await runtime?.dispose(); cleanup(); if (egress) throw Error('unexpected_fixture_egress'); });
  await start();
  const sql = readFileSync(new URL('../../db/ai-production-budget.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/^--.*$/gm, '').split(/;(?=\s*(?:CREATE|INSERT)|\s*$)/).filter(s => s.trim());
  await db.batch(statements.map(statement => db.prepare(statement)));
  if (provision) capability = await provisionMigrationTarget({ targetId, db });
  return { get db() { return db; }, get capability() { return capability; }, get egress() { return egress; },
    async bind(bound) { return openMigrationTarget({ targetId, db: bound }); },
    async restart() { await runtime.dispose(); await start(); if (provision) capability = await openMigrationTarget({ targetId, db }); },
    async rows(table) {
      if (!['metadata','requests','request_profiles','ai_budget_control','ai_budget_target','ai_budget_migration','ai_budget_policies','ai_dispatch_intents','sqlite_master'].includes(table)) throw Error('fixture_table');
      return (await db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results;
    },
  };
}
// Fault injection belongs to the test harness, not the migration API.
export function interceptBatches(db, intercept) {
  const wrap = (statement, sql) => ({ sql, statement, bind(...values) { return wrap(statement.bind(...values), sql); } });
  return { prepare(sql) { return wrap(db.prepare(sql), sql); },
    async batch(statements) {
      const sql = statements.map(statement => statement.sql);
      return intercept(sql, () => db.batch(statements.map(statement => statement.statement)));
    },
  };
}
