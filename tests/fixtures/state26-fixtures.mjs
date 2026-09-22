// Fixed mathematical inputs. No imports from the implementation under test.
export const NOW = 1_789_372_800_000;
export const MINUTE = 60_000;
export const BASELINE_SHA = '09338aa6b03affcb01262ad571212797b0590c09';
export const BENCHMARKS = Object.freeze({
  'ETH-USDT':'BTC-USDT','SOL-USDT':'BTC-USDT','XRP-USDT':'BTC-USDT','DOGE-USDT':'BTC-USDT','LINK-USDT':'BTC-USDT','ADA-USDT':'BTC-USDT','AVAX-USDT':'BTC-USDT',
  NVDA:'QQQ',AAPL:'QQQ',TSLA:'QQQ',MSFT:'QQQ',GOOGL:'QQQ',AMZN:'QQQ',META:'QQQ',COIN:'QQQ',
  '600519.SS':'000300.SS','300750.SZ':'000300.SS','0700.HK':'^HSI','9988.HK':'^HSI','1810.HK':'^HSI',
});
export function fixture({symbol='BTC-USDT',count=80,closes,end=NOW,step=.04}={}) {
  const crypto=symbol.endsWith('-USDT'),interval=(crypto?15:5)*MINUTE;
  const prices=closes??Array.from({length:count},(_,i)=>100+i*step);
  const points=prices.map((close,i)=>({time:end-(prices.length-i)*interval,open:close,close,high:close,low:close,volume:100,confirmed:true}));
  const currency=crypto?'USDT':symbol.endsWith('.HK')||symbol==='^HSI'?'HKD':/\.(SS|SZ)$/.test(symbol)?'CNY':'USD';
  const source=crypto?'OKX 欧易':'Yahoo Finance';
  const quote={symbol,name:symbol,price:prices.at(-1)??100,points,currency,source,session:'open',delayMinutes:0,timestamp:NOW,fetchedAt:NOW};
  return {symbols:[symbol],quotes:{[symbol]:quote},histories:{[symbol]:{points,intervalMs:interval,source,currency,fetchedAt:NOW}}};
}
export function paired({symbol='NVDA',benchmark=BENCHMARKS[symbol],asset={},reference={}}={}) {
  const a=fixture({symbol,...asset}),b=fixture({symbol:benchmark,...reference});
  return {symbols:[symbol],quotes:{...a.quotes,...b.quotes},histories:{...a.histories,...b.histories}};
}
export const pointsFor=(snapshot,symbol=snapshot.symbols[0])=>symbol.endsWith('-USDT')?snapshot.histories[symbol].points:snapshot.quotes[symbol].points;
export function fromReturns(returns,{count=80,symbol='BTC-USDT'}={}) {
  const prices=Array(Math.max(1,count-returns.length)).fill(100);
  for(const value of returns)prices.push(prices.at(-1)*(1+value/100));
  return fixture({symbol,closes:prices});
}
export function freeze(value) { if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }
export function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
  return value;
}

// The same factories feed the frozen old implementation and the candidate.
// Expected outputs are ONLY captured from the checked, clean BASELINE_SHA.
export function legacyCases() {
  const cases=[];
  const add=(name,snapshot=fixture({count:22}),overrides={})=>cases.push({name,snapshot,overrides});
  add('default-20-4-16');add('stock-20-4-16',fixture({symbol:'NVDA',count:22}));
  for(const count of [0,1,20,21,22,23,80,81,96])add(`count-${count}`,fixture({count}));
  for(const symbol of ['BTC-USDT','NVDA'])for(const sign of [-1,1])for(const offset of [-1e-7,0,1e-7]) {
    const floor=symbol==='NVDA'?.3:.6;
    add(`net-${symbol}-${sign}-${offset}`,fixture({symbol,closes:[100,...Array.from({length:21},(_,i)=>100*(1+sign*(floor+offset)*i/2000))]}));
  }
  for(const dip of [.999999,1,1.000001])add(`efficiency-${dip}`,fixture({closes:[100,100,100-dip,...Array(19).fill(103)]}));
  for(const [b,c] of [[100,150],[150,100],[100,100],[100,0],[100,149.9999],[100,150.0001],[100,66.6666],[100,66.6667],[1e-7,.3],[0,0]])add(`rms-${b}-${c}`,fromReturns([...Array(16).fill(b),...Array(4).fill(c)],{count:22}));
  add('offline-precedes-paused-clock-input',{symbols:['BTC-USDT'],quotes:{},histories:{}},{online:false,enabled:false,now:undefined});
  add('paused-precedes-clock-input',{symbols:['BTC-USDT'],quotes:{},histories:{}},{enabled:false,now:undefined});
  add('clock-precedes-input',{symbols:['BTC-USDT'],quotes:{},histories:{}},{now:undefined});
  const mutations=[
    ['awaiting_quote',f=>delete f.quotes['BTC-USDT']],
    ['quote_failed-before-invalid-stale',f=>Object.assign(f.quotes['BTC-USDT'],{error:'upstream',price:NaN,timestamp:0})],
    ['invalid_quote-before-stale',f=>Object.assign(f.quotes['BTC-USDT'],{price:NaN,timestamp:0})],
    ['stale_quote-before-history',f=>{f.quotes['BTC-USDT'].timestamp=0;delete f.histories['BTC-USDT'];}],
    ['quote-fetch-120000',f=>f.quotes['BTC-USDT'].fetchedAt=NOW-120000],
    ['quote-fetch-120001',f=>f.quotes['BTC-USDT'].fetchedAt=NOW-120001],
    ['quote-timestamp-180000',f=>f.quotes['BTC-USDT'].timestamp=NOW-180000],
    ['quote-timestamp-180001',f=>f.quotes['BTC-USDT'].timestamp=NOW-180001],
    ['awaiting_history',f=>delete f.histories['BTC-USDT']],
    ['source-before-stale-history',f=>Object.assign(f.histories['BTC-USDT'],{source:'Other',fetchedAt:0})],
    ['currency-mismatch',f=>f.histories['BTC-USDT'].currency='USD'],
    ['stale-before-interval',f=>Object.assign(f.histories['BTC-USDT'],{fetchedAt:0,intervalMs:1})],
    ['interval-before-points',f=>Object.assign(f.histories['BTC-USDT'],{intervalMs:1,points:[]})],
    ['insufficient-before-invalid-close',f=>{f.histories['BTC-USDT'].points.splice(0,1);f.histories['BTC-USDT'].points[0].close=0;}],
    ['invalid-close',f=>f.histories['BTC-USDT'].points[4].close=0],
    ['infinite-close',f=>f.histories['BTC-USDT'].points[4].close=Infinity],
    ['unconfirmed',f=>f.histories['BTC-USDT'].points.at(-1).confirmed=false],
    ['future-filtered',f=>f.histories['BTC-USDT'].points.push({...f.histories['BTC-USDT'].points.at(-1),time:NOW,close:999})],
    ['tail-duplicate',f=>f.histories['BTC-USDT'].points.at(-2).time+=900000],
    ['tail-gap',f=>f.histories['BTC-USDT'].points.splice(-5,1)],
  ];
  for(const [name,mutate] of mutations){const f=fixture({count:22});mutate(f);add(name,f);}
  const future=fixture({end:NOW+60000});future.quotes['BTC-USDT'].timestamp=NOW+60000;add('state-future-engine-legacy',future);
  add('stale-evidence-equal',fixture({end:NOW-960000}));add('stale-evidence-over',fixture({end:NOW-960001}));
  add('numeric-overflow',fixture({closes:[...Array(20).fill(1e-300),1e300,1e300]}));
  for(const session of ['closed','unknown']){const f=fixture({symbol:'NVDA'});Object.assign(f.quotes.NVDA,{session,delayMinutes:3});f.quotes.NVDA.points=[];add(`session-${session}`,f);}
  for(const symbol of ['NVDA','ETH-USDT','600519.SS','0700.HK'])for(const move of [-4,4]) {
    const f=paired({symbol});pointsFor(f).at(-1).close=100*(1+move/100);pointsFor(f).at(-1).volume=500;add(`relative-${symbol}-${move}`,f);
  }
  for(const [name,mutate] of [
    ['missing',f=>delete f.quotes.QQQ],['stale',f=>f.quotes.QQQ.fetchedAt=0],['session',f=>f.quotes.QQQ.session='closed'],
    ['source',f=>f.quotes.QQQ.source='Other'],['currency',f=>f.quotes.QQQ.currency='EUR'],['phase',f=>f.quotes.QQQ.points.forEach(p=>p.time+=1)],
    ['one-tail-lag',f=>f.quotes.QQQ.points.pop()],
  ]){const f=paired();mutate(f);add(`relative-${name}`,f);}
  // Legacy detector may select an older common tail which readiness rejects.
  const oldTail=paired({asset:{end:NOW+60000},reference:{end:NOW-9*MINUTE}});
  oldTail.quotes.NVDA.timestamp=NOW+60000;oldTail.quotes.QQQ.timestamp=NOW-3*MINUTE;
  pointsFor(oldTail).at(-3).close=108;add('relative-detector-older-paired-tail',oldTail);
  return cases;
}
export function legacyResult(api,{snapshot,overrides}) {
  const symbol=snapshot.symbols[0],state=api.buildAssetState({snapshot,symbol,now:NOW,enabled:true,online:true,...overrides});
  const coverage=api.radarCoverage(snapshot,NOW),scan=api.scanRadar(api.emptyRadarStore(),snapshot,NOW);
  const intelligence=api.buildRadarIntelligence(scan.signals,[symbol],NOW);
  const repeat=api.scanRadar(scan,snapshot,NOW+5000),expired=api.scanRadar(scan,snapshot,NOW+46*MINUTE);
  return {state,coverage,scan,intelligence,repeat,expired};
}
