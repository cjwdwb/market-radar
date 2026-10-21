import { buildAssetStateV2 } from "../radar/asset-state-v2";
import { prepareStateInput } from "../radar/asset-state";
import type { RadarSnapshot } from "../radar/types";
import { buildMarketContext } from "./context";
import { AI_VERSIONS, ContextSchema, InterpretationError, factId, type ProviderSafeContext } from "./contracts";
import { REAL_AI } from "./real-config";
import { createHash } from "node:crypto";
import { REAL_CONTEXT_SERIES, type RealContextGrant } from "./real-context-policy";

export type InferenceRights = { source: string; version: string; expiresAt: number; inference: boolean; localInterpretation: boolean; publicDisplay: boolean; kinds: ProviderSafeContext["evidence"][number]["kind"][] };
// 现有公开展示许可不自动授权第三方模型推理；生产实际准入为空。
export const APPROVED_INFERENCE_RIGHTS: readonly InferenceRights[] = Object.freeze([]);
/** 仅从服务端受控loader建立snapshot。不接收浏览器Context，不重建Radar事件会话。 */
export function createControlledSnapshots(load: (symbol: string, signal: AbortSignal) => Promise<RadarSnapshot>, options: { symbols: readonly string[]; rights?: readonly InferenceRights[]; now?: () => number; id?: () => string; directionOnly?: boolean }) {
  const now = options.now ?? Date.now, rights = options.rights ?? APPROVED_INFERENCE_RIGHTS;
  const snapshots = new Map<string, { scope: string; symbol: string; expiresAt: number; rightsVersion: string; context: ProviderSafeContext; input: RadarSnapshot; dependencies: string[] }>();
  const rightsVersion = () => JSON.stringify(rights);
  function checkRights(time: number) { return rights.filter(r => r.inference && r.localInterpretation && r.expiresAt > time); }
  return {
    async create(scope: string, symbol: string, signal: AbortSignal) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(scope) || !options.symbols.includes(symbol)) throw new InterpretationError("invalid_scope");
      if (!checkRights(now()).length) throw new InterpretationError("data_permission_unavailable");
      if (signal.aborted) throw new InterpretationError("cancelled");
      const snapshot = structuredClone(await load(symbol, signal)), time = now();
      if (signal.aborted) throw new InterpretationError("cancelled");
      const q = snapshot.quotes[symbol]; if (!q || q.symbol !== symbol) throw new InterpretationError("asset_mismatch");
      const state = buildAssetStateV2({ symbol, snapshot, now: time, enabled: true, online: true });
      const context = buildMarketContext({ symbol, quote: q, state, now: time, enabled: true, online: true });
      const prepared = prepareStateInput(snapshot, symbol, time);
      const permitted = checkRights(time), evidence = context.evidence.filter(e => {
        if (options.directionOnly && !["short.direction", "short.volatility", "medium.direction", "medium.volatility"].includes(e.id)) return false;
        // An unavailable dimension still needs a truthful sample/freshness explanation. Its
        // source can be "unavailable"; permission is based on the actual selected input dependency.
        const source = options.directionOnly ? snapshot.histories[symbol]?.source ?? q.source : e.source;
        return permitted.some(r => r.source === source && r.kinds.includes(e.kind));
      }).map(e => e.kind === "quote" ? { ...e, availability: prepared.ok ? "available" as const : "partial" as const } : e);
      if (!evidence.some(e => ["direction", "rms"].includes(e.kind) && e.availability === "available")) throw new InterpretationError("insufficient_context");
      const limitations = ["只解释获准事实；没有市场预测或交易建议", "事件快照未纳入（not_included），不能声称没有活跃事件", "未批准字段在模型序列化前排除", "真实分钟历史研究尚未验证", ...(options.directionOnly ? ["Relative、Alignment、Transition未纳入（not_included）；没有取得或外发基准", "官方资料未纳入（not_included），不推断新闻原因", "长期USD日频位置未计算（not_computed）", "仅解释原快照窗口，不跟随之后的行情自动更新"] : []), ...evidence.filter(e => e.availability !== "available").map(e => `${e.id}：${e.detail}`)];
      const body = { ...context, trust: "controlled" as const, evidence, limitations, contextId: `controlled:${factId({ evidence, symbol, time, rights: rightsVersion() })}` };
      const projected: ProviderSafeContext = { ...ContextSchema.parse(body), projectionVersion: AI_VERSIONS.projection };
      // Context的relative transition目前不含benchmark provenance；从原State依赖记录，不能只看UI引用。
      const usesBenchmark = evidence.some(e => e.kind === "relative" || e.id === "short.relative.transition" || e.kind === "alignment" && state.alignment.evaluated.some(p => p.participant === "short.relative"));
      const dependencies = [...new Set([symbol, ...(usesBenchmark && state.relative.benchmarkSymbol ? [state.relative.benchmarkSymbol] : [])])];
      const id = options.id?.() ?? crypto.randomUUID();
      if (snapshots.has(id)) throw new InterpretationError("snapshot_collision");
      const expiresAt = Math.min(time + REAL_AI.cacheTtlMs, ...permitted.map(r => r.expiresAt));
      snapshots.set(id, { scope, symbol, expiresAt, rightsVersion: rightsVersion(), context: projected, input: snapshot, dependencies });
      while (snapshots.size > REAL_AI.cacheEntries) snapshots.delete(snapshots.keys().next().value!);
      return { snapshotId: id, expiresAt, context: structuredClone(projected) };
    },
    get(scope: string, symbol: string, id: string) {
      const value = snapshots.get(id);
      if (!value || value.scope !== scope || value.symbol !== symbol) throw new InterpretationError("snapshot_not_found");
      if (now() >= value.expiresAt || value.rightsVersion !== rightsVersion()) throw new InterpretationError("context_expired");
      if (value.dependencies.some(dependency => !prepareStateInput(value.input, dependency, now()).ok)) throw new InterpretationError("context_expired");
      return structuredClone(value.context);
    },
    clear() { snapshots.clear(); },
  };
}

type SnapshotMetadata = { id: string; capturedAt: number; expiresAt: number; policyVersion: string; authorizationId: string; dataVersion: string; series: typeof REAL_CONTEXT_SERIES };
type AdmissionRecord = Readonly<{ context: ProviderSafeContext; metadata: SnapshotMetadata; scopeHash: string; assertAccess: () => void; assertCurrent: () => void }>;
export type ControlledAdmission = Readonly<{ kind: "registry-admission-v1" }>;
const admissions = new WeakMap<object, AdmissionRecord>();
function freezeAdmissionValue<T>(value: T): T { if (value && typeof value === "object") { for (const child of Object.values(value)) freezeAdmissionValue(child); Object.freeze(value); } return value; }
export function controlledAdmission(value: ControlledAdmission): AdmissionRecord {
  const record = value && admissions.get(value);
  if (!record) throw new InterpretationError("snapshot_admission_invalid");
  record.assertAccess(); return record;
}

/** Private runtime factory only. No client Context/rights/scope can create this capability. */
export function createRealContextSnapshots(load: (symbol: string, signal: AbortSignal) => Promise<RadarSnapshot>, grant: RealContextGrant, options: { now?: () => number; id?: () => string } = {}) {
  const now = options.now ?? Date.now, identity = JSON.stringify(grant);
  if (!grant || !grant.sourceEvidence || !grant.userAuthorizationEvidence || grant.retentionDays !== 30 || grant.approvedAt > now() || grant.revoked) throw new InterpretationError("real_authorization_required");
  // This is a bounded technical review session, not a manufactured source-license expiry.
  const reviewUntil = now() + 20 * 60_000;
  const rights: InferenceRights[] = [{ source: REAL_CONTEXT_SERIES.source, version: grant.policyVersion, expiresAt: reviewUntil, inference: true, localInterpretation: true, publicDisplay: false, kinds: ["direction", "rms"] }];
  const held = new Map<string, { scope: string; symbol: string; admission: ControlledAdmission }>(); let closed = false;
  const assertGrant = () => { if (closed || now() >= reviewUntil || grant.revoked || JSON.stringify(grant) !== identity) throw new InterpretationError("permission_revoked"); };
  const registry = createControlledSnapshots(async (symbol, signal) => {
    assertGrant(); const data = await load(symbol, signal); assertGrant();
    const q = data.quotes[symbol], h = data.histories[symbol];
    if (!q || !h || q.symbol !== "BTC-USDT" || q.source !== REAL_CONTEXT_SERIES.source || h.source !== q.source || q.currency !== "USDT" || h.currency !== "USDT" || q.session !== "open" || q.timezone !== "UTC" || h.intervalMs !== 900000 || Object.keys(data.quotes).some(s => s !== symbol) || Object.keys(data.histories).some(s => s !== symbol)) throw new InterpretationError("source_identity_mismatch");
    return data;
  }, { ...options, symbols: ["BTC-USDT"], rights, directionOnly: true });
  function get(scope: string, symbol: string, id: string) {
    assertGrant(); const entry = held.get(id);
    if (!entry || entry.scope !== scope || entry.symbol !== symbol) throw new InterpretationError("snapshot_not_found");
    return entry.admission;
  }
  return {
    async create(scope: string, symbol: string, signal: AbortSignal) {
      assertGrant(); const snap = await registry.create(scope, symbol, signal); assertGrant();
      const context = freezeAdmissionValue(structuredClone(snap.context)), scopeHash = createHash("sha256").update(scope).digest("hex");
      const metadata = freezeAdmissionValue({ id: snap.snapshotId, capturedAt: context.capturedAt, expiresAt: snap.expiresAt, policyVersion: grant.policyVersion, authorizationId: grant.authorizationId, dataVersion: createHash("sha256").update(JSON.stringify(context)).digest("hex"), series: REAL_CONTEXT_SERIES });
      const admission: ControlledAdmission = Object.freeze({ kind: "registry-admission-v1" });
      admissions.set(admission, Object.freeze({ context, metadata, scopeHash,
        assertAccess: () => { assertGrant(); if (held.get(snap.snapshotId)?.admission !== admission) throw new InterpretationError("snapshot_not_found"); },
        assertCurrent: () => { assertGrant(); registry.get(scope, symbol, snap.snapshotId); },
      }));
      held.set(snap.snapshotId, { scope, symbol, admission });
      while (held.size > REAL_AI.cacheEntries) held.delete(held.keys().next().value!);
      return { snapshotId: snap.snapshotId, expiresAt: snap.expiresAt };
    },
    get(scope: string, symbol: string, id: string) { const a = get(scope, symbol, id); controlledAdmission(a).assertCurrent(); return a; },
    evidence(scope: string, symbol: string, id: string) { const a = get(scope, symbol, id); const r = controlledAdmission(a); return { context: structuredClone(r.context), snapshot: structuredClone(r.metadata), oldSnapshot: (() => { try { r.assertCurrent(); return false; } catch { return true; } })() }; },
    revoke() { closed = true; held.clear(); registry.clear(); },
  };
}
