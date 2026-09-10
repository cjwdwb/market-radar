import { getQuotes, getHistory } from '../lib/market-data.ts';
import { VALID_SYMBOL, alertMatches } from '../lib/market.ts';

function json(body, status=200) { return Response.json(body,{status,headers:{'Cache-Control':'no-store'}}); }
export function validConfig(body) {
  return body && typeof body.enabled==='boolean' && Array.isArray(body.watchlist) && body.watchlist.length<=20 && body.watchlist.every(s=>typeof s==='string'&&VALID_SYMBOL.test(s)) && Array.isArray(body.alerts)&&body.alerts.length<=20&&new Set(body.alerts.map(a=>a.id)).size===body.alerts.length&&body.alerts.every(a=>a&&typeof a.id==='string'&&a.id.length<=100&&typeof a.symbol==='string'&&VALID_SYMBOL.test(a.symbol)&&['above','below'].includes(a.direction)&&typeof a.enabled==='boolean'&&Number.isFinite(a.target)&&a.target>0&&Number.isFinite(a.createdAt)&&a.createdAt>0);
}
async function status(env) {
  const settings=await env.DB.prepare('SELECT * FROM settings WHERE id=1').first();
  const runtime=await env.DB.prepare('SELECT * FROM runtime WHERE id=1').first();
  const rows=await env.DB.prepare('SELECT * FROM alerts').all();
  return {enabled:!!settings.enabled,watchlist:JSON.parse(settings.watchlist),updatedAt:settings.updated_at,lastStarted:runtime.last_started,lastFinished:runtime.last_finished,report:JSON.parse(runtime.report||'{}'),alerts:rows.results.map(r=>({...JSON.parse(r.payload),...(r.triggered_at?{enabled:false,triggeredAt:r.triggered_at,triggeredPrice:r.triggered_price}:{})}))};
}
export async function run(env) {
  const started=Date.now();
  const lock=await env.DB.prepare('UPDATE runtime SET lease_until=?,last_started=? WHERE id=1 AND lease_until<?').bind(started+55000,started,started).run();
  if(!lock.meta.changes)return;
  const report={checked:0,failed:[],quotes:{},errors:{}};
  try {
    const config=await status(env);
    if(config.enabled){
      const symbols=[...new Set([...config.watchlist,...config.alerts.filter(a=>a.enabled&&!a.triggeredAt).map(a=>a.symbol)])];
      for(const result of await getQuotes(symbols,false)){
        const {symbol}=result;
          try {
            if(!result.quote)throw new Error(result.error);
            const quote=result.quote;report.checked++;
            report.quotes[symbol]={price:quote.price,currency:quote.currency,timestamp:quote.timestamp,source:quote.source};
            for(const alert of config.alerts.filter(a=>a.symbol===symbol&&alertMatches(a,quote))){
              await env.DB.prepare("UPDATE alerts SET triggered_at=?,triggered_price=? WHERE id=? AND generation=? AND triggered_at IS NULL AND json_extract(payload, '$.enabled')=1 AND (SELECT enabled FROM settings WHERE id=1)=1").bind(Date.now(),quote.price,alert.id,alert.createdAt).run();
            }
          } catch(error) {report.failed.push(symbol);report.errors[symbol]=error.message;}
      }
    }
  } finally {
    await env.DB.prepare('UPDATE runtime SET last_finished=?,report=?,lease_until=0 WHERE id=1 AND last_started=?').bind(Date.now(),JSON.stringify(report),started).run();
  }
}
export default {
  async scheduled(event,env,ctx){ctx.waitUntil(run(env));},
  async fetch(request,env){
    const supplied=request.headers.get('Authorization')||'';
    const encode=new TextEncoder();
    const a=await crypto.subtle.digest('SHA-256',encode.encode(supplied));
    const b=await crypto.subtle.digest('SHA-256',encode.encode(`Bearer ${env.MONITOR_TOKEN}`));
    if(!env.MONITOR_TOKEN||!crypto.subtle.timingSafeEqual(a,b))return json({error:'Unauthorized'},401);
    try {
      const url=new URL(request.url);
      if(request.method==='GET'&&url.pathname==='/history'){
        const symbol=url.searchParams.get('symbol')||'',range=url.searchParams.get('range')||'15m';
        if(!VALID_SYMBOL.test(symbol)||!['15m','1d','1w','1m','3m'].includes(range))return json({error:'无效行情参数'},400);
        return json(await getHistory(symbol,range));
      }
      if(request.method==='GET')return json(await status(env));
      if(request.method==='POST'&&new URL(request.url).pathname==='/run'){await run(env);return json(await status(env));}
      if(request.method!=='PUT')return json({error:'Method not allowed'},405);
      if(Number(request.headers.get('content-length')||0)>30000)return json({error:'Payload too large'},413);
      const text=await request.text();if(text.length>30000)return json({error:'Payload too large'},413);
      const body=JSON.parse(text);if(!validConfig(body))return json({error:'无效的监控设置'},400);
      const queries=[env.DB.prepare('UPDATE settings SET enabled=?,watchlist=?,updated_at=? WHERE id=1').bind(body.enabled?1:0,JSON.stringify(body.watchlist),Date.now())];
      queries.push(body.alerts.length?env.DB.prepare(`DELETE FROM alerts WHERE id NOT IN (${body.alerts.map(()=>'?').join(',')})`).bind(...body.alerts.map(a=>a.id)):env.DB.prepare('DELETE FROM alerts'));
      for(const a of body.alerts){
        const payload={id:a.id,symbol:a.symbol,target:a.target,direction:a.direction,enabled:a.enabled,createdAt:a.createdAt};
        queries.push(env.DB.prepare('INSERT INTO alerts(id,generation,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,triggered_at=CASE WHEN excluded.generation>generation THEN NULL ELSE triggered_at END,triggered_price=CASE WHEN excluded.generation>generation THEN NULL ELSE triggered_price END,generation=excluded.generation WHERE excluded.generation>=generation').bind(a.id,a.createdAt,JSON.stringify(payload)));
      }
      await env.DB.batch(queries);return json(await status(env));
    }catch(error){console.error(JSON.stringify({event:'monitor_error',message:error.message}));return json({error:'云端监控暂时不可用'},503);}
  }
};
