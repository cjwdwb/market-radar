import { getChatGPTUser } from "@/app/chatgpt-auth";
export const dynamic = "force-dynamic";
async function proxy(request: Request) {
  const user = await getChatGPTUser();
  const ownerEmail=process.env.SITE_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail || !user || user.email.toLowerCase() !== ownerEmail) return Response.json({ error: "请使用网站所有者账号登录" }, { status: 401 });
  const token = process.env.MONITOR_TOKEN, base = process.env.MONITOR_URL;
  if (!token || !base) return Response.json({ error: "云端监控尚未配置" }, { status: 503 });
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  try {
    const body = request.method === "GET" ? undefined : await request.text();
    if (body && body.length > 30000) return Response.json({ error: "设置过大" }, { status: 413 });
    const response = await fetch(base, { method: request.method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(15000) });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "云端连接失败，请稍后重试" }, { status: 503 }); }
}
export const GET = proxy;
export const PUT = proxy;
