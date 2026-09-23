// Simulated market and archive data only. Real Date/timers remain untouched.
import {createRequire} from 'node:module';
import {accessCodeHash,createAccessSession} from '../../worker/access-gate.ts';
import {viewDigest,ATTRIBUTION,RIGHTS,SOURCE} from '../../lib/information/fed-view.mjs';
export const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
export const watches=['ETH-USDT','SOL-USDT','XRP-USDT','DOGE-USDT','ADA-USDT','AVAX-USDT','LINK-USDT','DOT-USDT','LTC-USDT','BCH-USDT','NVDA','AAPL','MSFT','AMZN','META','TSLA','GOOGL','QQQ','0700.HK','600519.SS'];
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function points(symbol,now,stage=0){
 const step=(symbol.endsWith('-USDT')?15:5)*60_000,end=Math.floor(now/step)*step;
 // Initial warm-up omits the OLDEST bar; latest completed evidence stays fresh.
 // A new completed bar appears only when the real source time grid advances.
 return Array.from({length:80},(_,i)=>{const close=100+i*.035+(i%2)*.015+(stage>=2&&i===79?.03:0);return {time:end-(80-i)*step,open:close-.01,high:close+.02,low:close-.02,close,volume:100+i,confirmed:true};}).slice(stage===0?1:0);
}
export async function archive(count=7,padded=false,label='Fixture'){
 const now=Date.now(),start=Date.parse('2026-09-01T00:00:00Z');
 const body={format:'fed-monetary-view-v1',source:SOURCE,attribution:ATTRIBUTION,rightsUrl:RIGHTS,identity:'reconstructed',vintage:'current',readRevision:1,exportedAt:now,range:{from:start,cutoff:now},coverage:{status:'endpoint_snapshot',expectedCount:null,limitation:'Not a complete historical or point-in-time collection'},records:Array.from({length:count},(_,i)=>{const date=String(1+Math.floor(i/26)).padStart(2,'0'),url=`https://www.federalreserve.gov/newsevents/pressreleases/monetary202609${date}${String.fromCharCode(97+i%26)}.htm`;return {id:url,url,title:`${label} ${i} `+'测'.repeat(padded?470:1),publishedAt:start+Math.floor(i/26)*86400000+(i%26)*60000,publicationPrecision:'minute',firstReceivedAt:now,versionReceivedAt:now,version:1,contentHash:'1'.repeat(64)};})};
 const view={...body,viewId:await viewDigest(body)},json=JSON.stringify(view),buffer=Buffer.from(json+' '.repeat(padded?1048576-Buffer.byteLength(json):0));
 return {view,file:{name:label+'.json',mimeType:'application/json',buffer}};
}
export async function fixture(browser,base,{width=1440,height=1000,watchlist=watches,probe=true,intro=true}={}){
 const origin=new URL(base);if(!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Loopback only');
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'});
 await context.addCookies([{name:'__Host-radar_access',value:createAccessSession({ACCESS_CODE_HASH:accessCodeHash('perf-fixture-only'),ACCESS_SESSION_SECRET:'perf-fixture-only-not-a-production-secret-275'}),url:base.replace('http:','https:'),secure:true,httpOnly:true,sameSite:'Lax'}]);
 await context.addInitScript(({watchlist,intro})=>{localStorage.setItem('market-radar-preferences-v1',JSON.stringify({watchlist,motionPreference:'normal'}));if(!intro)sessionStorage.setItem('radar-brand-seen','1');},{watchlist,intro});
 if(probe)await context.addInitScript(()=>{
  const data={raf:[],longtask:[],loaf:[],events:[],supported:PerformanceObserver.supportedEntryTypes,visible:document.visibilityState};let last=0,frame;const observers=[];
  const tick=t=>{if(last&&data.raf.length<60000)data.raf.push(t-last);last=t;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  for(const [type,key] of [['longtask','longtask'],['long-animation-frame','loaf'],['event','events']])if(data.supported.includes(type)){const o=new PerformanceObserver(list=>{for(const e of list.getEntries())if(data[key].length<10000)data[key].push({name:e.name,duration:e.duration,start:e.startTime,interactionId:e.interactionId,blockingDuration:e.blockingDuration});});o.observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});observers.push(o);}
  window.__perf275=data;window.__stop275=()=>{cancelAnimationFrame(frame);observers.forEach(o=>o.disconnect());return data;};
 });
 const page=await context.newPage(),requests=[],errors=[],warnings=[],counts=new Map(),started=Date.now();const control={fail:false};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))warnings.push({type:e.type(),text:e.text()});});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin.origin){await route.abort();return;}
  if(!url.pathname.startsWith('/api/')){await route.continue();return;}
  const now=Date.now(),key=url.pathname+url.search,n=counts.get(key)||0;counts.set(key,n+1);const stage=n===0?0:n===1?0:n===2?1:2;
  requests.push({at:now-started,path:url.pathname,query:url.search,stage,failed:control.fail});
  if(control.fail&&url.pathname==='/api/quotes'){await route.fulfill({status:503,json:{error:'Isolated temporary fixture failure'}});return;}
  if(url.pathname==='/api/quotes'){
   await route.fulfill({json:{results:(url.searchParams.get('symbols')||'').split(',').map(symbol=>{const crypto=symbol.endsWith('-USDT'),rows=points(symbol,now,stage);return {symbol,quote:{symbol,name:symbol,currency:crypto?'USDT':symbol.endsWith('.HK')||symbol==='^HSI'?'HKD':symbol.endsWith('.SS')?'CNY':'USD',source:crypto?'OKX 欧易':'Yahoo Finance',price:rows.at(-1).close+(n%2)*.01,change:1,changePercent:1,previousClose:100,high:104,low:99,volume:1000000,timestamp:now,fetchedAt:now,session:'open',delayMinutes:0,points:crypto?[]:rows}};}),fetchedAt:now}});return;
  }
  if(url.pathname==='/api/history'){const symbol=url.searchParams.get('symbol');await route.fulfill({json:{symbol,points:points(symbol,now,stage),currency:symbol.endsWith('-USDT')?'USDT':'USD',source:symbol.endsWith('-USDT')?'OKX 欧易':'Yahoo Finance',fetchedAt:now,timezone:'UTC'}});return;}
  await route.fulfill({status:401,json:{error:'No remote operations in performance fixture'}});
 });
 return {context,page,requests,errors,warnings,control};
}
