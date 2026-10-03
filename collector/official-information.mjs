// 单一公开元数据归档。不接受用户配置、行情事实、任意URL或服务器调用。
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync,writeFileSync,statSync,copyFileSync,linkSync,unlinkSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {OFFICIAL_SOURCES,normalizeReleases,parseOfficialView} from '../lib/information/official.mjs';
import {viewDigest} from '../lib/information/fed-view.mjs';
const schema=`CREATE TABLE info_meta(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL,cooldown INTEGER NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)));INSERT INTO info_meta VALUES(1,1,0,1);
CREATE TABLE info_versions(version INTEGER PRIMARY KEY,source TEXT NOT NULL,record_id INTEGER NOT NULL,hash TEXT NOT NULL,fact TEXT NOT NULL,first_saved INTEGER NOT NULL,saved INTEGER NOT NULL);CREATE INDEX info_versions_key ON info_versions(source,record_id,version);
CREATE TABLE info_snapshots(id TEXT PRIMARY KEY,source TEXT NOT NULL,checked INTEGER NOT NULL,saved INTEGER NOT NULL,receipt TEXT NOT NULL,refs TEXT NOT NULL);CREATE INDEX info_snapshots_source ON info_snapshots(source,checked);
CREATE TABLE info_requests(id TEXT PRIMARY KEY,dispatched INTEGER NOT NULL,status INTEGER,bytes INTEGER NOT NULL DEFAULT 0);`;
export class OfficialArchive{
 constructor(path=':memory:',{readOnly=false}={}){
  this.db=new DatabaseSync(path,{readOnly});this.db.exec('PRAGMA busy_timeout=5000; PRAGMA trusted_schema=OFF');
  const present=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='info_meta'").get();
  if(!present&&!readOnly){if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").get())throw Error('NEW_INFORMATION_DATABASE_REQUIRED');this.db.exec(schema);}
  if(this.db.prepare('SELECT schema_version FROM info_meta WHERE id=1').get()?.schema_version!==1)throw Error('INFORMATION_SCHEMA');
 }
 close(){this.db.close();}
 async ingest(sourceId,raw,checkedAt,savedAt,{receiptBasis='response_completed'}={}){
  if(!['reviewed_capture_mtime','response_completed'].includes(receiptBasis)||!Number.isSafeInteger(checkedAt)||checkedAt<1||!Number.isSafeInteger(savedAt)||savedAt<checkedAt)throw Error('INVALID_RECEIPT_TIME');
  const facts=normalizeReleases(sourceId,raw,checkedAt),hashes=await Promise.all(facts.map(viewDigest));
  const id=await viewDigest({sourceId,checkedAt,receiptBasis,hashes});
  this.db.exec('BEGIN IMMEDIATE');
  try{
   if(this.db.prepare('SELECT id FROM info_snapshots WHERE id=?').get(id)){this.db.exec('COMMIT');return {id,added:0,reused:true};}
   if(this.db.prepare('SELECT count(*) AS n FROM info_snapshots').get().n>=1000)throw Error('ARCHIVE_LIMIT');const versionCount=this.db.prepare('SELECT count(*) AS n FROM info_versions').get().n;
   const last=this.db.prepare('SELECT max(checked) AS at FROM info_snapshots WHERE source=?').get(sourceId);if(last.at>checkedAt)throw Error('OLDER_CAPTURE_REQUIRES_REVIEW');
   const refs=[];let added=0;
   for(let i=0;i<facts.length;i++){
    const fact=facts[i],head=this.db.prepare('SELECT * FROM info_versions WHERE source=? AND record_id=? ORDER BY version DESC LIMIT 1').get(sourceId,fact.id);
    let version=head?.version;if(!head||head.hash!==hashes[i]){
     if(versionCount+added>=5000)throw Error('ARCHIVE_LIMIT');const first=head?.first_saved??savedAt;
     version=Number(this.db.prepare('INSERT INTO info_versions(source,record_id,hash,fact,first_saved,saved) VALUES(?,?,?,?,?,?)').run(sourceId,fact.id,hashes[i],JSON.stringify(fact),first,savedAt).lastInsertRowid);added++;
    }refs.push(version);
   }
   this.db.prepare('INSERT INTO info_snapshots VALUES(?,?,?,?,?,?)').run(id,sourceId,checkedAt,savedAt,receiptBasis,JSON.stringify(refs));this.db.exec('COMMIT');return {id,added,reused:false};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 async view(exportedAt,{snapshots}={}){
  const sources=OFFICIAL_SOURCES.map(source=>{
   const snapshot=snapshots?.[source.id]?this.db.prepare('SELECT * FROM info_snapshots WHERE id=? AND source=?').get(snapshots[source.id],source.id):this.db.prepare('SELECT * FROM info_snapshots WHERE source=? ORDER BY checked DESC,rowid DESC LIMIT 1').get(source.id);
   if(snapshots?.[source.id]&&!snapshot)throw Error('SNAPSHOT_NOT_FOUND');
   if(!snapshot)return {sourceId:source.id,snapshotId:null,checkedAt:null,receiptBasis:null,records:[]};
   const records=JSON.parse(snapshot.refs).map(version=>{const r=this.db.prepare('SELECT * FROM info_versions WHERE version=? AND source=?').get(version,source.id);if(!r)throw Error('BROKEN_REFERENCE');return {fact:JSON.parse(r.fact),version:r.version,contentHash:r.hash,firstSavedAt:r.first_saved,versionSavedAt:r.saved};});
   return {sourceId:source.id,snapshotId:snapshot.id,checkedAt:snapshot.checked,receiptBasis:snapshot.receipt,records};
  });
  const body={format:'official-information-v1',identity:'reconstructed',vintage:'current',exportedAt,sources};return parseOfficialView(JSON.stringify({...body,viewId:await viewDigest(body)}),exportedAt);
 }
 seedInvestigation(rows){
  // 引入这次既有官方API请求，避免换采集入口把已消耗额度清零。
  this.db.exec('BEGIN IMMEDIATE');try{for(const r of rows){if(!Number.isSafeInteger(r.at)||r.at<1||typeof r.id!=='string'||!/^[a-z-]{1,80}$/.test(r.id)||!Number.isSafeInteger(r.bytes)||r.bytes<0)throw Error('BAD_LEDGER');this.db.prepare('INSERT OR IGNORE INTO info_requests VALUES(?,?,?,?)').run('investigation:'+r.id,r.at,r.status??0,r.bytes);}this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 reserve(id,now){
  this.db.exec('BEGIN IMMEDIATE');try{
   if(!Number.isSafeInteger(now)||now<1||typeof id!=='string'||id.length>100)throw Error('BAD_REQUEST_ID');
   const meta=this.db.prepare('SELECT * FROM info_meta').get();if(meta.enabled!==1)throw Error('COLLECTION_DISABLED');if(meta.cooldown>now)throw Error('SOURCE_COOLDOWN');
   if(this.db.prepare('SELECT count(*) AS n FROM info_requests WHERE dispatched>?').get(now-86400000).n>=12)throw Error('SOURCE_DAILY_BUDGET');
   const latest=this.db.prepare('SELECT max(dispatched) AS at FROM info_requests').get().at;if(latest&&now<latest+1100)throw Error('SOURCE_SPACING');
   this.db.prepare('INSERT INTO info_requests(id,dispatched) VALUES(?,?)').run(id,now);this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 finish(id,status,bytes,now,retryAfter){
  if(!Number.isSafeInteger(bytes)||bytes<0||!Number.isSafeInteger(now)||now<1)throw Error('BAD_ACCOUNTING');
  this.db.exec('BEGIN IMMEDIATE');try{
   if(this.db.prepare('UPDATE info_requests SET status=?,bytes=? WHERE id=? AND status IS NULL').run(status,bytes,id).changes!==1)throw Error('REQUEST_NOT_RESERVED');
   if(status!==200){const retry=typeof retryAfter==='string'&&/^\d+$/.test(retryAfter)?now+Number(retryAfter)*1000:Date.parse(retryAfter??'');const until=Math.max(now+3600000,Number.isSafeInteger(retry)?retry:0);this.db.prepare('UPDATE info_meta SET cooldown=max(cooldown,?)').run(until);}
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 backup(target){
  if(existsSync(target)||existsSync(target+'.manifest.json'))throw Error('NEW_BACKUP_REQUIRED');this.db.prepare('VACUUM INTO ?').run(target);
  const manifest={format:'official-information-backup-v1',bytes:statSync(target).size,sha256:createHash('sha256').update(readFileSync(target)).digest('hex')};writeFileSync(target+'.manifest.json',JSON.stringify(manifest),{flag:'wx'});return manifest;
 }
 static async restore(source,target,now){
  if(existsSync(target)||existsSync(target+'.pending'))throw Error('NEW_RESTORE_REQUIRED');
  const m=JSON.parse(readFileSync(source+'.manifest.json','utf8'));if(m.format!=='official-information-backup-v1'||m.bytes!==statSync(source).size||m.bytes>16*1024**2||m.sha256!==createHash('sha256').update(readFileSync(source)).digest('hex'))throw Error('BACKUP_CHECKSUM');
  copyFileSync(source,target+'.pending',constants.COPYFILE_EXCL);let restored;
  try{
   restored=new OfficialArchive(target+'.pending');
   if(restored.db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||restored.db.prepare('SELECT count(*) AS n FROM info_versions').get().n>5000||restored.db.prepare('SELECT count(*) AS n FROM info_snapshots').get().n>1000)throw Error('BACKUP_INVALID');
   for(const row of restored.db.prepare('SELECT source,id FROM info_snapshots').all())await restored.view(now,{snapshots:{[row.source]:row.id}});
   await restored.view(now);restored.db.prepare('UPDATE info_meta SET enabled=0').run();restored.close();restored=null;
   linkSync(target+'.pending',target);unlinkSync(target+'.pending');return {collection:'disabled',sourceChecksum:m.sha256};
  }catch(e){restored?.close();unlinkSync(target+'.pending');throw e;}
 }
}

export async function refreshOfficial(store,{fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),signal}={}){
 const started=now(),report=[];
 for(const source of OFFICIAL_SOURCES){
  if(signal?.aborted)throw Error('CANCELLED');if(now()-started>=120000)throw Error('BATCH_TIME_LIMIT');
  if(report.length)await sleep(1100);if(signal?.aborted)throw Error('CANCELLED');
  const id=crypto.randomUUID();store.reserve(id,now());let bytes=0,status=0,retryAfter,result,success=false;
  try{
   const response=await fetchImpl(`https://api.github.com/repos/${source.repo}/releases?per_page=5`,{redirect:'error',credentials:'omit',headers:{Accept:'application/vnd.github+json','User-Agent':'MarketRadar/2.9 https://github.com/cjwdwb/market-radar'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
   status=response.status;retryAfter=response.headers.get('retry-after');if(status!==200){await response.body?.cancel();throw Error('SOURCE_REJECTED');}
   const chunks=[],reader=response.body?.getReader();if(!reader)throw Error('EMPTY_RESPONSE');
   try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2*1024**2)throw Error('RESPONSE_LIMIT');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))),checkedAt=now();
   if(signal?.aborted)throw Error('CANCELLED');if(checkedAt-started>=120000)throw Error('BATCH_TIME_LIMIT');
   result=await store.ingest(source.id,raw,checkedAt,now());success=true;
  }finally{store.finish(id,success?200:status===200?0:status,bytes,now(),retryAfter);}
  report.push({sourceId:source.id,bytes,...result});
 }return report;
}
