import publication from "../../../data/published/fed-monetary.json" with { type: "json" };
import { parseFedView } from "../../../lib/information/fed-view.mjs";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
let prepared: ReturnType<typeof parseFedView> | undefined;

// 原Worker访问门禁在前；只读已审发布快照，GET不会采集、查询本地库或接受任意URL。
export async function GET(request: Request) {
  if (new URL(request.url).search) return Response.json({error:"此入口只读取已发布的官方资料。"},{status:400,headers});
  try {
    const view = await (prepared ??= parseFedView(JSON.stringify(publication),Date.now()));
    return Response.json(view,{headers});
  } catch {
    prepared = undefined;
    return Response.json({error:"官方资料暂不可用，实时行情不受影响。"},{status:503,headers});
  }
}
