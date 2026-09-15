import { assetFor, type Point, type Quote, type Range } from "./market";
import { getOKXHistory, getOKXQuote, getOKXTickers } from "./okx";
import { marketJson, MarketRequestError } from "./market-request";

type YahooMeta = {
  regularMarketPrice?: number; regularMarketTime?: number; chartPreviousClose?: number; previousClose?: number;
  regularMarketDayHigh?: number; regularMarketDayLow?: number; regularMarketVolume?: number; exchangeDataDelayedBy?: number;
  longName?: string; shortName?: string; currency?: string; exchangeTimezoneName?: string;
  currentTradingPeriod?: { regular?: { start: number; end: number } };
};
type YahooResult = { meta: YahooMeta; timestamp?: number[]; indicators?: { quote?: { close?: (number|null)[]; open?: (number|null)[]; high?: (number|null)[]; low?: (number|null)[]; volume?: (number|null)[] }[] } };
const cache = new Map<string,{expires:number;data:YahooResult}>();
const inFlight = new Map<string,Promise<YahooResult>>();
let upstreamRetryAt = 0;
const rangeConfig:Record<Range,{range:string;interval:string}> = {
  "15m":{range:"5d",interval:"15m"},
  "1d":{range:"1d",interval:"5m"},"1w":{range:"5d",interval:"60m"},
  "1m":{range:"1mo",interval:"1d"},"3m":{range:"3mo",interval:"1d"}
};
export function numeric(value:unknown):number|null {return typeof value==="number"&&Number.isFinite(value)?value:null;}
export function parsePoints(data:YahooResult):Point[] {
  const series=data.indicators?.quote?.[0];
  return (data.timestamp??[]).flatMap((timestamp,i)=>{
    const close=numeric(series?.close?.[i]);const volume=numeric(series?.volume?.[i]);
    return close!==null&&Number.isFinite(timestamp)?[{time:timestamp*1000,close,volume:volume??undefined,open:numeric(series?.open?.[i])??undefined,high:numeric(series?.high?.[i])??undefined,low:numeric(series?.low?.[i])??undefined,confirmed:timestamp*1000+900000<=Date.now()}]:[];
  }).sort((a,b)=>a.time-b.time);
}
export function parseQuote(symbol:string,data:YahooResult,now=Date.now()):Quote {
  const m=data.meta;const points=parsePoints(data);
  const current=numeric(m.regularMarketPrice);
  const timestamp=numeric(m.regularMarketTime);
  if(current===null||current<=0||timestamp===null) throw new Error("行情源暂未返回有效报价");
  // Use the previous close from the 1-day response, never the start of a multi-day chart.
  const previous=numeric(m.chartPreviousClose)??numeric(m.previousClose);
  const change=previous!==null&&previous>0?current-previous:null;
  const regular=m.currentTradingPeriod?.regular;
  const crypto=assetFor(symbol).market==="crypto";
  let session:Quote["session"]="unknown";
  if(crypto) session="open";
  else if(regular&&Number.isFinite(regular.start)&&Number.isFinite(regular.end)) session=now/1000>=regular.start&&now/1000<regular.end?"open":"closed";
  return {symbol,name:m.longName??m.shortName??assetFor(symbol).name,currency:m.currency??"USD",price:current,
    previousClose:previous,change,changePercent:change!==null&&previous?change/previous*100:null,
    high:numeric(m.regularMarketDayHigh),low:numeric(m.regularMarketDayLow),volume:numeric(m.regularMarketVolume),
    timestamp:timestamp*1000,fetchedAt:now,source:"Yahoo Finance",timezone:m.exchangeTimezoneName??"UTC",session,
    delayMinutes:numeric(m.exchangeDataDelayedBy),points};
}
async function fetchChart(symbol:string,range:Range):Promise<YahooResult> {
  const key=`${symbol}:${range}`; const cached=cache.get(key);
  if(cached&&cached.expires>Date.now()) return cached.data;
  const running=inFlight.get(key);if(running)return running;
  if(Date.now()<upstreamRetryAt)throw new Error("行情源请求繁忙，正在等待恢复后自动重试");
  const promise=(async()=>{
    const config=rangeConfig[range];
    const url=new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set("interval",config.interval);url.searchParams.set("range",config.range);url.searchParams.set("includePrePost","false");
    if(assetFor(symbol).market==="crypto"&&range==="1w")url.searchParams.set("range","7d");
    let body: {chart?:{result?:YahooResult[];error?:unknown}};
    try {
      body=await marketJson<typeof body>(url,{headers:{"User-Agent":"MarketRadar/1.0","Accept":"application/json"},timeoutMs:12_000,attempts:2});
    } catch(error) {
      if(error instanceof MarketRequestError&&error.retryAt)upstreamRetryAt=Math.max(upstreamRetryAt,error.retryAt);
      throw error;
    }
    const result=body.chart?.result?.[0];
    if(!result?.meta||body.chart?.error)throw new Error("该代码暂无可用行情，请检查市场后缀");
    if(cache.size>=180)cache.delete(cache.keys().next().value!);
    cache.set(key,{data:result,expires:Date.now()+((range==="1d"||range==="15m")?10_000:240_000)});
    return result;
  })();
  inFlight.set(key,promise);
  try{return await promise;}finally{inFlight.delete(key);}
}
export async function getQuote(symbol:string, includePoints=true):Promise<Quote> {return symbol.endsWith("-USDT")?getOKXQuote(symbol,includePoints):parseQuote(symbol,await fetchChart(symbol,"1d"));}
export async function getQuotes(symbols:string[],includePoints=true) {
  // Begin both providers together. A slow crypto provider must not delay stocks.
  const tickerRequest=symbols.some(s=>s.endsWith("-USDT"))
    ?getOKXTickers().then(tickers=>({tickers,error:undefined as unknown})).catch(error=>({tickers:{} as Record<string,Record<string,string>>,error}))
    :Promise.resolve({tickers:{} as Record<string,Record<string,string>>,error:undefined as unknown});
  const results: {symbol:string;quote?:Quote;error?:string}[]=[];
  for(let i=0;i<symbols.length;i+=10){
    results.push(...await Promise.all(symbols.slice(i,i+10).map(async symbol=>{
      try{
        if(symbol.endsWith("-USDT")){
          const {tickers,error:tickerError}=await tickerRequest;
          if(tickerError)throw tickerError;
          if(!tickers[symbol])throw new Error("欧易暂无该交易对行情");
          return {symbol,quote:await getOKXQuote(symbol,includePoints,tickers[symbol])};
        }
        return {symbol,quote:await getQuote(symbol,includePoints)};
      }catch(error){return {symbol,error:publicError(error)};}
    })));
  }
  return results;
}
export async function getHistory(symbol:string,range:Range) {
  if(symbol.endsWith("-USDT"))return getOKXHistory(symbol,range);
  const data=await fetchChart(symbol,range);const points=parsePoints(data);
  if(points.length<2)throw new Error("该时间范围暂无足够的走势数据");
  return {symbol,range,points,currency:data.meta.currency??"USD",timezone:data.meta.exchangeTimezoneName??"UTC",source:"Yahoo Finance",fetchedAt:Date.now()};
}
export function publicError(error:unknown) {
  if(error instanceof Error&&/行情|代码|走势/.test(error.message)) return error.message;
  return "行情连接暂时中断，请稍后刷新";
}
