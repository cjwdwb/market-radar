// 仅显式导出隔离fixture历史；不请求网络、不执行迁移，也不绑定生产资源。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore } from '../collector/store.mjs';
import { localFile } from './history-local.mjs';
import { BAR_LIMIT, PACKAGE_LIMIT, packageDigest, parseHistoryPackage } from '../lib/history/package.ts';

export async function exportHistoryPackage(store, { owner, source, asset, from, to, exportedAt }) {
  if (typeof source !== 'string' || !source.startsWith('fixture:')) throw Error('PRICE_SOURCE_NOT_APPROVED');
  let p;
  // 分页在同一读事务内完成，并固定readRevision，避免导出时混入其他写入版本。
  store.db.exec('BEGIN');
  try {
    let cursor = null, identity = null, interval = null, revision = null;
    const bars = [];
    do {
      const page = store.query({ owner, source, asset, kind: 'bar', from, to, limit: 200, cursor });
      revision ??= page.readRevision;
      if (revision !== page.readRevision || page.identity !== 'fixture') throw Error('MIXED_READ_VERSION');
      for (const row of page.records) {
        if (row.identity !== 'fixture' || row.payload.sessionEvidence !== 'fixture_only' || row.payload.complete !== true) throw Error('UNAPPROVED_RECORD');
        const run = store.requireRun(owner, row.run_id);
        const configured = run.config.assets.find(a => a.id === asset);
        if (!configured) throw Error('ASSET_IDENTITY_MISSING');
        // 只导出可携带的资产身份；owner、run和私有采集配置不进入浏览器文件。
        const nextIdentity = Object.fromEntries(['id','market','venue','providerId','currency','adjustment'].map(key => [key, configured[key]]));
        identity ??= nextIdentity; interval ??= row.payload.intervalMs;
        if (JSON.stringify(identity) !== JSON.stringify(nextIdentity) || interval !== row.payload.intervalMs || row.payload.currency !== identity.currency || row.payload.adjustment !== identity.adjustment) throw Error('MIXED_ASSET_OR_INTERVAL');
        const { open, high, low, close, volume } = row.payload;
        bars.push({ time: row.occurred_at, open, high, low, close, volume, version: row.revision, receivedAt: row.received_at });
        if (bars.length > BAR_LIMIT) throw Error('PACKAGE_ROW_LIMIT');
      }
      cursor = page.nextCursor;
    } while (cursor);
    if (!bars.length) throw Error('NO_ARCHIVED_BARS');
    p = { format: 'history-package-v1', identity: 'fixture', vintage: 'current_vintage', source, asset: identity,
      intervalMs: interval, sessionEvidence: 'fixture_only', readRevision: revision, range: { from, cutoff: to }, exportedAt, coverage: 'not_verified', bars };
    store.db.exec('COMMIT');
  } catch (error) { store.db.exec('ROLLBACK'); throw error; }
  p.digest = await packageDigest(p);
  const text = JSON.stringify(p);
  if (Buffer.byteLength(text) > PACKAGE_LIMIT) throw Error('PACKAGE_BYTE_LIMIT');
  return parseHistoryPackage(text, exportedAt);
}

async function main([dbName, queryJson, outputName]) {
  // 沿用work/state27范围与符号链接检查；wx要求新文件，避免覆盖既有导出/备份。
  const path = localFile(dbName), output = localFile(outputName);
  if (!existsSync(path)) throw Error('DATABASE_NOT_FOUND');
  if (existsSync(output)) throw Error('NEW_OUTPUT_REQUIRED');
  const store = new ArchiveStore(path);
  try {
    const result = await exportHistoryPackage(store, { ...JSON.parse(queryJson), exportedAt: Date.now() });
    mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result), { flag: 'wx', mode: 0o600 });
    return { format: result.format, identity: result.identity, bars: result.bars.length, readRevision: result.readRevision, digest: result.digest };
  } finally { store.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
