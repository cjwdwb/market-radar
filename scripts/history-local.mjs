// Isolated fixture archive only. No live providers, credentials, HTTP, cron or D1 operations.
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, lstatSync } from 'node:fs';
import { resolve, relative, dirname, sep, isAbsolute, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore, EXPORT_LIMITS } from '../collector/store.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../work/state27');
export function localFile(value){
  if(!value||typeof value!=='string')throw Error('LOCAL_FILE_REQUIRED');
  // CLI契约是可移植的根内相对名称；POSIX不能把Windows盘符/UNC当普通文件名放行。
  if(posix.isAbsolute(value)||win32.isAbsolute(value)||/^[a-z]:/i.test(value))throw Error('PATH_OUTSIDE_ISOLATED_ROOT');
  const parts=value.split(/[\\/]/);
  if(parts.some(part=>/[<>:"|?*\x00-\x1f]/.test(part)||(/(?:[. ]$)/.test(part)&&part!=='.'&&part!=='..')||/^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)))throw Error('PATH_OUTSIDE_ISOLATED_ROOT');
  const path=resolve(root,parts.join(sep)),rel=relative(root,path);
  if(!rel||isAbsolute(rel)||rel.startsWith('..')||rel.includes(`..${sep}`)||resolve(root,rel)!==path)throw Error('PATH_OUTSIDE_ISOLATED_ROOT');
  let parent=path;
  while(true){
    // lstat直接检查断链；existsSync会追随目标，反而漏掉目标尚不存在的符号链接。
    let entry;
    try{entry=lstatSync(parent);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(entry?.isSymbolicLink())throw Error('SYMLINK_NOT_ALLOWED');
    if(parent===dirname(dirname(root)))break;
    parent=dirname(parent);
  }
  return path;
}
export function main(args){
  const [command,dbName,...rest]=args;
  if(!['init','status','query','export','restore'].includes(command))throw Error('Usage: history-local.mjs init|status|query|export|restore <db-name> [owner runId | query-json | owner export-name | export-name]. All files confined to work/state27; fixture-only.');
  const dbPath=localFile(dbName);
  // 所有路径先通过守卫，再创建目录或打开数据库；非法恢复输入不能留下新目标。
  const restorePath=command==='restore'?localFile(rest[0]):null;
  const exportPath=command==='export'?localFile(rest[1]):null;
  let exported;
  if(restorePath){
    if(statSync(restorePath).size>EXPORT_LIMITS.bytes)throw Error('RESTORE_BYTE_LIMIT');
    exported=readFileSync(restorePath,'utf8');
  }
  if(command==='init'||command==='restore'){
    if(existsSync(dbPath))throw Error('NEW_DATABASE_REQUIRED');
    mkdirSync(dirname(dbPath),{recursive:true});
  }else if(!existsSync(dbPath))throw Error('DATABASE_NOT_FOUND');
  const store=new ArchiveStore(dbPath);
  try{
    if(command==='init')return {schemaVersion:2,identity:'fixture',externalCollection:'disabled'};
    if(command==='status')return store.requireRun(rest[0],rest[1]);
    if(command==='query')return store.query(JSON.parse(rest[0]));
    if(command==='restore')return store.restoreSnapshot(exported);
    const serialized=store.exportSnapshot(rest[0]),path=exportPath;
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,serialized,{flag:'wx',mode:0o600});
    return {format:JSON.parse(serialized).format,bytes:Buffer.byteLength(serialized)};
  }finally{store.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(main(process.argv.slice(2))));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
