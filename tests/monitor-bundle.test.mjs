import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Log, LogLevel, Miniflare } from 'miniflare';
import { buildMonitor } from '../scripts/build-monitor.mjs';

const outputRoot = fileURLToPath(new URL('../outputs/', import.meta.url));
const token = 'monitor-bundle-synthetic-token';
const traceId = '12345678-1234-4234-8234-123456789abc';
const headers = { Authorization: `Bearer ${token}`, 'X-Market-Trace': traceId };

function candles() {
  const open = Math.floor(Date.now() / 900_000) * 900_000;
  return { code: '0', data: [
    [String(open), '100', '103', '99', '102', '5', '0', '0', '0'],
    [String(open - 900_000), '99', '102', '98', '100', '20', '0', '0', '1'],
  ] };
}

test('standalone monitor bundle executes its real dependency graph in isolated workerd', { timeout: 60_000 }, async t => {
  await mkdir(outputRoot, { recursive: true });
  const folder = await mkdtemp(join(outputRoot, 'monitor-bundle-test-'));
  let runtime;
  const streams = new Set();
  t.after(async () => {
    for (const stream of streams) { try { stream.close(); } catch { /* Already cancelled. */ } }
    await runtime?.dispose();
    const target = await realpath(folder);
    if (dirname(target) !== await realpath(outputRoot) || !basename(target).startsWith('monitor-bundle-test-')) throw new Error('unsafe_monitor_fixture_cleanup');
    await rm(target, { recursive: true, force: true });
  });
  await writeFile(join(folder, 'keep.txt'), 'existing output');
  const scriptPath = await buildMonitor(folder);
  assert.deepEqual((await readdir(folder)).sort(), ['keep.txt', 'monitor.mjs']);
  assert.equal(await readFile(join(folder, 'keep.txt'), 'utf8'), 'existing output');

  let mode = 'valid';
  const calls = [];
  runtime = new Miniflare({
    host: '127.0.0.1', port: 0, compatibilityDate: '2026-05-15',
    modules: [
      { type: 'ESModule', path: join(folder, 'fixture.mjs'), contents: `
        import monitor from './monitor.mjs';
        export default { async fetch(request, env, ctx) {
          // Test-only caller cancellation; the deployed monitor module is unmodified.
          const path = new URL(request.url).pathname;
          if (!path.startsWith('/fixture-cancel')) return monitor.fetch(request, env, ctx);
          const controller = new AbortController();
          const timer = path === '/fixture-cancel-in-flight' ? setTimeout(() => controller.abort(), 250) : undefined;
          if (timer === undefined) controller.abort();
          try { return await monitor.fetch(new Request('https://monitor.test/history?symbol=ETH-USDT&range=15m', { headers: request.headers, signal: controller.signal }), env, ctx); }
          finally { if (timer !== undefined) clearTimeout(timer); }
        } };` },
      { type: 'ESModule', path: scriptPath },
    ],
    modulesRoot: folder, bindings: { MONITOR_TOKEN: token }, d1Databases: { DB: 'monitor-bundle-fixture' },
    log: new Log(LogLevel.ERROR),
    outboundService(request) {
      const url = new URL(request.url);
      calls.push({ origin: url.origin, path: url.pathname, symbol: url.searchParams.get('instId'), bar: url.searchParams.get('bar'), limit: url.searchParams.get('limit') });
      // No external request can leave this runtime, including unexpected fallback paths.
      assert.equal(url.origin, 'https://openapi.okx.com');
      assert.ok(['/api/v5/market/candles', '/api/v5/market/tickers'].includes(url.pathname));
      if (mode === 'denied') return new Response('', { status: 403 });
      if (mode === 'rate') return new Response('', { status: 429, headers: { 'Retry-After': '180' } });
      if (mode === 'stall') return new Response(new ReadableStream({
        start(controller) { streams.add(controller); },
      }), { headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/v5/market/tickers') return Response.json({ code: '0', data: [{ instId: 'BTC-USDT', last: '110', open24h: '100', ts: String(Date.now()) }] });
      return Response.json(candles());
    },
  });
  await runtime.ready;
  const history = (symbol = 'BTC-USDT', extra = {}) => runtime.dispatchFetch(`http://localhost/history?symbol=${symbol}&range=15m`, { headers: { ...headers, ...extra } });

  await t.test('authentication rejects absent and incorrect credentials without dispatch', async () => {
    for (const supplied of [{}, { Authorization: 'Bearer wrong-synthetic-token' }]) {
      const response = await runtime.dispatchFetch('http://localhost/history?symbol=BTC-USDT&range=15m', { headers: supplied });
      assert.equal(response.status, 401); assert.equal((await response.json()).error, 'Unauthorized');
    }
    assert.equal(calls.length, 0);
  });

  await t.test('BTC ETH and SOL retain native 15m identity and source confirmation', async () => {
    for (const symbol of ['BTC-USDT', 'ETH-USDT', 'SOL-USDT']) {
      const count = calls.length;
      const response = await history(symbol), body = await response.json();
      assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control'), /no-store/);
      assert.equal(calls.length, count + 1);
      assert.deepEqual(calls.at(-1), { origin: 'https://openapi.okx.com', path: '/api/v5/market/candles', symbol, bar: '15m', limit: '96' });
      assert.equal(body.symbol, symbol); assert.equal(body.range, '15m'); assert.equal(body.currency, 'USDT');
      assert.equal(body.metadata.instrument, symbol); assert.equal(body.metadata.intervalMs, 900_000);
      assert.equal(body.metadata.path, 'candles'); assert.equal(body.points.length, 2);
      assert.equal(body.points[0].confirmed, true); assert.equal(body.points[1].confirmed, false);
      assert.equal(body.metadata.lastCompleteAt, body.points[1].time); assert.equal(body.traceId, traceId);
      assert.ok(body.fetchedAt > 0 && body.fetchedAt <= Date.now());
    }
  });

  await t.test('bundled settings and run use only the isolated D1 and shared ticker', async () => {
    const db = await runtime.getD1Database('DB');
    await db.exec(await readFile(new URL('../monitor/schema.sql', import.meta.url), 'utf8'));
    const config = { enabled: true, watchlist: ['BTC-USDT'], alerts: [{ id: 'fixture-alert', symbol: 'BTC-USDT', direction: 'above', target: 105, enabled: true, createdAt: 1 }] };
    const saved = await runtime.dispatchFetch('http://localhost/', { method: 'PUT', headers, body: JSON.stringify(config) });
    assert.equal(saved.status, 200); await saved.arrayBuffer();
    const count = calls.length;
    const ran = await runtime.dispatchFetch('http://localhost/run', { method: 'POST', headers }), body = await ran.json();
    assert.equal(ran.status, 200); assert.equal(body.report.checked, 1);
    assert.equal(body.alerts[0].triggeredPrice, 110); assert.equal(body.alerts[0].enabled, false);
    assert.equal(calls.length, count + 1); assert.equal(calls.at(-1).path, '/api/v5/market/tickers');
  });

  await t.test('provider denial remains a standard error without another origin or endpoint', async () => {
    mode = 'denied'; const count = calls.length;
    const response = await history(), body = await response.json();
    assert.equal(response.status, 502); assert.equal(body.errorInfo.code, 'upstream_denied');
    assert.equal(body.errorInfo.upstreamStatus, 403); assert.equal(body.errorInfo.traceId, traceId);
    assert.equal(response.headers.get('X-Market-Trace'), traceId); assert.equal(calls.length, count + 1);
  });

  await t.test('expired deadline and pre-cancelled caller issue no request', async () => {
    const count = calls.length;
    const expired = await history('BTC-USDT', { 'X-Market-Deadline': String(Date.now() - 1) });
    assert.equal(expired.status, 504); assert.equal((await expired.json()).errorInfo.code, 'timeout');
    const cancelled = await runtime.dispatchFetch('http://localhost/fixture-cancel', { headers });
    assert.equal(cancelled.status, 499); assert.equal((await cancelled.json()).errorInfo.code, 'caller_cancelled');
    assert.equal(calls.length, count);
  });

  await t.test('body deadline and in-flight cancellation stop without retrying', async () => {
    mode = 'stall'; let count = calls.length;
    const response = await history('BTC-USDT', { 'X-Market-Deadline': String(Date.now() + 1_000) });
    assert.equal(response.status, 504); assert.equal((await response.json()).errorInfo.code, 'timeout');
    assert.equal(calls.length, count + 1);
    count = calls.length;
    const cancelled = await runtime.dispatchFetch('http://localhost/fixture-cancel-in-flight', { headers });
    assert.equal(cancelled.status, 499); assert.equal((await cancelled.json()).errorInfo.code, 'caller_cancelled');
    assert.equal(calls.length, count + 1);
  });

  await t.test('429 preserves Retry-After and blocks the next asset without dispatch', async () => {
    mode = 'rate'; const count = calls.length;
    const response = await history(), body = await response.json();
    assert.equal(response.status, 429); assert.equal(body.errorInfo.code, 'rate_limited');
    assert.equal(body.errorInfo.upstreamStatus, 429); assert.equal(body.errorInfo.traceId, traceId);
    assert.ok(Number(response.headers.get('Retry-After')) >= 179);
    assert.equal(calls.length, count + 1);
    const cooling = await history('SOL-USDT');
    assert.equal(cooling.status, 429); assert.equal((await cooling.json()).errorInfo.code, 'rate_limited');
    assert.equal(calls.length, count + 1);
  });
});
