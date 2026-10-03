// 显式操作员导出：只读批准库及两份公开响应，不联网、不复制DB/用户配置。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoinMetricsArchive } from '../collector/coinmetrics-archive.mjs';
import { CM_API_SEP } from '../collector/coinmetrics-api.mjs';
import { canonical } from '../collector/store.mjs';
import { packageDigest } from '../lib/history/package.ts';
import { loadPublishedReference } from '../lib/history/published-reference.ts';
import { localFile } from './history-local.mjs';

export async function exportReferencePublication() {
  const store = new CoinMetricsArchive(localFile('coinmetrics-api-sep2026/archive.sqlite'), { readOnly:true });
  try {
    if (canonical(store.config) !== canonical(CM_API_SEP)) throw Error('PUBLICATION_APPROVED_SOURCE_REQUIRED');
    const sources = ['btc','eth'].map(asset => {
      const q = store.query(asset), receipt = store.status().requests.find(r => r.asset === asset && r.status === 'accepted');
      if (!receipt || q.provenance.transport !== 'community_api') throw Error('PUBLICATION_SOURCE_INCOMPLETE');
      const raw = readFileSync(localFile('coinmetrics-api-sep2026/raw/' + receipt.id + '-' + asset + '-' + q.provenance.sha256 + '.json'), 'utf8');
      return { asset, raw, receivedAt:q.provenance.receivedAt, version:q.version };
    });
    const target = resolve('data/published/coinmetrics-sep2026.json');
    // 重导出验证同一版本；不改首次exportedAt制造新数据。
    const previous = existsSync(target) ? JSON.parse(readFileSync(target,'utf8')) : null;
    const body = { format:'reference-publication-v1', batch:CM_API_SEP.batch,
      exportedAt:previous?.exportedAt ?? Date.now(), sources };
    const publication = { ...body, checksum:await packageDigest(body) };
    const data = await loadPublishedReference(publication, Date.now());
    for (const asset of ['btc','eth']) {
      if (canonical(data.slices[asset]) !== canonical(store.query(asset))) throw Error('PUBLICATION_QUERY_MISMATCH');
    }
    const text=JSON.stringify(publication,null,2)+'\n';
    if (previous) {
      if (canonical(previous) !== canonical(publication)) throw Error('PUBLICATION_TARGET_CONFLICT');
    } else { mkdirSync(dirname(target),{recursive:true});writeFileSync(target,text,{flag:'wx',flush:true}); }
    return { checksum:publication.checksum, bytes:Buffer.byteLength(text), points:data.catalog.series.map(s=>({asset:s.asset,count:s.count})), reused:!!previous };
  } finally { store.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw Error('PUBLICATION_NO_ARGUMENTS');
  exportReferencePublication().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
