import { VALID_SYMBOL } from "@/lib/market";
import { getQuotes } from "@/lib/market-data";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const symbols=[...new Set((new URL(request.url).searchParams.get("symbols")??"").split(",").filter(Boolean))];
  if(!symbols.length||symbols.length>28||symbols.some(s=>!VALID_SYMBOL.test(s)))return Response.json({error:"请输入 1–28 个有效行情代码"},{status:400});
  const results=await getQuotes(symbols);
  return Response.json({results,fetchedAt:Date.now()},{headers:{"Cache-Control":"no-store"}});
}
