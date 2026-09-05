export type Market = "crypto" | "us" | "cn" | "hk";
export type Range = "1d" | "1w" | "1m" | "3m";
export type Asset = { symbol: string; name: string; market: Market; color: string; mark: string };
export type Point = { time: number; close: number; volume?: number };
export type Quote = {
  symbol: string; name: string; currency: string; price: number;
  change: number | null; changePercent: number | null; previousClose: number | null;
  high: number | null; low: number | null; volume: number | null;
  timestamp: number; fetchedAt: number; source: string; timezone: string;
  session: "open" | "closed" | "unknown"; delayMinutes: number | null;
  points: Point[]; error?: string;
};
export type QuoteResult = { symbol: string; quote?: Quote; error?: string };
export type PriceAlert = {
  id: string; symbol: string; direction: "above" | "below"; target: number;
  enabled: boolean; createdAt: number; triggeredAt?: number; triggeredPrice?: number;
};
export const MARKET_LABELS: Record<Market,string> = { crypto:"加密货币", us:"美股", cn:"A 股", hk:"港股" };
export const ASSETS: Asset[] = [
  {symbol:"BTC-USD",name:"比特币",market:"crypto",color:"#f7931a",mark:"₿"},
  {symbol:"ETH-USD",name:"以太坊",market:"crypto",color:"#8e9cee",mark:"Ξ"},
  {symbol:"SOL-USD",name:"Solana",market:"crypto",color:"#9e81f5",mark:"S"},
  {symbol:"XRP-USD",name:"XRP",market:"crypto",color:"#c1c8d4",mark:"X"},
  {symbol:"DOGE-USD",name:"狗狗币",market:"crypto",color:"#d5b96a",mark:"Ð"},
  {symbol:"LINK-USD",name:"Chainlink",market:"crypto",color:"#5689ff",mark:"L"},
  {symbol:"ADA-USD",name:"Cardano",market:"crypto",color:"#6a9ff0",mark:"A"},
  {symbol:"AVAX-USD",name:"Avalanche",market:"crypto",color:"#ee767c",mark:"A"},
  {symbol:"NVDA",name:"英伟达",market:"us",color:"#a7d557",mark:"N"},
  {symbol:"AAPL",name:"苹果",market:"us",color:"#d5dbe4",mark:"A"},
  {symbol:"TSLA",name:"特斯拉",market:"us",color:"#f57682",mark:"T"},
  {symbol:"MSFT",name:"微软",market:"us",color:"#74a7f1",mark:"M"},
  {symbol:"GOOGL",name:"谷歌",market:"us",color:"#6ab99b",mark:"G"},
  {symbol:"AMZN",name:"亚马逊",market:"us",color:"#e8b369",mark:"a"},
  {symbol:"META",name:"Meta",market:"us",color:"#8da3f2",mark:"M"},
  {symbol:"COIN",name:"Coinbase",market:"us",color:"#748dfa",mark:"C"},
  {symbol:"SPY",name:"标普 500 ETF",market:"us",color:"#78bba9",mark:"SP"},
  {symbol:"QQQ",name:"纳斯达克 100 ETF",market:"us",color:"#b291e3",mark:"Q"},
  {symbol:"^GSPC",name:"标普 500",market:"us",color:"#8ccca2",mark:"SP"},
  {symbol:"^IXIC",name:"纳斯达克综合",market:"us",color:"#a09de2",mark:"IX"},
  {symbol:"600519.SS",name:"贵州茅台",market:"cn",color:"#df8d87",mark:"茅"},
  {symbol:"300750.SZ",name:"宁德时代",market:"cn",color:"#81a9dc",mark:"宁"},
  {symbol:"000001.SS",name:"上证指数",market:"cn",color:"#ca9d73",mark:"沪"},
  {symbol:"000300.SS",name:"沪深 300",market:"cn",color:"#a2bc7f",mark:"沪"},
  {symbol:"0700.HK",name:"腾讯控股",market:"hk",color:"#72a4e4",mark:"腾"},
  {symbol:"9988.HK",name:"阿里巴巴",market:"hk",color:"#e3aa67",mark:"阿"},
  {symbol:"1810.HK",name:"小米集团",market:"hk",color:"#e89667",mark:"米"},
];
export const DEFAULT_WATCHLIST = ["BTC-USD","ETH-USD","SOL-USD","NVDA","AAPL","TSLA","600519.SS","0700.HK"];
export const OVERVIEW = ["BTC-USD","ETH-USD","^GSPC","^IXIC"];
export const VALID_SYMBOL = /^(?:\^?[A-Z][A-Z0-9.-]{0,13}|\d{4,6}\.(?:SS|SZ|HK))$/;
export function assetFor(symbol: string): Asset {
  return ASSETS.find(a=>a.symbol===symbol) ?? {
    symbol, name:symbol, market:symbol.endsWith("-USD")?"crypto":symbol.endsWith(".HK")?"hk":/\.(SS|SZ)$/.test(symbol)?"cn":"us",
    color:"#91a1bd",mark:symbol.replace(/[^A-Z0-9]/g,"").slice(0,2)
  };
}
export function displaySymbol(symbol:string) { return symbol.replace(/-USD$|\.SS$|\.SZ$|\.HK$/g,"").replace("^GSPC","S&P 500").replace("^IXIC","NASDAQ"); }
export function price(value:number|null|undefined,currency="USD",symbol=true) {
  if(value==null || !Number.isFinite(value)) return "—";
  const digits = value!==0&&Math.abs(value)<1?4:2;
  return new Intl.NumberFormat("en-US",{style:symbol?"currency":"decimal",currency,currencyDisplay:"narrowSymbol",minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
}
export function percent(value:number|null|undefined) {return value==null||!Number.isFinite(value)?"—":`${value>0?"+":""}${value.toFixed(2)}%`;}
export function compact(value:number|null|undefined) {return value==null?"—":new Intl.NumberFormat("zh-CN",{notation:"compact",maximumFractionDigits:2}).format(value);}
export function alertMatches(alert:PriceAlert,quote:Quote,now=Date.now()):boolean {
  if (!alert.enabled || alert.triggeredAt || quote.error || quote.symbol!==alert.symbol || !Number.isFinite(quote.price) || !Number.isFinite(alert.target) || alert.target<=0) return false;
  if (!Number.isFinite(quote.timestamp) || !Number.isFinite(quote.fetchedAt) || quote.timestamp>now+60_000 || now-quote.fetchedAt>120_000) return false;
  const crypto=assetFor(quote.symbol).market==="crypto";
  if(crypto ? now-quote.timestamp>180_000 : quote.session!=="open" || now-quote.timestamp>1_200_000) return false;
  return alert.direction==="above"?quote.price>=alert.target:quote.price<=alert.target;
}
