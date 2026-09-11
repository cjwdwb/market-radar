import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AccessSecrets = { ACCESS_CODE_HASH?: string; ACCESS_SESSION_SECRET?: string };
const COOKIE = "__Host-radar_access";
const LIFETIME = 7 * 24 * 60 * 60;
const securityHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "same-origin",
};

export function accessCodeHash(value: string) {
  return createHash("sha256").update(value.replace(/[\s-]/g, "").toUpperCase()).digest("hex");
}
function equalHex(a: string, b: string) {
  return /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
function signature(payload: string, config: Required<AccessSecrets>) {
  // Changing the access code also invalidates previously issued sessions.
  return createHmac("sha256", config.ACCESS_SESSION_SECRET).update(`radar-v1:${config.ACCESS_CODE_HASH}:${payload}`).digest("hex");
}
export function createAccessSession(config: Required<AccessSecrets>, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + LIFETIME}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload, config)}`;
}
function hasSession(request: Request, config: Required<AccessSecrets>) {
  const token = request.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || token.length > 160) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d{10}$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1])) return false;
  const expiry = Number(parts[0]), now = Math.floor(Date.now() / 1000);
  return expiry > now && expiry <= now + LIFETIME && equalHex(parts[2], signature(`${parts[0]}.${parts[1]}`, config));
}
function sessionCookie(value: string, age = LIFETIME) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
}
function redirect(path: string, cookie?: string) {
  return new Response(null, { status: 303, headers: { ...securityHeaders, Location: path, ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}
function accessPage(error = "", status = 200) {
  return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>访问验证 · 市场雷达</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>
  *{box-sizing:border-box}body{margin:0;background:#090909;color:#f5f5f5;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100svh;display:flex;flex-direction:column}header{height:72px;display:flex;align-items:center;gap:11px;padding:0 32px;border-bottom:1px solid #242424;font-weight:600}header span{display:grid;place-items:center;background:white;color:#111;width:32px;height:32px;border-radius:6px;font-size:23px}header small{color:#727272;font-size:10px;letter-spacing:2px;margin-left:12px;font-weight:400}main{flex:1;display:grid;place-items:center;padding:48px 20px}.card{width:min(100%,420px);border:1px solid #303030;border-radius:12px;padding:36px;background:#111}.lock{display:grid;place-items:center;width:48px;height:48px;border:1px solid #3a3a3a;border-radius:12px;background:#222;color:#eee;margin-bottom:26px}.eyebrow{font-size:10px;letter-spacing:2px;color:#777;margin-bottom:10px}h1{font-size:27px;font-weight:600;letter-spacing:-.5px;margin:0 0 12px}.intro{font-size:13px;color:#999;line-height:1.8;margin:0 0 28px}label{display:block;font-size:12px;margin-bottom:9px;color:#ccc}input{width:100%;border:1px solid #424242;background:#090909;border-radius:6px;color:white;padding:14px;font:inherit;font-size:16px;letter-spacing:1px;outline:none}input:focus{border-color:#eee;box-shadow:0 0 0 2px #ffffff18}button{width:100%;border:0;border-radius:6px;background:#f5f5f5;color:#111;padding:14px;font:inherit;font-size:14px;font-weight:600;margin-top:17px;cursor:pointer}button:hover{background:#ddd}button:focus-visible{outline:2px solid white;outline-offset:4px}.error{font-size:12px;line-height:1.7;color:#ff8090;margin:12px 0 0}.note{font-size:11px;line-height:1.8;color:#777;border-top:1px solid #292929;padding-top:20px;margin:24px 0 0}footer{text-align:center;padding:22px;color:#666;font-size:11px}@media(max-width:480px){header{padding:0 20px;height:62px}header small{display:none}.card{padding:28px 24px}main{padding:28px 20px}}
  body{background:#080808;color:#ededed}header{height:76px;border-color:#202020;font-weight:500;padding:0 40px}header span{background:transparent;color:#ededed;border:1px solid #555;border-radius:50%;font-size:26px}header small{letter-spacing:2.5px}.card{width:min(100%,440px);border:0;background:transparent;padding:40px 24px}.lock{background:transparent;border-color:#333;border-radius:50%;width:52px;height:52px;margin-bottom:36px}.eyebrow{font-size:10px;letter-spacing:2.4px;color:#909090;margin-bottom:16px}h1{font-size:36px;font-weight:500;letter-spacing:-1px}.intro{color:#a0a0a0;margin:18px 0 36px;line-height:1.9}label{color:#b5b5b5}input{height:52px;background:#101010;border-color:#353535;border-radius:8px}input::placeholder{color:#777;font-size:13px;letter-spacing:0}button{height:50px;border-radius:8px;font-weight:500;margin-top:18px}.error{color:#ddd}.note{border-color:#272727;padding-top:24px;margin-top:32px;color:#888}footer{font-size:10px;letter-spacing:1px;padding:28px}@media(max-width:480px){header{height:66px;padding:0 22px}.card{padding:20px 8px}main{padding:36px 24px}h1{font-size:32px}.lock{margin-bottom:28px}}
  header .brand-mark{width:56px;height:48px;object-fit:contain;flex-shrink:0}header{gap:14px}.intro{font-size:16px}label,button{font-size:14px}.eyebrow,.note,.error,footer{font-size:12px}input::placeholder{font-size:14px}@media(max-width:480px){header .brand-mark{width:46px;height:40px}}
  </style></head><body><header><img class="brand-mark" src="/brand.svg" alt="" width="56" height="48">市场雷达<small>MARKET RADAR</small></header><main><section class="card"><div class="lock"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg></div><div class="eyebrow">PRIVATE MARKET ACCESS</div><h1>输入访问码</h1><p class="intro">行情与你分享。<br>使用站主提供的访问码，进入市场雷达。</p><form action="/api/access" method="post"><label for="code">统一访问码</label><input id="code" name="code" type="password" autocomplete="current-password" placeholder="输入或粘贴访问码" required maxlength="64" autocapitalize="off" spellcheck="false" ${error ? 'aria-invalid="true" aria-describedby="access-error"' : ""}>${error ? `<p class="error" id="access-error" role="alert">${error}</p>` : ""}<button type="submit">进入市场雷达 →</button></form><p class="note">验证后在此浏览器保留 7 天。<br>没有访问码？请联系分享此网站的人。</p></section></main><footer>市场雷达 · 关注价格，留给雷达</footer></body></html>`, {
    status, headers: { ...securityHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
  });
}
async function limitedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 1024) throw new Error("too large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new Error("too large"); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

/** Runs before the application router; a missing secret always denies access. */
export async function accessGate(request: Request, env: AccessSecrets): Promise<Response | null> {
  const config = { ACCESS_CODE_HASH: env.ACCESS_CODE_HASH ?? process.env.ACCESS_CODE_HASH ?? "", ACCESS_SESSION_SECRET: env.ACCESS_SESSION_SECRET ?? process.env.ACCESS_SESSION_SECRET ?? "" };
  if (!/^[a-f0-9]{64}$/.test(config.ACCESS_CODE_HASH) || config.ACCESS_SESSION_SECRET.length < 32) {
    return new Response("访问验证暂时不可用，请稍后重试。", { status: 503, headers: securityHeaders });
  }
  const url = new URL(request.url);
  if (url.pathname === "/api/access" || url.pathname === "/api/access/logout") {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { ...securityHeaders, Allow: "POST" } });
    if (request.headers.get("origin") !== url.origin) return new Response("请求来源无效", { status: 403, headers: securityHeaders });
    if (url.pathname.endsWith("/logout")) return redirect("/access", sessionCookie("", 0));
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return new Response("无效表单", { status: 415, headers: securityHeaders });
    let body: string;
    try { body = await limitedBody(request); } catch { return new Response("请求过大", { status: 413, headers: securityHeaders }); }
    const code = new URLSearchParams(body).get("code") ?? "";
    if (code.length > 64 || !equalHex(accessCodeHash(code), config.ACCESS_CODE_HASH)) return accessPage("访问码不正确，请检查后重试。", 401);
    return redirect("/", sessionCookie(createAccessSession(config)));
  }
  const verified = hasSession(request, config);
  if (url.pathname === "/access") return verified ? redirect("/") : accessPage();
  if (verified) return null;
  if (url.pathname.startsWith("/api/") || request.headers.get("rsc") === "1" || !["GET", "HEAD"].includes(request.method)) {
    return Response.json({ error: "请先输入访问码", code: "ACCESS_REQUIRED" }, { status: 401, headers: securityHeaders });
  }
  return redirect("/access");
}

export function privateResponse(response: Response) {
  const secured = new Response(response.body, response);
  for (const [key, value] of Object.entries(securityHeaders)) secured.headers.set(key, value);
  return secured;
}
