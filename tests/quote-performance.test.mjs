import test from 'node:test';
import assert from 'node:assert/strict';
import {getQuotes} from '../lib/market-data.ts';
import {price,compact} from '../lib/market.ts';

test('reused formatters preserve currency, tiny prices and compact quantities',()=>{
 for(const currency of ['USD','USDT','CNY','HKD'])for(const symbol of [false,true])for(const value of [0,-12.3,0.0024,79000.5]){
  const digits=value!==0&&Math.abs(value)<1?4:2;
  const expected=currency==='USDT'?new Intl.NumberFormat('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value)+(symbol?' USDT':''):new Intl.NumberFormat('en-US',{style:symbol?'currency':'decimal',currency,currencyDisplay:'narrowSymbol',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
  assert.equal(price(value,currency,symbol),expected);
 }
 assert.equal(price(null),'—');assert.equal(compact(123456),new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:2}).format(123456));
});

const ticker={instId:'BTC-USDT',last:'110',open24h:'100',ts:String(Date.now()),high24h:'115',low24h:'95',volCcy24h:'5000'};
test('lightweight crypto quotes never request candle histories',async()=>{
 const original=fetch,paths=[];
 globalThis.fetch=async url=>{paths.push(new URL(url).pathname);return Response.json({code:'0',data:[ticker]});};
 try{const results=await getQuotes(['BTC-USDT'],false);assert.equal(results[0].quote.price,110);assert.deepEqual(results[0].quote.points,[]);assert.deepEqual(paths,['/api/v5/market/tickers']);}finally{globalThis.fetch=original;}
});
test('stock fetching starts while the crypto provider is still pending',async()=>{
 const original=fetch;let release,stockStarted=false;
 const blocked=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async url=>{
  if(new URL(url).hostname.includes('okx')){await blocked;return Response.json({code:'0',data:[ticker]});}
  stockStarted=true;return Response.json({chart:{result:[{meta:{regularMarketPrice:25,regularMarketTime:Date.now()/1000,chartPreviousClose:24,currency:'USD'}}]}});
 };
 try{
  const pending=getQuotes(['BTC-USDT','MSFT'],false);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stockStarted,true);release();const results=await pending;assert.equal(results[1].quote.price,25);
 }finally{release();globalThis.fetch=original;}
});
