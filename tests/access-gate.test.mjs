import test from "node:test";
import assert from "node:assert/strict";
import { accessGate, accessCodeHash, createAccessSession, privateResponse } from "../worker/access-gate.ts";

const origin = "https://radar.test";
const code = "ABCD-1234-EF56-7890-ABCD";
const config = { ACCESS_CODE_HASH: accessCodeHash(code), ACCESS_SESSION_SECRET: "test-session-secret-with-at-least-32-characters" };
const request = (path = "/", options = {}) => new Request(origin + path, options);
const login = (value = code, headers = {}) => request("/api/access", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams({ code: value }) });
const cookieRequest = (token, path = "/") => request(path, { headers: { cookie: `__Host-radar_access=${token}` } });

test("missing configuration fails closed; anonymous HTML, RSC and APIs require access", async () => {
  assert.equal((await accessGate(request(), {})).status, 503);
  for (const path of ["/", "/index.html", "/assets/example.js"]) {
    const response = await accessGate(request(path), config);
    assert.equal(response.status, 303); assert.equal(response.headers.get("location"), "/access");
  }
  for (const path of ["/api/quotes", "/api/history", "/api/monitor"]) assert.equal((await accessGate(request(path), config)).status, 401);
  assert.equal((await accessGate(request("/", { headers: { rsc: "1" } }), config)).status, 401);
  const page = await accessGate(request("/access"), config);
  assert.equal(page.status, 200); assert.match(await page.text(), /输入访问码/);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
});

test("wrong codes cannot grant cookies or reflect submitted HTML; valid code establishes a secure session", async () => {
  const wrong = await accessGate(login('<script>alert(1)</script>'), config);
  assert.equal(wrong.status, 401); assert.equal(wrong.headers.get("set-cookie"), null);
  assert.doesNotMatch(await wrong.text(), /<script>/);
  const valid = await accessGate(login(code.toLowerCase().replaceAll("-", " ")), config);
  assert.equal(valid.status, 303); assert.equal(valid.headers.get("location"), "/");
  const cookie = valid.headers.get("set-cookie");
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=604800"]) assert.ok(cookie.includes(flag));
  assert.doesNotMatch(cookie, new RegExp(code));
  const token = cookie.split(";")[0].split("=")[1];
  assert.equal(await accessGate(cookieRequest(token), config), null);
  assert.equal(await accessGate(cookieRequest(token, "/api/history"), config), null);
  assert.equal((await accessGate(cookieRequest(token, "/access"), config)).headers.get("location"), "/");
});

test("tampering, expiry and code rotation invalidate sessions", async () => {
  const token = createAccessSession(config);
  for (const candidate of [token.slice(0, -1), `${token}0`, "NaN.x.y", "fake", createAccessSession(config, Date.now() - 8 * 86400000)]) {
    assert.equal((await accessGate(cookieRequest(candidate), config)).status, 303);
  }
  assert.equal((await accessGate(cookieRequest(token), { ...config, ACCESS_CODE_HASH: accessCodeHash("changed-code") })).status, 303);
});

test("login and logout enforce same-origin POST and bounded form input", async () => {
  assert.equal((await accessGate(login(code, { origin: "https://evil.test" }), config)).status, 403);
  assert.equal((await accessGate(request("/api/access"), config)).status, 405);
  assert.equal((await accessGate(login(code, { "content-type": "application/json" }), config)).status, 415);
  assert.equal((await accessGate(login("x".repeat(1100)), config)).status, 413);
  assert.equal((await accessGate(request("/api/access/logout"), config)).status, 405);
  const logout = await accessGate(request("/api/access/logout", { method: "POST", headers: { origin } }), config);
  assert.equal(logout.status, 303); assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
});

test("authenticated application responses cannot be cached publicly", async () => {
  const response = privateResponse(new Response("private", { headers: { "cache-control": "public,max-age=300" } }));
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.equal(await response.text(), "private");
});
