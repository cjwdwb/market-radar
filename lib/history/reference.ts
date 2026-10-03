// 与受控本地reference查询一致；这里不计算价格、状态或研究结论。
export type ReferenceCoverage = {
  status: "partial" | "date_grid_present"; expectedDates: number; presentValues: number;
  missing: { sourceDate: string; reason: "missing_value" | "missing_date" }[];
};
export type ReferenceCatalog = {
  format: "reference-catalog-v1"; batch: string; identity: "fixture" | "reconstructed";
  series: { asset: "btc" | "eth"; id: string; version: string; range: { from: number; cutoff: number }; count: number; coverage: ReferenceCoverage; receivedAt: number }[];
};
export type ReferenceQuery = {
  format: "coinmetrics-reference-slice-v1"; identity: "fixture" | "reconstructed"; vintage: "current_vintage";
  series: { id: string; providerId: "btc" | "eth"; currency: "USD"; type: "reference_price"; frequency: "1d" };
  derivation?: { method: "offline_reextract"; derivedAt: number; parentBatch: string; parentSnapshot: string; parentVersion: string };
  version: string; queryRange: { from: number; cutoff: number }; coverageRange: { from: number; cutoff: number };
  coverage: ReferenceCoverage; provenance: { receivedAt: number; commit: string; sha256: string };
  points: { sourceDate: string; periodStartAt: number; evidenceEndAt: number; price: string }[];
};