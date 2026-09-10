import { VALID_SYMBOL, type Range } from "@/lib/market";
import { getHistory, publicError } from "@/lib/market-data";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const url=new URL(request.url);const symbol=url.searchParams.get("symbol")??"";const range=url.searchParams.get("range")??"1d";
  if(!VALID_SYMBOL.test(symbol)||!["15m","1d","1w","1m","3m"].includes(range))return Response.json({error:"无效的行情代码或时间范围"},{status:400});
  try{
    if(symbol.endsWith("-USDT")&&process.env.MONITOR_URL&&process.env.MONITOR_TOKEN){
      try{
        const upstream=new URL('/history',process.env.MONITOR_URL);upstream.searchParams.set('symbol',symbol);upstream.searchParams.set('range',range);
        const response=await fetch(upstream,{headers:{Authorization:`Bearer ${process.env.MONITOR_TOKEN}`},signal:AbortSignal.timeout(28000)});
        if(response.ok)return new Response(response.body,{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
      }catch{ /* Fall back to direct official market data if the monitor is unavailable. */ }
    }
    return Response.json(await getHistory(symbol,range as Range),{headers:{"Cache-Control":"no-store"}});
  }
  catch(error){return Response.json({error:publicError(error)},{status:503,headers:{"Cache-Control":"no-store"}});}
}
