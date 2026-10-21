// Local-only Node adapter. The hosted Worker and its real-provider gate are unchanged.
import './register-types.mjs';
import { createServer, request as proxyRequest } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrivateContextRuntime } from '../lib/ai/private-runtime.ts';

const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.sort().join(',');
const send = (res, status, value) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(JSON.stringify(value)); } };
async function readBody(req) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 2048) throw Error('request_limit'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function startPrivatePreview({ upstream, token, port = 5308, runtime = createPrivateContextRuntime(), lifetimeMs = 20 * 60000 }) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token) || !Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 20 * 60000) throw Error('invalid_private_session');
  const target = new URL(upstream), origin = `http://127.0.0.1:${port}`, scope = createHash('sha256').update(token).digest('hex');
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || !target.port || target.username || target.password || target.pathname !== '/' || target.search || target.hash || target.origin === origin) throw Error('loopback_preview_required');
  const connections = new Set(), jobs = new Set(); let closing = false, timer, loading = false;
  const server = createServer(async (req, res) => {
    if (closing || req.headers.host !== `127.0.0.1:${port}` || !req.url?.startsWith('/') || req.url.startsWith('//')) { send(res, 403, { error: 'private_session_required' }); return; }
    let url; try { url = new URL(req.url, origin); } catch { send(res, 400, { error: 'invalid_request' }); return; }
    if (url.origin !== origin) { send(res, 400, { error: 'invalid_request' }); return; }
    if (url.pathname === '/api/interpretation') {
      if (req.method !== 'GET' || url.search) { send(res, 403, { error: 'private_session_required' }); return; }
      const g = runtime.status().gate;
      send(res, 200, { mode: 'private_real', realProviderEnabled: g.admission === 'ready', admission: g.admission, ...(g.reason ? { reason: g.reason } : {}) }); return;
    }
    if (url.pathname.startsWith('/__ai-pilot/')) {
      const key = req.headers['x-ai-pilot-session'];
      if (req.method !== 'POST' || url.search || req.headers.origin !== origin || req.headers['content-type'] !== 'application/json' || typeof key !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(key) || key.length !== token.length || !timingSafeEqual(Buffer.from(key), Buffer.from(token))) { send(res, 403, { error: 'private_session_required' }); return; }
      const controller = new AbortController(); let done;
      const job = { controller, promise: new Promise(r => { done = r; }) }; jobs.add(job);
      res.once('close', () => { if (!res.writableEnded) controller.abort(); });
      const deadline = setTimeout(() => controller.abort(), 58_000); let isLoader = false;
      try {
        const body = await readBody(req); if (controller.signal.aborted) throw Error('cancelled');
        let result;
        if (url.pathname === '/__ai-pilot/status' && shape(body, [])) result = runtime.status();
        else if (url.pathname === '/__ai-pilot/snapshot' && shape(body, ['symbol']) && body.symbol === 'BTC-USDT') {
          if (loading) throw Error('busy'); loading = true; isLoader = true;
          result = await runtime.snapshot(scope, body.symbol, controller.signal);
        } else if (['/__ai-pilot/interpret', '/__ai-pilot/evidence'].includes(url.pathname) && shape(body, ['symbol', 'snapshotId']) && body.symbol === 'BTC-USDT' && typeof body.snapshotId === 'string' && /^[A-Za-z0-9:._-]{1,180}$/.test(body.snapshotId)) {
          result = url.pathname.endsWith('/interpret') ? await runtime.interpret(scope, body.symbol, body.snapshotId, controller.signal) : runtime.evidence(scope, body.symbol, body.snapshotId);
        } else throw Error('invalid_request');
        if (controller.signal.aborted) throw Error('cancelled');
        send(res, 200, result);
      } catch (error) {
        const code = error instanceof Error && /^[a-z][a-z_]{0,60}$/.test(error.message) ? error.message : 'invalid_request';
        send(res, ['permission_revoked', 'snapshot_not_found', 'data_permission_unavailable'].includes(code) ? 403 : code === 'busy' ? 409 : 400, { error: code });
      } finally { clearTimeout(deadline); if (isLoader) loading = false; jobs.delete(job); done(); }
      return;
    }
    // No arbitrary upstream/URL/SQL. Preserve the original app gate. Session credentials
    // never reach the app server, data provider, logs, model prompt or redirect URL.
    const destination = new URL(req.url, target);
    if (destination.origin !== target.origin || req.url.includes('\\')) { send(res, 400, { error: 'invalid_request' }); return; }
    if (req.headers.origin && req.headers.origin !== origin || !['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) { send(res, 403, { error: 'invalid_origin' }); return; }
    const headers = { ...req.headers, host: target.host }; delete headers['x-ai-pilot-session']; delete headers.authorization; delete headers.connection;
    // Preserve the existing gate's same-origin CSRF rule across this fixed loopback proxy.
    if (req.headers.origin === origin) headers.origin = target.origin;
    const proxy = proxyRequest(destination, { method: req.method, headers, timeout: 35000 }, upstreamResponse => {
      const outgoing = { ...upstreamResponse.headers, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
      res.writeHead(upstreamResponse.statusCode ?? 502, outgoing); let bytes = 0;
      upstreamResponse.on('data', chunk => { bytes += chunk.length; if (bytes > 8 * 1024 ** 2) { proxy.destroy(); res.destroy(); } }); upstreamResponse.pipe(res);
    });
    proxy.on('error', () => { if (!res.headersSent) send(res, 502, { error: 'preview_unavailable' }); else res.destroy(); });
    proxy.on('timeout', () => proxy.destroy()); res.on('close', () => proxy.destroy()); req.pipe(proxy);
  });
  server.requestTimeout = 65000; server.headersTimeout = 10000; server.maxHeadersCount = 40;
  server.on('connection', socket => { connections.add(socket); socket.on('close', () => connections.delete(socket)); });
  await new Promise((yes, no) => { server.once('error', no); server.listen(port, '127.0.0.1', yes); });
  async function close() {
    if (closing) return; closing = true; clearTimeout(timer); runtime.close();
    for (const job of jobs) job.controller.abort(); for (const connection of connections) connection.destroy();
    await new Promise(r => server.close(r)); await Promise.all([...jobs].map(j => j.promise));
  }
  timer = setTimeout(() => void close(), lifetimeMs);
  return { url: origin, close };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, port, ...extra] = process.argv.slice(2);
  // No product API Key is read, and no canonical budget is opened while source admission is blocked.
  (extra.length ? Promise.reject(Error('invalid_arguments')) : startPrivatePreview({ upstream, port: port ? Number(port) : 5308, token: process.env.MARKET_RADAR_AI_PREVIEW_SESSION }))
    .then(session => { console.log(JSON.stringify({ url: session.url, mode: 'private-preparation', realCallsEnabled: false, lifetimeMinutes: 20 })); process.on('SIGINT', () => void session.close()); process.on('SIGTERM', () => void session.close()); })
    .catch(error => { console.error(/^[a-z_]+$/.test(error.message) ? error.message : 'private_preview_failed'); process.exitCode = 1; });
}
