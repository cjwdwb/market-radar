import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { ProductBudget, REAL_CONTEXT_BATCH_ID } from '../lib/ai/product-budget.mjs';
import { REAL_AI, DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';

const NOW = Date.UTC(2026, 9, 19, 12);
const grant = { authorizationId: 'isolated-test-authorization', policyVersion: 'isolated-test-policy-v1', activatedAt: NOW };
const batch = (snapshotId = 'isolated-snapshot') => ({ id: REAL_CONTEXT_BATCH_ID, authorizationId: grant.authorizationId, policyVersion: grant.policyVersion, snapshotId, scopeHash: 'a'.repeat(64) });
const request = (extra = {}) => ({ now: NOW, pilot: SYNTHETIC_PILOT_ID, maximumNano: 10000, provider: 'deepseek', model: DEEPSEEK_AI.model, ...extra });
function fixture(t, oldCalls = 11) {
  const dir = mkdtempSync(join(tmpdir(), 'mr-real-batch-')), path = join(dir, 'budget.sqlite');
  let ledger = new ProductBudget(path, { initialize: true });
  // 先构造旧v1事实，再通过原profile迁移；不是正式库或来源数据。
  for (let i = 0; i < oldCalls; i++) {
    const r = ledger.reserve({ now: NOW - 1000, pilot: SYNTHETIC_PILOT_ID, maximumNano: 2000 });
    ledger.settle(r.id, { now: NOW - 500, usageCostNano: REAL_AI.cacheWriteNanoPerToken + REAL_AI.outputNanoPerToken,
      usage: { inputTokens: 1, outputTokens: 1 }, outcome: i === 0 ? 'validation_failed' : 'completed', responseId: `old-response-${i}` });
  }
  ledger.enableProviderProfiles();
  const close = () => { ledger?.close(); ledger = null; };
  t.after(() => { close(); rmSync(dir, { recursive: true, force: true }); });
  return { path, get ledger() { return ledger; }, close, reopen() { close(); ledger = new ProductBudget(path); return ledger; } };
}
const rows = ledger => ledger.db.prepare('SELECT * FROM requests ORDER BY id').all();
const profiles = ledger => ledger.db.prepare('SELECT * FROM request_profiles ORDER BY request_id').all();
const finish = (ledger, reserved, outcome = 'completed') => ledger.settle(reserved.id, { now: NOW + 1, usageCostNano: 1500,
  usage: { inputTokens: 1, outputTokens: 1 }, outcome, responseId: 'isolated-response' });

test('real batch: ordinary open does not migrate; explicit enable preserves all 11 old requests/prices and is idempotent', t => {
  const f = fixture(t), oldRows = rows(f.ledger), oldProfiles = profiles(f.ledger), before = f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID);
  assert.throws(() => f.ledger.inspectRealContextBatch(), /batch_unavailable/);
  assert.throws(() => f.ledger.reserve(request({ batch: batch() })), /batch_unavailable/);
  f.reopen();
  assert.equal(f.ledger.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='real_context_batches'").get().n, 0);
  assert.equal(Object.hasOwn(f.ledger.db.prepare('SELECT * FROM metadata').get(), 'real_context_batch_version'), false);
  const expected = { id: REAL_CONTEXT_BATCH_ID, calls: 0, limit: 3, stopped: false, authorizationId: grant.authorizationId, policyVersion: grant.policyVersion };
  assert.deepEqual(f.ledger.enableRealContextBatch(grant), expected);
  assert.deepEqual(f.ledger.enableRealContextBatch({ ...grant, activatedAt: NOW + 5000 }), expected);
  assert.equal(f.ledger.db.prepare('SELECT activated_at FROM real_context_batches').get().activated_at, NOW);
  assert.throws(() => f.ledger.enableRealContextBatch({ ...grant, authorizationId: 'replacement' }), /batch_identity_mismatch/);
  assert.throws(() => f.ledger.enableRealContextBatch({ ...grant, policyVersion: 'replacement' }), /batch_identity_mismatch/);
  assert.deepEqual(rows(f.ledger), oldRows); assert.deepEqual(profiles(f.ledger), oldProfiles);
  assert.deepEqual(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID), before);
  assert.equal(f.ledger.db.prepare('SELECT identity FROM metadata').get().identity, 'market-radar-product-budget-v2');
  f.reopen(); assert.deepEqual(f.ledger.inspectRealContextBatch(), expected);
});

test('real batch: activation waits for original active reservations without discarding occupancy', t => {
  const f = fixture(t), r = f.ledger.reserve(request());
  assert.throws(() => f.ledger.enableRealContextBatch(grant), /budget_recovery_required/);
  assert.equal(Object.hasOwn(f.ledger.db.prepare('SELECT * FROM metadata').get(), 'real_context_batch_version'), false);
  assert.equal(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID).active, 1);
  f.ledger.unknown(r.id, NOW + 1, 'unknown');
  f.ledger.enableRealContextBatch(grant);
  assert.equal(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.reserved, 10000);
  assert.equal(f.ledger.inspectRealContextBatch().calls, 0);
});

test('real batch: three completed calls persist across reopen and another process', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant);
  for (let i = 0; i < 3; i++) {
    const r = f.ledger.reserve(request({ batch: batch(`snapshot-${i}`) }));
    assert.equal(f.ledger.inspectRealContextBatch().calls, i + 1);
    finish(f.ledger, r);
    f.reopen(); assert.equal(f.ledger.inspectRealContextBatch().calls, i + 1);
  }
  const before = f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID);
  assert.equal(before.pilot.calls, 14); assert.equal(before.pilot.reserved, 0);
  assert.throws(() => f.ledger.reserve(request({ batch: batch('fourth') })), /batch_exhausted/);
  f.close();
  const output = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    `import {ProductBudget} from './lib/ai/product-budget.mjs';const b=new ProductBudget(process.argv[1]);let code;try{b.reserve(JSON.parse(process.argv[2]));}catch(e){code=e.message;}console.log(JSON.stringify({view:b.inspectRealContextBatch(),code}));b.close();`, f.path, JSON.stringify(request({ batch: batch('child-fourth') }))],
  { cwd: new URL('..', import.meta.url), windowsHide: true, encoding: 'utf8' });
  assert.equal(JSON.parse(output).view.calls, 3); assert.equal(JSON.parse(output).code, 'batch_exhausted');
  f.reopen(); assert.deepEqual(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID), before);
});

test('real batch: an already-open second connection cannot exceed the persistent third reservation', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant);
  const other = new ProductBudget(f.path);
  try {
    const first = f.ledger.reserve(request({ batch: batch('one') }));
    assert.throws(() => other.reserve(request({ batch: batch('concurrent') })), /busy/);
    finish(f.ledger, first);
    finish(other, other.reserve(request({ batch: batch('two') })));
    finish(f.ledger, f.ledger.reserve(request({ batch: batch('three') })));
    assert.throws(() => other.reserve(request({ batch: batch('four') })), /batch_exhausted/);
    assert.equal(other.inspectRealContextBatch().calls, 3);
  } finally { other.close(); }
});

test('real batch: original 20-call, pilot money and project month limits still bind before batch insert', async t => {
  await t.test('original pilot 20', t => {
    const f = fixture(t, 19); f.ledger.enableRealContextBatch(grant);
    finish(f.ledger, f.ledger.reserve(request({ batch: batch() })));
    assert.throws(() => f.ledger.reserve(request({ batch: batch('next') })), /budget_exhausted/);
    assert.equal(f.ledger.inspectRealContextBatch().calls, 1); assert.equal(f.ledger.inspect(NOW, SYNTHETIC_PILOT_ID).pilot.calls, 20);
  });
  await t.test('original pilot money', t => {
    const f = fixture(t, 0), r = f.ledger.reserve(request({ maximumNano: REAL_AI.pilotNano })); f.ledger.unknown(r.id, NOW, 'unknown');
    f.ledger.enableRealContextBatch(grant);
    assert.throws(() => f.ledger.reserve(request({ batch: batch() })), /budget_exhausted/);
    assert.equal(f.ledger.inspectRealContextBatch().calls, 0);
  });
  await t.test('all callers share UTC month', t => {
    const f = fixture(t, 0);
    for (let i = 0; i < 28; i++) { const r = f.ledger.reserve(request({ pilot: `existing-caller-${i}`, maximumNano: REAL_AI.pilotNano })); f.ledger.unknown(r.id, NOW, 'unknown'); }
    f.ledger.enableRealContextBatch(grant);
    assert.throws(() => f.ledger.reserve(request({ batch: batch() })), /budget_exhausted/);
    assert.equal(f.ledger.inspectRealContextBatch().calls, 0);
    const nextMonth = Date.UTC(2026, 10, 1), r = f.ledger.reserve(request({ now: nextMonth, batch: batch() }));
    f.ledger.unknown(r.id, nextMonth, 'unknown'); assert.equal(f.ledger.inspectRealContextBatch().calls, 1);
  });
});

test('real batch: malformed/changed authorization, scope and pilot never reserve or change the old ledger', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant); const before = rows(f.ledger), oldProfiles = profiles(f.ledger);
  for (const b of [null, {}, { ...batch(), id: 'another-batch' }, { ...batch(), authorizationId: 'other' }, { ...batch(), policyVersion: 'other' },
    { ...batch(), scopeHash: 'short' }, { ...batch(), snapshotId: '../outside' }, { ...batch(), extra: true }]) assert.throws(() => f.ledger.reserve(request({ batch: b })), /batch_identity_mismatch/);
  assert.throws(() => f.ledger.reserve(request({ batch: batch(), pilot: 'replacement' })), /batch_identity_mismatch/);
  assert.throws(() => f.ledger.reserve(request({ batch: batch(), now: NOW - 1 })), /batch_identity_mismatch/);
  assert.deepEqual(rows(f.ledger), before); assert.deepEqual(profiles(f.ledger), oldProfiles); assert.equal(f.ledger.inspectRealContextBatch().calls, 0);
});

test('real batch: durable stop cannot reactivate or overwrite its reason, while old synthetic reservations remain available', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant);
  const r = f.ledger.reserve(request({ batch: batch() })); finish(f.ledger, r);
  assert.equal(f.ledger.stopRealContextBatch('organization_failed').stopped, true);
  f.reopen(); assert.equal(f.ledger.enableRealContextBatch(grant).stopped, true);
  f.ledger.stopRealContextBatch('later_reason'); assert.equal(f.ledger.db.prepare('SELECT stop_reason FROM real_context_batches').get().stop_reason, 'organization_failed');
  assert.throws(() => f.ledger.reserve(request({ batch: batch('next') })), /batch_stopped/);
  assert.throws(() => f.ledger.db.exec('UPDATE real_context_batches SET stopped=0,stop_reason=NULL'), /batch_identity_immutable/);
  finish(f.ledger, f.ledger.reserve(request())); assert.equal(f.ledger.inspectRealContextBatch().calls, 1);
});

test('real batch: failed settlement and unknown stop atomically before another connection can reserve', async t => {
  for (const outcome of ['organization_failed', 'validation_failed', 'cancelled', 'unknown']) await t.test(outcome, t => {
    const f = fixture(t); f.ledger.enableRealContextBatch(grant); const other = new ProductBudget(f.path);
    try {
      const r = f.ledger.reserve(request({ batch: batch() }));
      if (outcome === 'unknown') f.ledger.unknown(r.id, NOW + 1, 'transport_error'); else finish(f.ledger, r, outcome);
      // Deliberately no external stop call between releasing reserved and this next caller.
      assert.throws(() => other.reserve(request({ batch: batch('racing-next-request') })), /batch_stopped/);
      assert.equal(other.inspectRealContextBatch().calls, 1);
      const row = rows(other).find(row => row.id === r.id);
      assert.equal(row.state, outcome === 'unknown' ? 'unknown' : 'settled');
      assert.equal(row.charged, outcome === 'unknown' ? null : 3000);
      assert.equal(row.reserved, 10000);
      f.reopen(); assert.equal(f.ledger.inspectRealContextBatch().stopped, true);
    } finally { other.close(); }
  });
});

test('real batch: stop persistence failure rolls back settlement/unknown and preserves the busy reservation', async t => {
  for (const unknown of [false, true]) await t.test(unknown ? 'unknown' : 'settlement', t => {
    const f = fixture(t); f.ledger.enableRealContextBatch(grant); const r = f.ledger.reserve(request({ batch: batch() }));
    const before = rows(f.ledger).find(row => row.id === r.id);
    f.ledger.db.exec("CREATE TRIGGER reject_atomic_stop BEFORE UPDATE ON real_context_batches BEGIN SELECT RAISE(ABORT,'stop_write_failed'); END");
    assert.throws(() => unknown ? f.ledger.unknown(r.id, NOW + 1, 'transport_error') : finish(f.ledger, r, 'organization_failed'), /stop_write_failed/);
    assert.deepEqual(rows(f.ledger).find(row => row.id === r.id), before);
    assert.equal(f.ledger.inspectRealContextBatch().stopped, false);
    const other = new ProductBudget(f.path);
    try { assert.throws(() => other.reserve(request({ batch: batch('next') })), /busy/); } finally { other.close(); }
  });
});

test('real batch: synthetic failure/unknown do not stop the separately bounded real batch', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant);
  finish(f.ledger, f.ledger.reserve(request()), 'validation_failed');
  const r = f.ledger.reserve(request()); f.ledger.unknown(r.id, NOW + 1, 'transport_error');
  assert.equal(f.ledger.inspectRealContextBatch().stopped, false);
  finish(f.ledger, f.ledger.reserve(request({ batch: batch() })));
  assert.equal(f.ledger.inspectRealContextBatch().stopped, false); assert.equal(f.ledger.inspectRealContextBatch().calls, 1);
});

test('real batch: migration and reservation failures roll back profile, parent, link and marker atomically', t => {
  const f = fixture(t), before = rows(f.ledger), oldProfiles = profiles(f.ledger);
  f.ledger.db.exec("CREATE TRIGGER reject_batch_marker BEFORE UPDATE ON metadata WHEN NEW.real_context_batch_version IS NOT NULL BEGIN SELECT RAISE(ABORT,'forced_migration_failure'); END");
  assert.throws(() => f.ledger.enableRealContextBatch(grant), /forced_migration_failure/);
  assert.equal(Object.hasOwn(f.ledger.db.prepare('SELECT * FROM metadata').get(), 'real_context_batch_version'), false);
  assert.equal(f.ledger.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'real_context_%'").get().n, 0);
  assert.deepEqual(rows(f.ledger), before); assert.deepEqual(profiles(f.ledger), oldProfiles);
  f.ledger.db.exec('DROP TRIGGER reject_batch_marker'); f.ledger.enableRealContextBatch(grant);
  f.ledger.db.exec("CREATE TRIGGER reject_batch_link BEFORE INSERT ON real_context_requests BEGIN SELECT RAISE(ABORT,'forced_link_failure'); END");
  assert.throws(() => f.ledger.reserve(request({ batch: batch() })), /forced_link_failure/);
  assert.deepEqual(rows(f.ledger), before); assert.deepEqual(profiles(f.ledger), oldProfiles); assert.equal(f.ledger.inspectRealContextBatch().calls, 0);
});

test('real batch: linked identities and original parent cannot be deleted or rebound', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant); const r = f.ledger.reserve(request({ batch: batch() })); finish(f.ledger, r);
  for (const sql of ['DELETE FROM real_context_requests', "UPDATE real_context_requests SET snapshot_id='replacement'", 'DELETE FROM real_context_batches',
    "UPDATE real_context_batches SET authorization_id='replacement'", `DELETE FROM requests WHERE id='${r.id}'`, `UPDATE requests SET pilot='replacement' WHERE id='${r.id}'`]) assert.throws(() => f.ledger.db.exec(sql), /batch_identity_immutable/);
  assert.equal(f.ledger.inspectRealContextBatch().calls, 1);
});

test('real batch: SQLite REPLACE cannot reactivate a stopped batch, replace linked requests or rebind snapshots', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant); const r = f.ledger.reserve(request({ batch: batch() })); finish(f.ledger, r);
  const before = rows(f.ledger), links = f.ledger.db.prepare('SELECT * FROM real_context_requests').all();
  assert.throws(() => f.ledger.db.exec("INSERT OR REPLACE INTO real_context_requests SELECT request_id,batch_id,'replacement',scope_hash FROM real_context_requests"), /batch_reservation_invalid/);
  assert.throws(() => f.ledger.db.exec(`INSERT OR REPLACE INTO requests SELECT * FROM requests WHERE id='${r.id}'`), /batch_identity_immutable/);
  f.ledger.stopRealContextBatch('organization_failed');
  assert.throws(() => f.ledger.db.exec('INSERT OR REPLACE INTO real_context_batches SELECT id,pilot,authorization_id,policy_version,activated_at,max_calls,0,NULL FROM real_context_batches'), /batch_identity_immutable/);
  assert.deepEqual(rows(f.ledger), before); assert.deepEqual(f.ledger.db.prepare('SELECT * FROM real_context_requests').all(), links);
  assert.equal(f.ledger.inspectRealContextBatch().stopped, true);
});

test('real batch: missing marker, table or protection trigger fails closed without repair', async t => {
  for (const damage of ["UPDATE metadata SET real_context_batch_version=NULL", 'DROP TABLE real_context_requests', 'DROP TABLE real_context_batches',
    'DROP TABLE real_context_requests; DROP TABLE real_context_batches; UPDATE metadata SET real_context_batch_version=NULL',
    'DROP TRIGGER real_context_request_no_delete']) {
    await t.test(damage.slice(0, 50), t => {
      const f = fixture(t); f.ledger.enableRealContextBatch(grant); const before = rows(f.ledger);
      f.ledger.db.exec(damage);
      assert.throws(() => f.ledger.inspectRealContextBatch(), /budget_unavailable/);
      assert.throws(() => f.ledger.reserve(request({ batch: batch() })), /budget_unavailable/);
      assert.throws(() => f.ledger.enableRealContextBatch(grant), /budget_unavailable/);
      assert.deepEqual(rows(f.ledger), before); f.close(); assert.throws(() => new ProductBudget(f.path), /budget_unavailable/);
      const raw = new DatabaseSync(f.path); assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM requests').get().n, 11); raw.close();
    });
  }
});

test('real batch: orphaned links fail validation even with all exact protection definitions present', t => {
  const f = fixture(t); f.ledger.enableRealContextBatch(grant);
  const guard = f.ledger.db.prepare("SELECT sql FROM sqlite_master WHERE name='real_context_request_guard'").get().sql;
  f.ledger.db.exec('PRAGMA foreign_keys=OFF; DROP TRIGGER real_context_request_guard;');
  f.ledger.db.prepare('INSERT INTO real_context_requests VALUES(?,?,?,?)').run('missing-parent', REAL_CONTEXT_BATCH_ID, 'snapshot', 'a'.repeat(64));
  f.ledger.db.exec(guard);
  assert.throws(() => f.ledger.inspectRealContextBatch(), /budget_unavailable/);
  assert.throws(() => f.ledger.reserve(request({ batch: batch() })), /budget_unavailable/);
  f.close(); assert.throws(() => new ProductBudget(f.path), /budget_unavailable/);
});
