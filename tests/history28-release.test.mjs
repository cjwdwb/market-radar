import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHistoryExample} from '../scripts/prepare-history28-example.mjs';
import {parseHistoryPackage} from '../lib/history/package.ts';
import {parseFedView} from '../lib/information/fed-view.mjs';
import {replayHistory,researchHistory} from '../lib/history/replay.ts';

test('release28: downloadable synthetic example is reproducible, valid and supports the frozen research minimum',async()=>{
 const text=readFileSync(new URL('../public/examples/history28-fixture.json',import.meta.url),'utf8'),raw=JSON.parse(text),p=await parseHistoryPackage(text,raw.exportedAt);
 assert.deepEqual(await createHistoryExample(p.exportedAt),p);assert.equal(p.bars.length,302);assert.ok(p.bars.every(b=>b.receivedAt===p.exportedAt));
 assert.equal(replayHistory(p,p.range.cutoff,p.exportedAt).horizons[0].direction.classification,'upward');
 const r=researchHistory(p,p.range.cutoff,p.exportedAt);assert.equal(r.status,'available');assert.equal(r.samples.length,10);
});
test('release28: existing FED public metadata keeps its source, receipt times, content identity and restricted fields',async()=>{
 const text=readFileSync(new URL('../public/examples/fed-monetary-20260923.json',import.meta.url),'utf8'),raw=JSON.parse(text),p=await parseFedView(text,raw.exportedAt);
 assert.equal(p.records.length,2);assert.equal(p.viewId,'5d76e9a931ab32d5da668bef672efd0e10541551ff6ea1c9a8a4c93b3c4aefb4');
 assert.equal(p.coverage.status,'endpoint_snapshot');assert.equal(p.coverage.expectedCount,null);
 assert.equal(/"(?:owner|token|cookie|authorization|alerts|settings|email|runId)"\s*:/i.test(text),false);
 assert.ok(p.records.every(r=>r.url.startsWith('https://www.federalreserve.gov/')));
});

test('release28: fixed-point demo generation repeats exactly and integrity rejection remains strict',async()=>{
 const at=1790935326955,a=await createHistoryExample(at),b=await createHistoryExample(at);
 assert.deepEqual(a,b);assert.equal(a.identity,'fixture');assert.equal(a.exportedAt,at);assert.equal(a.bars.length,302);
 assert.equal(a.bars[0].close,100);assert.equal(a.bars[1].close,100.02);assert.equal(a.bars[2].close,100.040004);
 assert.equal(a.bars[149].close,103.02453939);assert.equal(a.bars[176].close,103.58232078);
 assert.ok(a.bars.every(bar=>bar.low<=bar.close&&bar.close<=bar.high&&bar.open===bar.close&&bar.receivedAt===at));
 const changed=structuredClone(a);changed.bars[0].close+=.001;
 await assert.rejects(()=>parseHistoryPackage(JSON.stringify(changed),at),/校验失败/);
 for(const patch of [{identity:'observed_live'},{extra:true},{intervalMs:60000},{range:{from:a.range.from,cutoff:a.range.from}},{bars:[{...a.bars[0],close:null}]}])await assert.rejects(()=>parseHistoryPackage(JSON.stringify({...a,...patch}),at));
});
