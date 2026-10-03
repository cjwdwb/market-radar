// 显式本地会话：固定快照、单owner、独立key；不部署、不采集、不绕过既有app门禁。
import './register-types.mjs';
import { createServer, request as proxyRequest } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localFile } from './history-local.mjs';
import { ArchiveQueryService } from '../collector/query-service.mjs';
import { ResearchJournal } from '../collector/research-journal.mjs';
import { CoinMetricsArchive } from '../collector/coinmetrics-archive.mjs';

const validKey = key => typeof key === 'string' && key.length >= 24 && key.length <= 256;
const shape = (body, fields) => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).sort().join(' ') === fields.split(' ').filter(Boolean).sort().join(' ');
const send = (res, status, body) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); } };
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 8192) throw Error('BODY_LIMIT'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function startWorkbench({ snapshotName, owner, journalName, referenceName = null, token, upstream, port = 5297, lifetimeMs = 20 * 60000 }) {
  if (!validKey(token) || !Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 20 * 60000) throw Error('INVALID_LOCAL_SESSION');
  const target = new URL(upstream), origin = `http://127.0.0.1:${port}`;
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || !target.port || target.username || target.password || target.pathname !== '/' || target.search || target.hash || target.origin === origin) throw Error('LOOPBACK_PREVIEW_REQUIRED');
  if (!snapshotName && !referenceName) throw Error('SNAPSHOT_NOT_FOUND');
  let service = null, journal = null, reference = null;
  try {
    if (referenceName) reference = new CoinMetricsArchive(localFile(referenceName), { readOnly: true });
    // 多年查询固定在恢复副本；不长期占用采集库的rollback-journal读锁。
    if (reference?.series && reference.meta().enabled) throw Error('REFERENCE_RESTORED_COPY_REQUIRED');
    if (snapshotName) {
      const snapshot = localFile(snapshotName), journalPath = localFile(journalName), nested = relative(snapshot, journalPath);
      if (!isAbsolute(nested) && nested !== '..' && !nested.startsWith('..' + sep)) throw Error('JOURNAL_MUST_BE_SEPARATE');
      if (referenceName && journalPath === localFile(referenceName)) throw Error('JOURNAL_MUST_BE_SEPARATE');
      for (const name of ['archive.sqlite','snapshot.json']) localFile(join(snapshotName, name));
      if (!existsSync(snapshot)) throw Error('SNAPSHOT_NOT_FOUND');
      service = new ArchiveQueryService(snapshot, owner);
      mkdirSync(dirname(journalPath), { recursive: true }); journal = new ResearchJournal(journalPath, owner);
    }
  } catch (e) { reference?.close(); journal?.close(); service?.close(); throw e; }
  const jobs = new Set(), connections = new Set(); let active = 0, closing = false, timer;
  const server = createServer(async (req, res) => {
    if (req.headers.host !== `127.0.0.1:${port}` || !req.url?.startsWith('/') || req.url.startsWith('//')) { send(res, 403, { error: 'LOCAL_HOST_REQUIRED' }); return; }
    let url;
    try { url = new URL(req.url, origin); } catch { send(res, 400, { error: 'INVALID_PREVIEW_PATH' }); return; }
    if (url.origin !== origin) { send(res, 400, { error: 'INVALID_PREVIEW_PATH' }); return; }
    if (url.pathname.startsWith('/__archive/')) {
      const key = req.headers['x-archive-key'];
      if (closing || req.method !== 'POST' || req.headers.origin !== origin || req.headers['content-type'] !== 'application/json' || !validKey(key) || Buffer.byteLength(key) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(key), Buffer.from(token))) { send(res, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      const heavy = ['/__archive/query','/__archive/register'].includes(url.pathname);
      if (active >= 2 && heavy) { send(res, 409, { error: 'ARCHIVE_BUSY' }); return; }
      const controller = new AbortController();
      res.once('close', () => { if (!res.writableEnded) controller.abort(); });
      let release; const job = { controller, done: new Promise(r => { release = r; }) }; jobs.add(job);
      if (heavy) active++;
      try {
        const body = await readBody(req); let result;
        if (url.search) throw Error('INVALID_ARCHIVE_REQUEST');
        if (!service && !['/__archive/catalog','/__archive/reference-query','/__archive/health'].includes(url.pathname)) throw Error('MINUTE_ARCHIVE_UNAVAILABLE');
        switch (url.pathname) {
          case '/__archive/catalog': if (!shape(body, '')) throw Error('INVALID_ARCHIVE_REQUEST'); result = { ...(service?.catalog ?? { format: 'archive-catalog-v1', series: [], limitation: '本会话仅连接日频参考价；分钟回放与研究未连接。' }), reference: reference?.catalog() ?? null }; break;
          case '/__archive/reference-query': if (!shape(body, 'asset from cutoff version') || !reference) throw Error('REFERENCE_UNAVAILABLE'); result = reference.query(body.asset,body.from,body.cutoff,body.version); break;
          case '/__archive/query': if (!shape(body, 'selection')) throw Error('INVALID_ARCHIVE_REQUEST'); result = await service.analyze(body.selection, { signal: controller.signal }); break;
          case '/__archive/prices': if (!shape(body, 'selection cursor')) throw Error('INVALID_ARCHIVE_REQUEST'); result = service.pricePage(body.selection, body.cursor); break;
          case '/__archive/records': if (!shape(body, 'offset')) throw Error('INVALID_ARCHIVE_REQUEST'); result = journal.list(body.offset); break;
          case '/__archive/record': if (!shape(body, 'id')) throw Error('INVALID_ARCHIVE_REQUEST'); result = journal.get(body.id); break;
          case '/__archive/evaluate': if (!shape(body, 'id')) throw Error('INVALID_ARCHIVE_REQUEST'); result = journal.evaluate(body.id, service, Date.now()); break;
          case '/__archive/register': {
            if (!shape(body, 'requestKey mode question correctionOf selection')) throw Error('INVALID_ARCHIVE_REQUEST');
            service.selection(body.selection);
            const { requestKey, mode, question, correctionOf, selection } = body;
            result = journal.existing(requestKey, { mode, question, correctionOf, selection });
            if (!result) {
              const analysis = await service.analyze(selection, { signal: controller.signal });
              if (controller.signal.aborted) throw Error('QUERY_CANCELLED');
              result = journal.register({ requestKey, mode, question, correctionOf, analysis, service }, Date.now());
            }
            break;
          }
          case '/__archive/health': if (!shape(body, '')) throw Error('INVALID_ARCHIVE_REQUEST'); result = { active, pending: jobs.size - 1 }; break;
          default: throw Error('UNKNOWN_ARCHIVE_OPERATION');
        }
        send(res, 200, result);
      } catch (e) { send(res, 400, { error: /^[A-Z][A-Z0-9_]+$/.test(e.message) ? e.message : 'ARCHIVE_REQUEST_FAILED' }); }
      finally { if (heavy) active--; jobs.delete(job); release(); }
      return;
    }
    // 固定本地上游原样处理app门禁；归档key永不转发，拒绝任意地址与重定向跟随。
    const destination = new URL(req.url, target);
    if (destination.origin !== target.origin) { send(res, 400, { error: 'INVALID_PREVIEW_PATH' }); return; }
    const headers = { ...req.headers, host: target.host }; delete headers['x-archive-key']; delete headers.connection;
    const proxy = proxyRequest(destination, { method: req.method, headers, timeout: 15000 }, upstreamResponse => {
      res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers); let bytes = 0;
      upstreamResponse.on('data', chunk => { bytes += chunk.length; if (bytes > 8 * 1024 ** 2) { proxy.destroy(); res.destroy(); } });
      upstreamResponse.pipe(res);
    });
    proxy.on('error', () => { if (!res.headersSent) send(res, 502, { error: 'LOCAL_PREVIEW_UNAVAILABLE' }); else res.destroy(); });
    proxy.on('timeout', () => proxy.destroy()); res.on('close', () => proxy.destroy()); req.pipe(proxy);
  });
  server.requestTimeout = 25000; server.headersTimeout = 10000; server.maxHeadersCount = 40;
  server.on('connection', socket => { connections.add(socket); socket.on('close', () => connections.delete(socket)); });
  try { await new Promise((yes, no) => { server.once('error', no); server.listen(port, '127.0.0.1', yes); }); }
  catch (e) { journal?.close(); service?.close(); reference?.close(); throw e; }
  async function close() {
    if (closing) return; closing = true; clearTimeout(timer);
    for (const job of jobs) job.controller.abort();
    for (const connection of connections) connection.destroy();
    await new Promise(resolveClose => server.close(resolveClose));
    await Promise.all([...jobs].map(j => j.done)); journal?.close(); service?.close(); reference?.close();
  }
  timer = setTimeout(() => void close(), lifetimeMs);
  return { url: origin, close };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [snapshotArg, owner, journalName, upstream, port, referenceName, ...extra] = process.argv.slice(2);
  (extra.length ? Promise.reject(Error('INVALID_ARGUMENTS')) : startWorkbench({ snapshotName: snapshotArg === '-' ? null : snapshotArg, owner, journalName, referenceName, upstream, port: Number(port), token: process.env.RADAR_ARCHIVE_TOKEN }))
    .then(session => { console.log(JSON.stringify({ url: session.url, mode: 'local-only', collection: 'disabled', lifetimeMinutes: 20 })); process.on('SIGINT', () => void session.close()); process.on('SIGTERM', () => void session.close()); })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
