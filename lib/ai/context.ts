import { assetFor, type Quote } from "../market";
import type { AssetStateV2 } from "../radar/asset-state-v2";
import type { AssetIntelligenceContext } from "../radar/types";
import { officialSource, type OfficialView } from "../information/official.mjs";
import { ContextSchema, InterpretationError, boundedJson, factId, AI_VERSIONS, type Evidence, type MarketIntelligenceContext, type ProviderSafeContext } from "./contracts";

type InformationFact = { id: string; symbol: string; title: string; source: string; publishedAt: number; receivedAt: number; version: string };
/** 仅适配已有审核视图；项目更新不升级为财报、新闻原因或价格信号。 */
export function loadedInformationFacts(view:OfficialView|null,symbol:string):InformationFact[]{
  return view?.sources.flatMap(s=>{const source=officialSource(s.sourceId);return source?.symbols.includes(symbol)?s.records.map(r=>({id:`${s.sourceId}.${r.fact.id}`,symbol,title:`${source.name} · ${r.fact.tag}（项目/产品版本，不是财报或价格原因）`,source:s.sourceId,publishedAt:r.fact.publishedAt,receivedAt:r.firstSavedAt,version:`${view.viewId}:${r.version}:${r.contentHash}`})):[];})??[];
}
export type ContextInput = { symbol: string; quote?: Quote; state: AssetStateV2; radar?: AssetIntelligenceContext; now: number; online: boolean; enabled: boolean; information?: InformationFact[] };
/** 只组织共享派生事实；不检测Signal、不重新计算指标、不读取个人偏好或网络。 */
export function buildMarketContext(input: ContextInput): MarketIntelligenceContext {
  const { symbol, state, quote, radar, now } = input;
  if (state.symbol !== symbol || quote && quote.symbol !== symbol || radar && radar.symbol !== symbol) throw new InterpretationError("asset_mismatch");
  const asset = assetFor(symbol), currency = quote?.currency ?? (asset.market === "crypto" ? "USDT" : asset.market === "hk" ? "HKD" : asset.market === "cn" ? "CNY" : "USD");
  const evidence: Evidence[] = [], limitations = ["解释只描述已发生的窗口，不是交易建议或未来预测", "真实分钟历史研究尚未验证，不能提供历史胜率或相似样本结论", "长期USD日频位置未计算，不与即时USDT价格直接比较"];
  const inactive:Evidence["availability"]|null=!input.online?"offline":!input.enabled?"paused":state.calculatedAt!==now?"stale":null;
  const add = (value: Omit<Evidence, "symbol" | "currency" | "dataVersion" | "ruleVersion"> & Partial<Pick<Evidence, "dataVersion" | "ruleVersion">>) => {
    const financial=["direction","rms","relative","alignment","transition","signal"].includes(value.kind);
    const normalized=inactive&&financial?{...value,availability:inactive,classification:null,detail:`${inactive}；保留原依据供核对，不作为当前有效判断。${value.detail}`} : value;
    const e = { symbol, currency, ruleVersion: state.ruleVersion, dataVersion: factId(normalized), ...normalized }; evidence.push(e);
    if (e.availability !== "available") limitations.push(`${e.id}：${e.detail}`);
  };
  if (quote && Number.isFinite(quote.price) && quote.price > 0) add({ id: "quote", kind: "quote", source: quote.source, startAt: quote.timestamp, endAt: quote.timestamp,
    availability: !input.online ? "offline" : !input.enabled ? "paused" : radar?.freshness.state === "stale"?"stale":radar?.freshness.state === "current" ? "available" : "partial", classification: null, metrics: [{ id: "price", value: quote.price, unit: currency }], detail: "报价时间与抓取时间独立；不是历史在线观察证明", provenance:{quoteAt:quote.timestamp,fetchedAt:quote.fetchedAt} });
  for (const key of ["short", "medium"] as const) {
    const h = state.horizons[key], end = h.evidence?.closeEndAt ?? now, start = h.evidence?.closeStartAt ?? end;
    for (const dimension of ["direction", "volatility"] as const) {
      const d = h[dimension], metrics = Object.entries(d.metrics ?? {}).filter(([, value]) => typeof value === "number" && Number.isFinite(value)).map(([id, value]) => ({ id, value: value as number, unit: id === "path" ? currency : id.includes("Percent") ? "%" : id.endsWith("At") ? "UTC_ms" : "ratio" }));
      const e=h.evidence;
      add({ id: `${key}.${dimension}`, kind: dimension === "direction" ? "direction" : "rms", source: e?.source ?? "unavailable", startAt: start, endAt: end, availability: d.availability, classification: d.classification, metrics, detail: d.message,
        provenance:e?{methodId:d.methodId,configId:e.configId,quoteAt:e.quoteAt,fetchedAt:e.quoteFetchedAt,historyFetchedAt:e.historyFetchedAt,intervalMs:e.intervalMs,pointCount:e.pointCount,returnCount:e.returnCount,currentStartAt:e.currentStartAt,baselineStartAt:e.baselineStartAt,baselineEndAt:e.baselineEndAt}:undefined });
    }
  }
  const rel = state.relative;
  add({ id: "short.relative", kind: "relative", source: rel.evidence?.asset.source ?? "unavailable", startAt: rel.evidence?.closeStartAt ?? now, endAt: rel.evidence?.closeEndAt ?? now,
    availability: rel.availability, classification: rel.classification, metrics: Object.entries(rel.metrics ?? {}).filter(([, v]) => typeof v === "number").map(([id, value]) => ({ id, value: value as number, unit: id.includes("Points") ? "percentage_points" : "%" })), detail: rel.message,
    provenance:rel.evidence?{methodId:rel.methodId,configId:rel.configId,intervalMs:rel.evidence.intervalMs,pointCount:rel.evidence.pointCount,returnCount:rel.evidence.returnCount,quoteAt:rel.evidence.asset.quoteAt,fetchedAt:rel.evidence.asset.quoteFetchedAt,historyFetchedAt:rel.evidence.asset.historyFetchedAt,benchmark:{symbol:rel.evidence.benchmarkSymbol,source:rel.evidence.benchmark.source,currency:rel.evidence.benchmark.currency,quoteAt:rel.evidence.benchmark.quoteAt,fetchedAt:rel.evidence.benchmark.quoteFetchedAt,evidenceEndAt:rel.evidence.benchmark.latestEndAt}}:undefined });
  const alignment = state.alignment;
  add({ id: "alignment", kind: "alignment", source: "state-derived", startAt: alignment.closeEndAt ?? now, endAt: alignment.closeEndAt ?? now, availability: alignment.classification === "insufficient" ? "insufficient" : "available", classification: alignment.classification, metrics: [], detail: alignment.message });
  for (const [horizon, entries] of Object.entries(state.transitions)) for (const [dimension, t] of Object.entries(entries)) add({ id: `${horizon}.${dimension}.transition`, kind: "transition", source: t.current?.source ?? "unavailable", startAt: t.previousWindow?.observation.closeStartAt ?? now, endAt: t.currentWindow?.observation.closeEndAt ?? now, availability: t.availability, classification: t.status, metrics: [], detail: t.message });
  const active = radar?.activeEvents.filter(e => e.symbol === symbol && e.status === "active") ?? [];
  for (const event of active.slice(0, 3)) add({ id: `signal.${event.id}`, kind: "signal", source: event.signals[0]?.source ?? "unavailable", startAt: event.detectedAt, endAt: event.updatedAt, availability: "available", classification: event.direction, metrics: [], detail: `${event.title}；${event.metric}；事件可信度 ${event.confidence.level}（不是整体解释的可信度）`,provenance:{confidence:event.confidence.level,signalIds:event.signals.map(s=>s.id).slice(0,8)} });
  if (!radar) limitations.push("事件快照未纳入（not_included）；不能据此声称没有活跃事件");
  else if (!active.length) limitations.push("当前上下文没有活跃事件；不代表平静、低风险或没有方向结构");
  const information = (input.information ?? []).filter(f => f.symbol === symbol);
  for (const f of information.slice(0, 3)) add({ id: `information.${f.id}`, kind: "information", source: f.source, startAt: f.publishedAt, endAt: f.publishedAt, availability: "available", classification: "official_product_fact", metrics: [{ id: "receivedAt", value: f.receivedAt, unit: "UTC_ms" }], detail: f.title, dataVersion: f.version });
  if (!information.length) limitations.push("本上下文未加载相关官方资料，不代表近期没有重要事件");
  add({ id: "history.minute", kind: "history", source: "data-track", startAt: now, endAt: now, availability: "unsupported", classification: null, metrics: [], detail: "real_minute_research_not_verified" });
  const clipped = Math.max(0, active.length - 3) + Math.max(0, information.length - 3);
  if (clipped) limitations.push(`上下文有界裁剪${clipped}条事件/资料；完整覆盖与关联仍未证明`);
  const body = { schemaVersion: AI_VERSIONS.context, capturedAt: now, asOf: now, asset: { symbol, market: asset.market, currency }, trust: "client_declared" as const, ruleVersion: state.ruleVersion, evidence, limitations: [...new Set(limitations)], clipped, minuteHistoricalResearch: { availability: "unsupported" as const, reason: "real_minute_research_not_verified" as const }, dailyPosition: "not_computed" as const };
  const result = ContextSchema.parse({ ...body, contextId: `context:${factId(body)}` }); boundedJson(result); return result;
}

/** 权限来自闭合profile，不接受调用者的allowed/config。真实数据外发路径保持关闭。 */
export function projectProviderContext(context: MarketIntelligenceContext): ProviderSafeContext {
  const parsed = ContextSchema.parse(context);
  if (new Set(parsed.evidence.map(e=>e.id)).size!==parsed.evidence.length || parsed.evidence.some(e=>new Set(e.metrics.map(m=>m.id)).size!==e.metrics.length)) throw new InterpretationError("duplicate_evidence");
  if (parsed.trust !== "fixture" || parsed.evidence.some(e => !e.source.startsWith("fixture:") || e.symbol !== parsed.asset.symbol || e.currency !== parsed.asset.currency || e.endAt < e.startAt || e.endAt > parsed.asOf)) throw new InterpretationError("data_permission_unavailable");
  const value = { ...parsed, projectionVersion: AI_VERSIONS.projection as typeof AI_VERSIONS.projection }; boundedJson(value); return value;
}
