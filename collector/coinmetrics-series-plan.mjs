// 只含冻结常量；供本地SQLite与发布包校验共用，不引入存储或网络能力。
import { CM_API_BYTES } from './coinmetrics-api.mjs';
export const DAILY_MS = 86400000;
const at = s => Date.parse(s + 'T00:00:00Z');
export const CM_LONG_PLAN = Object.freeze({
  batch:'CM-LONG-20261003-001', policy:'cm-community-nc-daily-v2', identity:'reconstructed',
  from:at('2021-10-01'), cutoff:at('2026-10-03'), assets:['btc','eth'],
  maxRequests:20, requestBytes:CM_API_BYTES, requestMs:30000, spacingMs:1000,
});
export const CM_LONG_BATCHES = Object.freeze([
  ...[2021,2022,2023,2024,2025,2026].map(year=>({
    id:'BACKFILL-'+year, action:'backfill', from:at(year===2021?'2021-10-01':year+'-01-01'),
    cutoff:at(year===2026?'2026-10-02':(year+1)+'-01-01'),
  })),
  {id:'INCREMENTAL-20261003',action:'incremental',from:at('2026-09-30'),cutoff:at('2026-10-03')},
  ...[1,2].map(i=>({id:'REVISION-0'+i,action:'revision',from:at('2026-09-30'),cutoff:at('2026-10-03')})),
].map(batch => Object.freeze(batch)));
