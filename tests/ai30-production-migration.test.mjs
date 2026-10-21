import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { retireBudgetForMigration, inspectBudgetTransfer, backupRetiredBudget, importRetiredBudget, provisionMigrationTarget, openMigrationTarget } from '../lib/ai/budget-migration.mjs';
import { D1ProductBudget } from '../lib/ai/d1-budget.ts';
import { DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';
import { sourceFixture, targetFixture, interceptBatches, NOW, TARGET } from './fixtures/ai30-production-migration.mjs';

const retire = (source, target) => retireBudgetForMigration(source.ledger.db, { target: target.capability, now: NOW });
const transfer = (capability, target) => importRetiredBudget(capability, target.capability);
const countRetirement = source => source.ledger.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='ai_budget_retirement'").get().n;
const newReserve = ledger => ledger.reserve({ now: NOW + 1, pilot: SYNTHETIC_PILOT_ID, maximumNano: 100000, provider: 'deepseek', model: DEEPSEEK_AI.model });

test('B2: both providers, all months and unknown full reservation survive an atomic disabled import', async t => {
  const source = sourceFixture(t), target = await targetFixture(t), capability = retire(source, target), exported = inspectBudgetTransfer(capability);
  const result = await transfer(capability, target);
  for (const table of ['metadata','requests','request_profiles']) assert.deepEqual(await target.rows(table), exported.payload[table]);
  assert.deepEqual(result.rowHashes, exported.rowHashes); assert.deepEqual(result.totals, exported.totals);
  assert.equal(result.status, 'verified'); assert.equal(result.enabled, false); assert.equal(result.totals.total.unknownNano, 100000);
  assert.deepEqual(Object.keys(result.totals.months), ['2026-09','2026-10']);
  assert.equal((await target.rows('ai_budget_control'))[0].enabled, 0);
  assert.deepEqual(await target.rows('ai_dispatch_intents'), []); assert.deepEqual(await target.rows('ai_budget_policies'), []);
  assert.deepEqual(await transfer(capability, target), result);
  const accounting = await new D1ProductBudget(target.db).inspect(NOW);
  assert.equal(accounting.calls, 3); assert.equal(accounting.pilot, exported.totals.total.occupiedNano);
  assert.equal(target.egress, 0);
});

test('B2: permanent retirement covers already-open old handles and consistent retired backups', async t => {
  const source = sourceFixture(t), target = await targetFixture(t), old = source.open(), capability = retire(source, target), exported = inspectBudgetTransfer(capability);
  assert.throws(() => newReserve(old), /budget_retired/);
  const unknown = source.rows[2];
  assert.throws(() => old.settle(unknown.id, { now: NOW + 2, usageCostNano: unknown.cost, usage: unknown.usage, outcome: 'completed', responseId: 'late' }), /budget_retired/);
  assert.throws(() => old.unknown(unknown.id, NOW + 3, 'timeout'), /budget_retired/);
  assert.throws(() => old.db.prepare('DELETE FROM ai_budget_retirement').run(), /budget_retired/);
  assert.throws(() => old.db.prepare('INSERT OR REPLACE INTO ai_budget_retirement SELECT * FROM ai_budget_retirement').run(), /budget_retired/);
  const reopened = source.open(); assert.throws(() => newReserve(reopened), /budget_retired/);
  assert.deepEqual(inspectBudgetTransfer(retireBudgetForMigration(reopened.db, { target: target.capability, now: NOW + 100 })), exported);
  const backup = backupRetiredBudget(capability, join(source.dir, 'retired-backup.sqlite'));
  assert.equal(backup.payloadHash, exported.receipt.payload_hash); assert.match(backup.fileHash, /^[a-f0-9]{64}$/);
  assert.throws(() => backupRetiredBudget(capability, backup.path), /migration_backup_exists/);
  const copy = new DatabaseSync(backup.path);
  try { assert.throws(() => copy.prepare('UPDATE requests SET charged=0').run(), /budget_retired/); }
  finally { copy.close(); }
});

test('B2: reserved or unknown source schemas cannot retire; nothing is silently omitted', async t => {
  const target = await targetFixture(t);
  for (const kind of ['reserved','extension','table','sqlite-like-name','trigger']) await t.test(kind, t => {
    const source = sourceFixture(t, { histories: false });
    if (kind === 'reserved') source.history('deepseek', 'reserved', NOW - 1);
    if (kind === 'extension') source.ledger.db.exec('ALTER TABLE metadata ADD COLUMN real_context_batch_version TEXT');
    if (kind === 'table') source.ledger.db.exec('CREATE TABLE unexpected(value TEXT)');
    if (kind === 'sqlite-like-name') source.ledger.db.exec('CREATE TABLE sqlitex_extra(value TEXT)');
    if (kind === 'trigger') source.ledger.db.exec("CREATE TRIGGER unexpected BEFORE INSERT ON requests BEGIN SELECT RAISE(ABORT,'unexpected'); END");
    assert.throws(() => retire(source, target), /migration_reserved|migration_schema_unsupported/);
    assert.equal(countRetirement(source), 0);
  });
});

test('B2: malformed numeric types, fee/accounting mismatch and incomplete profiles fail before retirement', async t => {
  const target = await targetFixture(t);
  const cases = [
    "UPDATE requests SET reserved='bad'",
    "UPDATE requests SET charged='bad' WHERE state='settled'",
    "UPDATE requests SET usage_cost=1 WHERE state='settled'",
    "UPDATE requests SET month='2026-01'",
    "UPDATE requests SET input_tokens=-1 WHERE state='settled'",
    "UPDATE request_profiles SET fee_multiplier=3",
    "UPDATE request_profiles SET price_version='unknown'",
    "DELETE FROM request_profiles WHERE request_id=(SELECT id FROM requests LIMIT 1)",
  ];
  for (const sql of cases) await t.test(sql, t => {
    const source = sourceFixture(t); source.ledger.db.exec(sql);
    assert.throws(() => retire(source, target), /migration_source_invalid|migration_input_limit/);
    assert.equal(countRetirement(source), 0);
  });
});

test('B2: fixed 64-row and 256KiB input limits reject oversized source exports', async t => {
  const target = await targetFixture(t);
  await t.test('65 rows', t => {
    const source = sourceFixture(t), request = source.ledger.db.prepare("SELECT * FROM requests WHERE state='settled' LIMIT 1").get();
    const profile = source.ledger.db.prepare('SELECT * FROM request_profiles WHERE request_id=?').get(request.id);
    for (let i = 3; i < 65; i++) {
      const id = `fixture-${i}`;
      source.ledger.db.prepare(`INSERT INTO request_profiles VALUES(${Object.keys(profile).map(() => '?').join(',')})`).run(...Object.values({ ...profile, request_id: id }));
      source.ledger.db.prepare(`INSERT INTO requests VALUES(${Object.keys(request).map(() => '?').join(',')})`).run(...Object.values({ ...request, id }));
    }
    assert.throws(() => retire(source, target), /migration_input_limit/); assert.equal(countRetirement(source), 0);
  });
  await t.test('256KiB', t => {
    const source = sourceFixture(t); source.ledger.db.prepare("UPDATE requests SET response_id=? WHERE state='settled'").run('x'.repeat(256 * 1024));
    assert.throws(() => retire(source, target), /migration_input_limit/); assert.equal(countRetirement(source), 0);
  });
});

test('B2: source retirement write failure rolls back and never produces a transfer capability', async t => {
  const source = sourceFixture(t), db = source.ledger.db, target = await targetFixture(t);
  const broken = { prepare: sql => db.prepare(sql), exec(sql) { if (sql.startsWith('CREATE TRIGGER ai_retired_')) throw Error('fixture_retirement_failure'); return db.exec(sql); } };
  assert.throws(() => retireBudgetForMigration(broken, { target: target.capability, now: NOW }), /fixture_retirement_failure/);
  assert.equal(countRetirement(source), 0);
  await assert.rejects(transfer({ kind: 'market-radar-budget-transfer-v1' }, target), /migration_capability_required/);
  assert.equal((await target.rows('ai_budget_control'))[0].enabled, 0); assert.deepEqual(await target.rows('requests'), []);
});

test('B2: failed import rolls back all writes, keeps source retired, and can retry without clearing target', async t => {
  const source = sourceFixture(t), target = await targetFixture(t), capability = retire(source, target);
  await target.db.prepare("CREATE TRIGGER fixture_import_failure BEFORE INSERT ON requests BEGIN SELECT RAISE(ABORT,'fixture_import_failure'); END").all();
  await assert.rejects(transfer(capability, target), /fixture_import_failure/);
  for (const table of ['requests','request_profiles','metadata']) assert.deepEqual(await target.rows(table), []);
  assert.equal((await target.rows('sqlite_master')).some(row => row.name === 'ai_budget_migration'), false);
  assert.throws(() => newReserve(source.ledger), /budget_retired/);
  await target.db.prepare('DROP TRIGGER fixture_import_failure').all();
  assert.equal((await transfer(capability, target)).status, 'verified');
});

test('B2: lost source retirement commit reply never revives dispatch and permits re-export', async t => {
  const source = sourceFixture(t), db = source.ledger.db, target = await targetFixture(t);
  const lost = { prepare: sql => db.prepare(sql), exec(sql) { const result = db.exec(sql); if (sql === 'COMMIT') throw Error('fixture_source_reply_lost'); return result; } };
  assert.throws(() => retireBudgetForMigration(lost, { target: target.capability, now: NOW }));
  assert.equal(countRetirement(source), 1); assert.throws(() => newReserve(source.ledger), /budget_retired/);
  assert.equal(inspectBudgetTransfer(retire(source, target)).payload.requests.length, 3);
});

test('B2: lost initial/final commit responses recover by immutable receipt after D1 restart', async t => {
  for (const phase of ['initial','verification']) await t.test(phase, async t => {
    const source = sourceFixture(t), target = await targetFixture(t), capability = retire(source, target);
    let fired = false;
    const db = interceptBatches(target.db, async (sql, run) => {
      const result = await run();
      if (!fired && sql.some(s => phase === 'initial' ? s.startsWith('INSERT INTO ai_budget_migration') : s.startsWith("UPDATE ai_budget_migration SET status='verified'"))) {
        fired = true; throw Error('fixture_lost_commit_response');
      }
      return result;
    });
    await assert.rejects(importRetiredBudget(capability, await target.bind(db)), /fixture_lost_commit_response/);
    assert.equal(fired, true); assert.equal((await target.rows('ai_budget_control'))[0].enabled, 0);
    assert.throws(() => newReserve(source.ledger), /budget_retired/);
    await target.restart();
    const reopened = source.open(), freshCapability = retireBudgetForMigration(reopened.db, { target: target.capability, now: NOW + 100 });
    const result = await transfer(freshCapability, target);
    assert.equal(result.status, 'verified'); assert.equal((await target.rows('requests')).length, 3);
    assert.deepEqual(await transfer(freshCapability, target), result);
  });
});

test('B2: pending readback lock rejects concurrent settlement, new rows and control activation', async t => {
  const source = sourceFixture(t), target = await targetFixture(t), capability = retire(source, target), unknown = source.rows[2];
  let checked = false;
  const db = interceptBatches(target.db, async (sql, run) => {
    const result = await run();
    if (sql.some(s => s.startsWith('INSERT INTO ai_budget_migration'))) {
      const ledger = new D1ProductBudget(target.db);
      await assert.rejects(ledger.settle(unknown.id, { now: NOW + 2, usageCostNano: unknown.cost, usage: unknown.usage, outcome: 'completed', responseId: 'late' }), /migration_pending/);
      // An already-unknown row is a harmless no-op; the pending lock protects actual writes.
      await ledger.unknown(unknown.id, { now: NOW + 3, outcome: 'timeout' });
      await assert.rejects(target.db.prepare('UPDATE ai_budget_control SET enabled=1').all(), /migration_pending/);
      await assert.rejects(target.db.prepare('INSERT INTO request_profiles SELECT request_id||\'-extra\',provider,model,price_version,adapter_version,billing_profile,input_nano,output_nano,fee_multiplier FROM request_profiles LIMIT 1').all(), /migration_pending/);
      checked = true;
    }
    return result;
  });
  assert.equal((await importRetiredBudget(capability, await target.bind(db))).status, 'verified');
  assert.equal(checked, true);
  assert.equal((await target.rows('requests')).find(row => row.id === unknown.id).state, 'unknown');
});

test('B2: failed verification remains pending/locked and retries safely; mismatch cannot overwrite', async t => {
  const source = sourceFixture(t), target = await targetFixture(t), capability = retire(source, target);
  const db = interceptBatches(target.db, async (sql, run) => {
    if (sql.some(s => s.startsWith("UPDATE ai_budget_migration SET status='verified'"))) throw Error('fixture_before_verification');
    return run();
  });
  await assert.rejects(importRetiredBudget(capability, await target.bind(db)), /fixture_before_verification/);
  assert.equal((await target.rows('ai_budget_control'))[0].import_status, 'pending');
  await assert.rejects(target.db.prepare('UPDATE requests SET charged=0').all(), /migration_pending/);
  assert.equal((await transfer(capability, target)).status, 'verified');
  const another = sourceFixture(t), otherCapability = retire(another, target);
  await assert.rejects(transfer(otherCapability, target), /migration_target_conflict/);
  assert.equal((await target.rows('requests')).length, 3);
});

test('B2: browser/serialized grants, wrong target and nonempty destination are refused', async t => {
  const source = sourceFixture(t), target = await targetFixture(t), capability = retire(source, target), exported = inspectBudgetTransfer(capability);
  await assert.rejects(transfer(exported, target), /migration_capability_required/);
  const otherTarget = await targetFixture(t, { targetId: 'fixture-other-target' });
  await assert.rejects(transfer(capability, otherTarget), /migration_target_mismatch/);
  assert.throws(() => retire(source, otherTarget), /migration_retirement_conflict/);
  exported.payload.requests.length = 0; // Inspection returns detached data; cannot change the authority.
  assert.equal(inspectBudgetTransfer(capability).payload.requests.length, 3);
  await target.db.prepare("INSERT INTO metadata VALUES(1,'market-radar-product-budget-v2',2)").all();
  await assert.rejects(transfer(capability, target), /CHECK constraint|constraint failed/i);
  assert.equal((await target.rows('ai_budget_control'))[0].import_status, 'pending');
  assert.deepEqual(await target.rows('requests'), []);
});

test('B2 FIX: one retired source cannot initialize two distinct D1 instances with the same label', async t => {
  const source = sourceFixture(t), first = await targetFixture(t), second = await targetFixture(t);
  const firstIdentity = (await first.rows('ai_budget_target'))[0], secondIdentity = (await second.rows('ai_budget_target'))[0];
  assert.equal(firstIdentity.target_id, secondIdentity.target_id);
  assert.notEqual(firstIdentity.instance_id, secondIdentity.instance_id);
  const capability = retire(source, first), manifest = inspectBudgetTransfer(capability);
  assert.equal(manifest.receipt.target_instance, firstIdentity.instance_id);
  const imported = await transfer(capability, first);
  await assert.rejects(transfer(capability, second), /migration_target_mismatch/);
  assert.deepEqual(await second.rows('requests'), []);
  assert.equal((await second.rows('ai_budget_control'))[0].import_status, 'pending');
  assert.throws(() => retire(source, second), /migration_retirement_conflict/);
  await first.restart();
  assert.deepEqual((await first.rows('ai_budget_target'))[0], firstIdentity);
  assert.deepEqual(await transfer(capability, first), imported);
  // Neither successful import nor a fresh same-label instance gains dispatch permission.
  for (const target of [first, second]) {
    assert.equal((await target.rows('ai_budget_control'))[0].enabled, 0);
    assert.deepEqual(await target.rows('ai_budget_policies'), []);
    assert.deepEqual(await target.rows('ai_dispatch_intents'), []);
  }
});

test('B2 FIX: provisioned target identity is immutable and cannot be recreated or forged from a label', async t => {
  const source = sourceFixture(t), target = await targetFixture(t), before = await target.rows('ai_budget_target');
  for (const sql of ["UPDATE ai_budget_target SET instance_id='00000000-0000-4000-8000-000000000000'",
    'DELETE FROM ai_budget_target', 'INSERT OR REPLACE INTO ai_budget_target SELECT * FROM ai_budget_target']) {
    await assert.rejects(target.db.prepare(sql).all(), /migration_target_identity_immutable/);
  }
  await assert.rejects(provisionMigrationTarget({ targetId: TARGET, db: target.db }), /already exists/);
  assert.deepEqual(await target.rows('ai_budget_target'), before);
  assert.throws(() => retireBudgetForMigration(source.ledger.db, { target: { targetId: TARGET, db: target.db }, now: NOW }), /migration_target_capability_required/);
  const capability = retire(source, target);
  await assert.rejects(importRetiredBudget(capability, { targetId: TARGET, db: target.db }), /migration_target_capability_required/);
  await assert.rejects(openMigrationTarget({ targetId: 'wrong-label', db: target.db }), /migration_target_identity_invalid/);
});

test('B2 FIX: import cannot provision an unbound target; explicit provision can recover a lost reply', async t => {
  const source = sourceFixture(t), bound = await targetFixture(t), fresh = await targetFixture(t, { provision: false });
  const capability = retire(source, bound);
  await assert.rejects(openMigrationTarget({ targetId: TARGET, db: fresh.db }), /migration_schema_unsupported/);
  await assert.rejects(importRetiredBudget(capability, { targetId: TARGET, db: fresh.db }), /migration_target_capability_required/);
  assert.equal((await fresh.rows('sqlite_master')).some(row => row.name === 'ai_budget_target'), false);
  const lost = interceptBatches(fresh.db, async (sql, run) => {
    const result = await run();
    if (sql.some(s => s.startsWith('INSERT INTO ai_budget_target'))) throw Error('fixture_provision_reply_lost');
    return result;
  });
  await assert.rejects(provisionMigrationTarget({ targetId: TARGET, db: lost }), /fixture_provision_reply_lost/);
  const opened = await openMigrationTarget({ targetId: TARGET, db: fresh.db });
  await assert.rejects(importRetiredBudget(capability, opened), /migration_target_mismatch/);
  assert.deepEqual(await fresh.rows('requests'), []);
  assert.equal((await fresh.rows('ai_budget_control'))[0].enabled, 0);
});
