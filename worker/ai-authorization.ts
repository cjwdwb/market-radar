import { z } from "zod";

/** Sites 边缘验证的身份 + 服务端授权。共享访问码本身不授予 AI 权限。
 * 尚未接入公开路由；只有经过 Sites 身份头清洗/注入的入口才能调用此边界。
 */
export type AIPermission = "invoke" | "read" | "manage";
export type AIGrant = {
  siteId: string; subjectId: string; revision: number; enabled: boolean; expiresAt: number;
  permissions: readonly AIPermission[]; symbols: readonly string[];
};
export type AIGrantReader = { get(siteId: string, subjectId: string): Promise<AIGrant | null> };
export type AIAccessConfig = { siteId: string; origin: string; symbols: readonly string[] };
export type AIPrincipal = Readonly<{
  siteId: string; subjectId: string; grantRevision: number; scope: string; expiresAt: number;
}>;
export type AIOwnedRecord = {
  siteId: string; subjectId: string; grantRevision: number; scope: string;
  symbol: string; expiresAt: number;
};

export class AIAccessError extends Error {
  code: string;
  constructor(code: string) { super(code); this.name = "AIAccessError"; this.code = code; }
}
function deny(code: string): never { throw new AIAccessError(code); }
const identity = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const symbolSchema = z.string().min(1).max(80).regex(/^[A-Za-z0-9^._:/-]+$/);
const recordId = z.string().min(16).max(160).regex(/^[A-Za-z0-9_-]+$/);
const CommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("snapshot"), symbol: symbolSchema }).strict(),
  z.object({ action: z.literal("interpret"), symbol: symbolSchema, snapshotId: recordId }).strict(),
  z.object({ action: z.literal("cancel"), symbol: symbolSchema, requestId: recordId }).strict(),
  z.object({ action: z.literal("disable") }).strict(),
]);
export type AICommand = z.infer<typeof CommandSchema>;
const BODY_LIMIT = 4096;

function validateTarget(request: Request, config: AIAccessConfig) {
  let origin: URL, url: URL;
  try { origin = new URL(config.origin); url = new URL(request.url); } catch { return deny("access_configuration"); }
  if (!identity(config.siteId) || origin.protocol !== "https:" || origin.origin !== config.origin ||
      !Array.isArray(config.symbols) || config.symbols.length > 16 || config.symbols.some(s => !symbolSchema.safeParse(s).success)) deny("access_configuration");
  if (url.origin !== config.origin || (request.headers.has("host") && request.headers.get("host") !== origin.host)) deny("invalid_host");
  if (request.headers.get("sec-fetch-site") === "cross-site") deny("invalid_origin");
  if (request.method !== "GET" && request.method !== "POST") deny("invalid_method");
  if (request.method === "POST") {
    if (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site") deny("invalid_origin");
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") deny("invalid_content_type");
  } else if (request.headers.has("origin") && request.headers.get("origin") !== config.origin) deny("invalid_origin");
}

/** 每次操作重新查授权；调用方不得用旧 Principal 缓存代替本函数。 */
export async function authorizeAI(request: Request, permission: AIPermission, symbol: string | null,
  reader: AIGrantReader, config: AIAccessConfig, now: number): Promise<AIPrincipal & Readonly<{ canInvoke: boolean }>> {
  validateTarget(request, config);
  if (!Number.isSafeInteger(now) || now <= 0 || !["invoke", "read", "manage"].includes(permission)) deny("access_configuration");
  if (permission === "invoke" && request.method !== "POST") deny("invalid_method");
  const subjectId = request.headers.get("oai-authenticated-user-id");
  if (!identity(subjectId)) deny("authentication_required");
  if (permission !== "manage" && (symbol === null || !config.symbols.includes(symbol))) deny("unsupported_asset");
  let grant: AIGrant | null;
  try { grant = await reader.get(config.siteId, subjectId!); } catch { return deny("authorization_unavailable"); }
  if (!grant || grant.siteId !== config.siteId || grant.subjectId !== subjectId || grant.enabled !== true ||
      !Number.isSafeInteger(grant.revision) || grant.revision < 1 || !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt <= now ||
      !Array.isArray(grant.permissions) || !grant.permissions.every(p => ["invoke", "read", "manage"].includes(p)) ||
      !grant.permissions.includes(permission) || !Array.isArray(grant.symbols) || grant.symbols.length > 16 ||
      grant.symbols.some(s => !symbolSchema.safeParse(s).success) ||
      (symbol !== null && (!config.symbols.includes(symbol) || !grant.symbols.includes(symbol)))) deny("access_denied");
  const { siteId, subjectId: authorizedSubject, revision: grantRevision, expiresAt } = grant;
  const canInvoke = grant.permissions.includes("invoke");
  const bytes = new TextEncoder().encode(JSON.stringify(["ai-scope-v1", siteId, authorizedSubject, grantRevision]));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const scope = Array.from(digest, n => n.toString(16).padStart(2, "0")).join("");
  return Object.freeze({ siteId, subjectId: authorizedSubject, grantRevision, scope, expiresAt, canInvoke });
}

/** record 必须来自受控存储；ID 不可猜测不等于拥有读取权限。 */
export async function authorizeAIRecord(request: Request, record: AIOwnedRecord, reader: AIGrantReader,
  config: AIAccessConfig, now: number): Promise<AIPrincipal> {
  const principal = await authorizeAI(request, "read", record.symbol, reader, config, now);
  if (record.siteId !== principal.siteId || record.subjectId !== principal.subjectId ||
      record.grantRevision !== principal.grantRevision || record.scope !== principal.scope ||
      !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= now) deny("record_unavailable");
  return principal;
}

/** 供真实服务在等待预算/模型后重验。这里只收紧访问权限，不批准来源或生成可信金融事实。
 * record 是服务端持有的访问记录；expiresAt 是其访问截止，快照数据时效由 registry 另外核对。
 * 不保存请求正文/Cookie，不把回调或客户端参数当成授权记录。
 */
export function createAIRevalidation(request: Request, record: AIOwnedRecord, reader: AIGrantReader,
  config: AIAccessConfig, now: () => number = Date.now) {
  const owned = Object.freeze({ ...record });
  // 冻结入口身份与来源信息；等待期间修改原 Request.headers 不能切换调用者。
  const checkedRequest = new Request(request.url, { method: request.method, headers: request.headers });
  checkedRequest.headers.delete("cookie");
  checkedRequest.headers.delete("authorization");
  return async (phase: "dispatch" | "read" | "capability") => {
    if (phase !== "dispatch" && phase !== "read" && !(phase === "capability" && checkedRequest.method === "GET")) deny("access_configuration");
    const principal = await authorizeAI(checkedRequest, phase === "dispatch" ? "invoke" : "read", owned.symbol, reader, config, now());
    const after = now();
    validateTarget(checkedRequest, config);
    if (!config.symbols.includes(owned.symbol)) deny("unsupported_asset");
    // 查库与摘要计算都可能等待；不能用等待之前的时钟宣称授权仍有效。
    if (!Number.isSafeInteger(after) || after <= 0 || after >= principal.expiresAt ||
        !Number.isSafeInteger(owned.expiresAt) || after >= owned.expiresAt ||
        owned.siteId !== principal.siteId || owned.subjectId !== principal.subjectId ||
        owned.grantRevision !== principal.grantRevision || owned.scope !== principal.scope) deny("record_unavailable");
    // A capability GET describes the same grant that passed this final read check.
    // It never authorizes a dispatch: the POST must still pass invoke independently.
    if (phase === "capability" && !principal.canInvoke) deny("read_only");
  };
}

/** 只解析有界的操作参数。scope/模型/事实/权限/预算等未知字段一律拒绝。 */
export async function readAICommand(request: Request, config: AIAccessConfig): Promise<AICommand> {
  validateTarget(request, config);
  if (request.method !== "POST") deny("invalid_method");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT)) deny("input_limit");
  const reader = request.body?.getReader();
  if (!reader) deny("invalid_request");
  let total = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      if (request.signal.aborted) deny("cancelled");
      const { done, value } = await reader!.read(); if (done) break;
      total += value.byteLength; if (total > BODY_LIMIT) deny("input_limit");
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed = CommandSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!parsed.success) deny("invalid_request");
    return parsed.data!;
  } catch (error) { if (error instanceof AIAccessError) throw error; return deny("invalid_request"); }
  finally { await reader!.cancel().catch(() => {}); }
}
