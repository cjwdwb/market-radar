import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,rmSync,existsSync,symlinkSync,readFileSync,readdirSync,writeFileSync } from 'node:fs';
import { resolve,join,relative,sep,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { localFile,main as cli } from '../scripts/history-local.mjs';

const root=fileURLToPath(new URL('../work/state27/',import.meta.url));
function scratch(t){
  mkdirSync(root,{recursive:true});const folder=mkdtempSync(join(root,'p0-fixture-'));
  const rel=relative(root,folder);assert.ok(rel&&!isAbsolute(rel)&&!rel.startsWith('..'));
  t.after(()=>rmSync(folder,{recursive:true,force:true}));return {folder,name:rel};
}
test('p0 sqlite: forced GC, more than two bounded pages, conflicts, rollback and restore',()=>{
  const child=spawnSync(process.execPath,['--expose-gc',fileURLToPath(new URL('./fixtures/p0-sqlite-lifecycle.mjs',import.meta.url))],{encoding:'utf8',timeout:30000,windowsHide:true});
  assert.equal(child.status,0,child.stderr||String(child.error));const result=JSON.parse(child.stdout);assert.equal(result.gcCalls,10);assert.equal(result.exportGcCalls,10);assert.equal(result.rows,208);assert.equal(result.rollbackReusable,true);
});
test('p0 paths: portable relative names only, with no side effects for rejected syntax',t=>{
  const {folder,name}=scratch(t),before=readdirSync(root).sort();
  for(const input of [null,undefined,42,{},''])assert.throws(()=>localFile(input),/LOCAL_FILE_REQUIRED/);
  const bad=['.','a/..','../sibling.sqlite','../../outside.sqlite','../state27-sibling/x.sqlite','/tmp/p0-outside.sqlite','Z:/outside.sqlite','Z:\\outside.sqlite','Z:outside.sqlite','\\\\server\\share\\x.sqlite','//server/share/x.sqlite','\\\\?\\C:\\x.sqlite','\\\\.\\NUL','..\\..//outside.sqlite','a:stream','NUL','CON.txt','a/LPT1','a/COM1.log','COM¹','COM².txt','LPT³','CONIN$','CONOUT$','end.','end ','bad\0.sqlite',resolve(folder,'absolute.sqlite')];
  for(const input of bad){assert.throws(()=>localFile(input),/OUTSIDE/,input);assert.throws(()=>cli(['init',input]),/OUTSIDE/,input);}
  assert.deepEqual(readdirSync(root).sort(),before);assert.deepEqual(readdirSync(folder),[]);
  for(const input of [`${name}/nested/file.sqlite`,`${name}\\nested/file.sqlite`,`${name}/sub/../nested/file.sqlite`])assert.equal(localFile(input),join(folder,'nested','file.sqlite'));
  // Restore input and export output are validated before mkdir/open, even if the source DB is absent.
  assert.throws(()=>cli(['restore',`${name}/new/sub/db.sqlite`,'Z:/outside.json']),/OUTSIDE/);assert.equal(existsSync(join(folder,'new')),false);
  assert.throws(()=>cli(['export',`${name}/absent.sqlite`,'fixture-owner','Z:/out.json']),/OUTSIDE/);assert.equal(existsSync(join(folder,'absent.sqlite')),false);
});
test('p0 paths: valid operations preserve existing databases, backups and restore targets',t=>{
  const {folder,name}=scratch(t),db=`${name}/db.sqlite`,backup=`${name}/backup.json`,restored=`${name}/restored.sqlite`;
  cli(['init',db]);cli(['export',db,'fixture-owner',backup]);cli(['restore',restored,backup]);
  const original=readFileSync(join(folder,'backup.json'));assert.throws(()=>cli(['init',db]),/NEW_DATABASE/);assert.throws(()=>cli(['export',db,'fixture-owner',backup]),/EEXIST/);assert.throws(()=>cli(['restore',restored,backup]),/NEW_DATABASE/);assert.deepEqual(readFileSync(join(folder,'backup.json')),original);
});
test('p0 paths: parent directory symlink or Windows junction cannot redirect a CLI write',t=>{
  const {folder,name}=scratch(t),target=join(folder,'actual'),link=join(folder,'alias');mkdirSync(target);
  symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>localFile(`${name}/alias/child.sqlite`),/SYMLINK/);assert.throws(()=>cli(['init',`${name}/alias/child.sqlite`]),/SYMLINK/);assert.deepEqual(readdirSync(target),[]);
});
test('p0 paths: dangling directory alias is rejected without creating its target',t=>{
  const {folder,name}=scratch(t),target=join(folder,'missing'),link=join(folder,'dangling');
  symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>cli(['init',`${name}/dangling/child.sqlite`]),/SYMLINK/);assert.equal(existsSync(target),false);
});
test('p0 paths: existing file symlink is rejected before writes when OS permits link creation',t=>{
  const {folder,name}=scratch(t),target=join(folder,'target.txt'),link=join(folder,'file-link');writeFileSync(target,'unchanged');
  try{symlinkSync(target,link,'file');}catch(error){if(process.platform==='win32'&&error.code==='EPERM'){t.skip('Windows file symlink privilege unavailable; junctions covered separately');return;}throw error;}
  assert.throws(()=>localFile(`${name}${sep}file-link`),/SYMLINK/);assert.equal(readFileSync(target,'utf8'),'unchanged');
});
