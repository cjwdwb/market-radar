"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { DisplayInterpretation } from "@/lib/ai/private-contract";
import type { SiteInterpretation } from "@/lib/ai/site-contract";
import { AI_LIMITS } from "@/lib/ai/limits";

export const interpretationErrors: Record<string, string> = {
  provider_not_configured: "真实 Provider 尚未配置；当前行情与确定性情报仍可使用。", budget_exhausted: "本次解释预算已用完，未继续派发；行情与确定性情报仍可使用。", budget_unavailable: "无法安全读取或保存预算，真实解释已停止。", busy: "已有解释任务进行中，请稍后操作。",
  timeout: "解释超时，未自动重试。", cancelled: "已取消解释。", refusal: "Provider 拒绝生成此次解释。", incomplete: "Provider 输出未完成，未展示截断内容。",
  data_permission_unavailable: "来源用途许可尚未满足，真实资料取数与模型外发均已停止。", real_authorization_required: "真实输入授权尚未就绪，未取数或派发模型。", batch_stopped: "本轮试点已停止，未继续派发。",
  session_required: "请输入本机私有服务的会话凭据并连接。", unsupported_asset: "私有试点仅支持 BTC-USDT，请切换资产。", snapshot_expired: "原快照已到期，请手动重新查看解释。",
  private_session_required: "私有会话验证已失效，请重新连接；原快照结果已清除。", permission_revoked: "来源用途许可或授权已撤销，会话与原快照结果已清除。", context_expired: "原快照已到期，请手动重新查看解释。", batch_exhausted: "本轮试点次数已用完，未继续派发。", loader_timeout: "受控快照取数超时，未自动重试。",
  organization_failed: "模型组织质量未达标，本轮试点已停止；未展示本次输出。",
  invalid_output: "解释未通过结构校验。", unsupported_claim: "解释没有得到所引证据支持。", network_error: "解释暂时无法读取；原行情保持可用。",
  authentication_required: "站点身份尚未验证，请重新登录；原快照结果已清除。", access_denied: "当前站点身份没有解释权限；原快照结果已清除。", authorization_unavailable: "暂时无法核验站点授权，已停止读取或生成解释。", record_unavailable: "原快照已无法按当前授权读取；页面中的原结果已清除。", disabled: "站点受控试点已关闭，未继续生成解释。", result_unavailable: "原快照尚无可读取的已保存结果，未重新派发模型。",
  read_only: "当前站点身份仅可读取获准的原快照。",
  snapshot_invalid: "原快照完整性校验未通过，已停止解释。", idempotency_conflict: "请求身份与已有记录不一致，未重复派发。", budget_admission_denied: "当前预算或消费授权不允许派发，行情仍可使用。",
  snapshot_capacity: "本轮可保存的快照已达到上限；可继续读取获准的原快照，未新增取数或模型请求。",
};
async function boundedResponse(response: Response, maximum = 32768) {
  const reader = response.body?.getReader(); if (!reader) throw new Error("network_error");
  const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > maximum) throw new Error("invalid_output"); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
async function readSiteResponse(response: Response, maximum?: number) {
  // The site gate can respond before the AI handler, using its own localized error envelope.
  if (response.status === 401) {
    void response.body?.cancel().catch(() => {});
    throw new Error("authentication_required");
  }
  const payload = await boundedResponse(response, maximum);
  if (payload?.code === "ACCESS_REQUIRED") throw new Error("authentication_required");
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "network_error");
  return payload;
}
type Gate = "unknown" | "ready" | "blocked";
/** 父组件只持有一份请求状态；导航、render或行情变化都不触发Provider。 */
export function useInterpretation(symbol: string) {
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error" | "cancelled">("idle");
  const [discovering, setDiscovering] = useState(false), [siteReadOnly, setSiteReadOnly] = useState(false);
  const [error, setError] = useState(""), [result, setResult] = useState<DisplayInterpretation | SiteInterpretation | null>(null);
  const [mode, setMode] = useState("unknown"), [stateSymbol, setStateSymbol] = useState(symbol);
  const [gate, setGate] = useState<Gate>("unknown"), [connected, setConnected] = useState(false), [allowedSymbol, setAllowedSymbol] = useState("");
  const [allowedSymbols, setAllowedSymbols] = useState<string[]>([]), [siteSnapshot, setSiteSnapshot] = useState<{ symbol: string; snapshotId: string; expiresAt: number } | null>(null);
  if (stateSymbol !== symbol) { setStateSymbol(symbol); setPhase("idle"); setError(""); setResult(null); setSiteSnapshot(null); }
  const flight = useRef<AbortController | null>(null), generation = useRef(0), currentSymbol = useRef(symbol);
  const session = useRef(""), currentMode = useRef("unknown");
  useLayoutEffect(() => { currentSymbol.current = symbol; generation.current++; flight.current?.abort(); flight.current = null;
    const requestGeneration = generation;
    return () => { requestGeneration.current++; flight.current?.abort(); flight.current = null; };
  }, [symbol]);
  useLayoutEffect(() => { const credential = session; return () => { credential.current = ""; }; }, []);
  const cancel = useCallback(() => { generation.current++; flight.current?.abort(); flight.current = null; setDiscovering(false); setPhase("cancelled"); setError("cancelled"); }, []);
  const request = useCallback(async (action: "generate" | "connect" | "restore" | "discover", scenario = "upward", credential = "") => {
    if (flight.current || (action === "discover" && currentMode.current !== "unknown" && currentMode.current !== "site_controlled")) return;
    if (action === "connect" && currentMode.current !== "private_real") return;
    if (action === "connect") { session.current = credential.trim(); setConnected(false); setResult(null); setAllowedSymbol(""); setGate("unknown"); }
    const controller = new AbortController(), version = ++generation.current, selected = symbol;
    let timedOut = false;
    let rejectCancelled: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => { rejectCancelled = () => reject(new Error("cancelled")); });
    controller.signal.addEventListener("abort", rejectCancelled, { once: true });
    let timer = setTimeout(() => { timedOut = true; controller.abort(); }, AI_LIMITS.timeoutMs + 1000);
    const privateDeadline = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000); };
    const active = () => { if (controller.signal.aborted || version !== generation.current || currentSymbol.current !== selected) throw new Error("cancelled"); };
    flight.current = controller; setDiscovering(action === "discover"); setPhase("loading"); setError("");
    try {
      // 截止时间也覆盖响应读取和模块加载；迟到任务不能继续派发或写回。
      const task = (async (): Promise<DisplayInterpretation | SiteInterpretation | null> => {
        let requestMode = currentMode.current;
        if (action !== "connect") {
          const response = await fetch("/api/interpretation", { signal: controller.signal, cache: "no-store", credentials: "same-origin" });
          const capability = await readSiteResponse(response); active();
          if (!["fixture", "private_real", "unconfigured", "site_controlled"].includes(capability.mode)) throw new Error("invalid_output");
          if (capability.mode === "site_controlled") {
            const { parseSiteCapability } = await import("@/lib/ai/site-contract"); active();
            let checked; try { checked = parseSiteCapability(capability); } catch { throw new Error("invalid_output"); }
            if (requestMode !== checked.mode) { setResult(null); setSiteSnapshot(null); session.current = ""; setConnected(false); setAllowedSymbol(""); }
            requestMode = checked.mode; currentMode.current = requestMode; setMode(requestMode); setGate(checked.admission); setAllowedSymbols(checked.allowedSymbols);
            const readOnly = checked.admission === "blocked" && checked.reason === "read_only";
            setSiteReadOnly(readOnly);
            if (!checked.allowedSymbols.some(asset => asset === selected)) { setResult(null); setSiteSnapshot(null); }
            if (action === "discover" && (checked.admission === "ready" || readOnly)) return null;
            if (checked.admission !== "ready" && (action !== "restore" || !checked.allowedSymbols.some(asset => asset === selected))) throw new Error(checked.reason || "provider_not_configured");
            if (!checked.allowedSymbols.some(asset => asset === selected)) throw new Error("unsupported_asset");
          } else {
            if (requestMode === "site_controlled") { setResult(null); setSiteSnapshot(null); setAllowedSymbols([]); setSiteReadOnly(false); setGate("unknown"); }
            requestMode = capability.mode; currentMode.current = requestMode; setMode(requestMode);
          }
          if (requestMode === "private_real") setGate(capability.admission === "ready" ? "ready" : "blocked");
          if (action === "discover") {
            if (requestMode === "private_real" && capability.admission === "blocked") setError(typeof capability.reason === "string" && interpretationErrors[capability.reason] ? capability.reason : "data_permission_unavailable");
            return null;
          }
          if (requestMode === "private_real" && !session.current) throw new Error(capability.admission === "blocked" ? capability.reason || "data_permission_unavailable" : "session_required");
        }
        if (requestMode === "site_controlled") {
          privateDeadline();
          const post = async (body: object) => {
            active(); const response = await fetch("/api/interpretation", { method: "POST", signal: controller.signal, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const payload = await readSiteResponse(response, 65536); active();
            return payload;
          };
          let snapshot, body;
          if (action === "restore") {
            snapshot = result && "format" in result && result.format === "site-interpretation-v1" && result.context.asset.symbol === selected
              ? { symbol: selected, snapshotId: result.snapshot.id, expiresAt: result.snapshot.expiresAt } : siteSnapshot;
            if (!snapshot || snapshot.symbol !== selected) throw new Error("record_unavailable");
            active(); const response = await fetch(`/api/interpretation/result?${new URLSearchParams({ symbol: selected, snapshotId: snapshot.snapshotId })}`, { signal: controller.signal, credentials: "same-origin", cache: "no-store" });
            body = await readSiteResponse(response, 65536); active();
          } else {
            snapshot = await post({ action: "snapshot", symbol: selected });
            if (!snapshot || Object.keys(snapshot).sort().join(",") !== "expiresAt,snapshotId" || typeof snapshot.snapshotId !== "string" || !/^[A-Za-z0-9_-]{16,160}$/.test(snapshot.snapshotId) || !Number.isSafeInteger(snapshot.expiresAt) || snapshot.expiresAt <= 0) throw new Error("invalid_output");
            setSiteSnapshot({ symbol: selected, ...snapshot });
            body = await post({ action: "interpret", symbol: selected, snapshotId: snapshot.snapshotId });
          }
          const { parseSiteInterpretation } = await import("@/lib/ai/site-contract"); active();
          let next; try { next = parseSiteInterpretation(body); } catch { throw new Error("invalid_output"); }
          if (next.context.asset.symbol !== selected || next.snapshot.id !== snapshot.snapshotId || next.snapshot.expiresAt !== snapshot.expiresAt) throw new Error("invalid_output");
          return next;
        }
        if (action === "restore") throw new Error("record_unavailable");
        if (requestMode === "private_real") {
          privateDeadline();
          if (!session.current) throw new Error("session_required");
          const post = async (route: "status" | "snapshot" | "interpret", body: object) => {
            active();
            const response = await fetch(`/__ai-pilot/${route}`, { method: "POST", signal: controller.signal, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", "x-ai-pilot-session": session.current }, body: JSON.stringify(body) });
            const payload = await boundedResponse(response, 65536); active();
            if (!response.ok) {
              throw new Error(typeof payload.error === "string" ? payload.error : "network_error");
            }
            return payload;
          };
          const status = await post("status", {});
          if (!["ready", "blocked"].includes(status.gate?.admission) || status.allowedSymbol !== "BTC-USDT") throw new Error("invalid_output");
          setConnected(true); setGate(status.gate.admission); setAllowedSymbol(status.allowedSymbol);
          if (status.gate.admission !== "ready") throw new Error(status.gate.reason || "data_permission_unavailable");
          if (action === "connect") return null;
          if (selected !== status.allowedSymbol) throw new Error("unsupported_asset");
          const snapshot = await post("snapshot", { symbol: selected });
          if (typeof snapshot.snapshotId !== "string" || !snapshot.snapshotId || snapshot.snapshotId.length > 180 || !Number.isSafeInteger(snapshot.expiresAt) || snapshot.expiresAt <= 0) throw new Error("invalid_output");
          const body = await post("interpret", { symbol: selected, snapshotId: snapshot.snapshotId });
          const { parsePrivateInterpretation } = await import("@/lib/ai/private-contract"); active();
          let next;
          try { next = parsePrivateInterpretation(body); } catch { throw new Error("invalid_output"); }
          if (next.context.asset.symbol !== selected || next.snapshot.id !== snapshot.snapshotId || next.snapshot.expiresAt !== snapshot.expiresAt) throw new Error("invalid_output");
          return next;
        }
        if (requestMode !== "fixture" || action !== "generate") throw new Error("provider_not_configured");
        active();
        const response = await fetch("/api/interpretation", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: selected, scenario }) });
        const body = await boundedResponse(response); active();
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "network_error");
        const [{ ResultSchema }, { validateOutput }] = await Promise.all([import("@/lib/ai/contracts"), import("@/lib/ai/validation")]); active();
        const next = ResultSchema.parse(body);
        if (next.contextId !== next.context.contextId || next.asOf !== next.context.asOf || next.context.asset.symbol !== selected) throw new Error("invalid_output");
        validateOutput(JSON.stringify(next.output), next.context);
        return next;
      })();
      const next = await Promise.race([task, cancelled]);
      if (!controller.signal.aborted && !timedOut && version === generation.current && currentSymbol.current === selected) { if (next) setResult(next); setPhase(next ? "ready" : "idle"); }
    } catch (e) { if (version === generation.current && currentSymbol.current === selected) {
      const code = timedOut ? "timeout" : e instanceof Error && interpretationErrors[e.message] ? e.message : "network_error";
      if (currentMode.current === "private_real" && ["data_permission_unavailable", "real_authorization_required", "budget_unavailable", "batch_stopped", "batch_exhausted", "permission_revoked", "organization_failed"].includes(code)) setGate("blocked");
      if (currentMode.current === "private_real" && ["session_required", "private_session_required", "permission_revoked"].includes(code)) { session.current = ""; setConnected(false); setResult(null); if (code !== "permission_revoked") setGate("unknown"); }
      if (currentMode.current === "site_controlled") {
        if (code === "authentication_required") { setAllowedSymbols([]); setSiteReadOnly(false); }
        if (["authentication_required", "access_denied", "permission_revoked", "record_unavailable", "authorization_unavailable", "data_permission_unavailable", "real_authorization_required"].includes(code)) { setResult(null); setSiteSnapshot(null); }
        if (["authentication_required", "access_denied", "permission_revoked", "authorization_unavailable", "data_permission_unavailable", "real_authorization_required", "budget_unavailable", "batch_stopped", "batch_exhausted", "disabled", "organization_failed"].includes(code)) setGate("blocked");
      }
      setPhase("error"); setError(code);
    } }
    finally { clearTimeout(timer); controller.signal.removeEventListener("abort", rejectCancelled); if (version === generation.current) { flight.current = null; setDiscovering(false); } }
  }, [symbol, result, siteSnapshot]);
  const discover = useCallback(() => request("discover"), [request]);
  const generate = useCallback((scenario = "upward") => request("generate", scenario), [request]);
  const connectSession = useCallback((credential: string) => request("connect", "upward", credential), [request]);
  const restoreOriginal = useCallback(() => request("restore"), [request]);
  const visibleResult = result?.context.asset.symbol === symbol ? result : null;
  return { symbol, phase, error, mode, gate, discover, discovering, siteReadOnly, connected, allowedSymbol, allowedSymbols, result: visibleResult, resultKind: visibleResult ? "format" in visibleResult ? visibleResult.format === "site-interpretation-v1" ? "site_controlled" : "private_real" : "fixture" : null, canRestore: mode === "site_controlled" && Boolean(visibleResult && "format" in visibleResult && visibleResult.format === "site-interpretation-v1" || siteSnapshot?.symbol === symbol), generate, cancel, connectSession, restoreOriginal };
}
export type InterpretationController = ReturnType<typeof useInterpretation>;
