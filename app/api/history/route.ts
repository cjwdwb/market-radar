import { VALID_SYMBOL, type Range } from "@/lib/market";
import { getHistory, publicError } from "@/lib/market-data";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const url=new URL(request.url);const symbol=url.searchParams.get("symbol")??"";const range=url.searchParams.get("range")??"1d";
  if(!VALID_SYMBOL.test(symbol)||!["15m","1d","1w","1m","3m"].includes(range))return Response.json({error:"无效的行情代码或时间范围"},{status:400});
  try{return Response.json(await getHistory(symbol,range as Range),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return Response.json({error:publicError(error)},{status:503,headers:{"Cache-Control":"no-store"}});}
}
