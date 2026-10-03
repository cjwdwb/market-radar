import publication from "../../../data/published/coinmetrics-sep2026.json" with { type: "json" };
import { loadPublishedReference, queryPublishedReference } from "../../../lib/history/published-reference";
export const dynamic = "force-dynamic";
let prepared: ReturnType<typeof loadPublishedReference> | undefined;
const headers = { "Cache-Control": "private, no-store" };
// Worker现有访问门禁在此路由前执行；此接口只读构建时批准快照，无采集/DB/第三方请求。
export async function GET(request: Request) {
  const url = new URL(request.url), params = url.searchParams;
  if (url.search.length > 512 || [...params.keys()].some((key, i, all) =>
    !["asset","from","cutoff","version"].includes(key) || all.indexOf(key) !== i)) {
    return Response.json({ error: "日频查询参数无效。" }, { status:400, headers });
  }
  try {
    const data = await (prepared ??= loadPublishedReference(publication, Date.now()));
    if (!params.size) return Response.json(structuredClone(data.catalog), { headers });
    if (params.size !== 4 || !/^\d{13}$/.test(params.get("from") ?? "") || !/^\d{13}$/.test(params.get("cutoff") ?? "")) {
      return Response.json({ error: "请选择获准范围内的 UTC 日期。" }, { status:400, headers });
    }
    const result = queryPublishedReference(data, {
      asset:params.get("asset") ?? "", from:Number(params.get("from")), cutoff:Number(params.get("cutoff")), version:params.get("version") ?? "",
    });
    return Response.json(result, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const version = message === "REFERENCE_VERSION_CHANGED";
    const status = version ? 409 : message === "REFERENCE_QUERY_INVALID" ? 400 : 503;
    return Response.json({ error:version ? "资料版本已变化，请重新加载日频资料。" :
      status === 400 ? "日频资产、日期或版本无效。" : "已发布日频资料暂不可用，实时行情不受影响。" }, { status, headers });
  }
}
