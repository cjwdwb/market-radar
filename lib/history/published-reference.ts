// 发布包只承载获准的固定日频事实；复用原来源解析，不建立第二套价格计算。
import { CM_API_SEP, parseCoinMetricsApi } from "../../collector/coinmetrics-api.mjs";
import { canonical, packageDigest } from "./package";
import type { ReferenceCatalog, ReferenceQuery } from "./reference";

export const PUBLIC_REFERENCE_LIMIT = 32 * 1024;
type Source = { asset: "btc" | "eth"; raw: string; receivedAt: number; version: string };
type Publication = { format: "reference-publication-v1"; batch: string; exportedAt: number; sources: Source[]; checksum: string };
export type PublishedReference = { catalog: ReferenceCatalog; slices: Record<string, ReferenceQuery>; checksum: string; exportedAt: number };
const keys = (v: unknown, names: string): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join(" ") === names.split(" ").sort().join(" ");
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const fail = (code: string): never => { throw Error(code); };

/** 显式now仅核取得/导出不是未来；固定历史不套实时freshness或伪装成当时可知。 */
export async function loadPublishedReference(value: unknown, now: number): Promise<PublishedReference> {
  if (!integer(now) || new TextEncoder().encode(canonical(value)).length > PUBLIC_REFERENCE_LIMIT ||
      !keys(value, "format batch exportedAt sources checksum") || value.format !== "reference-publication-v1" ||
      value.batch !== CM_API_SEP.batch || !integer(value.exportedAt) || value.exportedAt < CM_API_SEP.cutoff || value.exportedAt > now ||
      !hash(value.checksum) || !Array.isArray(value.sources) || value.sources.length !== 2) fail("REFERENCE_PUBLICATION_INVALID");
  const p = value as Publication;
  const { checksum, ...body } = p;
  if (await packageDigest(body) !== checksum) fail("REFERENCE_PUBLICATION_CHECKSUM");
  const slices: Record<string, ReferenceQuery> = {}, series: ReferenceCatalog["series"] = [];
  for (let i = 0; i < 2; i++) {
    const source = p.sources[i], manifest = CM_API_SEP.manifests[i];
    if (!keys(source, "asset raw receivedAt version") || source.asset !== manifest.asset || typeof source.raw !== "string" ||
        !integer(source.receivedAt) || source.receivedAt > p.exportedAt || !hash(source.version)) fail("REFERENCE_SOURCE_INVALID");
    const slice = parseCoinMetricsApi(new TextEncoder().encode(source.raw), {
      manifest, from: CM_API_SEP.from, cutoff: CM_API_SEP.cutoff, receivedAt: source.receivedAt, now,
    });
    if (await packageDigest(slice) !== source.version) fail("REFERENCE_ARCHIVE_VERSION");
    const query = { ...slice, version: source.version, queryRange: slice.range, coverageRange: slice.range } as ReferenceQuery;
    slices[source.asset] = query;
    series.push({ asset: source.asset, id: query.series.id, version: query.version, range: query.queryRange,
      count: query.points.length, coverage: query.coverage, receivedAt: query.provenance.receivedAt });
  }
  return { catalog: { format: "reference-catalog-v1", batch: p.batch, identity: "reconstructed", series },
    slices, checksum: p.checksum, exportedAt: p.exportedAt };
}
export function queryPublishedReference(data: PublishedReference, params: { asset: string; from: number; cutoff: number; version: string }): ReferenceQuery {
  const { asset, from, cutoff, version } = params;
  if (!keys(params, "asset from cutoff version") || !["btc","eth"].includes(asset) ||
      !integer(from) || !integer(cutoff) || from % 86400000 || cutoff % 86400000 ||
      from < CM_API_SEP.from || cutoff > CM_API_SEP.cutoff || cutoff <= from || !hash(version)) fail("REFERENCE_QUERY_INVALID");
  const slice = data.slices[asset];
  if (slice.version !== version) fail("REFERENCE_VERSION_CHANGED");
  return structuredClone({ ...slice, queryRange: { from, cutoff },
    points: slice.points.filter(p => p.periodStartAt >= from && p.periodStartAt < cutoff) });
}
