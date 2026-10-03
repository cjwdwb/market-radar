// 显式操作员入口。固定本地根与已批准来源；网页请求不会执行此脚本。
import {existsSync,mkdirSync,writeFileSync,renameSync,lstatSync,unlinkSync} from 'node:fs';
import {dirname,resolve,sep,posix,win32} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OfficialArchive,refreshOfficial} from '../collector/official-information.mjs';
import {localFile} from './history-local.mjs';
import {OFFICIAL_LIMIT} from '../lib/information/official.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// 此入口的备份、恢复及伴随文件只属于官方资料子目录，不能写入相邻归档。
export function officialFile(value){
 if(typeof value!=='string'||!value||posix.isAbsolute(value)||win32.isAbsolute(value)||/^[a-z]:/i.test(value))throw Error('OFFICIAL_ROOT_REQUIRED');
 const prefix=localFile('official-information')+sep;
 const path=localFile('official-information/'+value);
 if(!path.startsWith(prefix))throw Error('OFFICIAL_ROOT_REQUIRED');
 for(const suffix of ['.manifest.json','.pending'])localFile('official-information/'+value+suffix);
 return path;
}
const archive=()=>officialFile('archive.sqlite');
function guardedPublication(){
 const path=resolve(root,'data/published/official-information.json');
 for(let parent=path+'.pending';parent!==root;parent=dirname(parent)){
  if(!parent.startsWith(root+sep))throw Error('PROJECT_PATH_REQUIRED');
  try{if(lstatSync(parent).isSymbolicLink())throw Error('LINK_REJECTED');}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 try{if(lstatSync(path).isSymbolicLink())throw Error('LINK_REJECTED');}catch(e){if(e.code!=='ENOENT')throw e;}return path;
}
export async function main(args){
 const [command,...rest]=args;if(!['status','publish','refresh','backup','restore'].includes(command))throw Error('Usage: official-information.mjs status|publish|refresh|backup <new.sqlite>|restore <backup.sqlite> <new.sqlite>');
 if(rest.length!==(command==='backup'?1:command==='restore'?2:0))throw Error('INVALID_ARGUMENTS');
 if(command==='restore'){
  const source=officialFile(rest[0]),target=officialFile(rest[1]);if(target===archive())throw Error('NEW_OFFLINE_TARGET_REQUIRED');return OfficialArchive.restore(source,target,Date.now());
 }
 if(!existsSync(archive()))throw Error('REVIEWED_ARCHIVE_REQUIRED');
 const store=new OfficialArchive(archive(),{readOnly:!['refresh'].includes(command)});
 try{
  if(command==='refresh')return await refreshOfficial(store);
  if(command==='backup')return store.backup(officialFile(rest[0]));
  const view=await store.view(Date.now());
  if(command==='status')return {sources:view.sources.map(s=>({sourceId:s.sourceId,records:s.records.length,checkedAt:s.checkedAt,snapshotId:s.snapshotId})),collectionEnabled:store.db.prepare('SELECT enabled FROM info_meta').get().enabled};
  const target=guardedPublication(),text=JSON.stringify(view,null,2);if(Buffer.byteLength(text)>OFFICIAL_LIMIT)throw Error('PUBLICATION_LIMIT');mkdirSync(dirname(target),{recursive:true});writeFileSync(target+'.pending',text,{flag:'wx',mode:0o600});
  try{guardedPublication();renameSync(target+'.pending',target);}catch(e){unlinkSync(target+'.pending');throw e;}
  return {viewId:view.viewId,records:view.sources.reduce((n,s)=>n+s.records.length,0),bytes:Buffer.byteLength(text),externalRequests:0};
 }finally{store.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch(e){console.error(e.message);process.exitCode=1;}
}
