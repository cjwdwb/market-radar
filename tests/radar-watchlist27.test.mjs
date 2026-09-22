import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWatchlistState } from '../lib/radar/watchlist-state.ts';
import { browserWatchlistExport } from '../lib/radar/watchlist-export.ts';
import { buildAssetStateV2 } from '../lib/radar/asset-state-v2.ts';
import { NOW, paired, fixture, freeze } from './fixtures/state26-fixtures.mjs';

const derive = (snapshot, extra = {}) => buildWatchlistState({snapshot,watchlist:['NVDA'],selected:'NVDA',now:NOW,online:true,enabled:true,...extra});
test('watchlist projection equals the whole 2.6 result without mutating data; selected reuses its row',()=>{
  const snapshot=freeze(paired()), list=freeze(['NVDA','NVDA','QQQ']);
  const result=derive(snapshot,{watchlist:list});
  assert.deepEqual(result.symbols,['NVDA','QQQ']);assert.equal(result.states.size,2);
  for(const symbol of result.symbols)assert.deepEqual(result.states.get(symbol),buildAssetStateV2({snapshot,symbol,now:NOW,online:true,enabled:true}));
  assert.strictEqual(result.states.get('NVDA'),result.states.get(result.symbols[0]));
  assert.equal(result.states.get('NVDA').relative.availability,'available');
});
test('bounded input, default order and auxiliary benchmarks do not create watchlist rows',()=>{
  const snapshot=paired();const result=derive(snapshot,{watchlist:['NVDA','invalid space','AAPL','NVDA']});
  assert.deepEqual(result.symbols,['NVDA','AAPL']);assert.equal(result.states.has('QQQ'),false);
  const bounded=derive(snapshot,{watchlist:Array.from({length:50},(_,i)=>`T${i}`),selected:'NVDA'});
  assert.equal(bounded.symbols.length,20);assert.equal(bounded.states.size,21);assert.equal(bounded.states.get('T0').horizons.short.direction.availability,'waiting');
  assert.equal(derive(snapshot,{watchlist:[],selected:'NVDA'}).states.size,1);
  assert.equal(derive(snapshot,{watchlist:[],selected:'bad symbol'}).states.size,0);
});
test('watchlist failures remain per dimension; missing benchmark does not disable direction',()=>{
  const snapshot=paired();delete snapshot.quotes.QQQ;
  const state=derive(snapshot).states.get('NVDA');
  assert.equal(state.relative.availability,'waiting');assert.equal(state.relative.classification,null);
  assert.equal(state.horizons.short.direction.availability,'available');
  const short=derive(paired({asset:{count:24}})).states.get('NVDA');
  assert.equal(short.horizons.short.direction.availability,'available');assert.equal(short.horizons.medium.direction.availability,'insufficient');
  const missing=fixture();delete missing.histories['BTC-USDT'];
  assert.equal(derive(missing,{watchlist:['BTC-USDT'],selected:'BTC-USDT'}).states.get('BTC-USDT').horizons.short.direction.availability,'waiting');
});
test('time expiry, paused and offline states are shared with the original rule',()=>{
  for(const extra of [{now:NOW+180001},{enabled:false},{online:false}]){
    const snapshot=paired(), state=derive(snapshot,extra).states.get('NVDA');
    assert.deepEqual(state,buildAssetStateV2({snapshot,symbol:'NVDA',now:NOW,enabled:true,online:true,...extra}));
    assert.equal(state.horizons.short.direction.classification,null);
  }
});
test('local export keeps full identities and insertion order, never aliases USD/USDT',()=>{
  const value=browserWatchlistExport(['0700.HK','BTC-USD','BTC-USDT','NOTKNOWN','0700.HK'],NOW,'saved_browser',false);
  assert.deepEqual(value.assets.map(a=>a.symbol),['0700.HK','BTC-USD','BTC-USDT','NOTKNOWN']);
  assert.equal(value.assets[1].providerRoute,'yahoo');assert.equal(value.assets[2].providerRoute,'okx');
  assert.equal(value.assets[3].marketMapping,'inferred_by_app');
  for(const row of value.assets){assert.equal(row.issuerId,null);assert.equal(row.venue,null);assert.equal(row.adjustment,null);}
  assert.equal(value.exportedAt,new Date(NOW).toISOString());
});
test('export discloses origin and never implies approved collection or saved user consent',()=>{
  for(const origin of ['saved_browser','app_default','storage_unavailable'])for(const edited of [false,true]){
    const result=browserWatchlistExport(['NVDA'],NOW,origin,edited);
    assert.equal(result.origin,origin);assert.equal(result.sessionEdited,edited);
    assert.equal(result.identityStatus,'unverified_owner_universe');
    assert.deepEqual(Object.keys(result).sort(),['assets','exportedAt','formatVersion','identityStatus','origin','scope','sessionEdited'].sort());
    assert.deepEqual(Object.keys(result.assets[0]).sort(),['symbol','appMarket','marketMapping','providerRoute','venue','issuerId','adjustment'].sort());
  }
});
test('empty, invalid and oversized exports remain bounded; invalid time is rejected',()=>{
  assert.deepEqual(browserWatchlistExport([],NOW,'app_default',false).assets,[]);
  assert.equal(browserWatchlistExport(['bad symbol',...Array.from({length:40},(_,i)=>`T${i}`)],NOW,'app_default',false).assets.length,20);
  for(const timestamp of [NaN,Infinity,0,-1])assert.throws(()=>browserWatchlistExport([],timestamp,'app_default',false));
});
