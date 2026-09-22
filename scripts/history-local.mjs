// Isolated fixture archive only. No live providers, credentials, HTTP, cron or D1 operations.
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, lstatSync } from 'node:fs';
import { resolve, relative, dirname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore, EXPORT_LIMITS } from '../collector/store.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../work/state27');
export function localFile(value){
  if(!value||typeof value!=='string')throw Error('LOCAL_FILE_REQUIRED');
  const path=resolve(root,value),rel=relative(root,path);
  if(!rel||isAbsolute(rel)||rel.startsWith('..')||rel.includes(`..${sep}`)||resolve(root,rel)!==path)throw Error('PATH_OUTSIDE_ISOLATED_ROOT');
  let parent=path;
  while(true){
    if(existsSync(parent)&&lstatSync(parent).isSymbolicLink())throw Error('SYMLINK_NOT_ALLOWED');
    if(parent===dirname(dirname(root)))break;
    parent=dirname(parent);
  }
  return path;
}
export function main(args){
  const [command,dbName,...rest]=args;
  if(!['init','status','query','export','restore'].includes(command))throw Error('Usage: history-local.mjs init|status|query|export|restore <db-name> [owner runId | query-json | owner export-name | export-name]. All files confined to work/state27; fixture-only.');
  const dbPath=localFile(dbName);
  if(command==='init'||command==='restore'){
    if(existsSync(dbPath))throw Error('NEW_DATABASE_REQUIRED');
    mkdirSync(dirname(dbPath),{recursive:true});
  }else if(!existsSync(dbPath))throw Error('DATABASE_NOT_FOUND');
  let exported;
  if(command==='restore'){
    const path=localFile(rest[0]);if(statSync(path).size>EXPORT_LIMITS.bytes)throw Error('RESTORE_BYTE_LIMIT');
    exported=readFileSync(path,'utf8');
  }
  const store=new ArchiveStore(dbPath);
  try{
    if(command==='init')return {schemaVersion:2,identity:'fixture',externalCollection:'disabled'};
    if(command==='status')return store.requireRun(rest[0],rest[1]);
    if(command==='query')return store.query(JSON.parse(rest[0]));
    if(command==='restore')return store.restoreSnapshot(exported);
    const serialized=store.exportSnapshot(rest[0]),path=localFile(rest[1]);
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,serialized,{flag:'wx',mode:0o600});
    return {format:JSON.parse(serialized).format,bytes:Buffer.byteLength(serialized)};
  }finally{store.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(main(process.argv.slice(2))));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
