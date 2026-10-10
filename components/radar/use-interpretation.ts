"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { InterpretationResult } from "@/lib/ai/contracts";
import { AI_LIMITS } from "@/lib/ai/limits";

export const interpretationErrors: Record<string, string> = {
  provider_not_configured: "真实 Provider 尚未配置；当前行情与确定性情报仍可使用。", budget_exhausted: "本次解释预算已用完，未继续派发；行情与确定性情报仍可使用。", budget_unavailable: "无法安全读取或保存预算，真实解释已停止。", busy: "已有解释任务进行中，请稍后操作。",
  timeout: "解释超时，未自动重试。", cancelled: "已取消解释。", refusal: "Provider 拒绝生成此次解释。", incomplete: "Provider 输出未完成，未展示截断内容。",
  data_permission_unavailable: "输入资料尚无模型外发许可。", invalid_output: "解释未通过结构校验。", unsupported_claim: "解释没有得到所引证据支持。", network_error: "解释暂时无法读取；原行情保持可用。",
};
async function boundedResponse(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error("network_error");
  const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > 32768) throw new Error("invalid_output"); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
/** 父组件只持有一份请求状态；导航、render或行情变化都不触发Provider。 */
export function useInterpretation(symbol: string) {
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error" | "cancelled">("idle");
  const [error, setError] = useState(""), [result, setResult] = useState<InterpretationResult | null>(null);
  const [mode, setMode] = useState("unknown"),[stateSymbol,setStateSymbol]=useState(symbol);
  if(stateSymbol!==symbol){setStateSymbol(symbol);setPhase("idle");setError("");setResult(null);}
  const flight = useRef<AbortController | null>(null), generation = useRef(0), currentSymbol = useRef(symbol);
  useLayoutEffect(() => { currentSymbol.current=symbol;generation.current++; flight.current?.abort(); flight.current = null;
    const requestGeneration=generation;
    return () => { requestGeneration.current++; flight.current?.abort(); flight.current = null; };
  }, [symbol]);
  const cancel = useCallback(() => { generation.current++; flight.current?.abort(); flight.current = null; setPhase("cancelled"); setError("cancelled"); }, []);
  const generate = useCallback(async (scenario = "upward") => {
    if (flight.current) return;
    const controller = new AbortController(), version = ++generation.current, selected = symbol;
    let timedOut=false;
    let rejectCancelled: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => { rejectCancelled = () => reject(new Error("cancelled")); });
    controller.signal.addEventListener("abort", rejectCancelled, { once: true });
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},AI_LIMITS.timeoutMs+1000);
    flight.current = controller; setPhase("loading"); setError("");
    try {
      // 同一个截止时间覆盖读取、按需加载和校验；import无法中断时也立即释放界面。
      const task = (async () => {
      const capability = await boundedResponse(await fetch("/api/interpretation", { signal: controller.signal, cache: "no-store" }));
      if (controller.signal.aborted || version !== generation.current || currentSymbol.current !== selected) throw new Error("cancelled");
      setMode(capability.mode);
      if (capability.mode !== "fixture") throw new Error("provider_not_configured");
      const response = await fetch("/api/interpretation", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: selected, scenario }) });
      const body = await boundedResponse(response);
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "network_error");
      const [{ResultSchema},{validateOutput}]=await Promise.all([import("@/lib/ai/contracts"),import("@/lib/ai/validation")]);
      const next = ResultSchema.parse(body);
      if (next.contextId !== next.context.contextId || next.asOf !== next.context.asOf || next.context.asset.symbol !== selected) throw new Error("invalid_output");
      validateOutput(JSON.stringify(next.output), next.context);
      return next;
      })();
      const next = await Promise.race([task, cancelled]);
      if (!controller.signal.aborted && !timedOut && version === generation.current && currentSymbol.current === selected) { setResult(next); setPhase("ready"); }
    } catch (e) { if (version === generation.current && currentSymbol.current === selected) { setPhase("error"); setError(timedOut?"timeout":e instanceof Error && interpretationErrors[e.message] ? e.message : "network_error"); } }
    finally { clearTimeout(timer); controller.signal.removeEventListener("abort", rejectCancelled); if (version === generation.current) flight.current = null; }
  }, [symbol]);
  return { symbol, phase, error, mode, result: result?.context.asset.symbol === symbol ? result : null, generate, cancel };
}
export type InterpretationController = ReturnType<typeof useInterpretation>;
