import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FED, isFedConfig, fedLink } from './source-policy.mjs';

export const LIMITS = Object.freeze({ requests: 20, pages: 10, pageBytes: 2 * 1024 ** 2, bytes: 8 * 1024 ** 2, writes: 2000, durationMs: 60000, assets: 2 });
export const EXPORT_LIMITS = Object.freeze({ bytes: 16 * 1024 ** 2, rows: 10000 });
const DAY = 86400000;
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const fail = code => { throw new Error(code); };
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const text = (v, max = 160) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x1f]/.test(v);
const token = v => text(v) && /^[a-zA-Z0-9_.:/^-]+$/.test(v);
const keys = (obj, allowed) => obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every(k => allowed.includes(k));
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && [Object.prototype,null].includes(Object.getPrototypeOf(value))) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return fail('INVALID_JSON');
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
function validateConfig(config) {
  if (!keys(config, ['owner','runId','source','universeVersion','assets','from','cutoff','createdAt','identity','limits']) ||
      ![config.owner, config.runId, config.source, config.universeVersion].every(token) || !(config.identity === 'fixture' && config.source.startsWith('fixture:') || isFedConfig(config))) fail('FIXTURE_SCOPE_REQUIRED');
  if (![config.from,config.cutoff,config.createdAt].every(n => integer(n,1)) || config.from >= config.cutoff || config.cutoff > config.createdAt || config.cutoff - config.from > 31 * DAY) fail('INVALID_RANGE');
  if (!Array.isArray(config.assets) || !config.assets.length || config.assets.length > LIMITS.assets || new Set(config.assets.map(a => a.id)).size !== config.assets.length) fail('INVALID_UNIVERSE');
  for (const a of config.assets) {
    if (!keys(a,['id','market','venue','providerId','currency','adjustment','role']) || ![a.id,a.market,a.venue,a.providerId,a.currency,a.adjustment].every(token) || !(isFedConfig(config)?a.role==='context':['asset','helper'].includes(a.role))) fail('INVALID_ASSET_IDENTITY');
  }
  if (!keys(config.limits,Object.keys(LIMITS).filter(k=>k!=='assets'))) fail('INVALID_LIMIT');
  const limits = Object.fromEntries(Object.entries(LIMITS).filter(([k])=>k!=='assets').map(([k,v])=>[k,config.limits[k]??v]));
  if (Object.entries(limits).some(([k,v])=>!integer(v,1,LIMITS[k]))) fail('INVALID_LIMIT');
  if(isFedConfig(config)&&Object.entries(limits).some(([k,v])=>v>FED.limits[k]))fail('SOURCE_LIMIT');
  return JSON.parse(canonical({...config,limits}));
}
function validateFact(record,config,receivedAt) {
  if (!keys(record,['asset','kind','occurredAt','payload']) || !config.assets.some(a=>a.id===record.asset) || !['bar','information'].includes(record.kind)) fail('INVALID_RECORD');
  const p=record.payload, asset=config.assets.find(a=>a.id===record.asset);
  const fed=isFedConfig(config);
  if(fed&&record.kind!=='information')fail('INFORMATION_ONLY');
  if (record.kind==='bar') {
    if (!integer(record.occurredAt,config.from,config.cutoff-1) || !keys(p,['intervalMs','currency','adjustment','open','high','low','close','volume','complete','sessionEvidence']) || ![300000,900000].includes(p.intervalMs) || p.currency!==asset.currency || p.adjustment!==asset.adjustment || p.complete!==true || p.sessionEvidence!=='fixture_only' || record.occurredAt%p.intervalMs!==0 || record.occurredAt+p.intervalMs>config.cutoff) fail('INVALID_BAR_METADATA');
    if (![p.open,p.high,p.low,p.close].every(n=>Number.isFinite(n)&&n>0) || p.high<Math.max(p.open,p.close,p.low) || p.low>Math.min(p.open,p.close,p.high) || !(p.volume===null || Number.isFinite(p.volume)&&p.volume>=0)) fail('INVALID_OHLCV');
    return { ...record, sortAt:record.occurredAt, key: canonical([p.intervalMs,record.occurredAt,p.currency,p.adjustment]), hash: digest(record) };
  }
  if (!keys(p,['sourceRecordId','title','publisher','url','publication','informationType']) || !token(p.sourceRecordId) || !['filing','announcement','report','macro'].includes(p.informationType) || !text(p.title,500) || !text(p.publisher,200) || /[<>]/.test(p.title+p.publisher)) fail('INVALID_INFORMATION');
  let url; try { url=new URL(p.url); } catch { fail('UNSAFE_LINK'); }
  if (fed ? !fedLink(p.url)||p.sourceRecordId!==p.url||p.publisher!==FED.attribution||p.informationType!=='macro' : url.protocol!=='https:' || url.hostname!=='example.invalid' || url.username || url.password || url.port || url.hash || url.search || !text(p.url,1000)) fail('UNSAFE_LINK');
  if (!keys(p.publication,['precision','at','date','timezone']) || p.publication.timezone!=='UTC' || !(fed?['minute','second']:['second','day','unknown']).includes(p.publication.precision)) fail('INVALID_PUBLICATION');
  const pub=p.publication;
  let sortAt=receivedAt;
  if (pub.precision==='second'||pub.precision==='minute') {
    if (!integer(pub.at,config.from,Math.min(receivedAt,config.cutoff-1)) || pub.at!==record.occurredAt || pub.date!==null) fail('INVALID_PUBLICATION');
    sortAt=pub.at;
    if(pub.precision==='minute'&&pub.at%60000!==0)fail('INVALID_PUBLICATION');
  } else {
    if (record.occurredAt!==null || pub.at!==null || (pub.precision==='day' ? !/^\d{4}-\d{2}-\d{2}$/.test(pub.date??'') || !Number.isFinite(Date.parse(pub.date)) || new Date(Date.parse(pub.date)).toISOString().slice(0,10)!==pub.date : pub.date!==null)) fail('INVALID_PUBLICATION');
    if(pub.precision==='day'){
      const dayStart=Date.parse(pub.date+'T00:00:00Z');sortAt=dayStart+DAY-1;
      if(dayStart>=config.cutoff||sortAt<config.from||dayStart>receivedAt)fail('INVALID_PUBLICATION');
    }
  }
  // Sorting bound is separate from event time and hash; a later batch never invents a source revision.
  return { ...record, sortAt, key: canonical([p.sourceRecordId,p.url]), hash: digest(record) };
}
const runView = row => row ? {...row,config:JSON.parse(row.config)} : null;

/** Local archive only: fixture or one explicitly approved Board metadata profile. No network/import-time work. */
export class ArchiveStore {
  constructor(filename=':memory:') {
    this.db=new DatabaseSync(filename);
    const exists=this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='archive_meta'").get();
    if(exists&&this.db.prepare('SELECT schema_version FROM archive_meta WHERE id=1').get()?.schema_version!==2){this.db.close();fail('SCHEMA_VERSION_NEW_DATABASE_REQUIRED');}
    this.db.exec('PRAGMA busy_timeout=3000;');
    this.db.exec(schema);
    if (this.db.prepare('SELECT schema_version FROM archive_meta WHERE id=1').get().schema_version!==2) fail('SCHEMA_VERSION');
  }
  close(){this.db.close();}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  createRun(input){
    const c=validateConfig(input);
    return this.transaction(()=>{
      if(this.getRun(c.owner,c.runId)) fail('RUN_EXISTS');
      this.assertIdentity(c);
      this.db.prepare('INSERT INTO archive_runs(owner,run_id,config,status) VALUES(?,?,?,?)').run(c.owner,c.runId,canonical(c),'ready');
      if(isFedConfig(c))this.db.prepare('INSERT OR IGNORE INTO archive_sources(source) VALUES(?)').run(c.source);
      return this.getRun(c.owner,c.runId);
    });
  }
  assertIdentity(config){
    const identity=a=>canonical(Object.fromEntries(Object.entries(a).filter(([k])=>k!=='role')));
    for(const row of this.db.prepare('SELECT config FROM archive_runs WHERE owner=?').iterate(config.owner)){
      const previous=JSON.parse(row.config);if(previous.source!==config.source)continue;
      for(const asset of config.assets){const old=previous.assets.find(a=>a.id===asset.id);if(old&&identity(old)!==identity(asset))fail('ASSET_IDENTITY_CONFLICT');}
    }
  }
  getRun(owner,runId){return runView(this.db.prepare('SELECT * FROM archive_runs WHERE owner=? AND run_id=?').get(owner,runId));}
  requireRun(owner,runId){return this.getRun(owner,runId)??fail('RUN_NOT_FOUND');}
  stopRun(owner,runId,reason='cancelled',leaseToken=undefined){
    if(!['cancelled','budget_requests','budget_bytes','budget_pages','budget_writes','budget_time','retry_exhausted','retry_after','invalid_page','no_progress','adapter_failure','timeout','budget_source','source_busy','source_cooldown','collection_disabled'].includes(reason))fail('INVALID_STOP_REASON');
    this.requireRun(owner,runId);
    if(leaseToken===undefined)this.db.prepare("UPDATE archive_runs SET status='paused',reason=? WHERE owner=? AND run_id=? AND status!='traversed'").run(reason,owner,runId);
    else this.db.prepare("UPDATE archive_runs SET status='paused',reason=? WHERE owner=? AND run_id=? AND status!='traversed' AND lease_token IS ?").run(reason,owner,runId,leaseToken);
    return this.getRun(owner,runId);
  }
  resumeRun(owner,runId,now){
    const r=this.requireRun(owner,runId);
    if(!integer(now,r.config.createdAt,r.config.createdAt+r.config.limits.durationMs-1))fail('RUN_DEADLINE');
    if(r.status==='traversed')return r;
    if(['budget_requests','budget_bytes','budget_pages','budget_writes','budget_time'].includes(r.reason))fail('BUDGET_EXHAUSTED');
    if(r.page_attempts>=3)fail('PAGE_ATTEMPTS_EXHAUSTED');
    if(now<r.retry_not_before)fail('RETRY_NOT_BEFORE');
    if(r.lease_token!==null&&now<r.lease_until)fail('RUN_IN_FLIGHT');
    this.db.prepare("UPDATE archive_runs SET status='ready',reason=NULL WHERE owner=? AND run_id=?").run(owner,runId);return this.getRun(owner,runId);
  }
  reserveRequest(owner,runId,now){
    return this.transaction(()=>{
      const r=this.requireRun(owner,runId),l=r.config.limits;
      if(r.status!=='ready')return {ok:false,reason:r.reason??r.status};
      if(r.lease_token!==null&&now<r.lease_until)return {ok:false,reason:'in_flight'};
      if(now<r.retry_not_before)return {ok:false,reason:'retry_after'};
      const reason=!integer(now,r.config.createdAt,r.config.createdAt+l.durationMs-1)?'budget_time':r.page_attempts>=3?'retry_exhausted':r.requests>=l.requests?'budget_requests':r.bytes>=l.bytes?'budget_bytes':r.pages>=l.pages?'budget_pages':r.writes>=l.writes?'budget_writes':null;
      if(reason){this.stopRun(owner,runId,reason);return {ok:false,reason};}
      const leaseToken=r.requests+1,leaseUntil=Math.min(now+8000,r.config.createdAt+l.durationMs);
      if(isFedConfig(r.config)){
        const source=this.db.prepare('SELECT * FROM archive_sources WHERE source=?').get(r.config.source);
        const count=this.db.prepare('SELECT count(*) AS n FROM archive_source_requests WHERE source=? AND requested_at>?').get(r.config.source,now-DAY).n;
        const blocked=!this.db.prepare('SELECT collection_enabled FROM archive_meta WHERE id=1').get().collection_enabled?'collection_disabled':source.lease_until>now?'source_busy':source.retry_not_before>now||source.last_dispatch&&now<source.last_dispatch+1000?'source_cooldown':count>=6?'budget_source':null;
        if(blocked){this.stopRun(owner,runId,blocked);return {ok:false,reason:blocked};}
        this.db.prepare('INSERT INTO archive_source_requests VALUES(?,?,?,?,?)').run(r.config.source,owner,runId,leaseToken,now);
        this.db.prepare('UPDATE archive_sources SET last_dispatch=?,lease_owner=?,lease_run=?,lease_token=?,lease_until=? WHERE source=?').run(now,owner,runId,leaseToken,leaseUntil,r.config.source);
      }
      this.db.prepare('UPDATE archive_runs SET requests=requests+1,page_attempts=page_attempts+1,lease_token=?,lease_until=? WHERE owner=? AND run_id=?').run(leaseToken,leaseUntil,owner,runId);
      return {ok:true,requestNumber:leaseToken,leaseToken,leaseUntil,attempt:r.page_attempts+1};
    });
  }
  releaseRequest(owner,runId,leaseToken){this.transaction(()=>{
    this.db.prepare('UPDATE archive_runs SET lease_token=NULL,lease_until=NULL WHERE owner=? AND run_id=? AND lease_token=?').run(owner,runId,leaseToken);
    this.db.prepare('UPDATE archive_sources SET lease_owner=NULL,lease_run=NULL,lease_token=NULL,lease_until=NULL WHERE lease_owner=? AND lease_run=? AND lease_token=?').run(owner,runId,leaseToken);
  });}
  deferRetry(owner,runId,leaseToken,notBefore){
    if(!integer(notBefore,1))fail('INVALID_RETRY_TIME');
    this.transaction(()=>{
      const result=this.db.prepare('UPDATE archive_runs SET retry_not_before=? WHERE owner=? AND run_id=? AND lease_token=?').run(notBefore,owner,runId,leaseToken);
      if(result.changes!==1)fail('FENCED_REQUEST');
      const source=this.requireRun(owner,runId).config.source;
      this.db.prepare('UPDATE archive_sources SET retry_not_before=MAX(retry_not_before,?) WHERE source=?').run(notBefore,source);
    });
  }
  chargeBytes(owner,runId,count,leaseToken=undefined){
    if(!integer(count))fail('INVALID_BYTE_COUNT');
    return this.transaction(()=>{
      const r=this.requireRun(owner,runId);
      if(!integer(r.bytes+count))fail('INVALID_BYTE_COUNT');
      this.db.prepare('UPDATE archive_runs SET bytes=bytes+? WHERE owner=? AND run_id=?').run(count,owner,runId);
      if(count>r.config.limits.pageBytes || r.bytes+count>r.config.limits.bytes){this.stopRun(owner,runId,'budget_bytes',leaseToken);return false;}
      return true;
    });
  }
  commitPage(owner,runId,{expectedCursor,nextCursor,records,receivedAt,traversalDone=false,leaseToken}, fault){
    return this.transaction(()=>{
      const r=this.requireRun(owner,runId),c=r.config;
      if(r.status!=='ready' || r.cursor!==expectedCursor)fail('CHECKPOINT_CONFLICT');
      if(r.lease_token!==leaseToken||leaseToken===null||!integer(receivedAt,c.createdAt,r.lease_until-1))fail('FENCED_REQUEST');
      if(r.requests<=r.pages||r.bytes<=0)fail('UNACCOUNTED_PAGE');
      if(r.bytes>c.limits.bytes)fail('BYTE_BUDGET');
      if(!integer(receivedAt,c.createdAt,c.createdAt+c.limits.durationMs-1))fail('RUN_DEADLINE');
      if(!Array.isArray(records) || records.length>c.limits.writes || typeof traversalDone!=='boolean' || !(nextCursor===null||text(nextCursor,500)) || traversalDone!==(nextCursor===null))fail('INVALID_PAGE');
      if(!traversalDone&&nextCursor===expectedCursor)fail('NO_PROGRESS');
      if(r.pages>=c.limits.pages)fail('PAGE_BUDGET');
      const normalized=records.map(record=>validateFact(record,c,receivedAt));
      if(new Set(normalized.map(f=>canonical([f.asset,f.kind,f.key]))).size!==normalized.length)fail('DUPLICATE_PAGE_KEYS');
      const fingerprint=digest(normalized.map(f=>({asset:f.asset,kind:f.kind,key:f.key,hash:f.hash})).sort((a,b)=>canonical(a).localeCompare(canonical(b))));
      if(this.db.prepare('SELECT 1 FROM archive_pages WHERE owner=? AND run_id=? AND fingerprint=?').get(owner,runId,fingerprint))fail('REPEATED_PAGE');
      if(nextCursor!==null&&this.db.prepare('SELECT 1 FROM archive_pages WHERE owner=? AND run_id=? AND (before_cursor=? OR after_cursor=?)').get(owner,runId,nextCursor,nextCursor))fail('CURSOR_CYCLE');
      const inserts=[];let duplicates=0,revisions=0;
      for(const f of normalized){
        const previous=this.db.prepare('SELECT hash FROM archive_facts WHERE owner=? AND source=? AND asset=? AND kind=? AND logical_key=? ORDER BY revision DESC,id DESC LIMIT 1').get(owner,c.source,f.asset,f.kind,f.key);
        if(previous?.hash===f.hash){duplicates++;continue;}
        if(previous)revisions++;inserts.push(f);
      }
      if(r.writes+inserts.length>c.limits.writes)fail('WRITE_BUDGET');
      this.db.prepare('UPDATE archive_meta SET revision=revision+1 WHERE id=1').run();
      const revision=this.db.prepare('SELECT revision FROM archive_meta WHERE id=1').get().revision;
      this.db.prepare('INSERT INTO archive_pages VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(owner,runId,r.pages+1,revision,fingerprint,expectedCursor,nextCursor,receivedAt,inserts.length,duplicates,revisions,traversalDone?1:0);
      for(const f of inserts)this.db.prepare('INSERT INTO archive_facts(owner,run_id,revision,source,asset,kind,logical_key,hash,occurred_at,sort_at,received_at,identity,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(owner,runId,revision,c.source,f.asset,f.kind,f.key,f.hash,f.occurredAt,f.sortAt,receivedAt,c.identity,canonical(f.payload));
      // Fault injection only from trusted local tests; no user/HTTP entry point.
      fault?.('after_facts');
      this.db.prepare('UPDATE archive_runs SET cursor=?,status=?,reason=NULL,pages=pages+1,writes=writes+?,lease_token=NULL,lease_until=NULL,page_attempts=0,retry_not_before=0 WHERE owner=? AND run_id=?').run(nextCursor,traversalDone?'traversed':'ready',inserts.length,owner,runId);
      this.db.prepare('UPDATE archive_sources SET lease_owner=NULL,lease_run=NULL,lease_token=NULL,lease_until=NULL WHERE lease_owner=? AND lease_run=? AND lease_token=?').run(owner,runId,leaseToken);
      fault?.('after_checkpoint');
      return {revision,inserted:inserts.length,duplicates,revisions,traversalDone};
    });
  }
  query({owner,source,asset,kind,from,to,limit=100,cursor=null}){
    if(![owner,source,asset].every(token)||!['bar','information'].includes(kind)||!integer(from,1)||!integer(to,from+1)||to-from>31*DAY||!integer(limit,1,200))fail('INVALID_QUERY');
    const signature=digest({owner,source,asset,kind,from,to,limit});
    const maximum=this.db.prepare('SELECT revision FROM archive_meta WHERE id=1').get().revision;
    let position={revision:maximum,afterTime:0,afterId:0,signature};
    if(cursor!==null){
      if(!text(cursor,2000))fail('INVALID_CURSOR');
      try{position=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{fail('INVALID_CURSOR');}
      if(!keys(position,['revision','afterTime','afterId','signature'])||position.signature!==signature||!integer(position.revision,0,maximum)||!integer(position.afterTime)||!integer(position.afterId))fail('INVALID_CURSOR');
    }
    const rows=this.db.prepare(`SELECT f.* FROM archive_facts f WHERE f.owner=? AND f.source=? AND f.asset=? AND f.kind=? AND f.revision<=?
      AND f.sort_at>=? AND f.sort_at<? AND (f.sort_at>? OR (f.sort_at=? AND f.id>?))
      AND NOT EXISTS(SELECT 1 FROM archive_facts n WHERE n.owner=f.owner AND n.source=f.source AND n.asset=f.asset AND n.kind=f.kind AND n.logical_key=f.logical_key AND n.revision<=? AND (n.revision>f.revision OR (n.revision=f.revision AND n.id>f.id)))
      ORDER BY f.sort_at,f.id LIMIT ?`).all(owner,source,asset,kind,position.revision,from,to,position.afterTime,position.afterTime,position.afterId,position.revision,limit+1);
    const more=rows.length>limit,items=rows.slice(0,limit),last=items.at(-1);
    const fed=source===FED.source&&owner===FED.owner&&asset===FED.asset.id;
    return {identity:fed?'reconstructed':'fixture',readRevision:position.revision,records:items.map(row=>({...row,payload:JSON.parse(row.payload),sortBasis:row.occurred_at!==null?'source_time':JSON.parse(row.payload).publication.precision==='day'?'publication_day_upper_bound':'first_received'})),
      nextCursor:more?Buffer.from(canonical({...position,afterTime:last.sort_at,afterId:last.id})).toString('base64url'):null,
      coverage:{status:'not_verified',expectedCount:null,reason:fed?'Current RSS snapshot only; not all September announcements or point-in-time information.':'Fixture archive only; queryable rows and endpoint traversal do not prove complete market coverage.'}};
  }
  exportSnapshot(owner){
    if(!token(owner))fail('INVALID_OWNER');
    return this.transaction(()=>{
      const tables=['archive_runs','archive_pages','archive_facts'];
      const count=tables.reduce((n,t)=>n+this.db.prepare(`SELECT count(*) AS n FROM ${t} WHERE owner=?`).get(owner).n,0);
      if(count>EXPORT_LIMITS.rows)fail('EXPORT_ROW_LIMIT');
      const real=this.db.prepare('SELECT 1 FROM archive_runs WHERE owner=? AND json_extract(config,\'$.source\')=?').get(owner,FED.source);
      const data={schemaVersion:real?2:1,owner,revision:this.db.prepare('SELECT revision FROM archive_meta WHERE id=1').get().revision,tables:{}};
      let budget=0;
      for(const table of tables){
        const rows=[];
        for(const row of this.db.prepare(`SELECT * FROM ${table} WHERE owner=? ORDER BY rowid`).iterate(owner)){
          budget+=Buffer.byteLength(canonical(row));if(budget>EXPORT_LIMITS.bytes-4096)fail('EXPORT_BYTE_LIMIT');rows.push(row);
        }data.tables[table]=rows;
      }
      if(real){
        data.tables.archive_sources=this.db.prepare('SELECT * FROM archive_sources WHERE source=?').all(FED.source);
        data.tables.archive_source_requests=this.db.prepare('SELECT * FROM archive_source_requests WHERE owner=? ORDER BY requested_at,run_id,request_number').all(owner);
        if(count+data.tables.archive_sources.length+data.tables.archive_source_requests.length>EXPORT_LIMITS.rows)fail('EXPORT_ROW_LIMIT');
      }
      const result=canonical({format:real?'history-local-v2':'history-local-v1',checksum:digest(data),data});
      if(Buffer.byteLength(result)>EXPORT_LIMITS.bytes)fail('EXPORT_BYTE_LIMIT');return result;
    });
  }
  restoreSnapshot(serialized){
    if(typeof serialized!=='string'||Buffer.byteLength(serialized)>EXPORT_LIMITS.bytes)fail('RESTORE_BYTE_LIMIT');
    const envelope=JSON.parse(serialized),data=envelope.data;
    const real=envelope.format==='history-local-v2';
    const tables=['archive_runs','archive_pages','archive_facts',...(real?['archive_sources','archive_source_requests']:[])];
    if(!keys(envelope,['format','checksum','data'])||!['history-local-v1','history-local-v2'].includes(envelope.format)||!data||envelope.checksum!==digest(data)||!keys(data,['schemaVersion','owner','revision','tables'])||data.schemaVersion!==(real?2:1)||!token(data.owner)||real&&data.owner!==FED.owner||!integer(data.revision)||!keys(data.tables,tables))fail('INVALID_EXPORT');
    if(tables.some(t=>!Array.isArray(data.tables[t]))||tables.reduce((n,t)=>n+data.tables[t].length,0)>EXPORT_LIMITS.rows)fail('RESTORE_ROW_LIMIT');
    return this.transaction(()=>{
      if([...tables,'archive_sources','archive_source_requests'].some(t=>this.db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n))fail('RESTORE_REQUIRES_EMPTY_DATABASE');
      for(const table of tables){
        const columns=this.db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
        for(const row of data.tables[table]){
          if(!keys(row,columns)||Object.keys(row).length!==columns.length||(table==='archive_sources'?row.source!==FED.source:row.owner!==data.owner))fail('INVALID_EXPORT_ROW');
          if(table==='archive_runs'){
            const c=validateConfig(JSON.parse(row.config));
            if(!real&&c.identity!=='fixture')fail('FIXTURE_SCOPE_REQUIRED');
            if(c.owner!==row.owner||c.runId!==row.run_id||!['ready','paused','traversed'].includes(row.status)||!(row.cursor===null||text(row.cursor,500))||!['requests','bytes','pages','writes'].every(k=>integer(row[k])))fail('INVALID_EXPORT_RUN');
            this.assertIdentity(c);
            if(!integer(row.page_attempts,0,3)||!integer(row.retry_not_before)||row.requests<row.pages+row.page_attempts||!((row.lease_token===null&&row.lease_until===null)||(integer(row.lease_token,1,row.requests)&&integer(row.lease_until,c.createdAt,c.createdAt+c.limits.durationMs))))fail('INVALID_EXPORT_LEASE');
            if(row.status==='traversed'&&(row.page_attempts!==0||row.retry_not_before!==0||row.lease_token!==null))fail('INVALID_EXPORT_LEASE');
          }
          if(table==='archive_pages'&&(!integer(row.revision,1,data.revision)||!integer(row.page_number,1)||!integer(row.received_at,1)||!['accepted','duplicates','revisions'].every(k=>integer(row[k]))||!text(row.fingerprint,64)||row.fingerprint.length!==64))fail('INVALID_EXPORT_PAGE');
          if(table==='archive_facts'){
            const run=this.requireRun(row.owner,row.run_id),payload=JSON.parse(row.payload);
            const f=validateFact({asset:row.asset,kind:row.kind,occurredAt:row.occurred_at,payload},run.config,row.received_at);
            if(!integer(row.id,1)||row.source!==run.config.source||row.identity!==run.config.identity||!integer(row.revision,1,data.revision)||!integer(row.received_at,run.config.createdAt,run.config.createdAt+run.config.limits.durationMs-1)||f.hash!==row.hash||f.key!==row.logical_key||f.sortAt!==row.sort_at)fail('INVALID_EXPORT_FACT');
            const page=this.db.prepare('SELECT * FROM archive_pages WHERE revision=?').get(row.revision);
            if(!page||page.owner!==row.owner||page.run_id!==row.run_id||page.received_at!==row.received_at)fail('INVALID_EXPORT_REFERENCE');
          }
          if(table==='archive_sources'){
            if(!integer(row.last_dispatch)||!integer(row.retry_not_before))fail('INVALID_SOURCE_LEDGER');
            const values=[row.lease_owner,row.lease_run,row.lease_token,row.lease_until];
            if(!values.every(v=>v===null)){
              const run=this.requireRun(row.lease_owner,row.lease_run);
              if(!isFedConfig(run.config)||row.lease_token!==run.lease_token||row.lease_until!==run.lease_until)fail('INVALID_SOURCE_LEASE');
            }
          }
          if(table==='archive_source_requests'){
            const run=this.requireRun(row.owner,row.run_id);
            if(!isFedConfig(run.config)||row.source!==FED.source||!integer(row.request_number,1,run.requests)||!integer(row.requested_at,run.config.createdAt,run.config.createdAt+run.config.limits.durationMs-1))fail('INVALID_SOURCE_LEDGER');
          }
          this.db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...columns.map(c=>row[c]));
        }
      }
      if(real){
        if(data.tables.archive_sources.length!==1)fail('INVALID_SOURCE_LEDGER');
        const source=data.tables.archive_sources[0],ledger=data.tables.archive_source_requests;
        if(source.last_dispatch!==(ledger.length?Math.max(...ledger.map(row=>row.requested_at)):0))fail('INVALID_SOURCE_LEDGER');
        for(const row of data.tables.archive_runs){const c=JSON.parse(row.config);if(isFedConfig(c)&&ledger.filter(item=>item.run_id===row.run_id).length!==row.requests)fail('INVALID_SOURCE_LEDGER');}
        if(data.tables.archive_runs.some(row=>row.retry_not_before>source.retry_not_before&&isFedConfig(JSON.parse(row.config))))fail('INVALID_SOURCE_LEDGER');
      }
      for(const row of data.tables.archive_runs){
        const pages=this.db.prepare('SELECT * FROM archive_pages WHERE owner=? AND run_id=? ORDER BY page_number').all(row.owner,row.run_id);
        if(pages.length!==row.pages||pages.some((p,i)=>p.page_number!==i+1||p.before_cursor!==(i?pages[i-1].after_cursor:null))||row.cursor!==(pages.at(-1)?.after_cursor??null)||row.writes!==pages.reduce((n,p)=>n+p.accepted,0)||row.writes!==this.db.prepare('SELECT count(*) AS n FROM archive_facts WHERE owner=? AND run_id=?').get(row.owner,row.run_id).n)fail('INVALID_EXPORT_CHECKPOINT');
        const c=JSON.parse(row.config),terminal=pages.at(-1)?.traversal_done===1;
        if(terminal!==(row.status==='traversed')||pages.slice(0,-1).some(p=>p.traversal_done)||row.requests<row.pages||row.requests>c.limits.requests||row.pages>c.limits.pages||row.writes>c.limits.writes||row.pages>0&&row.bytes===0||pages.some(p=>!integer(p.received_at,c.createdAt,c.createdAt+c.limits.durationMs-1)))fail('INVALID_EXPORT_BUDGET');
        if(pages.some(p=>p.revisions>p.accepted||p.accepted!==this.db.prepare('SELECT count(*) AS n FROM archive_facts WHERE revision=?').get(p.revision).n||!(p.before_cursor===null||text(p.before_cursor,500))||!(p.after_cursor===null||text(p.after_cursor,500))||Boolean(p.traversal_done)!==(p.after_cursor===null)))fail('INVALID_EXPORT_PAGE');
      }
      this.db.prepare('UPDATE archive_meta SET revision=? WHERE id=1').run(data.revision);
      // A restored budget snapshot is historical evidence, never permission to resume source dispatch.
      this.db.prepare('UPDATE archive_meta SET collection_enabled=0 WHERE id=1').run();
      if(this.db.prepare('PRAGMA foreign_key_check').all().length)fail('INVALID_EXPORT_REFERENCE');
      return {owner:data.owner,rows:tables.reduce((n,t)=>n+data.tables[t].length,0),revision:data.revision};
    });
  }
}
