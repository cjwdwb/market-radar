import { VALID_SYMBOL } from "@/lib/market";
import { getQuote, publicError } from "@/lib/market-data";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const symbols=[...new Set((new URL(request.url).searchParams.get("symbols")??"").split(",").filter(Boolean))];
  if(!symbols.length||symbols.length>28||symbols.some(s=>!VALID_SYMBOL.test(s)))return Response.json({error:"请输入 1–28 个有效行情代码"},{status:400});
  const results=[];
  // Bound upstream concurrency to reduce bursts on the free data source.
  for(let i=0;i<symbols.length;i+=4){
    results.push(...await Promise.all(symbols.slice(i,i+4).map(async symbol=>{
      try{return {symbol,quote:await getQuote(symbol)};}catch(error){return {symbol,error:publicError(error)};}
    })));
  }
  return Response.json({results,fetchedAt:Date.now()},{headers:{"Cache-Control":"no-store"}});
}
