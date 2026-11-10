import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSiteControl } from '../worker/ai-site-control.ts';
import { recordsFixture, SITE, SUBJECT, ORIGIN } from './fixtures/ai30-production-records.mjs';

function control(db, body, { subject = SUBJECT, origin = ORIGIN } = {}) {
  const request = new Request(ORIGIN + '/api/interpretation/control', {
    method: body ? 'POST' : 'GET',
    headers: { 'oai-authenticated-user-id': subject, origin, 'content-type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  });
  return handleSiteControl(request, { DB: db, AI_SITE_ENABLED: '1', AI_SITE_ID: SITE, AI_SITE_ORIGIN: ORIGIN });
}

test('management can read aggregate usage and stop without a key, source grant or redeploy', async t => {
  const f = await recordsFixture(t);
  await f.db.prepare("UPDATE ai_access_grants SET revision=revision+1, expires_at=?, permissions_json=?, symbols_json=?")
    .bind(Date.now() + 60_000, '["manage"]', '["BTC/USDT"]').run();
  // Equivalent JSON encodings must preserve a legitimate manager's ability to stop.
  await f.db.prepare('UPDATE ai_access_grants SET permissions_json=?,symbols_json=?')
    .bind(String.raw`["\u006danage"]`, String.raw`["BTC\/USDT"]`).run();
  const initial = await control(f.db);
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get('cache-control'), /no-store/);
  const state = await initial.json();
  assert.equal(state.enabled, true);
  assert.equal(state.budget.calls, 0);
  assert.equal(state.budget.billedCost, null);
  for (const [body, opts, status] of [
    [{ action: 'disable' }, { origin: 'https://other.invalid' }, 403],
    [{ action: 'disable' }, { subject: 'another-owner' }, 403],
    [{ action: 'enable' }, {}, 400],
    [{ action: 'disable', policy: 'production' }, {}, 400],
  ]) assert.equal((await control(f.db, body, opts)).status, status);

  assert.equal((await (await control(f.db)).json()).enabled, true);
  assert.deepEqual(await (await control(f.db, { action: 'disable' })).json(), { enabled: false, importStatus: 'verified' });
  await f.restart();
  assert.equal((await (await control(f.db)).json()).enabled, false);
  assert.equal((await f.rows('requests')).length, 0);
  assert.equal(f.egress, 0);
});

test('read/invoke cannot manage and revocation at the stop transaction prevents a stale write', async t => {
  const f = await recordsFixture(t);
  await f.db.prepare("UPDATE ai_access_grants SET revision=revision+1, expires_at=?, permissions_json=?")
    .bind(Date.now() + 60_000, '["read","invoke"]').run();
  assert.equal((await control(f.db)).status, 403);
  assert.equal((await control(f.db, { action: 'disable' })).status, 403);
  // First race uses the canonical schema. The final three deliberately simulate damaged
  // storage to exercise the independent SQL guard even if storage constraints are lost.
  const changes = [
    "revision=revision+1, enabled=0", "permissions_json='{\"removed\":\"manage\"}'",
    "expires_at='expired'", "symbols_json='{}'",
  ];
  for (const [index, change] of changes.entries()) {
    if (index === 1) {
      await f.db.batch([
        f.db.prepare('ALTER TABLE ai_access_grants RENAME TO fixture_intact_grants'),
        f.db.prepare('CREATE TABLE ai_access_grants AS SELECT * FROM fixture_intact_grants'),
      ]);
    }
    await f.db.prepare('UPDATE ai_access_grants SET revision=revision+1,enabled=1,expires_at=?,permissions_json=?,symbols_json=?')
      .bind(Date.now() + 60_000, '["manage"]', '[]').run();
    const racing = {
      prepare: sql => f.db.prepare(sql),
      async batch(statements) {
        await f.db.prepare('UPDATE ai_access_grants SET ' + change).run();
        return f.db.batch(statements);
      },
    };
    assert.equal((await control(racing, { action: 'disable' })).status, 403, change);
  }
  assert.equal((await f.db.prepare('SELECT enabled FROM ai_budget_control').first()).enabled, 1);
  assert.equal((await f.rows('requests')).length, 0);
});
