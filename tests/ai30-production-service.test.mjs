import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceFixture, NOW } from './fixtures/ai30-production-service.mjs';

const run = (f, id='one', changes={}, worker='alpha') => f.invoke({action:'run',id,...changes},worker);
const configure = (f, flags={}, grant, worker='alpha') => f.invoke({action:'configure',flags,grant},worker);
const release = (f, stage, worker='alpha') => f.invoke({action:'release',stage},worker);
const stats = (f, worker='alpha') => f.invoke({action:'inspect'},worker);

test('C1 workerd: D1 service requires the current request lifecycle before any reservation', async t => {
  const f=await serviceFixture(t);assert.equal((await run(f,'missing',{noExecution:true})).error,'budget_unavailable');
  assert.equal((await f.rows()).length,0);assert.equal((await stats(f)).calls,0);assert.equal(f.egress,0);
});

test('C1 workerd: D1 service requires server authority revalidation before any reservation', async t => {
  const f=await serviceFixture(t);await configure(f,{noRevalidation:true});assert.equal((await run(f)).error,'authorization_unavailable');
  assert.equal((await f.rows()).length,0);assert.equal((await stats(f)).calls,0);assert.equal(f.egress,0);
});

test('C1 workerd: existing service + D1 + C0 settle fixed-profile selection and cache without external traffic', async t => {
  const f=await serviceFixture(t),first=await run(f);
  assert.ok(first.result,JSON.stringify(first));assert.equal(first.result.deploymentMode,'local_pilot');assert.equal(first.result.inputIdentity,'synthetic');
  assert.equal(first.result.budgetChargedBoundNano,840000);assert.equal(first.result.billedCost,null);
  const cached=await run(f,'cached');assert.equal(cached.result.cacheHit,true);assert.equal(cached.result.requestId,first.result.requestId);
  const state=await stats(f);assert.equal(state.calls,1);assert.ok(state.events.includes('dispatch'));assert.ok(state.events.includes('read'));
  assert.equal((await f.rows())[0].state,'settled');assert.equal((await f.rows('ai_dispatch_intents'))[0].state,'settled');assert.equal(f.egress,0);
});

test('C1 workerd: reserve wait registers one shared flight before a double click; other payload stays busy', async t => {
  const f=await serviceFixture(t);await configure(f,{reserve:true});
  const first=run(f,'first');await f.wait('reserve');const second=run(f,'second');
  const other=await run(f,'other',{scenario:'mixed'});assert.equal(other.error,'busy');
  await f.invoke({action:'cancel',id:'first'});assert.equal((await first).error,'cancelled');
  await release(f,'reserve');assert.ok((await second).result);assert.equal((await stats(f)).events.filter(e=>e==='reserve').length,1);
  assert.equal((await stats(f)).calls,1);assert.equal((await f.rows()).length,1);assert.equal(f.egress,0);
});

test('C1 workerd: cross-instance same-key loser cannot mutate or stop the winner; different-key stays bounded', async t => {
  const f=await serviceFixture(t);await configure(f,{reply:true});const winner=run(f);await f.wait('provider');
  assert.equal((await run(f,'repeat',{},'beta')).error,'busy');
  assert.equal((await run(f,'other',{scenario:'mixed'},'beta')).error,'budget_admission_denied');
  assert.equal((await f.rows())[0].state,'reserved');assert.equal((await f.rows('ai_budget_policies'))[0].stopped,0);
  assert.equal((await stats(f,'beta')).events.filter(e=>e==='unknown').length,0);assert.equal((await stats(f,'beta')).calls,0);
  await release(f,'reply');assert.ok((await winner).result);assert.equal((await f.rows()).length,1);
});

test('C1 workerd: claim commit response lost stays occupied and never replays after restart', async t => {
  const f=await serviceFixture(t);await configure(f,{lostClaim:true});
  assert.equal((await run(f)).error,'budget_unavailable');assert.equal((await stats(f)).calls,0);assert.equal((await stats(f)).events.includes('unknown'),false);
  assert.equal((await f.rows())[0].state,'reserved');assert.equal((await f.rows('ai_dispatch_intents'))[0].state,'dispatch_started');
  await f.restart();assert.equal((await run(f,'retry')).error,'busy');assert.equal((await stats(f)).calls,0);assert.equal((await f.rows()).length,1);
});

test('C1 workerd: false claim proves no ownership and cannot unknown the earlier claimant', async t => {
  const f=await serviceFixture(t);await configure(f,{claimElsewhere:true});
  assert.equal((await run(f)).error,'busy');const state=await stats(f);assert.equal(state.calls,0);assert.equal(state.events.includes('unknown'),false);
  assert.equal((await f.rows())[0].state,'reserved');assert.equal((await f.rows('ai_dispatch_intents'))[0].state,'dispatch_started');
});

test('C1 workerd: a different server authorization cannot borrow the D1 spending policy', async t => {
  const f=await serviceFixture(t);await configure(f,{mismatchedAuthorization:true});
  assert.equal((await run(f)).error,'idempotency_conflict');assert.equal((await stats(f)).calls,0);
  assert.equal((await f.rows())[0].state,'reserved');assert.equal((await f.rows())[0].charged,null);
  assert.equal((await f.rows('ai_dispatch_intents'))[0].state,'ready');assert.equal(f.egress,0);
});

for(const stage of ['reserve','claimed'])test(`C1 workerd: cancellation during ${stage} accounts late owned reservation without dispatch`, async t => {
  const f=await serviceFixture(t);await configure(f,{[stage]:true});const pending=run(f,'cancel');await f.wait(stage);
  await f.invoke({action:'cancel',id:'cancel'});assert.equal((await pending).error,'cancelled');
  await release(f,stage);const state=await f.idle();assert.equal(state.calls,0);assert.equal((await f.rows())[0].state,'unknown');
  assert.ok(state.budget.monthly>0);assert.equal((await f.rows())[0].charged,null);
});

test('C1 workerd: timeout during pending reserve returns promptly but late commit remains charged at its full reserve', async t => {
  const f=await serviceFixture(t);await configure(f,{reserve:true,timeoutMs:30});const pending=run(f);await f.wait('reserve');
  assert.equal((await pending).error,'timeout');await release(f,'reserve');const state=await f.idle();
  assert.equal(state.calls,0);assert.equal((await f.rows())[0].state,'unknown');assert.ok(state.budget.monthly>0);
});

test('C1 workerd: real C0 revocation while claim awaits forbids HTTP and preserves reservation', async t => {
  const f=await serviceFixture(t);await configure(f,{claimed:true});const pending=run(f);await f.wait('claimed');
  await configure(f,{}, {enabled:false});await release(f,'claimed');assert.equal((await pending).error,'permission_revoked');
  assert.equal((await stats(f)).calls,0);assert.equal((await f.rows())[0].state,'unknown');
});

test('C1 workerd: delayed reserve rechecks snapshot freshness before claim', async t => {
  const f=await serviceFixture(t);await configure(f,{reserved:true});const pending=run(f);await f.wait('reserved');
  await f.invoke({action:'configure',now:NOW+60000});await release(f,'reserved');assert.equal((await pending).error,'context_expired');
  assert.equal((await stats(f)).calls,0);assert.equal((await f.rows())[0].state,'unknown');
});

test('C1 workerd: post-response read revocation settles actual usage and denies result/cache', async t => {
  const f=await serviceFixture(t);await configure(f,{reply:true});const pending=run(f);await f.wait('reply');
  await configure(f,{}, {permissions:['invoke']});await release(f,'reply');assert.equal((await pending).error,'permission_revoked');
  const row=(await f.rows())[0];assert.equal(row.state,'settled');assert.equal(row.outcome,'permission_revoked');assert.equal(row.charged,840000);
  assert.equal((await stats(f)).services[0].cache,0);
});

test('C1 workerd: asynchronous settlement must finish before delivery, then permission is rechecked', async t => {
  const f=await serviceFixture(t);await configure(f,{settle:true});let completed=false;const pending=run(f).then(value=>{completed=true;return value});await f.wait('settle');
  assert.equal(completed,false);assert.equal((await f.rows())[0].state,'reserved');
  await configure(f,{}, {enabled:false});await release(f,'settle');assert.equal((await pending).error,'permission_revoked');
  assert.equal((await f.rows())[0].state,'settled');assert.equal((await f.rows())[0].charged,840000);assert.equal((await stats(f)).events.includes('unknown'),false);
});

test('C1 workerd: stop during asynchronous settlement suppresses delivery but finishes accounting', async t => {
  const f=await serviceFixture(t);await configure(f,{settle:true});const pending=run(f);await f.wait('settle');
  await f.invoke({action:'stop'});assert.equal((await pending).error,'disabled');await release(f,'settle');await f.idle();
  assert.equal((await f.rows())[0].state,'settled');assert.equal((await f.rows())[0].charged,840000);assert.equal((await stats(f)).services[0].cache,0);
});

test('C1 workerd: lost settlement response cannot refund an already committed result', async t => {
  const f=await serviceFixture(t);await configure(f,{lostSettlement:true});assert.ok((await run(f)).error);
  assert.equal((await f.rows())[0].state,'settled');assert.equal((await f.rows())[0].charged,840000);assert.equal((await stats(f)).services[0].cache,0);
});

for(const mode of ['cancel','timeout','revoke'])test(`C1 workerd: cached result ${mode} during asynchronous read creates no reservation or late delivery`, async t => {
  const f=await serviceFixture(t);await configure(f,{timeoutMs:500});assert.ok((await run(f)).result);
  const before=(await f.rows()).length;await configure(f,{read:true});const pending=run(f,'cached');await f.wait('read',4);
  if(mode==='cancel')await f.invoke({action:'cancel',id:'cached'});
  if(mode==='revoke'){await configure(f,{}, {enabled:false});await release(f,'read');}
  assert.equal((await pending).error,mode==='revoke'?'permission_revoked':mode==='cancel'?'cancelled':'timeout');
  await release(f,'read');assert.equal((await f.rows()).length,before);assert.equal((await stats(f)).calls,1);
});

test('C1 workerd: disabled authority, unavailable grants and unadmitted context fail closed before transport', async t => {
  const f=await serviceFixture(t,{enabled:false});assert.equal((await run(f)).error,'budget_admission_denied');
  await configure(f,{authUnavailable:true});assert.equal((await run(f,'auth')).error,'authorization_unavailable');
  assert.equal((await run(f,'source',{untrusted:true})).error,'data_permission_unavailable');
  assert.equal((await f.rows()).length,0);assert.equal((await stats(f)).calls,0);assert.equal(f.egress,0);
});

test('C1 workerd: corrupt authoritative ledger blocks the composed service without modifying past accounting', async t => {
  const f=await serviceFixture(t);assert.ok((await run(f)).result);
  await f.db.prepare("INSERT INTO request_profiles SELECT 'fixture-orphan',provider,model,price_version,adapter_version,billing_profile,input_nano,output_nano,fee_multiplier FROM request_profiles LIMIT 1").all();
  assert.equal((await run(f,'corrupt',{scenario:'mixed'})).error,'budget_admission_denied');assert.equal((await f.rows()).length,1);
  assert.equal((await stats(f)).calls,1);assert.equal((await f.rows())[0].charged,840000);assert.equal(f.egress,0);
});
