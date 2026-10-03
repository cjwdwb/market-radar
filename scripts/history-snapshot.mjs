// 显式本地操作；所有路径先过既有守卫，不接受网络/生产/任意SQL参数。
import { Worker } from 'node:worker_threads';
import { mkdirSync, existsSync, statSync, renameSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localFile } from './history-local.mjs';
import { SNAPSHOT_LIMITS } from '../collector/snapshot.mjs';

export async function runSnapshot({ command, sourceName, owner, targetName, timeoutMs = SNAPSHOT_LIMITS.timeoutMs, signal }) {
  if (!['create', 'restore'].includes(command) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > SNAPSHOT_LIMITS.timeoutMs || typeof owner !== 'string' || !/^[a-zA-Z0-9_.:/^-]{1,160}$/.test(owner)) throw Error('INVALID_SNAPSHOT_ARGUMENT');
  const source = localFile(sourceName), target = localFile(targetName);
  const withinSource = relative(source, target);
  if (command === 'restore' && (withinSource === '' || !isAbsolute(withinSource) && withinSource !== '..' && !withinSource.startsWith('..' + sep))) throw Error('SNAPSHOT_TARGET_MUST_BE_SEPARATE');
  // 源与目标文件的链接必须在创建目标前检查，包括断链。
  if (command === 'restore') for (const name of ['archive.sqlite', 'snapshot.json']) localFile(join(sourceName, name));
  if (!existsSync(source) || (command === 'create' ? !statSync(source).isFile() : !statSync(source).isDirectory())) throw Error('SNAPSHOT_SOURCE_MISSING');
  if (existsSync(target)) throw Error('NEW_SNAPSHOT_TARGET_REQUIRED');
  if (signal?.aborted) throw Error('SNAPSHOT_CANCELLED');
  mkdirSync(dirname(target), { recursive: true }); mkdirSync(target, { mode: 0o700 });
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(new URL('../collector/snapshot.mjs', import.meta.url), { workerData: { command, source, target, owner }, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128 } });
    let finished = false;
    const done = (error, result) => {
      if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      // 第一个完成/取消/超时决定获胜。worker不能自行提交，故失败不会留下成功manifest。
      void worker.terminate().then(() => {
        if (error) { reject(error); return; }
        try {
          const name = command === 'create' ? 'snapshot.json' : 'restore.json';
          renameSync(join(target, name + '.pending'), join(target, name));
          resolveResult(result);
        } catch (e) { reject(e); }
      }, reject);
    };
    const cancel = () => done(Error('SNAPSHOT_CANCELLED'));
    const timer = setTimeout(() => done(Error('SNAPSHOT_TIMEOUT')), timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    worker.once('message', message => done(message.error ? Error(message.error) : null, message.result));
    worker.once('error', e => done(e));
    worker.once('exit', code => { if (!finished) done(Error(`SNAPSHOT_WORKER_EXIT_${code}`)); });
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  process.on('SIGINT', () => controller.abort()); process.on('SIGTERM', () => controller.abort());
  const [command, sourceName, owner, targetName, ...extra] = process.argv.slice(2);
  (extra.length ? Promise.reject(Error('INVALID_SNAPSHOT_ARGUMENT')) : runSnapshot({ command, sourceName, owner, targetName, signal: controller.signal }))
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
