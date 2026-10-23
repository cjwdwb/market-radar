import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { personalHistoryFixture } from './fixtures/personal-history.mjs';
import { parsePersonalHistory } from '../lib/ai/personal-history-contract.ts';
test('personal file preserves fixed historical identity/references and does not mutate input', () => {
  const value = personalHistoryFixture(), before = structuredClone(value), result = parsePersonalHistory(value);
  assert.deepEqual(value, before); assert.deepEqual(result, value); assert.equal(result.vintage, 'current_vintage');
});
test('personal file rejects wrong identities, duplicate metrics, mismatched kinds and missing disclosures', () => {
  for (const change of [d => d.context.asset.symbol='BTC-USDT', d => d.inputIdentity='approved_real', d => d.context.evidence[0].source='OKX 欧易', d => d.context.evidence[0].provenance.intervalMs=300000, d => d.context.evidence[0].metrics.push(d.context.evidence[0].metrics[0]), d => d.context.evidence[0].kind='rms', d => d.context.evidence.push(d.context.evidence[0]), d => {d.systemRequired=[];d.systemAdded=[];}, d => d.rawBars=[]]) {const value=personalHistoryFixture();change(value);assert.throws(()=>parsePersonalHistory(value));}
});
test('all rendered dates are finite JS Date values; malformed references rejected', () => {
  for (const change of [d=>d.generatedAt=Number.MAX_SAFE_INTEGER,d=>d.context.capturedAt=Number.MAX_SAFE_INTEGER,d=>d.context.evidence[0].provenance.quoteAt=Number.MAX_SAFE_INTEGER,d=>d.context.evidence[0].provenance.baselineStartAt=Number.MAX_SAFE_INTEGER,d=>d.context.evidence[0].startAt=-1,d=>d.modelSelection.sentences[0].evidenceRefs=['missing'],d=>d.modelSelection.sentences[0].metricRefs=['missing:missing'],d=>d.systemAdded[0]={...d.systemAdded[0],text:'mismatch'}]) {const value=personalHistoryFixture();change(value);assert.throws(()=>parsePersonalHistory(value));}
});
test('reader stays browser-local without dispatch, persistence or unescaped HTML', () => {
  const source=readFileSync(new URL('../components/radar/personal-history.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML/);
  for(const text of ['未向服务端验证','文件声明','file.size > 65536','generation.current','清除本页记录'])assert.ok(source.includes(text));
});
