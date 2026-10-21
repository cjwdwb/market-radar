import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Miniflare } from 'miniflare';
import ts from 'typescript';
import { D1ProductBudget } from '../../lib/ai/d1-budget.ts';
import { DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from '../../lib/ai/real-config.ts';

export const NOW = Date.UTC(2026, 9, 21, 12);
export const SCOPE = 'a'.repeat(64);
export const input = (key = 'one', overrides = {}) => ({ now: NOW, idempotencyKey: key, scopeHash: SCOPE,
  payloadHash: 'b'.repeat(64), payloadBytes: 1000, snapshotId: 'fixture-snapshot', snapshotHash: 'c'.repeat(64), catalogHash: 'd'.repeat(64), ...overrides });
export const settlement = (overrides = {}) => ({ now: NOW + 2, usageCostNano: 1500,
  usage: { inputTokens: 1, outputTokens: 1 }, outcome: 'completed', responseId: 'fixture-response', ...overrides });

// Compile the real pure adapter plus its only dependency for direct execution inside workerd.
// Exact import removal prevents this fixture from silently omitting a new runtime dependency.
const dependency = 'import { ACTIVE_PRODUCT_AI, REAL_AI, DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from "./real-config";';
const adapter = readFileSync(new URL('../../lib/ai/d1-budget.ts', import.meta.url), 'utf8');
if (!adapter.startsWith(dependency) || /^import /m.test(adapter.slice(dependency.length))) throw new Error('fixture_dependency_changed');
const source = (readFileSync(new URL('../../lib/ai/real-config.ts', import.meta.url), 'utf8') + adapter.slice(dependency.length)).replace(/^export /gm, '');
const workerScript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText + `
export default { async fetch(request, env) {
  const { operation, args } = await request.json();
  if (!['reserve','claim','settle','unknown','inspect','disable'].includes(operation)) return new Response('', {status:400});
  try { const result = await new D1ProductBudget(env.BUDGET)[operation](...args); return Response.json({result}); }
  catch (error) { return Response.json({error:error.message}, {status:409}); }
} };`;

// This test-only initializer seeds explicit synthetic provenance. No production adapter can call it.
export async function fixture(t, { seed = true, verified = true, maxCalls = 3, maxNano = 250_000_000, stopOnFailure = false, legacyNumericConstraints = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mr-d1-budget-'));
  let mf, db;
  const start = async () => {
    mf = new Miniflare({ d1Persist: dir, workers: ['alpha','beta'].map(name => ({ name, modules: true,
      script: workerScript, compatibilityDate: '2026-05-22', d1Databases: { BUDGET: 'fixture-budget' } })) });
    db = await mf.getD1Database('BUDGET', 'alpha');
  };
  t.after(async () => {
    await mf?.dispose();
    const target = realpathSync(dir);
    if (dirname(target) !== realpathSync(tmpdir()) || !basename(target).startsWith('mr-d1-budget-')) throw new Error('fixture_cleanup_path');
    rmSync(target, { recursive: true, force: true });
  });
  await start();
  let sql = readFileSync(new URL('../../db/ai-production-budget.sql', import.meta.url), 'utf8');
  // Deliberately emulate the former non-STRICT numeric checks to test already-corrupt storage.
  // Production never weakens a schema or repairs damaged rows on open.
  if (legacyNumericConstraints) sql = sql.replace(/typeof\(([a-z_]+)\)='integer' AND \1 BETWEEN (0|1) AND 9007199254740991/g, '$1>=$2');
  // D1 exec treats each line as a statement; prepare/batch retain CREATE TRIGGER bodies.
  const statements = sql.replace(/^--.*$/gm, '').split(/;(?=\s*(?:CREATE|INSERT)|\s*$)/).filter(s => s.trim());
  await db.batch(statements.map(statement => db.prepare(statement)));
  if (seed) {
    await db.batch([
      db.prepare("INSERT INTO metadata VALUES(1,'market-radar-product-budget-v2',2)"),
      db.prepare("INSERT INTO ai_budget_policies VALUES('fixture-policy','pilot',?,'fixture-authorization',?,?,?, ?,0,NULL)").bind(SYNTHETIC_PILOT_ID, SCOPE, maxCalls, maxNano, Number(stopOnFailure)),
      db.prepare("UPDATE ai_budget_control SET enabled=1,import_status=?,import_hash=?,policy_id='fixture-policy' WHERE id=1").bind(verified ? 'verified' : 'pending', verified ? 'e'.repeat(64) : null),
    ]);
  }
  return { get db() { return db; }, get ledger() { return new D1ProductBudget(db); },
    async invoke(worker, operation, ...args) {
      const target = await mf.getWorker(worker);
      const response = await target.fetch('http://fixture.invalid/', { method: 'POST', body: JSON.stringify({operation,args}) });
      const value = await response.json(); if (!response.ok) throw new Error(value.error); return value.result;
    },
    async restart() { await mf.dispose(); await start(); },
    async rows(table) {
      if (!['requests','request_profiles','ai_dispatch_intents','ai_budget_policies','ai_budget_control'].includes(table)) throw new Error('fixture_table');
      return (await db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results;
    },
    async history({ id = 'historical', atMonth = '2026-10', pilot = SYNTHETIC_PILOT_ID, state = 'settled', reserved = 10000, charged = 3000, profileModel = DEEPSEEK_AI.model } = {}) {
      await db.batch([
        db.prepare('INSERT INTO request_profiles VALUES(?,?,?,?,?,?,?,?,2)').bind(id, DEEPSEEK_AI.provider, profileModel,
          DEEPSEEK_AI.priceVersion, DEEPSEEK_AI.adapterVersion, DEEPSEEK_AI.billingProfile, DEEPSEEK_AI.cacheWriteNanoPerToken, DEEPSEEK_AI.outputNanoPerToken),
        db.prepare(`INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, atMonth, pilot, reserved,
          state === 'settled' ? charged : null, state === 'settled' ? charged / 2 : null, state, NOW - 1000,
          state === 'settled' ? NOW - 1 : null, state === 'settled' ? 'completed' : 'timeout', state === 'settled' ? 'fixture-response' : null,
          state === 'settled' ? 1 : null, state === 'settled' ? 1 : null, DEEPSEEK_AI.model),
      ]);
    },
  };
}
