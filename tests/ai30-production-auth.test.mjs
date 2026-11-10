import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { authorizeAI, authorizeAIRecord, readAICommand, createAIRevalidation } from '../worker/ai-authorization.ts';

// Explicit synthetic identities only; no production user, token, key or data.
const NOW = Date.UTC(2026, 9, 21, 0), ORIGIN = 'https://fixture-market.invalid';
const config = { siteId: 'fixture-site', origin: ORIGIN, symbols: ['BTC-USDT', 'ETH-USDT'] };
const baseGrant = () => ({ siteId: config.siteId, subjectId: 'fixture-owner', revision: 1, enabled: true,
  expiresAt: NOW + 60000, permissions: ['invoke', 'read', 'manage'], symbols: ['BTC-USDT'] });
const store = grant => ({ async get() { return grant; } });

test('actual worker gate: a signed visitor sees generic discovery even with an owner identity; cannot reach site resources', async t => {
  const entry = `import worker from './worker/index.ts';
    export default {fetch(req, env, ctx) { return worker.fetch(req, {
      ACCESS_CODE_HASH:'a'.repeat(64),ACCESS_SESSION_SECRET:'synthetic-visitor-session-secret-for-test',
      AI_FIXTURE_ENABLED:'1',
      get AI_SITE_ENABLED(){throw Error('visitor entered site runtime')},
      get DB(){throw Error('visitor read site database')},
      get MARKET_RADAR_DEEPSEEK_API_KEY(){throw Error('visitor read provider config')}
    },ctx); }};`;
  // Bundle the real access gate and AI routes. Unrelated image/SSR handlers are not used here.
  const built = await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'fixture-visitor-ai.ts'},
    bundle:true,write:false,platform:'neutral',format:'esm',external:['node:*'],conditions:['workerd','browser'],
    plugins:[{name:'non-ai-handlers',setup(b){
      b.onResolve({filter:/^vinext\/server\//},args=>({path:args.path,namespace:'unrelated'}));
      b.onLoad({filter:/.*/,namespace:'unrelated'},()=>({contents:'export const DEFAULT_DEVICE_SIZES=[],DEFAULT_IMAGE_SIZES=[];export const handleImageOptimization=()=>{throw Error()};export default {fetch(){throw Error()}};'}));
    }}]});
  let egress=0;
  const mf=new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-05-22',
    compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',outboundService:()=>{egress++;return new Response(null,{status:503});}});
  t.after(()=>mf.dispose());
  const worker=await mf.getWorker();
  const login=await worker.fetch(ORIGIN+'/from-aether',{redirect:'manual'});
  assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
  const headers={cookie,'oai-authenticated-user-id':'fixture-owner'};
  const capability=await worker.fetch(ORIGIN+'/api/interpretation',{headers});
  assert.equal(capability.status,200);assert.match(capability.headers.get('cache-control'),/private, no-store/);
  assert.deepEqual(await capability.json(),{mode:'unconfigured',demonstration:false,realProviderEnabled:false});
  const local=await worker.fetch('http://127.0.0.1/api/interpretation',{headers});
  assert.deepEqual(await local.json(),{mode:'fixture',demonstration:true,realProviderEnabled:false});
  for(const [path,method] of [['/api/interpretation','POST'],['/api/interpretation/result?symbol=BTC-USDT&snapshotId=abcdefghijklmnop','GET'],
    ['/api/interpretation/control','GET'],['/api/interpretation/control','POST']]){
    assert.equal((await worker.fetch(ORIGIN+path,{method,headers})).status,401);
  }
  assert.equal(egress,0);
});
function req({ method = 'POST', subject = 'fixture-owner', body = { action: 'snapshot', symbol: 'BTC-USDT' }, headers = {}, url = ORIGIN + '/api/ai' } = {}) {
  return new Request(url, { method, headers: { ...(method === 'POST' ? { origin: ORIGIN, 'content-type': 'application/json' } : {}),
    ...(subject === null ? {} : { 'oai-authenticated-user-id': subject }), ...headers }, ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}
const invoke = (r = req(), reader = store(baseGrant()), cfg = config, now = NOW) => authorizeAI(r, 'invoke', 'BTC-USDT', reader, cfg, now);

test('production auth: access code/email alone never grant paid invocation; grant failures fail closed', async () => {
  await assert.rejects(invoke(req({ subject: null, headers: { cookie: 'mr_access=synthetic', 'oai-authenticated-user-email': 'owner@example.invalid' } })), /authentication_required/);
  await assert.rejects(invoke(req({ subject: 'fixture-visitor' })), /access_denied/);
  await assert.rejects(invoke(req(), store(null)), /access_denied/);
  await assert.rejects(invoke(req(), { async get() { throw Error('db unavailable'); } }), /authorization_unavailable/);
  for (const patch of [{ enabled: false }, { expiresAt: NOW }, { revision: 0 }, { siteId: 'other-site' }, { subjectId: 'other-owner' }, { permissions: ['owner'] }])
    await assert.rejects(invoke(req(), store({ ...baseGrant(), ...patch })), /access_denied/);
});

test('production auth: invoke/read/manage are separate, server whitelist defaults closed', async () => {
  for (const permission of ['invoke', 'read', 'manage']) {
    const reader = store({ ...baseGrant(), permissions: [permission] });
    for (const operation of ['invoke', 'read', 'manage']) {
      const call = authorizeAI(req(), operation, operation === 'manage' ? null : 'BTC-USDT', reader, config, NOW);
      if (permission === operation) assert.equal((await call).subjectId, 'fixture-owner');
      else await assert.rejects(call, /access_denied/);
    }
  }
  await assert.rejects(invoke(req(), store(baseGrant()), { ...config, symbols: [] }), /unsupported_asset/);
  await assert.rejects(authorizeAI(req(), 'invoke', 'ETH-USDT', store(baseGrant()), config, NOW), /access_denied/);
  await assert.rejects(authorizeAI(req(), 'invoke', null, store(baseGrant()), config, NOW), /unsupported_asset/);
  // A stopped/empty asset list must not prevent a separately authorized manager from reading controls.
  assert.equal((await authorizeAI(req({ method: 'GET' }), 'manage', null, store(baseGrant()), { ...config, symbols: [] }, NOW)).subjectId, 'fixture-owner');
});

test('production auth: record ownership, grant revision and expiry rechecked on every read', async () => {
  let grant = baseGrant(), lookups = 0;
  const reader = { async get(site, subject) { lookups++; assert.equal(site, config.siteId); assert.equal(subject, 'fixture-owner'); return grant; } };
  const principal = await invoke(req(), reader);
  assert.equal(Object.isFrozen(principal), true);
  assert.match(principal.scope, /^[a-f0-9]{64}$/);
  const record = { ...principal, symbol: 'BTC-USDT', expiresAt: NOW + 20000 };
  assert.equal((await authorizeAIRecord(req({ method: 'GET' }), record, reader, config, NOW)).scope, principal.scope);
  for (const patch of [{ siteId: 'other-site' }, { subjectId: 'other-owner' }, { grantRevision: 2 }, { scope: '0'.repeat(64) }, { expiresAt: NOW }])
    await assert.rejects(authorizeAIRecord(req({ method: 'GET' }), { ...record, ...patch }, reader, config, NOW), /record_unavailable/);
  grant = { ...grant, revision: 2 };
  await assert.rejects(authorizeAIRecord(req({ method: 'GET' }), record, reader, config, NOW), /record_unavailable/);
  grant = { ...grant, enabled: false };
  await assert.rejects(authorizeAIRecord(req({ method: 'GET' }), record, reader, config, NOW), /access_denied/);
  grant = { ...grant, enabled: true };
  await assert.rejects(authorizeAIRecord(req({ method: 'GET' }), record, reader, config, NOW + 60000), /access_denied/);
  assert.equal(lookups, 10);
});

test('production revalidation: each phase re-reads grant, binds original identity and keeps read/invoke separate', async () => {
  let grant = baseGrant(), time = NOW, reads = 0;
  const reader = { async get() { reads++; return grant; } }, request = req();
  const principal = await invoke(request, reader);
  const owned = { ...principal, symbol: 'BTC-USDT', expiresAt: NOW + 40000 };
  const revalidate = createAIRevalidation(request, owned, reader, config, () => time);
  // Neither caller mutation nor a browser-submitted record can change a frozen binding.
  request.headers.set('oai-authenticated-user-id', 'fixture-visitor');
  owned.subjectId = 'fixture-visitor';
  await revalidate('dispatch'); await revalidate('read');
  grant = { ...grant, permissions: ['read'] };
  await assert.rejects(revalidate('dispatch'), /access_denied/);
  await revalidate('read');
  grant = { ...grant, revision: 2 };
  await assert.rejects(revalidate('read'), /record_unavailable/);
  grant = { ...grant, enabled: false };
  await assert.rejects(revalidate('read'), /access_denied/);
  assert.equal(reads, 7);
});

test('production revalidation: expiry during asynchronous lookup cannot authorize dispatch or result read', async () => {
  const principal = await invoke(), owned = { ...principal, symbol: 'BTC-USDT', expiresAt: NOW + 10000 };
  for (const phase of ['dispatch', 'read']) {
    let time = NOW;
    const reader = { async get() { await Promise.resolve(); time = NOW + 10000; return baseGrant(); } };
    const revalidate = createAIRevalidation(req(), owned, reader, config, () => time);
    await assert.rejects(revalidate(phase), /record_unavailable/);
  }
  let time = NOW;
  const reader = { async get() { await Promise.resolve(); time = NOW + 60000; return baseGrant(); } };
  await assert.rejects(createAIRevalidation(req(), { ...owned, expiresAt: NOW + 120000 }, reader, config, () => time)('read'), /record_unavailable/);
});

test('production revalidation: unavailable authorization and changed server whitelist fail closed', async () => {
  const principal = await invoke(), owned = { ...principal, symbol: 'BTC-USDT', expiresAt: NOW + 40000 };
  await assert.rejects(createAIRevalidation(req(), owned, { async get() { throw Error('unavailable'); } }, config, () => NOW)('dispatch'), /authorization_unavailable/);
  const cfg = { ...config, symbols: ['BTC-USDT'] };
  const revalidate = createAIRevalidation(req(), owned, store(baseGrant()), cfg, () => NOW);
  await revalidate('read'); cfg.symbols = [];
  await assert.rejects(revalidate('read'), /unsupported_asset/);
  await assert.rejects(revalidate('invalid'), /access_configuration/);
  cfg.symbols = ['BTC-USDT'];
  // Existing authorizeAI rechecks membership immediately after its lookup, before the new guard.
  await assert.rejects(createAIRevalidation(req(), owned, { async get() { cfg.symbols = []; return baseGrant(); } }, cfg, () => NOW)('dispatch'), /access_denied/);
});

test('production auth: fixed host/origin and method checks happen before grant lookup', async () => {
  let lookups = 0; const reader = { async get() { lookups++; return baseGrant(); } };
  const cases = [
    [req({ url: 'https://other.invalid/api/ai' }), /invalid_host/],
    [req({ headers: { host: 'other.invalid' } }), /invalid_host/],
    [req({ headers: { origin: 'https://other.invalid' } }), /invalid_origin/],
    [req({ headers: { origin: 'null' } }), /invalid_origin/],
    [req({ headers: { 'sec-fetch-site': 'cross-site' } }), /invalid_origin/],
    [req({ headers: { 'content-type': 'text/plain' } }), /invalid_content_type/],
    [req({ method: 'GET' }), /invalid_method/],
    [req({ method: 'PUT' }), /invalid_method/],
  ];
  for (const [request, error] of cases) await assert.rejects(invoke(request, reader), error);
  assert.equal(lookups, 0);
});

test('production auth: strict bounded commands cannot carry facts, authority, model or budget', async () => {
  assert.deepEqual(await readAICommand(req(), config), { action: 'snapshot', symbol: 'BTC-USDT' });
  for (const field of ['Context', 'Prompt', 'model', 'url', 'key', 'trust', 'rights', 'scope', 'role', 'budget', 'ledgerPath'])
    await assert.rejects(readAICommand(req({ body: { action: 'snapshot', symbol: 'BTC-USDT', [field]: 'forged' } }), config), /invalid_request/);
  for (const body of [{ action: 'anything' }, { action: 'interpret', symbol: 'BTC-USDT', snapshotId: 'short' }, { action: 'disable', scope: 'forged' }, 'null', 'not-json'])
    await assert.rejects(readAICommand(req({ body }), config), /invalid_request/);
  await assert.rejects(readAICommand(req({ headers: { 'content-length': '4097' } }), config), /input_limit/);
  await assert.rejects(readAICommand(req({ body: ' '.repeat(4097) }), config), /input_limit/);
  await assert.rejects(readAICommand(req({ headers: { 'content-length': '-1' } }), config), /input_limit/);
});

test('production auth: local workerd checks real Request/crypto and blocks egress (platform header authenticity is NOT verified here)', async () => {
  const built = await build({ absWorkingDir: process.cwd(), tsconfigRaw: {}, stdin: { contents: `
    import {authorizeAI,readAICommand} from './worker/ai-authorization.ts';
    const config=${JSON.stringify(config)}, grant=${JSON.stringify(baseGrant())};
    export default { async fetch(probe) {
      const headers={origin:config.origin,'content-type':'application/json'};
      if(new URL(probe.url).pathname!=='/anonymous') headers['oai-authenticated-user-id']='fixture-owner';
      // Construct a fixture Request inside workerd; this does not simulate Sites' identity edge.
      const request=new Request(config.origin+'/api/ai',{method:'POST',headers,body:JSON.stringify({action:'snapshot',symbol:'BTC-USDT'})});
      try { const principal=await authorizeAI(request,'invoke','BTC-USDT',{async get(){return grant}},config,${NOW});
        const command=await readAICommand(request,config); return Response.json({scope:principal.scope,command});
      } catch(e) { return Response.json({error:e.code},{status:403}); }
    }};`, resolveDir: process.cwd(), sourcefile: 'auth-runtime-fixture.ts', loader: 'ts' }, bundle: true, write: false, platform: 'browser', format: 'esm' });
  let egress = 0;
  const runtime = new Miniflare({ modules: true, script: built.outputFiles[0].text, compatibilityDate: '2026-05-15',
    host: '127.0.0.1', outboundService: () => { egress++; return new Response('blocked', { status: 503 }); } });
  try {
    const ok = await runtime.dispatchFetch('http://localhost/authorized');
    const response = await ok.json();
    assert.equal(ok.status, 200, JSON.stringify(response)); assert.equal(response.scope, (await invoke()).scope);
    const denied = await runtime.dispatchFetch('http://localhost/anonymous');
    assert.equal(denied.status, 403); assert.equal((await denied.json()).error, 'authentication_required');
    assert.equal(egress, 0);
  } finally { await runtime.dispose(); }
});
