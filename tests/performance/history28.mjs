// Real-clock local fixture measurement. No network, production resources or frame-rate claims.
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { ArchiveStore } from '../../collector/store.mjs';
import { exportHistoryPackage } from '../../scripts/history-package.mjs';
import { replayHistory, researchHistory } from '../../lib/history/replay.ts';
import { historyFixture } from '../fixtures/history28.mjs';

const store = new ArchiveStore();
try {
  const p = await historyFixture({count:2000}), owner='fixture-performance', runId='fixture-performance';
  store.createRun({owner,runId,source:p.source,universeVersion:'fixture-performance-v1',assets:[{...p.asset,role:'asset'}],from:p.range.from,cutoff:p.range.cutoff,createdAt:p.exportedAt,identity:'fixture',limits:{}});
  const records=p.bars.map(b=>({asset:p.asset.id,kind:'bar',occurredAt:b.time,payload:{intervalMs:p.intervalMs,currency:p.asset.currency,adjustment:p.asset.adjustment,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume,complete:true,sessionEvidence:'fixture_only'}}));
  const reservation=store.reserveRequest(owner,runId,p.exportedAt);if(!reservation.ok)throw Error('FIXTURE_RESERVATION_FAILED');
  store.chargeBytes(owner,runId,Buffer.byteLength(JSON.stringify(records)));
  store.commitPage(owner,runId,{expectedCursor:null,nextCursor:null,records,receivedAt:p.exportedAt,traversalDone:true,leaseToken:reservation.leaseToken});store.releaseRequest(owner,runId,reservation.leaseToken);
  const measurements=[];
  for(let i=0;i<5;i++){
    const start=performance.now();const view=await exportHistoryPackage(store,{owner,source:p.source,asset:p.asset.id,from:p.range.from,to:p.range.cutoff,exportedAt:p.exportedAt});const queryMs=performance.now()-start;
    const computeStart=performance.now();replayHistory(view,view.range.cutoff,view.exportedAt);const result=researchHistory(view,view.range.cutoff,view.exportedAt);
    measurements.push({queryPackageMs:queryMs,replayAndResearchMs:performance.now()-computeStart,samples:result.samples.length});
  }
  const result={identity:'fixture',clock:'performance.now, not frozen',runtime:process.version,bars:2000,networkRequests:0,measurements};
  mkdirSync('outputs/history28',{recursive:true});writeFileSync('outputs/history28/performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{store.close();}
