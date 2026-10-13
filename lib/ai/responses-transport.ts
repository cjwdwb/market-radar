import { InterpretationError } from "./contracts";
import { REAL_AI } from "./real-config";

/** 两个固定适配器共用有界HTTP读取；无重试、重定向、错误正文透传。 */
export async function requestResponseJson(endpoint: string, key: string, body: string, signal: AbortSignal, transport: typeof fetch): Promise<unknown> {
  if (signal.aborted) throw new InterpretationError("cancelled");
  let response: Response;
  try { response = await transport(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal, redirect: "error" }); }
  catch { throw new InterpretationError(signal.aborted ? "cancelled" : "transport_error"); }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new InterpretationError(response.status === 429 ? "rate_limited" : response.status === 402 ? "provider_credit_unavailable" : response.status === 401 || response.status === 403 ? "provider_access_denied" : "provider_http_error");
  }
  const reader = response.body?.getReader(); if (!reader) throw new InterpretationError("invalid_response");
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > REAL_AI.responseBytes) throw new InterpretationError("response_limit"); chunks.push(value); } }
  catch (e) { throw e instanceof InterpretationError ? e : new InterpretationError(signal.aborted ? "cancelled" : "transport_error"); }
  finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new InterpretationError("invalid_response"); }
}
