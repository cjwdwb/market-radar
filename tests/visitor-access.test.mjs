import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { accessGate, accessCodeHash, createAccessSession } from "../worker/access-gate.ts";

const origin = "https://radar.test";
const config = { ACCESS_CODE_HASH: accessCodeHash("test-only-access"), ACCESS_SESSION_SECRET: "visitor-test-secret-at-least-32-characters" };
const request = (path, options = {}) => new Request(origin + path, options);
async function entrance() {
  const response = await accessGate(request("/from-aether"), config);
  return { response, cookie: response.headers.get("set-cookie").split(";")[0] };
}
const visit = (cookie, path, options = {}) => request(path, { ...options, headers: { cookie, ...options.headers } });

test("public home entrance needs no code or referrer, grants only a separate visitor cookie", async () => {
  const { response, cookie } = await entrance();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  assert.match(cookie, /^__Host-radar_visitor=/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=86400", "Path=/"]) assert.ok(response.headers.get("set-cookie").includes(flag));
  assert.doesNotMatch(response.headers.get("set-cookie"), /__Host-radar_access=|test-only-access/);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  const extra = await accessGate(request("/from-aether?next=https://evil.test"), config);
  assert.equal(extra.headers.get("location"), "/");
});

test("visitor can load market workspace, RSC, built assets and reviewed public samples", async () => {
  const { cookie } = await entrance();
  for (const path of ["/", "/api/quotes?symbols=BTCUSDT", "/api/history?symbol=BTCUSDT&range=1d", "/api/reference-history", "/api/information", "/api/asset-information", "/api/interpretation", "/assets/index-abc.js", "/assets/app-123.css", "/assets/font.woff2", "/_vinext/image?url=%2Fbrand.svg&w=64", "/examples/history28-fixture.json", "/examples/fed-monetary-20260923.json"]) {
    for (const method of ["GET", "HEAD"]) assert.equal(await accessGate(visit(cookie, path, { method }), config), null, `${method} ${path}`);
  }
  assert.equal(await accessGate(visit(cookie, "/?_rsc=test", { headers: { rsc: "1" } }), config), null);
});

test("visitor cannot read cloud state, unknown APIs, private pages, source maps or write", async () => {
  const { cookie } = await entrance();
  for (const path of ["/api/monitor", "/api/monitor/", "/api/admin", "/api/history/private", "/api/future-route"]) {
    const response = await accessGate(visit(cookie, path), config);
    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).code, "ACCESS_REQUIRED");
  }
  for (const path of ["/admin", "/private", "/assets/index.js.map", "/examples/private.json", "/assets/%2fapi%2fmonitor.js"]) assert.equal((await accessGate(visit(cookie, path), config)).status, 303, path);
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    for (const path of ["/", "/api/quotes", "/api/interpretation", "/api/monitor", "/assets/app.js"]) assert.equal((await accessGate(visit(cookie, path, { method }), config)).status, 401, `${method} ${path}`);
  }
});

test("visitor token cannot become full access; full token still has original scope", async () => {
  const { cookie } = await entrance();
  const swapped = cookie.replace("__Host-radar_visitor=", "__Host-radar_access=");
  assert.equal((await accessGate(visit(swapped, "/api/monitor"), config)).status, 401);
  const full = `__Host-radar_access=${createAccessSession(config)}`;
  assert.equal(await accessGate(visit(`${cookie}; ${full}`, "/api/monitor"), config), null);
  assert.equal(await accessGate(visit(full, "/api/interpretation", { method: "POST" }), config), null);
  const response = await accessGate(visit(full, "/from-aether"), config);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("tampered, expired and wrong-scope visitor sessions fail closed", async () => {
  const { cookie } = await entrance();
  for (const value of [cookie + "0", "__Host-radar_visitor=fake", `__Host-radar_visitor=${createAccessSession(config)}`]) assert.equal((await accessGate(visit(value, "/api/quotes"), config)).status, 401);
  for (const expiry of [Math.floor(Date.now() / 1000) - 10, Math.floor(Date.now() / 1000) + 86400 * 2]) {
    const payload = `${expiry}.${"a".repeat(32)}`;
    const sig = createHmac("sha256", config.ACCESS_SESSION_SECRET).update(`radar-visitor-v1:${config.ACCESS_CODE_HASH}:${payload}`).digest("hex");
    assert.equal((await accessGate(visit(`__Host-radar_visitor=${payload}.${sig}`, "/api/quotes"), config)).status, 401);
  }
  assert.equal((await accessGate(visit(cookie, "/api/quotes"), { ...config, ACCESS_CODE_HASH: accessCodeHash("rotated") })).status, 401);
  assert.equal((await accessGate(request("/from-aether"), {})).status, 503);
});

test("logout clears both sessions and visitor entrance never trusts cross-site headers", async () => {
  const { cookie } = await entrance();
  const logout = await accessGate(visit(cookie, "/api/access/logout", { method: "POST", headers: { origin } }), config);
  const cookies = logout.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.some((value) => value.startsWith("__Host-radar_access=") && value.includes("Max-Age=0")));
  assert.ok(cookies.some((value) => value.startsWith("__Host-radar_visitor=") && value.includes("Max-Age=0")));
  assert.equal((await accessGate(visit(cookie, "/api/access/logout", { method: "POST", headers: { origin: "https://other.test" } }), config)).status, 403);
  assert.equal((await accessGate(request("/from-aether", { method: "POST" }), config)).status, 405);
  assert.equal((await accessGate(request("/api/monitor", { headers: { referer: "http://127.0.0.1:5173/", origin: "http://127.0.0.1:5173" } }), config)).status, 401);
});
