// CPU-only bounded derivation diagnostic. Fixed mathematical fixtures, not browser timings.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildWatchlistState} from '../../lib/radar/watchlist-state.ts';
import {buildAssetStateV2} from '../../lib/radar/asset-state-v2.ts';
import {fixture,NOW} from '../fixtures/state26-fixtures.mjs';
import {DEFAULT_WATCHLIST} from '../../lib/market.ts';
const symbols=['ETH-USDT','SOL-USDT','XRP-USDT','DOGE-USDT','ADA-USDT','AVAX-USDT','LINK-USDT','DOT-USDT','LTC-USDT','BCH-USDT','NVDA','AAPL','MSFT','AMZN','META','TSLA','GOOGL','QQQ','0700.HK','600519.SS'];
const snapshot={symbols,quotes:{},histories:{}};for(const symbol of [...symbols,'BTC-USDT','^HSI','000300.SS']){const f=fixture({symbol});Object.assign(snapshot.quotes,f.quotes);Object.assign(snapshot.histories,f.histories);}
const report={node:process.version,identity:'fixed source-valid synthetic mathematical input; CPU only',groups:[]};
for(const list of [symbols.slice(0,1),DEFAULT_WATCHLIST,symbols]){
 const count=list.length,input={snapshot,watchlist:list,selected:'BTC-USDT',now:NOW,enabled:true,online:true};const actual=buildWatchlistState(input);
 for(const [symbol,value]of actual.states)assert.deepEqual(value,buildAssetStateV2({...input,symbol}));
 for(let i=0;i<100;i++)buildWatchlistState(input);
 for(let repeat=0;repeat<5;repeat++){const times=[];for(let i=0;i<200;i++){const start=performance.now();buildWatchlistState(input);times.push(performance.now()-start);}times.sort((a,b)=>a-b);report.groups.push({count,selectedExtra:actual.states.size-count,repeat,samples:times.length,p50:times[100],p95:times[190],max:times.at(-1)});}
}
const label=process.argv[2]||'baseline';fs.mkdirSync(`outputs/perf275/${label}`,{recursive:true});fs.writeFileSync(`outputs/perf275/${label}/state-cost.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
