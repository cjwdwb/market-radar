// CoinMetricsArchive schema 2：有界多批次、逐日修订与共享预算。旧pilot schema 1不迁移。
import { DatabaseSync } from 'node:sqlite';
import { existsSync, statSync, openSync, closeSync, fsyncSync, linkSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { canonical, digest } from './store.mjs';
import { CM_DAILY } from './coinmetrics-source.mjs';
import { CM_API_BYTES, CM_API_NOTICE, coinMetricsDailyUrl, parseCoinMetricsDailyPage } from './coinmetrics-api.mjs';

import { DAILY_MS, CM_LONG_PLAN, CM_LONG_BATCHES } from './coinmetrics-series-plan.mjs';
export { DAILY_MS, CM_LONG_PLAN, CM_LONG_BATCHES };
const at = s => Date.parse(s + 'T00:00:00Z');
const date = n => new Date(n).toISOString().slice(0,10);
const fail = code => { throw Error(code); };
const integer = (n, lo=0, hi=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n>=lo && n<=hi;
const exact = (v, keys) => v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).sort().join(' ')===keys.split(' ').sort().join(' ');
const DAY = DAILY_MS, MAX_DB = 16*1024**2, MAX_EXPORT = 8*1024**2;
const schema = `
CREATE TABLE cm_series_meta(id INTEGER PRIMARY KEY CHECK(id=1), config TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), blocked INTEGER NOT NULL CHECK(blocked IN(0,1)), retry_at INTEGER NOT NULL);
CREATE TABLE cm_series_requests(id INTEGER PRIMARY KEY, batch TEXT NOT NULL, asset TEXT NOT NULL, started INTEGER NOT NULL, finished INTEGER, status TEXT NOT NULL, bytes INTEGER, retry_until INTEGER NOT NULL DEFAULT 0, http_status INTEGER);
CREATE TABLE cm_series_responses(revision INTEGER PRIMARY KEY REFERENCES cm_series_requests(id), received_at INTEGER NOT NULL, sha TEXT NOT NULL, raw TEXT NOT NULL);
CREATE TABLE cm_series_facts(asset TEXT NOT NULL, day INTEGER NOT NULL, revision INTEGER NOT NULL REFERENCES cm_series_responses(revision), price TEXT, reason TEXT, first_received INTEGER NOT NULL, PRIMARY KEY(asset,day,revision));
CREATE INDEX cm_series_lookup ON cm_series_facts(asset,day,revision DESC);
`;
const schemaHash = db => digest(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
const m = new DatabaseSync(':memory:');m.exec(schema);const expectedSchema=schemaHash(m);m.close();
const meta = s => s.db.prepare('SELECT * FROM cm_series_meta').get();
const requests = s => s.db.prepare('SELECT * FROM cm_series_requests ORDER BY id').all();
const responses = s => s.db.prepare('SELECT * FROM cm_series_responses ORDER BY revision').all();
const tx = (s, fn) => { s.db.exec('BEGIN IMMEDIATE');try{const v=fn();s.db.exec('COMMIT');return v;}catch(e){s.db.exec('ROLLBACK');throw e;} };
function planFor(fixture) { return {...CM_LONG_PLAN,identity:fixture?'fixture':'reconstructed'}; }
function batchFor(id) { const b=CM_LONG_BATCHES.find(v=>v.id===id);if(!b)fail('CM_BATCH_NOT_APPROVED');return b; }
function manifest(asset) { return {asset,transport:'community_api'}; }
function cells(slice) {
  const map=new Map(slice.points.map(p=>[p.periodStartAt,{price:p.price,reason:null}]));
  for(const p of slice.coverage.missing)map.set(at(p.sourceDate),{price:null,reason:p.reason});
  return [...map].sort((a,b)=>a[0]-b[0]);
}
function parsed(s, req, raw, receivedAt) {
  const b=batchFor(req.batch);
  const slice=parseCoinMetricsDailyPage(raw,{manifest:manifest(req.asset),from:b.from,cutoff:b.cutoff,receivedAt,now:receivedAt});
  slice.identity=s.config.identity;return slice;
}
export function isDailySeriesFile(path) {
  if(!existsSync(path))return false;
  const db=new DatabaseSync(path,{readOnly:true});
  try{return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cm_series_meta'").get();}finally{db.close();}
}
export function openDailySeries(path,{create=false,fixture=false,readOnly=false}={}) {
  if(create&&existsSync(path)||!create&&!existsSync(path))fail(create?'CM_NEW_TARGET_REQUIRED':'CM_ARCHIVE_NOT_FOUND');
  if(existsSync(path)&&statSync(path).size>MAX_DB)fail('CM_DB_LIMIT');
  const db=new DatabaseSync(path,{readOnly}),s={db,series:true,readOnly,config:planFor(fixture)};
  try{
    db.exec('PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000;');
    if(create){db.exec(schema);db.prepare('INSERT INTO cm_series_meta VALUES(1,?,1,0,0)').run(canonical(s.config));}
    if(schemaHash(db)!==expectedSchema)fail('CM_SCHEMA_MISMATCH');
    if(Object.values(db.prepare('PRAGMA integrity_check(1)').get())[0]!=='ok')fail('CM_DB_INTEGRITY');
    if(readOnly)db.exec('BEGIN');
    s.config=JSON.parse(meta(s).config);
    if(canonical(s.config)!==canonical(planFor(s.config.identity==='fixture')))fail('CM_CONFIG_MISMATCH');
    validateDailySeries(s);return s;
  }catch(e){db.close();throw e;}
}
export function dailyStatus(s) {
  const ledger=requests(s),r=responses(s),state=meta(s);
  return {batch:s.config.batch,identity:s.config.identity,schemaVersion:2,requests:ledger,newRequests:ledger.length,
    actualBytes:ledger.reduce((n,v)=>n+(v.bytes??0),0),reservedBytes:ledger.length*CM_API_BYTES,
    reservedMs:ledger.length*30000,enabled:!!state.enabled,blocked:!!state.blocked,retryAt:state.retry_at,
    points:s.db.prepare('SELECT count(*) AS n FROM cm_series_facts WHERE price IS NOT NULL').get().n,
    factVersions:s.db.prepare('SELECT count(*) AS n FROM cm_series_facts').get().n,
    readRevision:r.at(-1)?.revision??0,
    completed:CM_LONG_BATCHES.map(b=>({...b,assets:ledger.filter(v=>v.batch===b.id&&v.status==='accepted').map(v=>v.asset)})),
  };
}
function checkpoint(s, batch, asset) { return !!s.db.prepare("SELECT 1 FROM cm_series_requests WHERE batch=? AND asset=? AND status='accepted'").get(batch,asset); }
function reserve(s,batch,asset,now) {
  const b=batchFor(batch);
  if(!s.config.assets.includes(asset)||!integer(now,s.config.cutoff))fail('CM_REQUEST_INVALID');
  return tx(s,()=>{
    const state=dailyStatus(s);
    if(!state.enabled||state.blocked)fail('CM_COLLECTION_DISABLED');
    if(checkpoint(s,batch,asset))return null;
    if(state.retryAt>now)fail('CM_SOURCE_COOLDOWN');
    if(state.requests.some(r=>r.status==='reserved'&&now<r.started+30000))fail('CM_REQUEST_IN_PROGRESS');
    if(state.requests.length>=s.config.maxRequests||state.actualBytes>state.requests.length*CM_API_BYTES)fail('CM_PLAN_BUDGET');
    if(state.requests.filter(r=>r.batch===batch&&r.asset===asset).length>=2)fail('CM_BATCH_BUDGET');
    // 增量必须依赖已经提交的回补高水位；缺口仍独立保留，不靠最大日期猜完整。
    if(b.action!=='backfill'&&!CM_LONG_BATCHES.filter(v=>v.action==='backfill').every(v=>s.config.assets.every(a=>checkpoint(s,v.id,a))))fail('CM_INCREMENTAL_CHECKPOINT');
    if(b.action==='revision'&&!s.config.assets.every(a=>checkpoint(s,'INCREMENTAL-20261003',a)))fail('CM_INCREMENTAL_CHECKPOINT');
    s.db.prepare("UPDATE cm_series_requests SET status='interrupted' WHERE status='reserved'").run();
    s.db.prepare('UPDATE cm_series_meta SET retry_at=max(retry_at,?)').run(now+1000);
    return Number(s.db.prepare("INSERT INTO cm_series_requests(batch,asset,started,status) VALUES(?,?,?,'reserved')").run(batch,asset,now).lastInsertRowid);
  });
}
export function dailyFailure(s,id,now,{bytes=0,status='failed',retryAt=0,blocked=false,httpStatus=null}={}) {
  if(!integer(bytes)||!integer(now)||!integer(retryAt)||!['failed','rejected','rate_limited','oversized'].includes(status))fail('CM_FAILURE_INVALID');
  tx(s,()=>{
    const req=s.db.prepare('SELECT * FROM cm_series_requests WHERE id=?').get(id);
    if(!req||req.status!=='reserved'||now<req.started)fail('CM_RESERVATION_INVALID');
    s.db.prepare('UPDATE cm_series_requests SET status=?,finished=?,bytes=?,retry_until=?,http_status=? WHERE id=?').run(status,now,bytes,retryAt,httpStatus,id);
    s.db.prepare('UPDATE cm_series_meta SET blocked=max(blocked,?),retry_at=max(retry_at,?)').run(+blocked,retryAt);
  });
}
export function acceptDailyPage(s,id,bytes,receivedAt) {
  const req=s.db.prepare('SELECT * FROM cm_series_requests WHERE id=?').get(id);
  if(!req||req.status!=='reserved'||!integer(receivedAt,req.started,req.started+30000))fail('CM_RESERVATION_INVALID');
  const slice=parsed(s,req,bytes,receivedAt);
  return tx(s,()=>{
    if(s.db.prepare('SELECT status FROM cm_series_requests WHERE id=?').get(id).status!=='reserved'||checkpoint(s,req.batch,req.asset))fail('CM_CHECKPOINT_CONFLICT');
    if(s.db.prepare('SELECT count(*) AS n FROM cm_series_facts').get().n+slice.coverage.expectedDates>12000)fail('CM_FACT_BUDGET');
    s.db.prepare('INSERT INTO cm_series_responses VALUES(?,?,?,?)').run(id,receivedAt,slice.provenance.sha256,Buffer.from(bytes).toString('utf8'));
    const find=s.db.prepare('SELECT * FROM cm_series_facts WHERE asset=? AND day=? ORDER BY revision DESC LIMIT 1');
    const put=s.db.prepare('INSERT INTO cm_series_facts VALUES(?,?,?,?,?,?)');
    for(const [day,v]of cells(slice)){
      const prior=find.get(req.asset,day);
      if(prior&&prior.price===v.price&&prior.reason===v.reason)continue;
      put.run(req.asset,day,id,v.price,v.reason,prior?.first_received??receivedAt);
    }
    s.db.prepare("UPDATE cm_series_requests SET status='accepted',finished=?,bytes=?,http_status=200 WHERE id=?").run(receivedAt,bytes.byteLength,id);
    return {asset:req.asset,batch:req.batch,accepted:slice.points.length,missing:slice.coverage.missing.length,revision:id};
  });
}
export async function collectDailyBatch(s,batch,{fetchImpl=fetch,clock=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms)),signal}={}) {
  const b=batchFor(batch),start=clock(),results=[];
  for(const asset of s.config.assets){
    if(signal?.aborted)fail('CM_CANCELLED');
    if(clock()-start>=120000)fail('CM_RUN_DEADLINE');
    if(checkpoint(s,batch,asset))continue;
    const pause=meta(s).retry_at-clock();
    if(pause>1000)fail('CM_SOURCE_COOLDOWN');
    if(pause>0)await wait(pause);
    if(signal?.aborted)fail('CM_CANCELLED');
    const id=reserve(s,batch,asset,clock());if(id===null)continue;
    let bytesSeen=0;
    const timeout=AbortSignal.timeout(30000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
    try{
      const response=await fetchImpl(coinMetricsDailyUrl(manifest(asset),b.from,b.cutoff),{redirect:'manual',signal:requestSignal,headers:{Accept:'application/json'}});
      if(response.status!==200){
        const value=response.headers.get('retry-after'),now=clock();
        const retry=value&&/^\d+$/.test(value)?now+Number(value)*1000:Date.parse(value??'');
        dailyFailure(s,id,now,{status:response.status===429?'rate_limited':'rejected',blocked:[401,403].includes(response.status),httpStatus:response.status,retryAt:response.status===429?Math.max(now+60000,Number.isSafeInteger(retry)?retry:0):0});
        try{await response.body?.cancel();}catch{/* 清理失败不能抹去拒绝或Retry-After。 */}
        fail('CM_SOURCE_HTTP_'+response.status);
      }
      const declared=response.headers.get('content-length');
      if(declared&&(!/^\d+$/.test(declared)||Number(declared)>CM_API_BYTES)){await response.body?.cancel();fail('CM_RESPONSE_LIMIT');}
      if(!response.body)fail('CM_EMPTY_RESPONSE');
      const chunks=[];
      for await(const chunk of response.body){bytesSeen+=chunk.length;if(bytesSeen>CM_API_BYTES)fail('CM_RESPONSE_LIMIT');chunks.push(chunk);if(requestSignal.aborted)fail('CM_CANCELLED');}
      if(requestSignal.aborted)fail('CM_CANCELLED');
      results.push(acceptDailyPage(s,id,Buffer.concat(chunks),clock()));
    }catch(e){
      if(s.db.prepare('SELECT status FROM cm_series_requests WHERE id=?').get(id).status==='reserved')dailyFailure(s,id,clock(),{bytes:bytesSeen,status:bytesSeen>CM_API_BYTES?'oversized':'failed'});
      throw e;
    }
  }
  return {batch,results,status:dailyStatus(s)};
}
function versionFor(s, revision) {
  return digest({plan:s.config,responses:s.db.prepare('SELECT revision,sha,received_at FROM cm_series_responses WHERE revision<=? ORDER BY revision').all(revision)});
}
function revisionFor(s,version) {
  const all=responses(s);
  if(version===null)return all.at(-1)?.revision??0;
  if(typeof version!=='string'||!/^[a-f0-9]{64}$/.test(version))fail('CM_QUERY_VERSION');
  for(const r of all)if(versionFor(s,r.revision)===version)return r.revision;
  fail('CM_QUERY_VERSION');
}
function currentRows(s,asset,from,to,revision) {
  return s.db.prepare(`SELECT f.* FROM cm_series_facts f WHERE asset=? AND day>=? AND day<? AND revision<=?
    AND revision=(SELECT max(g.revision) FROM cm_series_facts g WHERE g.asset=f.asset AND g.day=f.day AND g.revision<=?) ORDER BY day`).all(asset,from,to,revision,revision);
}
function coverage(s,asset,from,cutoff,revision,missingLimit=31) {
  const rows=currentRows(s,asset,from,cutoff,revision),byDay=new Map(rows.map(r=>[r.day,r]));
  let values=0,gaps=0,uncollected=0;const missing=[];
  for(let day=from;day<cutoff;day+=DAY){const r=byDay.get(day);if(r?.price!==null&&r?.price!==undefined){values++;continue;}
    if(!r)uncollected++;else gaps++;
    if(missing.length<missingLimit)missing.push({sourceDate:date(day),reason:r?.reason??'not_backfilled'});
  }
  return {status:values===(cutoff-from)/DAY?'date_grid_present':'partial',expectedDates:(cutoff-from)/DAY,presentValues:values,missing,missingCount:gaps+uncollected,gapCount:gaps,notBackfilledCount:uncollected,missingTruncated:gaps+uncollected>missing.length};
}
export function dailyQuery(s,asset,from=s.config.from,cutoff=s.config.cutoff,version=null) {
  if(!s.config.assets.includes(asset)||!integer(from,s.config.from,s.config.cutoff-DAY)||from%DAY||!integer(cutoff,from+DAY,s.config.cutoff)||cutoff%DAY)fail('CM_QUERY_RANGE');
  const revision=revisionFor(s,version);if(!revision)fail('CM_SERIES_NOT_COLLECTED');
  const end=Math.min(cutoff,from+31*DAY),rows=currentRows(s,asset,from,end,revision);
  const evidence=s.db.prepare('SELECT revision,sha,received_at FROM cm_series_responses WHERE revision<=? ORDER BY revision').all(revision);
  return {format:'coinmetrics-reference-slice-v1',identity:s.config.identity,vintage:'current_vintage',
    source:CM_DAILY.source,series:{id:'crypto:coinmetrics:'+asset+':PriceUSD:USD:1d',providerId:asset,currency:'USD',type:'reference_price',frequency:'1d'},
    version:versionFor(s,revision),queryRange:{from,cutoff},coverageRange:{from,cutoff:end},
    page:{from,cutoff:end,nextFrom:end<cutoff?end:null},coverage:coverage(s,asset,from,end,revision),
    provenance:{transport:'community_api',receivedAt:Math.max(...evidence.map(r=>r.received_at)),sha256:digest(evidence),responseDigests:evidence.map(r=>r.sha)},
    attribution:CM_DAILY.attribution,license:CM_DAILY.license,licenseUrl:CM_DAILY.licenseUrl,notice:CM_API_NOTICE,
    points:rows.filter(r=>r.price!==null).map(r=>{const source=s.db.prepare('SELECT received_at,sha FROM cm_series_responses WHERE revision=?').get(r.revision);return {sourceDate:date(r.day),periodStartAt:r.day,evidenceEndAt:r.day+DAY,price:r.price,firstReceivedAt:r.first_received,versionReceivedAt:source.received_at,sourceVersion:source.sha};}),
    analysis:{short90m:'unsupported_frequency',medium180m:'unsupported_frequency',forward30m:'unsupported_frequency'},
  };
}
export function dailyCatalog(s) {
  const revision=revisionFor(s,null),ledger=requests(s);
  return {format:'reference-catalog-v1',batch:s.config.batch,identity:s.config.identity,series:revision?s.config.assets.map(asset=>{
    const rows=currentRows(s,asset,s.config.from,s.config.cutoff,revision),valid=rows.filter(r=>r.price!==null);
    const accepted=ledger.filter(r=>r.asset===asset&&r.status==='accepted'),backs=accepted.filter(r=>batchFor(r.batch).action==='backfill'),incs=accepted.filter(r=>batchFor(r.batch).action==='incremental');
    let checkpointAt=s.config.from;
    for(const b of CM_LONG_BATCHES.filter(b=>b.action==='backfill')){if(!checkpoint(s,b.id,asset))break;checkpointAt=b.cutoff;}
    if(checkpoint(s,'INCREMENTAL-20261003',asset))checkpointAt=s.config.cutoff;
    return {asset,id:'crypto:coinmetrics:'+asset+':PriceUSD:USD:1d',version:versionFor(s,revision),range:{from:s.config.from,cutoff:s.config.cutoff},
      count:valid.length,coverage:coverage(s,asset,s.config.from,s.config.cutoff,revision),receivedAt:Math.max(0,...accepted.map(r=>r.finished)),
      actualFirst:valid[0]?.day??null,actualLast:valid.at(-1)?.day??null,checkpointAt,
      revisionCount:s.db.prepare('SELECT count(*) AS n FROM cm_series_facts WHERE asset=?').get(asset).n-rows.length,
      lastBackfill:Math.max(0,...backs.map(r=>r.finished))||null,lastIncremental:Math.max(0,...incs.map(r=>r.finished))||null};
  }):[],limitation:'UTC日格覆盖不保证价格准确/PIT；日频不支持分钟方法。未回补与来源缺值分开。'};
}

/** 重新解析全部有界原始响应，验证修订链、消耗及checkpoint；不能只校验行数。 */
export function validateDailySeries(s,now=Date.now()) {
  const state=meta(s),ledger=requests(s),raw=responses(s);
  if(!exact(state,'id config enabled blocked retry_at')||state.id!==1||![0,1].includes(state.enabled)||![0,1].includes(state.blocked)||!integer(state.retry_at)||canonical(s.config)!==canonical(planFor(s.config.identity==='fixture')))fail('CM_CONFIG_MISMATCH');
  if(ledger.length>20||raw.length>18||s.db.prepare('SELECT count(*) AS n FROM cm_series_facts').get().n>12000)fail('CM_PLAN_BUDGET');
  const expected=[],last=new Map(),done=new Set();let previousStart=0,requiredWait=0,forbidden=false;
  for(let i=0;i<ledger.length;i++){
    const r=ledger[i],b=batchFor(r.batch);
    if(r.id!==i+1||!s.config.assets.includes(r.asset)||!integer(r.started,s.config.cutoff,now)||r.started<previousStart+1000||r.started<requiredWait||forbidden||
      !['reserved','interrupted','accepted','failed','rejected','rate_limited','oversized'].includes(r.status)||
      r.finished!==null&&!integer(r.finished,r.started,now)||r.bytes!==null&&!integer(r.bytes)||
      r.status==='accepted'&&(!integer(r.finished,r.started,r.started+30000)||!integer(r.bytes,1,CM_API_BYTES))||
      r.bytes>CM_API_BYTES&&r.status!=='oversized'||!integer(r.retry_until)||r.http_status!==null&&!integer(r.http_status,100,599)||
      r.status==='accepted'&&r.http_status!==200||r.status==='rate_limited'&&(r.http_status!==429||r.retry_until<r.finished+60000)||
      ledger.filter(v=>v.batch===r.batch&&v.asset===r.asset).length>2)fail('CM_REQUEST_LEDGER_INVALID');
    previousStart=r.started;
    requiredWait=Math.max(requiredWait,r.retry_until);if([401,403].includes(r.http_status))forbidden=true;
    if(b.action!=='backfill'&&!CM_LONG_BATCHES.filter(v=>v.action==='backfill').every(v=>s.config.assets.every(a=>done.has(v.id+':'+a))))fail('CM_INCREMENTAL_CHECKPOINT');
    if(b.action==='revision'&&!s.config.assets.every(a=>done.has('INCREMENTAL-20261003:'+a)))fail('CM_INCREMENTAL_CHECKPOINT');
    const data=raw.find(v=>v.revision===r.id);
    if(r.status!=='accepted'){if(data)fail('CM_CHECKPOINT_INVALID');continue;}
    if(!data||data.received_at!==r.finished||Buffer.byteLength(data.raw)!==r.bytes||done.has(r.batch+':'+r.asset))fail('CM_CHECKPOINT_INVALID');
    const slice=parsed(s,r,Buffer.from(data.raw),data.received_at);if(slice.provenance.sha256!==data.sha)fail('CM_RESPONSE_CHECKSUM');
    done.add(r.batch+':'+r.asset);
    for(const [day,value]of cells(slice)){
      const key=r.asset+':'+day,old=last.get(key);
      if(old&&old.price===value.price&&old.reason===value.reason)continue;
      const fact={asset:r.asset,day,revision:r.id,...value,first_received:old?.first_received??r.finished};expected.push(fact);last.set(key,fact);
    }
  }
  if(ledger.length&&state.retry_at<previousStart+1000||state.retry_at<requiredWait||forbidden&&!state.blocked||raw.length!==done.size||s.db.prepare('PRAGMA foreign_key_check').all().length)fail('CM_CHECKPOINT_INVALID');
  const actual=s.db.prepare('SELECT * FROM cm_series_facts ORDER BY revision,day').all();
  if(canonical(actual)!==canonical(expected))fail('CM_REVISION_CHAIN');
  if(s.db.prepare('PRAGMA page_count').get().page_count*s.db.prepare('PRAGMA page_size').get().page_size>MAX_DB)fail('CM_DB_LIMIT');
}
export function exportDailySeries(s) {
  s.db.exec('SAVEPOINT daily_export');
  try{
    validateDailySeries(s);
    const body={format:'coinmetrics-local-snapshot-v2',meta:meta(s),requests:requests(s),responses:responses(s),facts:s.db.prepare('SELECT * FROM cm_series_facts ORDER BY revision,day').all()};
    const text=canonical({...body,checksum:digest(body)});if(Buffer.byteLength(text)>MAX_EXPORT)fail('CM_BACKUP_LIMIT');return text;
  }finally{s.db.exec('RELEASE daily_export');}
}
export function restoreDailySeries(path,text) {
  if(typeof text!=='string'||Buffer.byteLength(text)>MAX_EXPORT)fail('CM_BACKUP_LIMIT');
  const input=JSON.parse(text);
  if(!exact(input,'format meta requests responses facts checksum'))fail('CM_BACKUP_INVALID');
  const {checksum,...body}=input;
  if(body.format!=='coinmetrics-local-snapshot-v2'||digest(body)!==checksum||!exact(body.meta,'id config enabled blocked retry_at')||
    !Array.isArray(body.requests)||body.requests.length>20||!Array.isArray(body.responses)||body.responses.length>18||!Array.isArray(body.facts)||body.facts.length>12000)fail('CM_BACKUP_INVALID');
  const config=JSON.parse(body.meta.config);if(canonical(config)!==canonical(planFor(config.identity==='fixture')))fail('CM_CONFIG_MISMATCH');
  const load=s=>tx(s,()=>{
    if(body.meta.id!==1||![0,1].includes(body.meta.enabled)||![0,1].includes(body.meta.blocked)||!integer(body.meta.retry_at))fail('CM_BACKUP_INVALID');
    s.db.prepare('UPDATE cm_series_meta SET enabled=0,blocked=?,retry_at=?').run(body.meta.blocked,body.meta.retry_at);
    for(const r of body.requests){if(!exact(r,'id batch asset started finished status bytes retry_until http_status'))fail('CM_BACKUP_INVALID');s.db.prepare('INSERT INTO cm_series_requests VALUES(?,?,?,?,?,?,?,?,?)').run(r.id,r.batch,r.asset,r.started,r.finished,r.status==='reserved'?'interrupted':r.status,r.bytes,r.retry_until,r.http_status);}
    for(const r of body.responses){if(!exact(r,'revision received_at sha raw')||typeof r.raw!=='string'||Buffer.byteLength(r.raw)>CM_API_BYTES)fail('CM_BACKUP_INVALID');s.db.prepare('INSERT INTO cm_series_responses VALUES(?,?,?,?)').run(r.revision,r.received_at,r.sha,r.raw);}
    for(const r of body.facts){if(!exact(r,'asset day revision price reason first_received'))fail('CM_BACKUP_INVALID');s.db.prepare('INSERT INTO cm_series_facts VALUES(?,?,?,?,?,?)').run(r.asset,r.day,r.revision,r.price,r.reason,r.first_received);}
    validateDailySeries(s);
  });
  const staged=openDailySeries(':memory:',{create:true,fixture:config.identity==='fixture'});let result;
  try{load(staged);result=dailyStatus(staged);}finally{staged.db.close();}
  if(path===':memory:')return result;
  if(existsSync(path))fail('CM_NEW_TARGET_REQUIRED');
  const pending=path+'.pending-'+randomUUID();
  try{
    const target=openDailySeries(pending,{create:true,fixture:config.identity==='fixture'});
    try{load(target);}finally{target.db.close();}
    const fd=openSync(pending,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}
    linkSync(pending,path);return result;
  }finally{if(existsSync(pending))unlinkSync(pending);}
}
