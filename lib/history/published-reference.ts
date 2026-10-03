// 发布包只承载获准的固定日频事实；复用原来源解析，不建立第二套价格计算。
import { CM_API_SEP, CM_API_NOTICE, parseCoinMetricsApi, parseCoinMetricsDailyPage } from "../../collector/coinmetrics-api.mjs";
import { CM_LONG_PLAN, CM_LONG_BATCHES, DAILY_MS as DAY } from "../../collector/coinmetrics-series-plan.mjs";
import { CM_DAILY } from "../../collector/coinmetrics-source.mjs";
import { canonical, packageDigest } from "./package";
import type { ReferenceCatalog, ReferenceQuery, ReferenceCoverage } from "./reference";

export const PUBLIC_REFERENCE_LIMIT = 32 * 1024;
export const PUBLIC_LONG_REFERENCE_LIMIT = 512 * 1024;
type Source = { asset: "btc" | "eth"; raw: string; receivedAt: number; version: string };
type Publication = { format: "reference-publication-v1"; batch: string; exportedAt: number; sources: Source[]; checksum: string };
type DayValue = { price: string | null; reason: "missing_date" | "missing_value" | null; firstReceivedAt: number; versionReceivedAt: number; sourceVersion: string };
export type PublishedReference = { catalog: ReferenceCatalog; slices: Record<string, ReferenceQuery>; checksum: string; exportedAt: number; daily?: Record<string, Map<number, DayValue>> };
const keys = (v: unknown, names: string): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join(" ") === names.split(" ").sort().join(" ");
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
function fail(code: string): never { throw Error(code); }

/** 显式now仅核取得/导出不是未来；固定历史不套实时freshness或伪装成当时可知。 */
export async function loadPublishedReference(value: unknown, now: number): Promise<PublishedReference> {
  if (value && typeof value === "object" && "format" in value && value.format === "reference-publication-v2") return loadLongReference(value, now);
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
      from < data.catalog.series[0].range.from || cutoff > data.catalog.series[0].range.cutoff || cutoff <= from || !hash(version)) fail("REFERENCE_QUERY_INVALID");
  const slice = data.slices[asset];
  if (slice.version !== version) fail("REFERENCE_VERSION_CHANGED");
  if (data.daily) {
    const end = Math.min(cutoff, from + 31 * DAY);
    return structuredClone({ ...slice, queryRange: { from, cutoff }, coverageRange: { from, cutoff:end },
      page: { from, cutoff:end, nextFrom:end < cutoff ? end : null }, coverage: dayCoverage(data.daily[asset], from, end),
      points: slice.points.filter(p => p.periodStartAt >= from && p.periodStartAt < end) });
  }
  return structuredClone({ ...slice, queryRange: { from, cutoff },
    points: slice.points.filter(p => p.periodStartAt >= from && p.periodStartAt < cutoff) });
}

function dayCoverage(rows: Map<number, DayValue>, from: number, cutoff: number): ReferenceCoverage {
  const missing: ReferenceCoverage["missing"] = []; let count=0, gap=0, uncollected=0;
  for(let at=from;at<cutoff;at+=DAY){const r=rows.get(at);if(r?.price!==null&&r?.price!==undefined){count++;continue;}
    if(r)gap++;else uncollected++;if(missing.length<31)missing.push({sourceDate:new Date(at).toISOString().slice(0,10),reason:r?.reason??"not_backfilled"});}
  return {status:count===(cutoff-from)/DAY?"date_grid_present":"partial",expectedDates:(cutoff-from)/DAY,presentValues:count,missing,
    missingCount:gap+uncollected,gapCount:gap,notBackfilledCount:uncollected,missingTruncated:gap+uncollected>missing.length};
}

/** 构建输入保留有界原响应链；Worker仅准备一次，HTTP只送目录/一页，不接SQLite。 */
async function loadLongReference(value: unknown, now: number): Promise<PublishedReference> {
  if (!integer(now) || new TextEncoder().encode(canonical(value)).length>PUBLIC_LONG_REFERENCE_LIMIT ||
      !keys(value,"format batch exportedAt version sources checksum") || value.format!=="reference-publication-v2" ||
      value.batch!==CM_LONG_PLAN.batch || !integer(value.exportedAt) || value.exportedAt<CM_LONG_PLAN.cutoff || value.exportedAt>now ||
      !hash(value.version) || !hash(value.checksum) || !Array.isArray(value.sources) || ![14,16,18].includes(value.sources.length)) fail("REFERENCE_PUBLICATION_INVALID");
  const {checksum,...body}=value;if(await packageDigest(body)!==checksum)fail("REFERENCE_PUBLICATION_CHECKSUM");
  const daily: Record<string,Map<number,DayValue>>={btc:new Map(),eth:new Map()}, evidence: {revision:number;sha:string;received_at:number}[]=[];
  const expected=CM_LONG_BATCHES.flatMap(batch=>CM_LONG_PLAN.assets.map(asset=>({batch,asset}))), received: Record<string,number>={};
  let previousRevision=0, previousReceipt=0;
  for(let i=0;i<value.sources.length;i++){
    const source=value.sources[i], {asset,batch}=expected[i];
    if(!keys(source,"asset batch revision raw receivedAt") || source.asset!==asset || source.batch!==batch.id || typeof source.raw!=="string" ||
       !integer(source.revision) || source.revision<=previousRevision || source.revision>CM_LONG_PLAN.maxRequests ||
       !integer(source.receivedAt) || source.receivedAt<previousReceipt || source.receivedAt>value.exportedAt)fail("REFERENCE_SOURCE_INVALID");
    const slice=parseCoinMetricsDailyPage(new TextEncoder().encode(source.raw),{manifest:{asset,transport:"community_api"},from:batch.from,cutoff:batch.cutoff,receivedAt:source.receivedAt,now});
    const byDate=new Map<number,{price:string|null;reason:DayValue["reason"]}>();
    for(const p of slice.points)byDate.set(p.periodStartAt,{price:p.price,reason:null});
    for(const m of slice.coverage.missing)byDate.set(Date.parse(m.sourceDate+"T00:00:00Z"),{price:null,reason:m.reason as DayValue["reason"]});
    for(const [at,record] of byDate){const old=daily[asset].get(at);if(old&&old.price===record.price&&old.reason===record.reason)continue;
      daily[asset].set(at,{...record,firstReceivedAt:old?.firstReceivedAt??source.receivedAt,versionReceivedAt:source.receivedAt,sourceVersion:slice.provenance.sha256});}
    evidence.push({revision:source.revision,sha:slice.provenance.sha256,received_at:source.receivedAt});received[asset]=source.receivedAt;
    previousRevision=source.revision;previousReceipt=source.receivedAt;
  }
  if(await packageDigest({plan:CM_LONG_PLAN,responses:evidence})!==value.version)fail("REFERENCE_ARCHIVE_VERSION");
  const slices: Record<string,ReferenceQuery>={},series: ReferenceCatalog["series"]=[];
  const provenance={transport:"community_api" as const,receivedAt:previousReceipt,sha256:await packageDigest(evidence),responseDigests:evidence.map(r=>r.sha)};
  for(const asset of ["btc","eth"] as const){
    const range={from:CM_LONG_PLAN.from,cutoff:CM_LONG_PLAN.cutoff}, coverage=dayCoverage(daily[asset],range.from,range.cutoff);
    const points=[...daily[asset]].sort((a,b)=>a[0]-b[0]).flatMap(([at,r])=>r.price===null?[]:[{sourceDate:new Date(at).toISOString().slice(0,10),periodStartAt:at,evidenceEndAt:at+DAY,price:r.price,firstReceivedAt:r.firstReceivedAt,versionReceivedAt:r.versionReceivedAt,sourceVersion:r.sourceVersion}]);
    slices[asset]={format:"coinmetrics-reference-slice-v1",identity:"reconstructed",vintage:"current_vintage",source:CM_DAILY.source,
      series:{id:"crypto:coinmetrics:"+asset+":PriceUSD:USD:1d",providerId:asset,currency:"USD",type:"reference_price",frequency:"1d"},
      version:value.version,queryRange:range,coverageRange:range,coverage,provenance,points,
      attribution:CM_DAILY.attribution,license:CM_DAILY.license,licenseUrl:CM_DAILY.licenseUrl,notice:CM_API_NOTICE,
      analysis:{short90m:"unsupported_frequency",medium180m:"unsupported_frequency",forward30m:"unsupported_frequency"}} as ReferenceQuery;
    series.push({asset,id:slices[asset].series.id,version:value.version,range,count:points.length,coverage,receivedAt:received[asset]});
  }
  return {catalog:{format:"reference-catalog-v1",batch:value.batch,identity:"reconstructed",series},slices,daily,checksum:value.checksum,exportedAt:value.exportedAt};
}
