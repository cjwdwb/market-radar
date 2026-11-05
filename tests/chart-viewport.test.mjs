import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorWindow,boundWindow,rememberWindow,resolveWindow,zoomWindow} from '../lib/chart-viewport.ts';
const points=Array.from({length:96},(_,i)=>({time:1700000000000+i*900000}));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('pan stays within loaded candles and supports fractional movement',()=>{
 assert.deepEqual(boundWindow(96,-20,40),{start:0,count:40});
 assert.deepEqual(boundWindow(96,90,40),{start:56,count:40});
 assert.deepEqual(boundWindow(96,12.25,40),{start:12.25,count:40});
 assert.deepEqual(boundWindow(3,0,1),{start:0,count:3});
 assert.deepEqual(boundWindow(0,0,20),{start:0,count:0});
});
test('zoom keeps the candle under the cursor or pinch center in place',()=>{
 for(const anchor of [0,.25,.5,.8,1]){
  const before={start:20,count:40},after=zoomWindow(96,before,20,anchor);
  close(before.start+before.count*anchor,after.start+after.count*anchor);
 }
 assert.equal(zoomWindow(96,{start:20,count:40},1).count,16);
 assert.deepEqual(zoomWindow(96,{start:20,count:40},200),{start:0,count:96});
});
test('historical views stay on the same timestamps as new bars arrive or old bars roll off',()=>{
 const view=rememberWindow(points,{start:12.25,count:40});
 close(resolveWindow(points,view,60).start,12.25);
 const expanded=[...points,{time:points.at(-1).time+900000}];
 close(resolveWindow(expanded,view,60).start,12.25);
 close(resolveWindow(expanded.slice(1),view,60).start,11.25);
});
test('latest follows incoming bars; reset uses the responsive default window',()=>{
 const latest=rememberWindow(points,{start:56,count:40});assert.equal(latest.endTime,null);
 const expanded=[...points,{time:points.at(-1).time+900000}];
 assert.deepEqual(resolveWindow(expanded,latest,60),{start:57,count:40});
 assert.deepEqual(resolveWindow(points,{count:null,endTime:null},60),{start:36,count:60});
 assert.deepEqual(resolveWindow(points,{count:null,endTime:null},40),{start:56,count:40});
});

test('a held drag retains its original absolute candle anchor when old bars roll off',()=>{
 const before={start:12.25,count:40},gesture=anchorWindow(points,before);
 const appended={time:points.at(-1).time+900000},rolled=[...points.slice(1),appended];
 const resolved=resolveWindow(rolled,gesture,60);
 close(resolved.start,11.25);
 const movement=-3.5;
 const originalDrag=anchorWindow(points,{...before,start:before.start+movement});
 const rolledDrag=anchorWindow(rolled,{...resolved,start:resolved.start+movement});
 close(rolledDrag.endTime,originalDrag.endTime);
 assert.notEqual(anchorWindow(rolled,{...before,start:before.start+movement}).endTime,originalDrag.endTime,'the previous index-only gesture changed the candle time');
});

test('a gesture anchored at the latest candle does not silently switch to follow mode on append',()=>{
 const before={start:56,count:40},gesture=anchorWindow(points,before);
 assert.equal(gesture.endTime,points.at(-1).time);
 const expanded=[...points,{time:points.at(-1).time+900000}];
 assert.deepEqual(resolveWindow(expanded,gesture,60),before);
 assert.deepEqual(resolveWindow(expanded,rememberWindow(points,before),60),{start:57,count:40});
});
