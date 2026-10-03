// 显式本地发布准备；只读既有FED库，不抓取、不部署、不启用调度。
import { DatabaseSync } from 'node:sqlite';
import { existsSync, lstatSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore, validateConfig } from '../collector/store.mjs';
import { FED, isFedConfig } from '../collector/source-policy.mjs';
import { localFile } from './history-local.mjs';
import { publicView } from './fed-history.mjs';
import { parseFedView, VIEW_LIMIT } from '../lib/information/fed-view.mjs';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=resolve(project,'data/published/fed-monetary.json');
function checkTarget(path){
  if(path!==project&&!path.startsWith(project+sep))throw Error('PROJECT_TARGET_REQUIRED');
  for(let part=path;part!==project;part=dirname(part)){
    try{if(lstatSync(part).isSymbolicLink())throw Error('LINK_TARGET_REJECTED');}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
}
export async function prepareInformation(){
  const source=localFile('fed-monetary/archive.sqlite');
  if(!existsSync(source))throw Error('ARCHIVE_NOT_COLLECTED');
  checkTarget(target);checkTarget(target+'.pending');
  const db=new DatabaseSync(source,{readOnly:true});
  let view;
  try{
    db.exec('BEGIN');
    if(db.prepare('SELECT schema_version FROM archive_meta WHERE id=1').get()?.schema_version!==2)throw Error('SCHEMA_VERSION');
    const row=db.prepare("SELECT config FROM archive_runs WHERE owner=? AND status='traversed' ORDER BY rowid DESC LIMIT 1").get(FED.owner);
    if(!row)throw Error('NO_COMPLETED_SOURCE_BATCH');
    const c=validateConfig(JSON.parse(row.config));if(!isFedConfig(c))throw Error('SOURCE_NOT_APPROVED');
    const store=Object.create(ArchiveStore.prototype);store.db=db;
    view=await publicView(store,{from:c.from,to:c.cutoff,exportedAt:Date.now()});
    db.exec('COMMIT');
  }finally{db.close();}
  const serialized=JSON.stringify(view,null,2);
  if(Buffer.byteLength(serialized)>VIEW_LIMIT)throw Error('VIEW_BYTE_LIMIT');
  await parseFedView(serialized,Date.now());
  mkdirSync(dirname(target),{recursive:true});
  // wx防止同时准备互相覆盖；旧公开视图只在完整校验与写入后替换。
  writeFileSync(target+'.pending',serialized,{flag:'wx',mode:0o600});
  try{checkTarget(target);renameSync(target+'.pending',target);}
  catch(e){unlinkSync(target+'.pending');throw e;}
  return {source:FED.source,records:view.records.length,range:view.range,readRevision:view.readRevision,viewId:view.viewId,bytes:Buffer.byteLength(serialized),target:'data/published/fed-monetary.json',externalRequests:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(process.argv.length!==2)throw Error('NO_ARGUMENTS_ALLOWED');console.log(JSON.stringify(await prepareInformation()));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
