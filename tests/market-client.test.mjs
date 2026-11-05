import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { ClientRequestPool, ClientCooldown, ClientHistoryCache, clientHistoryKey, clientJson, completeQuoteResults, validateClientHistory } from '../lib/market-client.ts';
import { MarketHistoryController } from '../components/use-market-history.ts';
import { MarketQuotesController } from '../components/use-market-quotes.ts';

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { await turn(); await turn(); };
const historyOptions = (extra = {}) => ({ selected: 'BTC-USDT', range: '15m', requestKey: 'BTC-USDT,ETH-USDT,SOL-USDT', hydrated: true, visible: true, online: true, auto: false, ...extra });
const quoteOptions = (extra = {}) => ({ requestKey: 'BTC-USDT,ETH-USDT', symbolKey: 'BTC-USDT,ETH-USDT', hydrated: true, visible: true, online: true, auto: false, backgroundTabs: true, ...extra });
function history(path, extra = {}) {
  const url = new URL(path, 'http://localhost'), symbol = url.searchParams.get('symbol');
  return { symbol, range: url.searchParams.get('range'), source: 'OKX 欧易', currency: 'USDT', timezone: 'UTC', fetchedAt: Date.now(),
    points: [{ time: 900000, close: 10, confirmed: true }, { time: 1800000, close: 11 }],
    metadata: { intervalMs: 900000, bar: '15m', exchange: 'OKX', marketType: 'spot', instrument: symbol, volumeUnit: 'base', bucketTimezone: 'UTC', completion: 'source',
      firstAt:900000,lastAt:1800000,lastCompleteAt:1800000,invalidRows:0,duplicateRows:0,gapCount:0,path:'candles',limitations:[] }, ...extra };
}
function quote(symbol, fetchedAt = Date.now()) { return { symbol, price: 10, timestamp: fetchedAt, fetchedAt, points: [], source: symbol.endsWith('-USDT') ? 'OKX 欧易' : 'Yahoo Finance', currency: symbol.endsWith('-USDT') ? 'USDT' : 'USD' }; }
function setup(t, fetch) {
  const original = globalThis.fetch; globalThis.fetch = fetch;
  t.after(() => { globalThis.fetch = original; });
  t.mock.timers.enable({ apis: ['Date','setTimeout','setInterval'], now: 10_000_000 });
}

test('shared pool cancels one waiter independently and aborts only after the last leaves', async () => {
  const pool = new ClientRequestPool(), pending = deferred(), a = new AbortController(), b = new AbortController(); let calls = 0, signal;
  const start = s => { calls++; signal = s; return pending.promise; };
  const one = pool.request('same', start, a.signal), two = pool.request('same', start, b.signal);
  const rejectedOne = assert.rejects(one, error => error.info.code === 'caller_cancelled');
  await flush(); a.abort(); await rejectedOne;
  assert.equal(signal.aborted, false); assert.equal(calls, 1);
  const rejectedTwo = assert.rejects(two, error => error.info.code === 'caller_cancelled'); b.abort(); await rejectedTwo;
  assert.equal(signal.aborted, true); pending.resolve(1); await flush();
});

test('old pool completion cannot delete its replacement operation', async () => {
  const pool = new ClientRequestPool(), old = deferred(), next = deferred(), abort = new AbortController(); let calls = 0;
  const one = pool.request('k', () => { calls++; return old.promise; }, abort.signal);
  const rejected = assert.rejects(one); await flush(); abort.abort(); await rejected;
  const two = pool.request('k', () => { calls++; return next.promise; }); await flush();
  old.resolve('old'); await flush();
  const three = pool.request('k', () => { calls++; return Promise.resolve('wrong'); });
  next.resolve('new'); assert.deepEqual(await Promise.all([two,three]), ['new','new']); assert.equal(calls, 2);
});

test('history cache shares exactly native crypto 15m/1d, preserves acquisition, bounds entries and bypasses read cache manually', async t => {
  let calls = 0; setup(t, async path => { calls++; return json(history(path)); });
  const cache = new ClientHistoryCache(new ClientCooldown()), signal = new AbortController().signal;
  const one = await cache.read('BTC-USDT','15m',signal), two = await cache.read('BTC-USDT','1d',signal);
  assert.equal(calls,1); assert.equal(two.data.range,'1d'); assert.equal(two.network,false); assert.equal(two.data.fetchedAt,one.data.fetchedAt);
  t.mock.timers.tick(1000); await cache.read('BTC-USDT','1d',signal,true); assert.equal(calls,2);
  assert.notEqual(clientHistoryKey('BTC-USDT','1d'),clientHistoryKey('BTC-USDT','1w'));
  assert.notEqual(clientHistoryKey('AAPL','1d'),clientHistoryKey('AAPL','15m'));
  for (let i=0;i<24;i++) await cache.read(`X${i}-USDT`,'1d',signal);
  assert.equal(cache.peek('BTC-USDT','1d'),undefined);
});

test('a shared history operation survives one consumer cancellation and manual joins the remaining work', async t => {
  const pending = deferred(); let calls = 0, requestPath, underlying;
  setup(t, (path, options) => { calls++; requestPath = path; underlying = options.signal; return pending.promise; });
  const cache = new ClientHistoryCache(new ClientCooldown()), a = new AbortController(), b = new AbortController();
  const one = cache.read('BTC-USDT','15m',a.signal), two = cache.read('BTC-USDT','1d',b.signal,true);
  const rejected = assert.rejects(one); await flush(); a.abort(); await rejected; assert.equal(underlying.aborted,false);
  pending.resolve(json(history(requestPath))); assert.equal((await two).data.range,'1d'); assert.equal(calls,1);
});

test('bounded client JSON cancels a stalled response body at its absolute deadline', async t => {
  let cancelled = false;
  setup(t, async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel() { cancelled = true; } }), { headers: { 'content-type':'application/json' } }));
  const operation = clientJson('/fixture',new AbortController().signal,100);
  const rejected = assert.rejects(operation,error => error.info.code === 'timeout');
  await flush(); t.mock.timers.tick(100); await rejected; assert.equal(cancelled,true);
});

test('HTTP 429 non-JSON retains rate semantics and longest provider cooldown applies across symbols', async t => {
  setup(t, async () => new Response('busy',{status:429,headers:{'retry-after':'120'}}));
  const cooldown = new ClientCooldown(); let failure;
  try { await clientJson('/fixture',new AbortController().signal,100); } catch (error) { failure = error; }
  assert.equal(failure.info.code,'rate_limited'); cooldown.observe('BTC-USDT',failure);
  t.mock.timers.tick(61000); assert.throws(() => cooldown.check('ETH-USDT'),error => error.info.retryAt === 10_120_000);
  assert.doesNotThrow(() => cooldown.check('AAPL'));
});

test('missing, duplicate, invalid and explicitly errored quote rows become per-asset failures', () => {
  const results = completeQuoteResults(['BTC-USDT','ETH-USDT','SOL-USDT','AAPL'],[
    {symbol:'BTC-USDT',quote:quote('BTC-USDT')},{symbol:'BTC-USDT',quote:quote('BTC-USDT')},
    {symbol:'SOL-USDT',quote:quote('ETH-USDT')},{symbol:'AAPL',quote:quote('AAPL'),error:'unavailable'}
  ]);
  assert.equal(results.length,4); assert.ok(results.every(row => !row.quote && row.error));
});

test('history selection/manual share one request, failures retain same-key original data and gate analysis until recovery', async t => {
  let fail = false, calls = 0;
  setup(t, async path => { calls++; return fail ? json({error:'fixture unavailable',errorInfo:{code:'upstream_unavailable'}},502) : json(history(path)); });
  const controller = new MarketHistoryController(new ClientCooldown()); t.after(controller.dispose);
  controller.update(historyOptions()); const manual = controller.refresh(); await manual; await flush(); assert.equal(calls,1);
  const first = controller.getSnapshot().history.fetchedAt;
  fail = true; t.mock.timers.tick(1000); await controller.refresh();
  let state = controller.getSnapshot(); assert.equal(state.history.key,'BTC-USDT:15m'); assert.equal(state.history.fetchedAt,first); assert.ok(state.historyError); assert.ok(state.trends['BTC-USDT'].error); assert.equal(state.trends['BTC-USDT'].fetchedAt,first);
  fail = false; await controller.refresh(); state = controller.getSnapshot(); assert.equal(state.historyError,''); assert.equal(state.trends['BTC-USDT'].error,undefined); assert.ok(state.history.fetchedAt>first);
});

test('unknown history interval remains unsupported, never guessed from the requested range', async t => {
  setup(t, async path => json(history(path,{metadata:undefined})));
  const controller = new MarketHistoryController(new ClientCooldown()); t.after(controller.dispose);
  controller.update(historyOptions()); await controller.refresh();
  assert.equal(controller.getSnapshot().trends['BTC-USDT'].intervalMs,0);
});

test('rapid selection and offline cancellation cannot publish a prior generation or set a failure', async t => {
  const pending = []; setup(t,(path,options) => { const job=deferred(); pending.push({path,signal:options.signal,...job}); return job.promise; });
  const controller = new MarketHistoryController(new ClientCooldown()); t.after(controller.dispose);
  controller.update(historyOptions()); await flush();
  controller.update(historyOptions({selected:'ETH-USDT'})); await flush(); assert.equal(pending[0].signal.aborted,true);
  pending[0].resolve(json(history(pending[0].path))); await flush(); assert.equal(controller.getSnapshot().history,null);
  pending[1].resolve(json(history(pending[1].path))); await flush(); assert.equal(controller.getSnapshot().history.key,'ETH-USDT:15m');
  const refresh = controller.refresh(); await flush(); controller.update(historyOptions({selected:'ETH-USDT',online:false})); await refresh;
  assert.equal(controller.getSnapshot().historyError,''); assert.equal(controller.getSnapshot().historyLoading,false);
});

test('auto-off permits initial overview but visibility/network changes do not resume reads; explicit selection and manual remain available', async t => {
  let calls=0; setup(t,async path=>{calls++;return json(history(path));});
  const controller=new MarketHistoryController(new ClientCooldown());t.after(controller.dispose);
  controller.update(historyOptions());await flush();assert.equal(calls,1);
  t.mock.timers.tick(1500);await flush();assert.equal(calls,3);
  controller.update(historyOptions({visible:false}));controller.update(historyOptions());
  controller.update(historyOptions({online:false}));controller.update(historyOptions());
  t.mock.timers.tick(120000);await flush();assert.equal(calls,3);
  controller.update(historyOptions({selected:'ETH-USDT'}));await flush();assert.equal(calls,4);
  await controller.refresh();assert.equal(calls,5);
});

test('overview starts after selected and runs at most three workers', async t => {
  const pending=[];setup(t,(path)=>{const job=deferred();pending.push({path,...job});return job.promise;});
  const controller=new MarketHistoryController(new ClientCooldown());t.after(controller.dispose);
  controller.update(historyOptions({requestKey:'BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT,DOGE-USDT'}));await flush();assert.equal(pending.length,1);assert.match(pending[0].path,/BTC-USDT/);
  t.mock.timers.tick(1500);await flush();assert.equal(pending.length,3);
  pending[0].resolve(json(history(pending[0].path)));await flush();assert.equal(pending.length,4);
});

test('quotes normalize missing rows, preserve old data/error/fetchedAt, never advance global freshness on partial failure, and recover', async t => {
  let partial=false; setup(t,async path=>{const symbols=new URL(path,'http://localhost').searchParams.get('symbols').split(',');return json({results:symbols.filter(s=>!partial||s==='BTC-USDT').map(symbol=>({symbol,quote:quote(symbol)})),fetchedAt:Date.now()+99999});});
  const controller=new MarketQuotesController(new ClientCooldown());t.after(controller.dispose);
  controller.update(quoteOptions());await controller.refresh();const first=controller.getSnapshot().lastFetched;assert.equal(first,10_000_000);
  partial=true;t.mock.timers.tick(1000);await controller.refresh();let state=controller.getSnapshot();assert.ok(state.errors['ETH-USDT']);assert.equal(state.quotes['ETH-USDT'].fetchedAt,first);assert.equal(state.lastFetched,first);assert.equal(state.quotes['BTC-USDT'].fetchedAt,first+1000);
  partial=false;await controller.refresh();state=controller.getSnapshot();assert.equal(state.errors['ETH-USDT'],undefined);assert.equal(state.quotes['ETH-USDT'].error,undefined);assert.equal(state.lastFetched,first+1000);
});

test('quote manual refresh joins pending groups, and auto-off visibility/network resume makes no new request', async t => {
  const pending=deferred();let calls=0;setup(t,()=>{calls++;return pending.promise;});
  const controller=new MarketQuotesController(new ClientCooldown());t.after(controller.dispose);
  controller.update(quoteOptions());const a=controller.refresh(),b=controller.refresh();await flush();assert.equal(calls,1);
  pending.resolve(json({results:['BTC-USDT','ETH-USDT'].map(symbol=>({symbol,quote:quote(symbol)}))}));await Promise.all([a,b]);assert.equal(controller.getSnapshot().loading,false);
  controller.update(quoteOptions({visible:false}));controller.update(quoteOptions());controller.update(quoteOptions({online:false}));controller.update(quoteOptions());t.mock.timers.tick(120000);await flush();assert.equal(calls,1);
});

test('per-asset backoff keeps successful crypto on five-second cadence, stocks fifteen and background sixty', async t => {
  const calls=[];setup(t,async path=>{const symbols=new URL(path,'http://localhost').searchParams.get('symbols').split(',');calls.push({at:Date.now(),symbols});return json({results:symbols.map(symbol=>symbol==='ETH-USDT'?{symbol,error:'fixture unavailable'}:{symbol,quote:quote(symbol)})});});
  const options=quoteOptions({requestKey:'BTC-USDT,ETH-USDT,AAPL',symbolKey:'BTC-USDT,ETH-USDT,AAPL',auto:true});
  const controller=new MarketQuotesController(new ClientCooldown());t.after(controller.dispose);controller.update(options);await flush();
  t.mock.timers.tick(5000);await flush();t.mock.timers.tick(5000);await flush();assert.deepEqual(calls.at(-1).symbols,['BTC-USDT']);
  t.mock.timers.tick(5000);await flush();assert.ok(calls.some(call=>call.at===10_015_000&&call.symbols.includes('AAPL')));
  controller.update({...options,visible:false});const before=calls.length;t.mock.timers.tick(59999);await flush();assert.equal(calls.length,before);t.mock.timers.tick(1);await flush();assert.ok(calls.length>before);
});

test('server cooldown is shared across history/quote and manual refresh cannot extend or bypass it', async t => {
  let calls=0;setup(t,async()=>{calls++;return json({error:'rate limited',errorInfo:{code:'rate_limited',stage:'upstream',retryAt:10_120_000}},429);});
  const cooldown=new ClientCooldown(), historyController=new MarketHistoryController(cooldown), quotesController=new MarketQuotesController(cooldown);t.after(historyController.dispose);t.after(quotesController.dispose);
  historyController.update(historyOptions());await historyController.refresh();assert.equal(calls,1);
  quotesController.update(quoteOptions());await quotesController.refresh();assert.equal(calls,1);t.mock.timers.tick(61000);await quotesController.refresh();assert.equal(calls,1);
  assert.throws(()=>cooldown.check('SOL-USDT'),error=>error.info.retryAt===10_120_000);
});

test('all requested stocks share one server batch instead of multiplying its worker budget', async t => {
  const calls=[];setup(t,async path=>{const symbols=new URL(path,'http://localhost').searchParams.get('symbols').split(',');calls.push(symbols);return json({results:symbols.map(symbol=>({symbol,quote:quote(symbol)}))});});
  const stocks=Array.from({length:20},(_,index)=>`S${index}`), requestKey=['BTC-USDT','ETH-USDT',...stocks].join(',');
  const controller=new MarketQuotesController(new ClientCooldown());t.after(controller.dispose);
  controller.update(quoteOptions({requestKey,symbolKey:requestKey}));await controller.refresh();
  assert.equal(calls.length,2);assert.equal(calls.find(group=>group.includes('S0')).length,20);assert.equal(calls.find(group=>group.includes('BTC-USDT')).length,2);
});

test('malformed optional metadata is rejected before chart/footer consumers can render it', () => {
  const body=history('/api/history?symbol=BTC-USDT&range=1d');
  for(const metadata of [null,{}, {...body.metadata,limitations:'bad'}, {...body.metadata,limitations:[1]}, {...body.metadata,intervalMs:-1}, {...body.metadata,intervalMs:14400000}, {...body.metadata,gapCount:-1}, {...body.metadata,lastCompleteAt:'wrong'}, {...body.metadata,lastAt:123}]) {
    assert.throws(()=>validateClientHistory({...body,metadata},'BTC-USDT','1d'),error=>error.info.code==='invalid_data');
  }
  assert.equal(validateClientHistory({...body,metadata:undefined},'BTC-USDT','1d').metadata,undefined);
});

test('successful overview clears a previously failed chart error before a cache-only revisit', async t => {
  let fail=true,calls=0;setup(t,async path=>{calls++;return fail?json({error:'fixture unavailable'},502):json(history(path));});
  const controller=new MarketHistoryController(new ClientCooldown());t.after(controller.dispose);
  controller.update(historyOptions());await flush();assert.ok(controller.getSnapshot().historyError);
  fail=false;controller.update(historyOptions({selected:'ETH-USDT'}));await flush();t.mock.timers.tick(1500);await flush();
  const before=calls;controller.update(historyOptions());await flush();
  assert.equal(calls,before);assert.equal(controller.getSnapshot().history.key,'BTC-USDT:15m');assert.equal(controller.getSnapshot().historyError,'');
});
