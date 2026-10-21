import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, input, settlement, NOW, SCOPE } from './fixtures/ai30-production-budget.mjs';
import { REAL_AI } from '../lib/ai/real-config.ts';
import { D1ProductBudget } from '../lib/ai/d1-budget.ts';

const claim = (ledger, id, now = NOW + 1) => ledger.claim(id, { now, scopeHash: SCOPE });
const finish = async (ledger, reserved, overrides) => { assert.equal((await claim(ledger, reserved.id)).claimed, true); return ledger.settle(reserved.id, settlement(overrides)); };
const counts = async f => Promise.all(['requests','request_profiles','ai_dispatch_intents'].map(async name => (await f.rows(name)).length));

test('D1: schema defaults disabled/unverified and ordinary construction cannot initialize or dispatch', async t => {
  const f = await fixture(t, { seed: false });
  assert.equal((await f.rows('ai_budget_control'))[0].enabled, 0);
  await assert.rejects(f.ledger.reserve(input()), /budget_admission_denied/);
  assert.deepEqual(await counts(f), [0,0,0]);
});

test('D1: enabled fixture policy still cannot reserve before trusted import verification', async t => {
  const f = await fixture(t, {verified:false});
  await assert.rejects(f.ledger.reserve(input()), /budget_admission_denied/);
  assert.deepEqual(await counts(f), [0,0,0]);
});

test('D1: actual workerd batch reserves once for two independent callers and preserves every linked identity', async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([f.invoke('alpha','reserve',input('a')), f.invoke('beta','reserve',input('b'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.deepEqual(await counts(f), [1,1,1]);
  assert.equal((await f.invoke('alpha','inspect',NOW)).active, 1);
  const intent = (await f.rows('ai_dispatch_intents'))[0];
  assert.equal(intent.payload_hash, input().payloadHash);
  assert.equal(Object.hasOwn(intent, 'payload'), false);
  const reserved = results.find(r => r.status === 'fulfilled').value;
  const claimed = await Promise.all(['alpha','beta'].map(worker => f.invoke(worker,'claim',reserved.id,{ now: NOW+1, scopeHash: SCOPE })));
  assert.equal(claimed.filter(result => result.claimed).length, 1);
});

test('D1: commit succeeded but response lost never permits a second claim', async t => {
  const f = await fixture(t);
  const lostResponse = new D1ProductBudget({ prepare: sql => f.db.prepare(sql), async batch(statements) {
    await f.db.batch(statements); throw new Error('fixture_lost_response');
  } });
  await assert.rejects(lostResponse.reserve(input()), /fixture_lost_response/);
  assert.deepEqual(await counts(f), [1,1,1]);
  const original = await f.ledger.reserve(input());
  await assert.rejects(claim(lostResponse, original.id), /fixture_lost_response/);
  await f.restart();
  assert.equal((await claim(f.ledger, original.id)).claimed, false);
  assert.equal((await f.ledger.inspect(NOW)).active, 1);
});

test('D1: ready orphan cannot be refunded through unknown then settlement', async t => {
  const f = await fixture(t), r = await f.ledger.reserve(input());
  await f.ledger.unknown(r.id, {now:NOW+2,outcome:'orphaned'});
  await assert.rejects(f.ledger.settle(r.id, settlement()), /settlement_conflict/);
  await assert.rejects(f.ledger.settle(r.id, settlement({usageCostNano:0,usage:{inputTokens:0,outputTokens:0}})), /settlement_conflict/);
  assert.equal((await f.ledger.inspect(NOW)).monthly, r.reservedNano);
});

test('D1: policy change cannot rebind an existing idempotency key', async t => {
  const f = await fixture(t), r = await f.ledger.reserve(input());
  await f.db.prepare("INSERT INTO ai_budget_policies SELECT 'another',mode,pilot,'new-authorization',scope_hash,max_calls,max_nano,stop_on_failure,0,NULL FROM ai_budget_policies").all();
  await f.db.prepare("UPDATE ai_budget_control SET policy_id='another'").all();
  await assert.rejects(f.ledger.reserve(input()), /idempotency_conflict/);
  assert.equal((await claim(f.ledger, r.id)).claimed, false);
});

test('D1: REPLACE cannot reset requests, policy, accounting profile, intent or imported authority', async t => {
  const f = await fixture(t); await f.ledger.reserve(input());
  for (const table of ['requests','request_profiles','ai_dispatch_intents','ai_budget_policies','ai_budget_control','metadata']) {
    await assert.rejects(f.db.prepare(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table}`).all(), /immutable/);
  }
  assert.deepEqual(await counts(f), [1,1,1]);
});

test('D1: concurrent same-key retries return one reservation; each fixed identity mismatch is rejected', async t => {
  const f = await fixture(t);
  const [a,b] = await Promise.all([f.ledger.reserve(input()), f.ledger.reserve(input())]);
  assert.equal(a.id, b.id); assert.notEqual(a.repeated, b.repeated);
  for (const overrides of [{ payloadHash: 'f'.repeat(64) }, { payloadBytes: 1001 }, { snapshotId: 'different' },
    { snapshotHash: 'f'.repeat(64) }, { catalogHash: 'f'.repeat(64) }]) await assert.rejects(f.ledger.reserve(input('one', overrides)), /idempotency_conflict/);
  await assert.rejects(f.ledger.reserve(input('one', { scopeHash: 'f'.repeat(64) })), /budget_admission_denied/);
  assert.deepEqual(await counts(f), [1,1,1]);
});

test('D1: failed later write rolls back first profile reservation and budget completely', async t => {
  const f = await fixture(t);
  await f.db.prepare("CREATE TRIGGER reject_intent BEFORE INSERT ON ai_dispatch_intents BEGIN SELECT RAISE(ABORT,'fixture_failure'); END").all();
  await assert.rejects(f.ledger.reserve(input()), /fixture_failure/);
  assert.deepEqual(await counts(f), [0,0,0]);
  assert.equal((await f.ledger.inspect(NOW)).monthly, 0);
});

test('D1: claim grants only one caller and neither restart nor retries replay dispatch_started', async t => {
  const f = await fixture(t), r = await f.ledger.reserve(input());
  const results = await Promise.all([claim(f.ledger, r.id), claim(f.ledger, r.id)]);
  assert.equal(results.filter(r => r.claimed).length, 1);
  await f.restart();
  assert.equal((await f.ledger.reserve(input())).id, r.id);
  assert.equal((await claim(f.ledger, r.id)).claimed, false);
  assert.equal((await f.ledger.inspect(NOW)).active, 1);
});

test('D1: disable prevents reserve and claim while known usage still settles an already dispatched request', async t => {
  const f = await fixture(t), ledger = f.ledger, r = await ledger.reserve(input());
  await claim(ledger, r.id); await ledger.disable('operator_stop');
  assert.equal(await ledger.settle(r.id, settlement()), 3000);
  await assert.rejects(ledger.reserve(input('next')), /budget_admission_denied/);
  assert.equal((await ledger.inspect(NOW)).monthly, 3000);
});

test('D1: shutdown between reserve and claim keeps the reservation without a dispatch permit', async t => {
  const f = await fixture(t), r = await f.ledger.reserve(input());
  await f.ledger.disable('operator_stop');
  assert.equal((await claim(f.ledger, r.id)).claimed, false);
  await assert.rejects(f.ledger.settle(r.id, settlement()), /settlement_conflict/);
  assert.equal((await f.ledger.inspect(NOW)).active, 1);
});

test('D1: missing, stopped, or production policy cannot gain dispatch permission', async t => {
  const f = await fixture(t);
  await f.db.prepare("UPDATE ai_budget_control SET policy_id='missing'").all();
  await assert.rejects(f.ledger.reserve(input()), /budget_admission_denied/);
  await f.db.prepare("INSERT INTO ai_budget_policies VALUES('production','production','production','fixture',?,20,250000000,1,0,NULL)").bind(SCOPE).all();
  await f.db.prepare("UPDATE ai_budget_control SET policy_id='production'").all();
  await assert.rejects(f.ledger.reserve(input()), /budget_admission_denied/);
  assert.deepEqual(await counts(f), [0,0,0]);
});

test('D1: exact settlement is concurrent-idempotent and different tokens, outcome or response ID conflict', async t => {
  const f = await fixture(t), r = await f.ledger.reserve(input()); await claim(f.ledger, r.id);
  assert.deepEqual(await Promise.all([f.ledger.settle(r.id, settlement()), f.ledger.settle(r.id, settlement())]), [3000,3000]);
  for (const changes of [{ usage: { inputTokens: 5, outputTokens: 0 } }, { outcome: 'validation_failed' }, { responseId: 'different' }]) {
    await assert.rejects(f.ledger.settle(r.id, settlement(changes)), /settlement_conflict/);
  }
  await f.ledger.unknown(r.id, { now: NOW + 3, outcome: 'timeout' });
  assert.equal((await f.rows('requests'))[0].state, 'settled');
  assert.equal((await f.ledger.inspect(NOW)).monthly, 3000);
});

test('D1: profile-derived usage and reserve ceiling reject lower pricing, excess and immutable-rate rewrites', async t => {
  const f = await fixture(t), r = await f.ledger.reserve(input()); await claim(f.ledger, r.id);
  await assert.rejects(f.ledger.settle(r.id, settlement({ usageCostNano: 1000 })), /invalid_usage/);
  await assert.rejects(f.ledger.settle(r.id, settlement({ usageCostNano: 120000000, usage: { inputTokens: 0, outputTokens: 100000 } })), /reservation_exceeded/);
  await assert.rejects(f.db.prepare('UPDATE request_profiles SET input_nano=1').all(), /budget_profile_immutable/);
  assert.equal((await f.ledger.inspect(NOW)).active, 1);
});

test('D1: inconsistent historical profile model refuses accounting and preserves imported occupancy', async t => {
  const f = await fixture(t); await f.history({state:'unknown',profileModel:'wrong-model'});
  await assert.rejects(f.ledger.settle('historical', settlement()), /budget_profile_invalid/);
  await assert.rejects(f.ledger.inspect(NOW), /budget_unavailable/);
  assert.equal((await f.rows('requests'))[0].reserved, 10000);
});

test('D1: numeric schema rejects text, fractions and unsafe integers instead of coercing spend to zero', async t => {
  const f = await fixture(t);
  for (const reserved of ['not-a-number', 0.5, Number.MAX_SAFE_INTEGER + 1, -1]) {
    await assert.rejects(f.history({state:'unknown',reserved}), /constraint|SQLITE_CONSTRAINT/i);
    assert.deepEqual(await counts(f), [0,0,0]);
  }
  await f.history();
  for (const column of ['charged','usage_cost','input_tokens','output_tokens','ended_at']) {
    for (const value of ['not-a-number', 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(f.db.prepare(`UPDATE requests SET ${column}=? WHERE id='historical'`).bind(value).all(), /constraint|SQLITE_CONSTRAINT/i);
    }
  }
  assert.equal((await f.ledger.inspect(NOW)).monthly, 3000);
});

test('D1: existing old-month corrupt numeric rows block atomic reserve, duplicate lookup, claim and inspect', async t => {
  for (const reserved of ['not-a-number', 0.5, Number.MAX_SAFE_INTEGER + 1]) await t.test(String(reserved), async t => {
    const f = await fixture(t, {legacyNumericConstraints:true}), r = await f.ledger.reserve(input());
    await f.history({state:'unknown',atMonth:'2026-09',reserved});
    const before = await counts(f);
    await assert.rejects(f.invoke('alpha','reserve',input('next')), /budget_admission_denied/);
    await assert.rejects(f.ledger.reserve(input()), /budget_admission_denied/);
    assert.equal((await f.invoke('beta','claim',r.id,{now:NOW+1,scopeHash:SCOPE})).claimed, false);
    await assert.rejects(f.invoke('alpha','inspect',NOW), /budget_unavailable/);
    assert.deepEqual(await counts(f), before);
    assert.equal((await f.rows('ai_dispatch_intents'))[0].state, 'ready');
  });
});

test('D1: corrupt old-month amount blocks first reservation even with no active request', async t => {
  const f = await fixture(t, {legacyNumericConstraints:true});
  await f.history({state:'unknown',atMonth:'2026-09',reserved:'not-a-number'});
  assert.equal((await f.rows('requests')).filter(row => row.state === 'reserved').length, 0);
  assert.equal((await f.rows('ai_dispatch_intents')).length, 0);
  const before = await counts(f);
  await assert.rejects(f.invoke('alpha','reserve',input()), /budget_admission_denied/);
  await assert.rejects(f.invoke('alpha','inspect',NOW), /budget_unavailable/);
  assert.deepEqual(await counts(f), before);
});

test('D1: missing, orphaned or mismatched historical profiles fail closed before any new spend', async t => {
  for (const damage of ['missing','orphan','model']) await t.test(damage, async t => {
    const f = await fixture(t), r = await f.ledger.reserve(input());
    await f.history({state:'unknown',profileModel:damage==='model' ? 'wrong-model' : 'deepseek-flash'});
    if (damage === 'missing') {
      await f.db.prepare('DROP TRIGGER profile_no_delete').all();
      await f.db.prepare("DELETE FROM request_profiles WHERE request_id='historical'").all();
      await f.db.prepare("CREATE TRIGGER profile_no_delete BEFORE DELETE ON request_profiles BEGIN SELECT RAISE(ABORT,'budget_profile_immutable'); END").all();
    }
    if (damage === 'orphan') await f.db.prepare("INSERT INTO request_profiles SELECT 'orphan',provider,model,price_version,adapter_version,billing_profile,input_nano,output_nano,fee_multiplier FROM request_profiles WHERE request_id='historical'").all();
    const before = await counts(f);
    await assert.rejects(f.ledger.reserve(input('next')), /budget_admission_denied/);
    assert.equal((await claim(f.ledger,r.id)).claimed, false);
    await assert.rejects(f.ledger.inspect(NOW), /budget_unavailable/);
    assert.deepEqual(await counts(f), before);
  });
});

test('D1: unknown conserves money across restart/month; late usage settles in original month', async t => {
  const f = await fixture(t), ledger = f.ledger, r = await ledger.reserve(input()); await claim(ledger, r.id);
  await ledger.unknown(r.id, { now: NOW + 2, outcome: 'timeout' }); await f.restart();
  const nextMonth = Date.UTC(2026,10,1), view = await f.ledger.inspect(nextMonth);
  assert.equal(view.active, 0); assert.equal(view.monthly, 0); assert.equal(view.carry, r.reservedNano);
  assert.equal(view.dispatchRemainingNano, REAL_AI.dispatchNano - r.reservedNano);
  await f.ledger.settle(r.id, settlement({ now: nextMonth }));
  assert.equal((await f.rows('requests'))[0].month, '2026-10');
  assert.equal((await f.ledger.inspect(nextMonth)).carry, 0);
});

test('D1: old-month or expired ready intents cannot dispatch in a new month', async t => {
  const f = await fixture(t), r = await f.ledger.reserve(input());
  assert.equal((await claim(f.ledger, r.id, Date.UTC(2026,10,1))).claimed, false);
  assert.equal((await claim(f.ledger, r.id, NOW + REAL_AI.cacheTtlMs)).claimed, false);
  assert.equal((await f.ledger.inspect(NOW)).active, 1);
});

test('D1: original 20-call cap includes historical entries and cannot reset by policy/month', async t => {
  const f = await fixture(t);
  for (let n=0; n<20; n++) await f.history({ id: `historical-${n}` });
  await assert.rejects(f.ledger.reserve(input()), /budget_admission_denied/);
  await assert.rejects(f.ledger.reserve(input('next-month', { now: Date.UTC(2026,10,1) })), /budget_admission_denied/);
  assert.equal((await f.ledger.inspect(NOW)).calls, 20);
});

test('D1: original pilot money and subpolicy money caps independently reject the next reservation', async t => {
  for (const policyLimit of [false,true]) await t.test(String(policyLimit), async t => {
    const maximum = ((1000+2048)*300+2048*1200)*2;
    const f = await fixture(t, {maxNano: policyLimit ? maximum : REAL_AI.pilotNano});
    if (!policyLimit) await f.history({state:'unknown',reserved:REAL_AI.pilotNano-maximum});
    const r = await f.ledger.reserve(input());
    assert.equal(r.reservedNano, maximum);
    await f.ledger.unknown(r.id, {now:NOW+2,outcome:'timeout'});
    await assert.rejects(f.ledger.reserve(input('next')), /budget_admission_denied/);
  });
});

test('D1: last monthly allowance includes prior-month unknown; competing callers cannot overspend', async t => {
  const f = await fixture(t), example = await f.ledger.reserve(input('estimate'));
  await finish(f.ledger, example);
  await f.history({ id: 'other-caller', atMonth: '2026-09', pilot: 'other-pilot', state: 'unknown', reserved: REAL_AI.dispatchNano - 3000 - example.reservedNano });
  const result = await Promise.allSettled([f.ledger.reserve(input('a')), f.ledger.reserve(input('b'))]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await f.ledger.inspect(NOW)).dispatchRemainingNano, 0);
});

test('D1: subpolicy last call and amount are durable while original pilot cumulative spend remains', async t => {
  const f = await fixture(t, { maxCalls: 2 });
  await finish(f.ledger, await f.ledger.reserve(input('one')));
  const attempts = await Promise.allSettled([f.ledger.reserve(input('two')), f.ledger.reserve(input('three'))]);
  const second = attempts.find(r => r.status === 'fulfilled').value;
  await finish(f.ledger, second); await f.restart();
  await assert.rejects(f.ledger.reserve(input('four')), /budget_admission_denied/);
  assert.equal((await f.ledger.inspect(NOW)).calls, 2);
});

test('D1: failure/unknown stop policy in the same transaction; injected stop failure preserves active reservation', async t => {
  for (const failStop of [false,true]) for (const unknown of [false,true]) await t.test(`${failStop}/${unknown}`, async t => {
    const f = await fixture(t, { stopOnFailure: true }), r = await f.ledger.reserve(input()); await claim(f.ledger, r.id);
    if (failStop) await f.db.prepare("CREATE TRIGGER reject_stop BEFORE UPDATE ON ai_budget_policies BEGIN SELECT RAISE(ABORT,'fixture_stop_failure'); END").all();
    const run = () => unknown ? f.ledger.unknown(r.id, { now: NOW + 2, outcome: 'timeout' }) : f.ledger.settle(r.id, settlement({ outcome: 'validation_failed' }));
    if (failStop) { await assert.rejects(run(), /fixture_stop_failure/); assert.equal((await f.ledger.inspect(NOW)).active, 1); }
    else { await run(); assert.equal((await f.rows('ai_budget_policies'))[0].stopped, 1); assert.equal((await f.ledger.inspect(NOW)).active, 0); }
    await assert.rejects(f.ledger.reserve(input('next')), /budget_admission_denied/);
  });
});
