import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {recordsFixture,NOW,SITE,SUBJECT} from './fixtures/ai30-production-records.mjs';
const symbol='BTC-USDT';
const snapshot=f=>f.request('/api/interpretation',{action:'snapshot',symbol});
const interpret=(f,id,options)=>f.request('/api/interpretation',{action:'interpret',symbol,snapshotId:id},options);
const read=(f,id,options)=>f.request('/api/interpretation/result?'+new URLSearchParams({symbol,snapshotId:id}),undefined,options);

test('revoked grants survive restart and regrant only permits records from the new revision', async t => {
 const f = await recordsFixture(t);
 const original = (await snapshot(f)).body.snapshotId;
 const firstResult = await interpret(f, original);
 assert.equal(firstResult.status, 200);

 await f.db.prepare('UPDATE ai_access_grants SET enabled=0').run();
 assert.equal((await read(f, original)).status, 403);
 await f.restart();
 assert.equal((await read(f, original)).status, 403);
 // Even an operator reopening access cannot reuse the scope of old snapshots.
 await assert.rejects(f.db.prepare('UPDATE ai_access_grants SET enabled=1').run(), /grant_revision/);
 await f.db.prepare('UPDATE ai_access_grants SET enabled=1, revision=2').run();
 const scope = createHash('sha256').update(JSON.stringify(['ai-scope-v1',SITE,SUBJECT,2])).digest('hex');
 await f.db.batch([
  f.db.prepare(`INSERT INTO ai_budget_policies SELECT 'regrant',mode,pilot,authorization_id,?,
    max_calls,max_nano,stop_on_failure,stopped,stop_reason FROM ai_budget_policies WHERE id='fixture-policy'`).bind(scope),
  f.db.prepare(`INSERT INTO ai_context_policy_links SELECT 'regrant',authorization_id,policy_version,?,
    review_started_at,review_until FROM ai_context_policy_links WHERE policy_id='fixture-policy'`).bind(scope),
  f.db.prepare("UPDATE ai_budget_control SET policy_id='regrant' WHERE id=1"),
 ]);
 const fresh = await snapshot(f);
 assert.equal(fresh.status, 200);
 const freshId = fresh.body.snapshotId;
 const secondResult = await interpret(f, freshId);
 assert.equal(secondResult.status, 200);
 assert.notEqual(secondResult.body.requestId, firstResult.body.requestId);
 await f.restart();
 assert.equal((await read(f, freshId)).body.requestId, secondResult.body.requestId);
 assert.equal((await read(f, original)).body.error, 'record_unavailable');
 assert.equal((await interpret(f, original)).body.error, 'record_unavailable');
 assert.equal((await f.rows('requests')).length, 2);
 assert.equal(f.egress, 0);
});

test('D1 keeps a permanent grant identity and only narrows decoded rights within a revision', async t => {
 const f = await recordsFixture(t);
 const run = (sql, ...values) => f.db.prepare(sql).bind(...values).run();
 for (const sql of [
  'DELETE FROM ai_access_grants',
  "UPDATE ai_access_grants SET site_id='different-site',revision=2",
  "UPDATE OR REPLACE ai_access_grants SET subject_id='different-owner',revision=2",
  'INSERT OR REPLACE INTO ai_access_grants SELECT * FROM ai_access_grants',
 ]) await assert.rejects(run(sql), /grant_identity_immutable/, sql);
 // A separately named row cannot implicitly replace the old grant through a rowid collision.
 await assert.rejects(run("INSERT OR REPLACE INTO ai_access_grants(rowid,site_id,subject_id,revision,enabled,expires_at,permissions_json,symbols_json) VALUES(1,'site','new',1,1,0,'[]','[]')"), /rowid/);

 await run('UPDATE ai_access_grants SET revision=2,permissions_json=?,symbols_json=?',
  '["read","manage","invoke"]', '["BTC/USDT","BTC-USDT"]');
 await run('UPDATE ai_access_grants SET permissions_json=?,symbols_json=?',
  '[ "invoke", "\\u0072ead", "manage" ]', '["BTC-USDT","BTC\\/USDT"]');
 await run('UPDATE ai_access_grants SET permissions_json=?,symbols_json=?,expires_at=?',
  '["read"]', '["BTC/USDT"]', NOW + 1000);
 for (const widening of [
  "permissions_json='[\"read\",\"invoke\"]'",
  "symbols_json='[\"BTC/USDT\",\"BTC-USDT\"]'",
  'expires_at=expires_at+1',
  'revision=1',
 ]) await assert.rejects(run('UPDATE ai_access_grants SET ' + widening), /grant_revision_required/, widening);
 const grant = await f.db.prepare('SELECT * FROM ai_access_grants').first();
 assert.deepEqual(grant, {site_id:SITE, subject_id:SUBJECT, revision:2, enabled:1,
  expires_at:NOW+1000, permissions_json:'["read"]', symbols_json:'["BTC/USDT"]'});
});

test('D1 rejects malformed grant writes so repairing a malformed row cannot restore its old scope', async t => {
 const f = await recordsFixture(t);
 const original = await f.db.prepare('SELECT * FROM ai_access_grants').first();
 const invalid = /grant_revision_required|grant_invalid|CHECK constraint failed|malformed JSON/i;
 const invalidUpdates = [
  ['revision=0'], ['revision=1.5'], ['revision=9007199254740992'], ["revision='v2'"],
  ['revision=2,expires_at=expires_at-0.5'], ['revision=2,expires_at=9007199254740992'],
  ["revision=2,permissions_json='{}'"], ["revision=2,permissions_json='invalid'"],
  ['revision=2,permissions_json=?', '["read","owner"]'],
  ['revision=2,permissions_json=?', '["read",false]'],
  ["revision=2,permissions_json=permissions_json||char(0)||'suffix'"],
  ['revision=2,permissions_json=?', '["read\\u0000x"]'],
  ['revision=2,symbols_json=?', '["BTC-USDT",["nested"]]'],
  ['revision=2,symbols_json=?', '["BTC-USDT",""]'],
  ['revision=2,symbols_json=?', '["BTC-USDT","bad symbol"]'],
  ['revision=2,symbols_json=?', '["BTC-USDT","BTC\\u0000x"]'],
  ["revision=2,symbols_json=symbols_json||char(0)||'suffix'"],
  ['revision=2,symbols_json=?', JSON.stringify(['A'.repeat(81)])],
  ['revision=2,symbols_json=?', JSON.stringify(Array(17).fill('BTC-USDT'))],
 ];
 for (const [assignment, ...values] of invalidUpdates) {
  await assert.rejects(f.db.prepare('UPDATE ai_access_grants SET ' + assignment).bind(...values).run(), invalid, assignment);
 }
 for (const [permissions, symbols] of [['["owner"]','[]'], ['["read"]','["bad symbol"]']]) {
  await assert.rejects(f.db.prepare('INSERT INTO ai_access_grants VALUES(?,?,1,1,?,?,?)')
   .bind(SITE, 'new-owner', NOW+1000, permissions, symbols).run(), invalid);
 }
 assert.deepEqual((await f.db.prepare('SELECT * FROM ai_access_grants').all()).results, [original]);
});

test('hosted composition can read the original authorized result after the product key is removed',async t=>{
 const f=await recordsFixture(t), s=await snapshot(f);
 const original=await interpret(f,s.body.snapshotId);
 assert.equal(original.status,200);
 await f.request('/__test/config',{flags:{hostedWithoutKey:true}});
 const capability=await f.request();
 assert.equal(capability.body.reason,'provider_not_configured');
 assert.deepEqual(capability.body.allowedSymbols,[symbol]);
 assert.equal(capability.body.realProviderEnabled,false);
 assert.deepEqual((await read(f,s.body.snapshotId)).body.modelSelection,original.body.modelSelection);
 assert.equal((await read(f,s.body.snapshotId,{subject:'fixture-visitor'})).status,403);
 assert.equal((await snapshot(f)).body.error,'provider_not_configured');
 assert.equal((await f.rows('requests')).length,1);
 assert.equal((await f.rows('ai_snapshots')).length,1);
 assert.equal(f.egress,0);
});

test('C2 actual workerd: capture → another instance interpretation → restart → saved result; no network',async t=>{
 const f=await recordsFixture(t);assert.equal((await f.request()).body.admission,'ready');
 const s=await snapshot(f);assert.equal(s.status,200,JSON.stringify(s.body));
 const r=await interpret(f,s.body.snapshotId,{worker:'beta'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.format,'site-interpretation-v1');assert.equal(r.body.deploymentMode,'site_pilot');
 assert.equal((await f.rows('requests')).length,1);assert.equal((await f.rows('ai_results')).length,1);
 await f.restart();await f.request('/__test/config',{time:NOW+61000});
 const saved=await read(f,s.body.snapshotId);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.oldSnapshot,true);assert.equal(saved.body.snapshot.capturedAt,NOW);assert.deepEqual(saved.body.modelSelection,r.body.modelSelection);assert.equal(saved.body.cacheHit,true);
 assert.deepEqual((await f.request('/__test/stats')).body,{time:NOW+61000,loads:0,calls:0});assert.equal(f.egress,0);
});
test('C2 default source decision blocks all acquisition and model calls despite an environment key/flag',async t=>{
 const f=await recordsFixture(t);const r=await f.request('/__test/default');assert.equal(r.body.reason,'data_permission_unavailable');
 await f.request('/__test/config',{flags:{noGrant:true}});assert.equal((await snapshot(f)).body.error,'data_permission_unavailable');assert.equal((await f.rows('ai_snapshots')).length,0);
 assert.equal((await f.request('/__test/stats')).body.loads,0);assert.equal(f.egress,0);
});
test('C2 strict route rejects anonymous, cross-origin, unknown fields and invalid read query without work',async t=>{
 const f=await recordsFixture(t);
 for(const options of [{subject:null},{subject:'fixture-visitor'},{headers:{origin:'https://evil.invalid'}},{headers:{host:'evil.invalid'}}]){
  assert.notEqual((await f.request('/api/interpretation',{action:'snapshot',symbol},options)).status,200);
 }
 for(const extra of [{scope:'owner'},{context:{}},{model:'other'},{rights:true}])assert.equal((await f.request('/api/interpretation',{action:'snapshot',symbol,...extra})).body.error,'invalid_request');
 assert.equal((await f.request('/api/interpretation/result?symbol=BTC-USDT&snapshotId=abcdefghijklmnop&url=x')).body.error,'invalid_request');
 assert.equal((await f.request('/__test/stats')).body.loads,0);assert.equal((await f.rows('requests')).length,0);
});
test('C2 snapshot ownership and source revocation are checked on reads',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;assert.equal((await interpret(f,s.snapshotId)).status,200);
 assert.notEqual((await read(f,s.snapshotId,{subject:'fixture-visitor'})).status,200);
 await f.request('/__test/config',{revoked:true});assert.notEqual((await read(f,s.snapshotId)).status,200);
 assert.equal((await f.request('/__test/stats')).body.calls,1);
});
test('C2 restore never renews 60s freshness or the fixed twenty-minute authorization review',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;await f.restart();await f.request('/__test/config',{time:NOW+60000});
 assert.equal((await interpret(f,s.snapshotId)).body.error,'context_expired');assert.equal((await f.rows('requests')).length,0);
 await f.request('/__test/config',{time:NOW+1200000});assert.notEqual((await read(f,s.snapshotId)).status,200);assert.notEqual((await snapshot(f)).status,200);
});
test('C2 stored result becomes old when underlying history expires before the sixty-second snapshot TTL',async t=>{
 const f=await recordsFixture(t);await f.request('/__test/config',{flags:{historyAge:119999}});
 const s=(await snapshot(f)).body,r=await interpret(f,s.snapshotId);assert.equal(r.status,200);assert.equal(r.body.oldSnapshot,false);
 await f.request('/__test/config',{time:NOW+2});const old=await read(f,s.snapshotId);
 assert.equal(old.status,200);assert.equal(old.body.oldSnapshot,true);assert.equal(old.body.snapshot.expiresAt,NOW+60000);assert.equal((await f.request('/__test/stats')).body.calls,1);
});
test('C2 result storage failure preserves settled accounting and never redispatches',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;await f.db.prepare("CREATE TRIGGER fixture_fail BEFORE INSERT ON ai_results BEGIN SELECT RAISE(ABORT,'fixture_fail'); END").all();
 assert.notEqual((await interpret(f,s.snapshotId)).status,200);assert.equal((await f.rows('requests'))[0].state,'settled');assert.equal((await f.rows('ai_results')).length,0);
 assert.equal((await read(f,s.snapshotId)).body.error,'result_unavailable');assert.notEqual((await interpret(f,s.snapshotId)).status,200);assert.equal((await f.request('/__test/stats')).body.calls,1);
});
test('C2 immutable records and bounded expiry cleanup leave financial identity/counts intact',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;assert.equal((await interpret(f,s.snapshotId)).status,200);
 await assert.rejects(f.db.prepare("UPDATE ai_snapshots SET fresh_until=fresh_until+1").all(),/record_immutable/);
 await assert.rejects(f.db.prepare("UPDATE ai_results SET body='{}'").all(),/record_immutable/);
 const before=await f.rows('requests');await f.request('/__test/config',{time:NOW+30*86400000});await f.request('/__test/purge');
 assert.equal((await f.rows('ai_snapshots')).length,0);assert.equal((await f.rows('ai_results')).length,0);assert.deepEqual(await f.rows('requests'),before);assert.equal((await f.rows('ai_dispatch_intents')).length,1);
});
test('C2 spending shutdown preserves authorized reads, never creates another request',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;assert.equal((await interpret(f,s.snapshotId)).status,200);
 await f.db.prepare('UPDATE ai_budget_control SET enabled=0 WHERE id=1').all();
 const capability=(await f.request()).body;assert.equal(capability.admission,'blocked');assert.equal(capability.reason,'disabled');assert.deepEqual(capability.allowedSymbols,[symbol]);
 assert.equal((await read(f,s.snapshotId)).status,200);assert.equal((await snapshot(f)).body.error,'disabled');assert.equal((await f.rows('requests')).length,1);
});
test('C2 a local-only or different-site source grant cannot authorize hosted acquisition',async t=>{
 const f=await recordsFixture(t);
 for(const grant of [{deployment:'local_pilot'},{deployment:'site_pilot',siteId:'other-site'},{siteId:'fixture-site',storage:'local-only'}]){
  await f.request('/__test/config',{grant});assert.equal((await snapshot(f)).body.error,'data_permission_unavailable');
 }
 assert.equal((await f.request('/__test/stats')).body.loads,0);assert.equal((await f.rows('requests')).length,0);
});
test('capability reports a current, read-only grant after a slow policy read; reads do not spend',async t=>{
 const f=await recordsFixture(t), s=(await snapshot(f)).body;
 const paid=await interpret(f,s.snapshotId); assert.equal(paid.status,200);
 await f.request('/__test/config',{flags:{jumpLinkAt:1,readOnlyOnLink:true}});
 const cap=await f.request();assert.equal(cap.status,200);
 assert.deepEqual(cap.body,{format:'site-ai-capability-v1',mode:'site_controlled',auth:'site_session',deploymentMode:'site_pilot',
  admission:'blocked',reason:'read_only',allowedSymbols:[symbol],realProviderEnabled:false});
 await f.request('/__test/config',{flags:{}});
 const saved=await read(f,s.snapshotId);assert.equal(saved.status,200);assert.equal(saved.body.requestId,paid.body.requestId);
 for(const body of [{action:'snapshot',symbol},{action:'interpret',symbol,snapshotId:s.snapshotId}]){
  const denied=await f.request('/api/interpretation',body);assert.equal(denied.status,403);assert.equal(denied.body.error,'access_denied');
 }
 assert.equal((await f.request('/api/interpretation',{action:'disable'})).status,400);
 for(const patch of [{permissions:['manage'],symbols:[symbol]}, {permissions:['read'],symbols:['ETH-USDT']}]){
  await f.db.prepare('UPDATE ai_access_grants SET revision=revision+1,permissions_json=?,symbols_json=? WHERE subject_id=?')
   .bind(JSON.stringify(patch.permissions),JSON.stringify(patch.symbols),SUBJECT).run();
  const denied=await f.request();assert.equal(denied.body.admission,'blocked');assert.deepEqual(denied.body.allowedSymbols,[]);
  assert.equal((await read(f,s.snapshotId)).body.error,'access_denied');
 }
 assert.deepEqual((await f.request('/__test/stats')).body,{time:NOW,loads:1,calls:1});
 assert.equal((await f.rows('requests')).length,1);assert.equal(f.egress,0);
});
test('C2 switching to a different policy with the same source/scope cannot spend on an old snapshot',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;
 await f.db.batch([
  f.db.prepare("INSERT INTO ai_budget_policies SELECT 'replacement',mode,pilot,authorization_id,scope_hash,max_calls,max_nano,stop_on_failure,stopped,stop_reason FROM ai_budget_policies WHERE id='fixture-policy'"),
  f.db.prepare("INSERT INTO ai_context_policy_links SELECT 'replacement',authorization_id,policy_version,scope_hash,review_started_at,review_until FROM ai_context_policy_links WHERE policy_id='fixture-policy'"),
  f.db.prepare("UPDATE ai_budget_control SET policy_id='replacement' WHERE id=1"),
 ]);
 assert.equal((await interpret(f,s.snapshotId)).body.error,'permission_revoked');assert.equal((await f.rows('requests')).length,0);assert.equal((await f.request('/__test/stats')).body.calls,0);
});
test('C2 final D1 read crossing the review deadline cannot return an authorized result',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;assert.equal((await interpret(f,s.snapshotId)).status,200);
 await f.request('/__test/config',{flags:{jumpLinkAt:2,jumpTime:NOW+1200000}});
 assert.equal((await read(f,s.snapshotId)).body.error,'permission_revoked');assert.equal((await f.request('/__test/stats')).body.calls,1);
});
test('C2 grant revocation during final D1 policy read is checked before returning saved data',async t=>{
 const f=await recordsFixture(t),s=(await snapshot(f)).body;assert.equal((await interpret(f,s.snapshotId)).status,200);
 await f.request('/__test/config',{flags:{jumpLinkAt:2,revokeOnLink:true}});
 assert.equal((await read(f,s.snapshotId)).body.error,'access_denied');assert.equal((await f.request('/__test/stats')).body.calls,1);
});
test('C2 capacity stops acquisition before loader and keeps the original immutable snapshots',async t=>{
 const f=await recordsFixture(t);for(let i=0;i<16;i++)assert.equal((await snapshot(f)).status,200);
 const before=(await f.request('/__test/stats')).body;assert.equal((await snapshot(f)).body.error,'snapshot_capacity');assert.equal((await f.request('/__test/stats')).body.loads,before.loads);
 assert.equal((await f.rows('ai_snapshots')).length,16);assert.equal((await f.rows('requests')).length,0);
});
