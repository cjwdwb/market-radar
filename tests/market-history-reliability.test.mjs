import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {GET as historyRoute} from '../app/api/history/route.ts';
import {GET as quotesRoute} from '../app/api/quotes/route.ts';
import {getHistory,parsePoints} from '../lib/market-data.ts';
import {getOKXHistory,parseCandles} from '../lib/okx.ts';
import {marketScope} from '../lib/market-request.ts';
import {validateProxyHistory} from '../lib/market-history.ts';

let now,sequence=0;
const savedEnvironment={url:process.env.MONITOR_URL,token:process.env.MONITOR_TOKEN};
beforeEach(t=>{now=2_100_000_000_000+(++sequence)*1_000_000;t.mock.method(Date,'now',()=>now);t.mock.method(console,'warn',()=>{});delete process.env.MONITOR_URL;delete process.env.MONITOR_TOKEN;t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network call');});});
afterEach(()=>{for(const [key,value] of [['MONITOR_URL',savedEnvironment.url],['MONITOR_TOKEN',savedEnvironment.token]])if(value===undefined)delete process.env[key];else process.env[key]=value;});
const rows=()=>{const open=Math.floor(now/900000)*900000;return [[String(open),'10','13','9','12','5','0','0','0'],[String(open-900000),'11','12','8','10','3','0','0','1']];};
const request=(range='1d',signal)=>new Request(`https://site.test/api/history?symbol=BTC-USDT&range=${range}`,{signal});
const proxy=()=>{process.env.MONITOR_URL='https://monitor.example.test';process.env.MONITOR_TOKEN='synthetic-test-token';};
const legacy=()=>({symbol:'BTC-USDT',range:'1d',currency:'USDT',timezone:'UTC',source:'OKX 欧易',fetchedAt:now-1000,points:parseCandles(rows())});

test('unconfigured history route uses direct official provider and additive metadata',async t=>{
 const urls=[];t.mock.method(globalThis,'fetch',async url=>{urls.push(url);return Response.json({code:'0',data:rows()});});const response=await historyRoute(request());const body=await response.json();assert.equal(response.status,200);assert.equal(urls[0].origin,'https://openapi.okx.com');assert.equal(body.metadata.instrument,'BTC-USDT');assert.equal(body.metadata.intervalMs,900000);assert.equal(body.metadata.volumeUnit,'base');assert.equal(body.fetchedAt,now);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('valid legacy proxy response preserves original acquisition and labels unverifiable metadata',async t=>{
 proxy();let calls=0;t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;assert.equal(url.hostname,'monitor.example.test');assert.equal(options.redirect,'error');assert.ok(Number(options.headers['X-Market-Deadline'])<=now+6000);return Response.json(legacy());});const response=await historyRoute(request());const body=await response.json();assert.equal(response.status,200);assert.equal(calls,1);assert.equal(body.fetchedAt,now-1000);assert.equal(body.metadata.path,'monitor');assert.ok(body.metadata.limitations.includes('legacy_proxy_metadata_unverified'));assert.equal(body.cache.ageMs,1000);
});
test('proxy HTTP errors never trigger a direct request and remain distinct from site authentication',async t=>{
 for(const [status,expected,code] of [[401,502,'proxy_auth_error'],[403,502,'proxy_auth_error'],[451,502,'upstream_denied'],[503,502,'proxy_unavailable']]){
  proxy();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status});});const response=await historyRoute(request());const body=await response.json();assert.equal(response.status,expected);assert.equal(body.errorInfo.code,code);assert.equal(body.errorInfo.stage,'proxy');assert.equal(calls,1);
 }
});
test('proxy 429 enforces provider cooldown and carries a reliable Retry-After',async t=>{
 proxy();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'180'}});});const a=await historyRoute(request());assert.equal(a.status,429);assert.equal(a.headers.get('Retry-After'),'180');const b=await historyRoute(request());assert.equal(b.status,429);assert.equal(calls,1);
});
test('proxy transport failure, malformed JSON and HTML cannot pass or silently fall back',async t=>{
 for(const [mode,code] of [['transport','proxy_unavailable'],['html','unexpected_content_type'],['json','invalid_json']]){
  proxy();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;if(mode==='transport')throw new TypeError('fetch failed');return new Response(mode==='html'?'<html>':'{',{headers:{'Content-Type':mode==='html'?'text/html':'application/json'}});});const response=await historyRoute(request());assert.equal(response.status,502);assert.equal((await response.json()).errorInfo.code,code);assert.equal(calls,1);
 }
});
test('proxy body timeout consumes the original bounded hop and never overlaps direct',async t=>{
 proxy();let calls=0,cancelled=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(new ReadableStream({pull(controller){now+=6001;controller.enqueue(new TextEncoder().encode('{}'));},cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}});});const response=await historyRoute(request());assert.equal(response.status,504);assert.equal((await response.json()).errorInfo.code,'timeout');assert.equal(calls,1);assert.equal(cancelled,1);
});
test('partial or invalid proxy configuration fails explicitly without network',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(legacy());});process.env.MONITOR_URL='https://monitor.example.test';let response=await historyRoute(request());assert.equal((await response.json()).errorInfo.code,'proxy_configuration_error');proxy();process.env.MONITOR_URL='not a URL';response=await historyRoute(request());assert.equal((await response.json()).errorInfo.code,'proxy_configuration_error');assert.equal(calls,0);
});
test('proxy rejects wrong identity, currency, range, source, future acquisition and bad bars',async t=>{
 const alterations=[v=>v.symbol='ETH-USDT',v=>v.range='1w',v=>v.currency='USD',v=>v.source='another source',v=>v.fetchedAt=now+60000,v=>delete v.fetchedAt,v=>v.points[0].high=1,v=>v.points[0].time=Math.floor(v.points[0].time/1000),v=>v.points.push({...v.points[0],close:11})];
 for(const alter of alterations){proxy();const body=legacy();alter(body);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(body);});const response=await historyRoute(request());assert.equal(response.status,502);assert.equal((await response.json()).errorInfo.code,'invalid_data');assert.equal(calls,1);}
});
test('proxy source metadata must match actual points and interval',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({code:'0',data:rows()}));const body=await getOKXHistory('BTC-USDT','1d');const scope=marketScope();assert.equal(validateProxyHistory(body,'BTC-USDT','1d',scope).metadata.path,'candles');
 for(const alter of [v=>v.metadata.intervalMs=3600000,v=>v.metadata.lastCompleteAt=now,v=>v.metadata.instrument='ETH-USDT',v=>v.metadata.limitations=['https://private.invalid/secret']]){const invalid=structuredClone(body);alter(invalid);assert.throws(()=>validateProxyHistory(invalid,'BTC-USDT','1d',scope),error=>error.code==='invalid_data');}
});
test('route invalid input and active caller cancellation issue no upstream request',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({});});assert.equal((await historyRoute(request('nope'))).status,400);const controller=new AbortController();controller.abort();assert.equal((await historyRoute(request('1d',controller.signal))).status,499);assert.equal(calls,0);
});
test('quote route returns requested missing ticker as an asset error rather than dropping it',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({code:'0',data:[{instId:'BTC-USDT',last:'100',open24h:'99',ts:String(now)}]}));const response=await quotesRoute(new Request('https://site.test/api/quotes?symbols=BTC-USDT,ETH-USDT'));const body=await response.json();assert.equal(response.status,200);assert.equal(body.results.length,2);assert.equal(body.results[0].quote.fetchedAt,now);assert.equal(body.results[1].symbol,'ETH-USDT');assert.equal(body.results[1].errorInfo.code,'unsupported_asset');assert.equal(body.checkedAt,now);
});
test('normalization rejects conflicting duplicates, malformed numeric values and invalid OHLC',async t=>{
 const source=rows();const identical=[source[0],source[0],source[1]];t.mock.method(globalThis,'fetch',async()=>Response.json({code:'0',data:identical}));let history=await getOKXHistory('BTC-USDT','15m');assert.equal(history.metadata.duplicateRows,1);assert.equal(history.points.length,2);
 const conflict=[...source,[...source[0]]];conflict[2][5]='99';t.mock.method(globalThis,'fetch',async()=>Response.json({code:'0',data:conflict}));await assert.rejects(getOKXHistory('BTC-USDT','15m'),error=>error.code==='invalid_data');
 const malformed=[...source];for(const [index,value] of [[1,''],[2,null],[3,'0'],[4,'Infinity'],[5,'-1']]){const row=[...source[0]];row[index]=value;malformed.push(row);}const future=[...source[0]];future[0]=String(Number(source[0][0])+1800000);malformed.push(future);t.mock.method(globalThis,'fetch',async()=>Response.json({code:'0',data:malformed}));history=await getOKXHistory('BTC-USDT','15m');assert.equal(history.metadata.invalidRows,6);assert.equal(history.points.length,2);assert.ok(history.metadata.limitations.includes('invalid_rows'));
});
test('unknown confirmation stays unknown and gaps are explicit without fabricated bars',async t=>{
 const source=rows();source[0][8]='unknown';source[1][0]=String(Number(source[1][0])-900000);t.mock.method(globalThis,'fetch',async()=>Response.json({code:'0',data:source}));const result=await getOKXHistory('BTC-USDT','15m');assert.equal(result.points.at(-1).confirmed,undefined);assert.equal(result.metadata.gapCount,1);assert.equal(result.points.length,2);assert.equal(result.metadata.lastCompleteAt,result.points[0].time+900000);assert.ok(result.metadata.limitations.includes('unknown_confirmation'));
});
test('same close permits high/volume updates, confirmation transition and next bar',async t=>{
 const start=Math.floor(now/900000)*900000;let source=rows();t.mock.method(globalThis,'fetch',async()=>Response.json({code:'0',data:source}));const first=await getOKXHistory('BTC-USDT','15m');source=structuredClone(source);source[0][2]='14';source[0][5]='6';const revised=await getOKXHistory('BTC-USDT','15m');assert.equal(first.points.at(-1).close,revised.points.at(-1).close);assert.equal(revised.points.at(-1).high,14);assert.equal(revised.points.at(-1).volume,6);
 now=start+900001;const elapsed=await getOKXHistory('BTC-USDT','15m');assert.equal(elapsed.points.at(-1).confirmed,false);source[0][8]='1';const confirmed=await getOKXHistory('BTC-USDT','15m');assert.equal(confirmed.metadata.lastCompleteAt,start+900000);source.unshift([String(start+900000),'12','15','11','14','1','0','0','0']);const appended=await getOKXHistory('BTC-USDT','15m');assert.equal(appended.points.at(-1).time,start+900000);assert.equal(appended.metadata.lastCompleteAt,start+900000);
});
test('Yahoo fixed intervals use elapsed-window metadata while daily confirmation remains unknown',()=>{
 const timestamp=Math.floor(now/1000)-600;const data={meta:{},timestamp:[timestamp],indicators:{quote:[{close:[100],open:[99],high:[101],low:[98]}]}};
 assert.equal(parsePoints(data,300000,now)[0].windowEnded,true);assert.equal(parsePoints(data,900000,now)[0].windowEnded,false);assert.equal(parsePoints(data,3600000,now)[0].windowEnded,false);assert.equal(parsePoints(data,null,now)[0].windowEnded,undefined);assert.equal(parsePoints(data,300000,now)[0].confirmed,undefined);
});
test('Yahoo daily history cache preserves source identity, acquisition and unknown session end',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({chart:{result:[{meta:{symbol:'DAILY',currency:'USD',exchangeTimezoneName:'America/New_York'},timestamp:[Math.floor(now/1000)-172800,Math.floor(now/1000)-86400],indicators:{quote:[{close:[100,101],open:[99,100],high:[101,102],low:[98,99]}]}}]}});});
 const first=await getHistory('DAILY','1m');now+=1000;const cached=await getHistory('DAILY','1m');assert.equal(calls,1);assert.equal(cached.fetchedAt,first.fetchedAt);assert.equal(cached.metadata.intervalMs,null);assert.equal(cached.metadata.bar,'1d');assert.equal(cached.metadata.completion,'unknown');assert.equal(cached.metadata.lastCompleteAt,null);assert.equal(cached.points[0].confirmed,undefined);assert.equal(cached.points[0].windowEnded,undefined);
});
