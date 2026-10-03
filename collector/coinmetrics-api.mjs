// 官方免密Community产品的固定九月批次；PriceUSD是USD日终参考值，不是交易所K线。
import { createHash } from 'node:crypto';
import { CM_DAILY } from './coinmetrics-source.mjs';

const DAY = 86400000;
export const CM_API_SEP = Object.freeze({
  batch: 'CM-API-SEP2026-002', identity: 'reconstructed',
  from: Date.parse('2026-09-01T00:00:00Z'), cutoff: Date.parse('2026-10-01T00:00:00Z'),
  manifests: Object.freeze(['btc','eth'].map(asset => Object.freeze({ asset, transport: 'community_api' }))),
});
export const CM_API_BYTES = 128 * 1024;
export const CM_API_NOTICE = 'Source data is provided without warranty. UTC dates and PriceUSD are selected from the Coin Metrics Community API; this is not an exchange OHLC series.';
const fail = code => { throw Error(code); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).sort().join(' ') === keys.split(' ').sort().join(' ');
export function coinMetricsApiUrl(manifest) {
  return dailyUrl(manifest, CM_API_SEP.from, CM_API_SEP.cutoff, '100');
}
export function coinMetricsDailyUrl(manifest, from, cutoff) {
  return dailyUrl(manifest, from, cutoff, '1000');
}
function dailyUrl(manifest, from, cutoff, pageSize) {
  if (!exact(manifest, 'asset transport') || !['btc','eth'].includes(manifest.asset) || manifest.transport !== 'community_api') fail('CM_API_MANIFEST');
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(cutoff) || from % DAY || cutoff % DAY ||
      from < Date.parse('2021-10-01T00:00:00Z') || cutoff <= from || cutoff - from > 366 * DAY) fail('CM_API_RANGE');
  const url = new URL('https://community-api.coinmetrics.io/v4/timeseries/asset-metrics');
  url.search = new URLSearchParams({
    assets: manifest.asset, metrics: 'PriceUSD', frequency: '1d',
    start_time: new Date(from).toISOString().replace('.000Z','Z'), end_time: new Date(cutoff).toISOString().replace('.000Z','Z'),
    end_inclusive: 'false', page_size: pageSize, paging_from: 'start',
  }).toString();
  return url.href;
}
/** 有限完整响应；后页不能默默截断为完整月，不跟服务端任意URL。 */
export function parseCoinMetricsApi(bytes, { manifest, from, cutoff, receivedAt, now }) {
  if (from !== CM_API_SEP.from || cutoff !== CM_API_SEP.cutoff) fail('CM_API_RANGE');
  return parseDailyPage(bytes, { manifest, from, cutoff, receivedAt, now }, coinMetricsApiUrl(manifest));
}
export function parseCoinMetricsDailyPage(bytes, options) {
  return parseDailyPage(bytes, options, coinMetricsDailyUrl(options.manifest, options.from, options.cutoff));
}
function parseDailyPage(bytes, { manifest, from, cutoff, receivedAt, now }, sourceUrl) {
  const days = (cutoff - from) / DAY;
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > CM_API_BYTES) fail('CM_API_SIZE');
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(receivedAt) || receivedAt < cutoff || receivedAt > now) fail('CM_API_RANGE');
  let response;
  try { response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('CM_API_JSON'); }
  if (!response || typeof response !== 'object' || Array.isArray(response) ||
      Object.keys(response).some(k => !['data','next_page_token','next_page_url'].includes(k)) ||
      !Array.isArray(response.data) || response.data.length > days) fail('CM_API_SHAPE');
  for (const key of ['next_page_token','next_page_url']) {
    if (Object.hasOwn(response, key) && response[key] !== null && response[key] !== '') fail('CM_API_PAGINATION');
  }
  const points = [], byDate = new Map();
  let previous = -1;
  for (const row of response.data) {
    if (!exact(row, 'asset time PriceUSD') || row.asset !== manifest.asset ||
        typeof row.time !== 'string' || !/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0{1,9})?Z$/.test(row.time)) fail('CM_API_ROW');
    const sourceDate = row.time.slice(0,10), at = Date.parse(sourceDate + 'T00:00:00Z');
    if (!Number.isSafeInteger(at) || new Date(at).toISOString().slice(0,10) !== sourceDate ||
        at < from || at >= cutoff || at + DAY > receivedAt) fail('CM_API_DATE');
    if (at <= previous) fail('CM_API_ORDER');
    previous = at;
    const value = row.PriceUSD;
    if (value !== null && value !== '' && (typeof value !== 'string' || value.length > 80 ||
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0)) fail('CM_API_PRICE');
    byDate.set(at, value);
    if (value !== null && value !== '') points.push({ sourceDate, periodStartAt: at, evidenceEndAt: at + DAY, price: value });
  }
  const missing = [];
  for (let at = from; at < cutoff; at += DAY) {
    if (!byDate.has(at) || byDate.get(at) === null || byDate.get(at) === '') {
      missing.push({ sourceDate: new Date(at).toISOString().slice(0,10), reason: byDate.has(at) ? 'missing_value' : 'missing_date' });
    }
  }
  return {
    format: 'coinmetrics-reference-slice-v1', source: CM_DAILY.source, sourceUrl,
    series: { id: 'crypto:coinmetrics:' + manifest.asset + ':PriceUSD:USD:1d', providerId: manifest.asset,
      market: 'crypto', venue: 'composite_reference', currency: 'USD', metric: 'PriceUSD', frequency: '1d',
      periodConvention: 'utc_date_end', adjustment: 'provider_reference', type: 'reference_price' },
    identity: 'reconstructed', vintage: 'current_vintage',
    attribution: CM_DAILY.attribution, license: CM_DAILY.license, licenseUrl: CM_DAILY.licenseUrl, notice: CM_API_NOTICE,
    provenance: { transport: 'community_api', sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength, receivedAt, sourcePublishedAt: null, publicationPrecision: 'unknown',
      authentication: 'not_proven_by_checksum' },
    range: { from, cutoff },
    coverage: { status: missing.length ? 'partial' : 'date_grid_present', expectedDates: days, presentValues: points.length,
      missing, sourceRows: response.data.length, excludedOutsideRange: 0, excludedIncomplete: 0,
      limitation: 'A present date grid does not prove source accuracy, historical point-in-time availability, or exchange OHLC coverage.' },
    points, analysis: { short90m: 'unsupported_frequency', medium180m: 'unsupported_frequency', forward30m: 'unsupported_frequency' },
  };
}
