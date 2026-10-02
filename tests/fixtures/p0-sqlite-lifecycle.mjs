// Disposable in-memory archive; forced GC makes the original Node22 iterator failure deterministic.
import assert from 'node:assert/strict';
import { ArchiveStore } from '../../collector/store.mjs';
const start=Date.parse('2026-09-01T00:00:00Z');
const asset={id:'fixture:US:BASE:USD',market:'us',venue:'TEST',providerId:'fixture:BASE',currency:'USD',adjustment:'raw',role:'asset'};
const late={...asset,id:'fixture:US:LATE:USD',providerId:'fixture:LATE'};
const config=(runId,extra={})=>({owner:'p0-fixture',runId,source:'fixture:p0',universeVersion:'fixture-v1',assets:[asset],from:start,cutoff:start+86400000,createdAt:start+86401000,identity:'fixture',limits:{},...extra});
assert.equal(typeof global.gc,'function');
const store=new ArchiveStore();
let gcCalls=0,exportGcCalls=0;const parse=JSON.parse,stringify=JSON.stringify;
try{
  store.createRun(config('r000'));
  JSON.parse=function(...args){if(gcCalls<10){gcCalls++;global.gc();}return parse(...args);};
  for(let i=1;i<205;i++)store.createRun(config(`r${String(i).padStart(3,'0')}`,i===204?{assets:[late]}:{}));
  for(const [id,target] of [['first-conflict',asset],['last-conflict',late]]){
    assert.throws(()=>store.createRun(config(id,{assets:[{...target,currency:'EUR'}]})),/ASSET_IDENTITY_CONFLICT/);
    assert.equal(store.getRun('p0-fixture',id),null);
  }
  store.createRun(config('after-rollback',{assets:[late]}));
  store.createRun(config('other-owner',{owner:'p0-other',assets:[{...asset,currency:'EUR'}]}));
  store.createRun(config('other-source',{source:'fixture:other',assets:[{...asset,currency:'EUR'}]}));
  const restored=new ArchiveStore();
  try{
    JSON.stringify=function(...args){if(exportGcCalls<10){exportGcCalls++;global.gc();}return stringify(...args);};
    const snapshot=store.exportSnapshot('p0-fixture');JSON.stringify=stringify;
    assert.equal(parse(snapshot).data.tables.archive_runs.length,207);
    restored.restoreSnapshot(snapshot);
    // 恢复保留 run 原状态，停止采集由 archive_meta 控制，不改写历史状态。
    assert.equal(restored.getRun('p0-fixture','after-rollback').status,'ready');
    assert.equal(restored.db.prepare('SELECT collection_enabled FROM archive_meta WHERE id=1').get().collection_enabled,0);
  }
  finally{restored.close();}
  console.log(JSON.stringify({node:process.version,gcCalls,exportGcCalls,rows:store.db.prepare('SELECT count(*) AS n FROM archive_runs').get().n,rollbackReusable:true}));
}finally{JSON.parse=parse;JSON.stringify=stringify;store.close();}
