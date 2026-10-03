// 显式操作员导出：只读批准库及两份公开响应，不联网、不复制DB/用户配置。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoinMetricsArchive } from '../collector/coinmetrics-archive.mjs';
import { CM_API_SEP } from '../collector/coinmetrics-api.mjs';
import { CM_LONG_PLAN } from '../collector/coinmetrics-series-plan.mjs';
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
export async function exportLongReferencePublication() {
  const store=new CoinMetricsArchive(localFile('coinmetrics-long20261003/archive.sqlite'),{readOnly:true});
  try{
    if(!store.series||canonical(store.config)!==canonical(CM_LONG_PLAN))throw Error('PUBLICATION_APPROVED_SOURCE_REQUIRED');
    const ledger=store.status().requests;
    const sources=store.db.prepare('SELECT revision,received_at,raw FROM cm_series_responses ORDER BY revision').all().map(r=>{
      const request=ledger.find(q=>q.id===r.revision&&q.status==='accepted');if(!request)throw Error('PUBLICATION_SOURCE_INCOMPLETE');
      return {asset:request.asset,batch:request.batch,revision:r.revision,raw:r.raw,receivedAt:r.received_at};
    });
    const target=resolve('data/published/coinmetrics-long20261003.json'),previous=existsSync(target)?JSON.parse(readFileSync(target,'utf8')):null;
    const body={format:'reference-publication-v2',batch:CM_LONG_PLAN.batch,exportedAt:previous?.exportedAt??Date.now(),version:store.catalog().series[0].version,sources};
    const publication={...body,checksum:await packageDigest(body)},data=await loadPublishedReference(publication,Date.now());let pages=0;
    const {queryPublishedReference}=await import('../lib/history/published-reference.ts');
    for(const asset of ['btc','eth'])for(let from=CM_LONG_PLAN.from;from<CM_LONG_PLAN.cutoff;){
      const params={asset,from,cutoff:CM_LONG_PLAN.cutoff,version:body.version},page=queryPublishedReference(data,params);
      if(canonical(page)!==canonical(store.query(asset,from,params.cutoff,body.version)))throw Error('PUBLICATION_QUERY_MISMATCH');
      pages++;from=page.page.nextFrom??CM_LONG_PLAN.cutoff;
    }
    const text=JSON.stringify(publication,null,2)+'\n';
    if(previous){if(canonical(previous)!==canonical(publication))throw Error('PUBLICATION_TARGET_CONFLICT');}
    else{mkdirSync(dirname(target),{recursive:true});writeFileSync(target,text,{flag:'wx',flush:true});}
    return {checksum:publication.checksum,version:body.version,bytes:Buffer.byteLength(text),pages,points:data.catalog.series.map(s=>({asset:s.asset,count:s.count})),reused:!!previous};
  }finally{store.close();}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3 || process.argv[2] && process.argv[2] !== 'long') throw Error('PUBLICATION_ARGUMENTS');
  (process.argv[2]==='long'?exportLongReferencePublication():exportReferencePublication()).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
