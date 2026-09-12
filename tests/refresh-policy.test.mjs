import test from 'node:test';
import assert from 'node:assert/strict';
import {reusePoints,retryDelay} from '../lib/refresh-policy.ts';

test('unchanged snapshots preserve identity, live and historical corrections are retained',()=>{
 const old=[{time:1,open:10,high:13,low:9,close:12,volume:5,confirmed:false},{time:2,close:14}];
 assert.equal(reusePoints(old,structuredClone(old)),old);
 for(const [key,value] of [['high',15],['volume',6],['confirmed',true],['close',11]]){
  const updated=structuredClone(old);updated[0][key]=value;const result=reusePoints(old,updated);
  assert.notEqual(result,old);assert.equal(result[0][key],value);assert.equal(result[1],old[1]);
 }
 assert.equal(reusePoints(old,[...old,{time:3,close:15}]).length,3);
 assert.equal(reusePoints(old,old.slice(1)).length,1);
});
test('consecutive failures progressively slow polling with a one-minute upper bound',()=>{
 assert.deepEqual([1,2,3,4,5,6,1000].map(n=>retryDelay(n,5000)),[5000,10000,20000,40000,60000,60000,60000]);
 assert.deepEqual([1,2,3,4].map(n=>retryDelay(n,15000)),[15000,30000,60000,60000]);
});
