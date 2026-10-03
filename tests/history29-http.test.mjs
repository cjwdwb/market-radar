import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { localHistoryFixture } from './fixtures/history29-local.mjs';
import { startWorkbench } from '../scripts/history-workbench.mjs';

// 明确隔离凭据；不是网站访问码，不向provider/生产发送。
const token = 'fixture-only-history29-http-session';
async function sparePort() { const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r)); return port; }
const raw = (url, path, headers = {}, method = 'POST', body = '{}') => new Promise((resolve, reject) => {
  const r = request(url, { path, method, headers, agent: false }, res => { let text = ''; res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, data: (() => { try { return JSON.parse(text); } catch { return null; } })() })); });
  r.on('error', e => reject(Error(path + ': ' + e.message))); r.end(body);
});

test('stage29 C HTTP: loopback session isolation, bounded query, journal persistence and cancel', async t => {
  const f = await localHistoryFixture(t, { count: 9500 }), port = await sparePort();
  let forwarded = null;
  const upstream = createServer((req, res) => { forwarded = req.headers; res.end('isolated-preview'); });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  const config = { snapshotName: f.name('snapshot'), owner: f.owner, journalName: f.name('journal.sqlite'), token, port, upstream: `http://127.0.0.1:${upstream.address().port}` };
  let session = await startWorkbench(config);
  const headers = { Origin: session.url, 'X-Archive-Key': token, 'Content-Type': 'application/json' };
  const api = (path, body = {}) => raw(session.url, '/__archive/' + path, headers, 'POST', JSON.stringify(body));
  try {
    assert.equal((await raw(session.url, '/__archive/catalog', {})).status, 403);
    assert.equal((await raw(session.url, '/\\[', {}, 'GET', '')).status, 400);
    for (const overrides of [{ Origin: 'https://evil.invalid' }, { Host: 'evil.invalid' }, { 'X-Archive-Key': 'wrong-fixture-key' }, { 'Content-Type': 'text/plain' }]) assert.equal((await raw(session.url, '/__archive/catalog', { ...headers, ...overrides })).status, 403);
    assert.equal((await raw(session.url, '/__archive/catalog', headers, 'GET')).status, 403);
    assert.equal((await raw(session.url, '/__archive/catalog?owner=other', headers)).status, 400);
    assert.equal((await api('catalog', { owner: 'other' })).status, 400);
    const catalog = await api('catalog'); assert.equal(catalog.status, 200); assert.equal(catalog.headers['cache-control'], 'no-store'); assert.equal(catalog.headers['access-control-allow-origin'], undefined);
    const s = catalog.data.series[0], q = { snapshot: catalog.data.snapshot, series: s.key, from: f.from, to: f.end, asOf: f.end };
    const result = await api('query', { selection: q }); assert.equal(result.status, 200); assert.equal(result.data.scan.rows, 9500);
    assert.equal((await api('query', { selection: { ...q, snapshot: '0'.repeat(64) } })).status, 400);
    const register = { selection: q, requestKey: 'http-history', mode: 'historical', question: '隔离研究记录', correctionOf: null };
    const saved = await api('register', register); assert.equal(saved.status, 200); assert.equal(saved.data.identity, 'fixture_historical_simulation');
    assert.deepEqual((await api('register', register)).data, saved.data);
    assert.equal((await api('register', { ...register, registeredAt: 1 })).status, 400);
    assert.equal((await api('records', { offset: 0 })).data.records.length, 1);
    const preview = await raw(session.url, '/', headers, 'GET', ''); assert.equal(preview.status, 200, preview.text); assert.equal(forwarded['x-archive-key'], undefined);
    const aborted = new AbortController();
    const pending = fetch(session.url + '/__archive/query', { method: 'POST', headers, body: JSON.stringify({ selection: q }), signal: aborted.signal }).catch(e => e);
    aborted.abort(); await pending;
    await new Promise(r => setTimeout(r, 50)); const health = await api('health'); assert.equal(health.data.active, 0); assert.equal(health.data.pending, 0);
    await session.close(); session = await startWorkbench(config);
    assert.deepEqual((await api('record', { id: saved.data.id })).data, saved.data);
    assert.equal((await api('query', { selection: q })).data.research.counts.retained, result.data.research.counts.retained);
    await assert.rejects(startWorkbench({ ...config, port: await sparePort(), upstream: 'https://example.com' }), /LOOPBACK_PREVIEW_REQUIRED/);
  } finally { await session.close(); await new Promise(r => upstream.close(r)); }
});

test('reference-only session uses existing auth gate, fixed USD/daily query; never exposes minute research', async t => {
  const { CoinMetricsArchive } = await import('../collector/coinmetrics-archive.mjs');
  const { createHash } = await import('node:crypto');
  const { localFile } = await import('../scripts/history-local.mjs');
  const f = await localHistoryFixture(t, { count: 40 }), referenceName = f.name('reference.sqlite');
  const bytes = Buffer.from('time,PriceUSD\n2026-09-01,100.123456789\n');
  const fixture = ['btc','eth'].map(asset => ({ asset, commit:'a'.repeat(40), blobSha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'), bytes:bytes.length }));
  const store = new CoinMetricsArchive(localFile(referenceName), { create:true, fixture }), received = Date.now();
  store.accept(store.reserve('btc', received), bytes, received); store.close();
  const upstream = createServer((req,res) => res.end('isolated-preview'));
  await new Promise(r => upstream.listen(0,'127.0.0.1',r));
  const port = await sparePort(), session = await startWorkbench({ referenceName, token, upstream:'http://127.0.0.1:'+upstream.address().port, port });
  const headers = { Origin:session.url, 'X-Archive-Key':token, 'Content-Type':'application/json' };
  const api = (action, body) => raw(session.url, '/__archive/'+action, headers, 'POST', JSON.stringify(body));
  try {
    assert.equal((await raw(session.url,'/__archive/reference-query',{})).status,403);
    const catalog = (await api('catalog',{})).data; assert.deepEqual(catalog.series,[]); assert.equal(catalog.reference.identity,'fixture');
    const s = catalog.reference.series[0], query = { asset:s.asset, from:s.range.from, cutoff:s.range.cutoff, version:s.version };
    const response = await api('reference-query',query); assert.equal(response.status,200); assert.equal(response.headers['cache-control'],'no-store');
    assert.equal(response.data.series.currency,'USD'); assert.equal(response.data.points[0].price,'100.123456789');
    assert.equal(response.data.analysis.forward30m,'unsupported_frequency');
    assert.equal((await api('reference-query',{...query,version:'old'})).status,400);
    assert.equal((await api('reference-query',{...query,path:'outside.sqlite'})).status,400);
    assert.equal((await api('reference-query',{...query,asset:'eth'})).status,400);
    assert.equal((await api('register',{})).data.error,'MINUTE_ARCHIVE_UNAVAILABLE');
    assert.equal((await api('query',{})).data.error,'MINUTE_ARCHIVE_UNAVAILABLE');
    assert.equal((await api('collect',{})).status,400);
  } finally { await session.close(); await new Promise(r=>upstream.close(r)); }
});