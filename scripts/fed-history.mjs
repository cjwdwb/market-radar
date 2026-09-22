// Explicit local-only operations. There is no server route, timer or production binding.
import {existsSync,mkdirSync,writeFileSync,readFileSync,statSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {ArchiveStore,EXPORT_LIMITS} from '../collector/store.mjs';
import {runBatch} from '../collector/runner.mjs';
import {createFedAdapter} from '../collector/fed-source.mjs';
import {FED} from '../collector/source-policy.mjs';
import {localFile} from './history-local.mjs';
import {parseFedView,viewDigest,VIEW_LIMIT} from '../lib/information/fed-view.mjs';

const canonicalName='fed-monetary/archive.sqlite';
export function fedConfig(now,runId=randomUUID()){
  return {owner:FED.owner,runId,source:FED.source,universeVersion:FED.universeVersion,assets:[FED.asset],from:FED.start,cutoff:now,createdAt:now,identity:'reconstructed',limits:{...FED.limits,requests:1}};
}
export async function publicView(store,{from,to,exportedAt}){
  const queried=store.query({owner:FED.owner,source:FED.source,asset:FED.asset.id,kind:'information',from,to,limit:200});
  if(queried.nextCursor)throw Error('VIEW_ROW_LIMIT_NARROW_RANGE');
  const body={format:'fed-monetary-view-v1',source:FED.source,attribution:FED.attribution,rightsUrl:FED.rights,identity:'reconstructed',vintage:'current',readRevision:queried.readRevision,exportedAt,range:{from,cutoff:to},coverage:{status:'endpoint_snapshot',expectedCount:null,limitation:'Not a complete historical or point-in-time collection'},records:queried.records.map(row=>({
    id:row.payload.sourceRecordId,title:row.payload.title,url:row.payload.url,publishedAt:row.occurred_at,publicationPrecision:row.payload.publication.precision,
    firstReceivedAt:store.db.prepare('SELECT MIN(received_at) AS at FROM archive_facts WHERE owner=? AND source=? AND logical_key=? AND revision<=?').get(FED.owner,FED.source,row.logical_key,queried.readRevision).at,
    versionReceivedAt:row.received_at,version:row.revision,contentHash:row.hash,
  }))};
  const result={...body,viewId:await viewDigest(body)};return parseFedView(JSON.stringify(result),exportedAt);
}
function writeNew(name,text){const path=localFile(name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text,{flag:'wx',mode:0o600});}
export async function main(args){
  const [command,...rest]=args;
  if(!['collect','status','view','backup','restore'].includes(command))throw Error('Usage: fed-history.mjs collect|status|view <new-view.json>|backup <new-backup.json>|restore <backup.json> <new-db.sqlite>');
  if((['collect','status'].includes(command)&&rest.length)||(command==='view'||command==='backup')&&rest.length!==1||command==='restore'&&rest.length!==2)throw Error('INVALID_ARGUMENTS');
  if(command==='restore'){
    const backup=localFile(rest[0]),target=localFile(rest[1]);if(target===localFile(canonicalName)||existsSync(target))throw Error('NEW_OFFLINE_DATABASE_REQUIRED');
    if(statSync(backup).size>EXPORT_LIMITS.bytes)throw Error('RESTORE_BYTE_LIMIT');mkdirSync(dirname(target),{recursive:true});
    const store=new ArchiveStore(target);try{return {...store.restoreSnapshot(readFileSync(backup,'utf8')),collection:'disabled'};}finally{store.close();}
  }
  const path=localFile(canonicalName);
  if(command!=='collect'&&!existsSync(path))throw Error('ARCHIVE_NOT_COLLECTED');
  if(command==='collect')mkdirSync(dirname(path),{recursive:true});
  const store=new ArchiveStore(path);
  try{
    if(command==='collect'){
      const config=fedConfig(Date.now());store.createRun(config);
      const adapter=createFedAdapter({capture:value=>writeNew(`fed-monetary/rss-${config.runId}.json`,JSON.stringify({...value,decodedTextBytes:Buffer.byteLength(value.text),decodedTextSha256:createHash('sha256').update(value.text).digest('hex')}))});const result=await runBatch({store,owner:FED.owner,runId:config.runId,adapter});
      return {runId:config.runId,status:result.status,reason:result.reason,requests:result.requests,bytes:result.bytes,writes:result.writes,from:config.from,cutoff:config.cutoff,sourceRead:adapter.lastRead??null,coverage:'RSS snapshot only, completeness unknown'};
    }
    if(command==='backup'){const serialized=store.exportSnapshot(FED.owner);writeNew(rest[0],serialized);return {format:JSON.parse(serialized).format,bytes:Buffer.byteLength(serialized)};}
    const latest=store.db.prepare('SELECT config FROM archive_runs WHERE owner=? AND status=? ORDER BY rowid DESC LIMIT 1').get(FED.owner,'traversed');
    if(!latest)throw Error('NO_COMPLETED_SOURCE_BATCH');const config=JSON.parse(latest.config);
    const view=await publicView(store,{from:config.from,to:config.cutoff,exportedAt:Date.now()});
    if(command==='view'){const text=JSON.stringify(view,null,2);if(Buffer.byteLength(text)>VIEW_LIMIT)throw Error('VIEW_BYTE_LIMIT');writeNew(rest[0],text);return {records:view.records.length,readRevision:view.readRevision,viewId:view.viewId,range:view.range};}
    return {records:view.records.length,readRevision:view.readRevision,range:view.range,identity:view.identity,coverage:view.coverage};
  }finally{store.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch(e){console.error(e.message);process.exitCode=1;}
}
