import { buildAssetStateV2 } from "../radar/asset-state-v2";
import { prepareStateInput } from "../radar/asset-state";
import type { RadarSnapshot } from "../radar/types";
import { buildMarketContext } from "./context";
import { AI_VERSIONS, ContextSchema, InterpretationError, factId, type ProviderSafeContext } from "./contracts";
import { REAL_AI } from "./real-config";

export type InferenceRights = { source: string; version: string; expiresAt: number; inference: boolean; localInterpretation: boolean; publicDisplay: boolean; kinds: ProviderSafeContext["evidence"][number]["kind"][] };
// 现有公开展示许可不自动授权第三方模型推理；生产实际准入为空。
export const APPROVED_INFERENCE_RIGHTS: readonly InferenceRights[] = Object.freeze([]);
/** 仅从服务端受控loader建立snapshot。不接收浏览器Context，不重建Radar事件会话。 */
export function createControlledSnapshots(load: (symbol: string, signal: AbortSignal) => Promise<RadarSnapshot>, options: { symbols: readonly string[]; rights?: readonly InferenceRights[]; now?: () => number; id?: () => string }) {
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
      const permitted = checkRights(time), evidence = context.evidence.filter(e => permitted.some(r => r.source === e.source && r.kinds.includes(e.kind))).map(e => e.kind === "quote" ? { ...e, availability: prepared.ok ? "available" as const : "partial" as const } : e);
      if (!evidence.some(e => ["direction", "rms"].includes(e.kind) && e.availability === "available")) throw new InterpretationError("insufficient_context");
      const limitations = ["只解释获准事实；没有市场预测或交易建议", "事件快照未纳入（not_included），不能声称没有活跃事件", "未批准字段在模型序列化前排除", "真实分钟历史研究尚未验证", ...evidence.filter(e => e.availability !== "available").map(e => `${e.id}：${e.detail}`)];
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
  };
}
