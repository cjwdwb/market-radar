// 固定本地试点操作员入口。没有任意URL、生产DB、cron或远程写入选项。
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync, openSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localFile } from './history-local.mjs';
import { createHash } from 'node:crypto';
import { CM_API_SEP } from '../collector/coinmetrics-api.mjs';
import { canonical } from '../collector/store.mjs';
import { CoinMetricsArchive, collectCoinMetrics, CM_PILOT, CM_MAY_PILOT, reextractCoinMetricsMay } from '../collector/coinmetrics-archive.mjs';

const dbName = 'coinmetrics-sep2026/archive.sqlite', mayDbName = 'coinmetrics-may2026/archive.sqlite', apiDbName = 'coinmetrics-api-sep2026/archive.sqlite';
export async function main(args) {
  const [command, ...rest] = args;
  if (!['collect','status','query','backup','restore','extract-may','may-status','may-query','may-backup','api-collect','api-status','api-query','api-backup'].includes(command)) throw Error('CM_COMMAND_REQUIRED');
  if (command === 'extract-may') {
    if (rest.length) throw Error('CM_ARGUMENTS');
    const source = new CoinMetricsArchive(localFile(dbName), { readOnly: true });
    try {
      if (canonical(source.config) !== canonical(CM_PILOT)) throw Error('CM_APPROVED_PROFILE_REQUIRED');
      const target = localFile(mayDbName), raw = {};
      let derivedAt = Date.now(), existingText = null;
      if (existsSync(target)) {
        const existing = new CoinMetricsArchive(target, { readOnly: true });
        try {
          if (canonical(existing.config) !== canonical(CM_MAY_PILOT)) throw Error('CM_MAY_TARGET_CONFLICT');
          derivedAt = existing.query('btc').derivation.derivedAt; existingText = existing.exportSnapshot();
        } finally { existing.close(); }
      }
      for (const m of CM_PILOT.manifests) {
        const path = localFile('coinmetrics-sep2026/raw/' + m.asset + '-' + m.blobSha + '.csv');
        if (statSync(path).size !== m.bytes) throw Error('CM_FILE_SIZE_MISMATCH');
        raw[m.asset] = readFileSync(path);
      }
      const text = reextractCoinMetricsMay(source, raw, derivedAt);
      if (existingText !== null && text !== existingText) throw Error('CM_MAY_TARGET_CONFLICT');
      if (existingText === null) { mkdirSync(dirname(target), { recursive: true }); CoinMetricsArchive.restore(target, text); }
      const result = new CoinMetricsArchive(target, { readOnly: true });
      try { return { ...result.status(), reused: existingText !== null, catalog: result.catalog() }; } finally { result.close(); }
    } finally { source.close(); }
  }
  const action = command.replace(/^(?:may|api)-/, '');
  if (command === 'restore') {
    if (rest.length !== 2) throw Error('CM_ARGUMENTS');
    const source = localFile(rest[0]), target = localFile(rest[1]);
    if (statSync(source).size > 1024 ** 2) throw Error('CM_BACKUP_LIMIT');
    const text = readFileSync(source, 'utf8');
    if (existsSync(target)) throw Error('CM_NEW_TARGET_REQUIRED');
    mkdirSync(dirname(target), { recursive: true });
    return CoinMetricsArchive.restore(target, text);
  }
  if (action === 'query' ? rest.length !== 1 : action === 'backup' ? rest.length !== 1 : rest.length !== 0) throw Error('CM_ARGUMENTS');
  const path = localFile(command.startsWith('api-') ? apiDbName : command.startsWith('may-') ? mayDbName : dbName), backup = action === 'backup' ? localFile(rest[0]) : null;
  if (action === 'collect') mkdirSync(dirname(path), { recursive: true });
  const store = new CoinMetricsArchive(path, { create: action === 'collect' && !existsSync(path), readOnly: action !== 'collect', batch: command.startsWith('api-') ? CM_API_SEP.batch : CM_PILOT.batch });
  try {
    if (action === 'collect' && canonical(store.config) !== canonical(command.startsWith('api-') ? CM_API_SEP : CM_PILOT)) throw Error('CM_APPROVED_PROFILE_REQUIRED');
    if (action === 'collect') return await collectCoinMetrics(store, { saveRaw: (manifest, bytes, receivedAt, requestId) => {
      if (manifest.transport === 'community_api') {
        // 每次响应单独保管；落盘后崩溃也不覆盖旧响应或借旧文件回填取得时间。
        const hash = createHash('sha256').update(bytes).digest('hex');
        const stem = 'coinmetrics-api-sep2026/raw/' + requestId + '-' + manifest.asset + '-' + hash;
        const raw = localFile(stem + '.json'); mkdirSync(dirname(raw), { recursive: true });
        writeFileSync(raw, bytes, { flag: 'wx', mode: 0o600, flush: true });
        writeFileSync(localFile(stem + '.receipt.json'), JSON.stringify({ manifest, requestId, receivedAt, sha256: hash, bytes: bytes.length }), { flag: 'wx', mode: 0o600, flush: true });
        return;
      }
      const raw = localFile('coinmetrics-sep2026/raw/' + manifest.asset + '-' + manifest.blobSha + '.csv');
      mkdirSync(dirname(raw), { recursive: true });
      if (existsSync(raw)) {
        if (statSync(raw).size !== bytes.length || !readFileSync(raw).equals(bytes)) throw Error('CM_RAW_CONFLICT');
      } else {
        const pending = localFile('coinmetrics-sep2026/raw/' + manifest.asset + '-' + receivedAt + '.pending');
        const fd = openSync(pending, 'wx', 0o600);
        try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
        renameSync(pending, raw);
      }
      // 事实中的首次receivedAt由成功checkpoint持有；原文件不会反推历史接收时间。
      const receipt = localFile('coinmetrics-sep2026/raw/' + manifest.asset + '-' + receivedAt + '.json');
      writeFileSync(receipt, JSON.stringify({ manifest, receivedAt }), { flag: 'wx', mode: 0o600, flush: true });
    } });
    if (action === 'status') return { ...store.status(), catalog: store.catalog() };
    if (action === 'query') return store.query(rest[0]);
    const text = store.exportSnapshot();
    mkdirSync(dirname(backup), { recursive: true });
    writeFileSync(backup, text, { flag: 'wx', mode: 0o600, flush: true });
    return { format: 'coinmetrics-local-snapshot-v1', bytes: Buffer.byteLength(text), collectionOnRestore: 'disabled' };
  } finally { store.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(r => console.log(JSON.stringify(r))).catch(e => { console.error(/^[A-Z0-9_]+$/.test(e.message) ? e.message : 'CM_LOCAL_OPERATION_FAILED'); process.exitCode = 1; });
}