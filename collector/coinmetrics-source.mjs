// Coin Metrics data 仓库的日终参考价格格式。纯离线解析；不授予来源权限，也不启动采集。
import { createHash } from 'node:crypto';

export const CM_DAILY = Object.freeze({
  source: 'coinmetrics:community:PriceUSD:1d:v1',
  metric: 'PriceUSD',
  license: 'CC-BY-NC-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'Data: Coin Metrics',
  notice: 'Source data is provided without warranty. Dates and PriceUSD are selected from the source archive; this is not an exchange OHLC series.',
  limits: Object.freeze({ bytes: 4 * 1024 ** 2, rows: 10000, columns: 256, lineBytes: 16384, days: 31 }),
});
const DAY = 86400000;
const FIRST = Date.parse('2009-01-01T00:00:00Z');
const fail = code => { throw Error(code); };
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const exactKeys = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function utcDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('CM_INVALID_DATE');
  const at = Date.parse(value + 'T00:00:00Z');
  if (!integer(at, FIRST) || new Date(at).toISOString().slice(0, 10) !== value) fail('CM_INVALID_DATE');
  return at;
}
function price(value) {
  if (value === '') return null;
  // 保留原始十进制字符串。有限数校验不把价格改写成浮点或0。
  if (value.length > 80 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ||
      !Number.isFinite(Number(value)) || Number(value) <= 0) fail('CM_INVALID_PRICE');
  return value;
}
export function coinMetricsFile(manifest) {
  if (!exactKeys(manifest, ['asset', 'commit', 'blobSha', 'bytes']) ||
      !['btc', 'eth'].includes(manifest.asset) ||
      typeof manifest.commit !== 'string' || typeof manifest.blobSha !== 'string' ||
      !/^[a-f0-9]{40}$/.test(manifest.commit) || !/^[a-f0-9]{40}$/.test(manifest.blobSha) ||
      !integer(manifest.bytes, 1, CM_DAILY.limits.bytes)) fail('CM_INVALID_MANIFEST');
  return 'https://raw.githubusercontent.com/coinmetrics/data/' + manifest.commit + '/csv/' + manifest.asset + '.csv';
}

/** manifest必须由后续受控采集器提供；校验和仅证明字节完整性，不证明发布者真实性。 */
export function parseCoinMetricsCsv(bytes, options) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > CM_DAILY.limits.bytes ||
      !exactKeys(options, ['manifest', 'from', 'cutoff', 'receivedAt', 'now'])) fail('CM_INVALID_INPUT');
  const { manifest, from, cutoff, receivedAt, now } = options;
  const sourceUrl = coinMetricsFile(manifest);
  if (!integer(now, FIRST) || !integer(receivedAt, FIRST, now) ||
      !integer(from, FIRST, receivedAt - 1) || from % DAY ||
      !integer(cutoff, from + DAY, receivedAt) || cutoff % DAY ||
      cutoff - from > CM_DAILY.limits.days * DAY) fail('CM_INVALID_RANGE');
  if (bytes.byteLength !== manifest.bytes) fail('CM_FILE_SIZE_MISMATCH');
  const blob = createHash('sha1').update('blob ' + bytes.byteLength + '\0').update(bytes).digest('hex');
  if (blob !== manifest.blobSha) fail('CM_BLOB_MISMATCH');

  let csv;
  try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('CM_INVALID_UTF8'); }
  // 官方generate.js产生无引号数字CSV；本协议拒绝未知CSV扩展，避免错列。
  if (/["\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(csv) || csv.includes('\r') && !/^(?:[^\r]*\r\n)*[^\r]*$/.test(csv)) fail('CM_INVALID_CSV');
  const lines = csv.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length < 2 || lines.length - 1 > CM_DAILY.limits.rows) fail('CM_ROW_LIMIT');
  if (lines.some(line => !line || Buffer.byteLength(line) > CM_DAILY.limits.lineBytes)) fail('CM_LINE_LIMIT');
  const header = lines[0].split(',');
  if (header.length < 2 || header.length > CM_DAILY.limits.columns ||
      new Set(header).size !== header.length || header.some(c => !/^[A-Za-z][A-Za-z0-9_]*$/.test(c)) ||
      header[0] !== 'time' || !header.includes(CM_DAILY.metric)) fail('CM_INVALID_COLUMNS');
  const priceIndex = header.indexOf(CM_DAILY.metric);
  let previous = -1, outsideRange = 0, incomplete = 0;
  const byDate = new Map(), points = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    if (cells.length !== header.length || cells.some(c => c.trim() !== c)) fail('CM_INVALID_CSV');
    const at = utcDate(cells[0]);
    if (at <= previous) fail('CM_INVALID_ORDER');
    if (at > Math.floor(receivedAt / DAY) * DAY) fail('CM_FUTURE_DATE');
    previous = at;
    const decimal = price(cells[priceIndex]);
    // 日频PriceUSD的日期是观测日，证据截止为次日UTC零点，绝不按日初回放。
    const evidenceEndAt = at + DAY;
    if (evidenceEndAt > receivedAt) { incomplete++; continue; }
    if (at < from || at >= cutoff) { outsideRange++; continue; }
    byDate.set(at, decimal);
    if (decimal !== null) points.push({
      sourceDate: cells[0], periodStartAt: at, evidenceEndAt, price: decimal,
    });
  }
  const missing = [];
  for (let at = from; at < cutoff; at += DAY) {
    if (!byDate.has(at) || byDate.get(at) === null) missing.push({
      sourceDate: new Date(at).toISOString().slice(0, 10),
      reason: byDate.has(at) ? 'missing_value' : 'missing_date',
    });
  }
  return {
    format: 'coinmetrics-reference-slice-v1',
    source: CM_DAILY.source, sourceUrl,
    series: {
      id: 'crypto:coinmetrics:' + manifest.asset + ':PriceUSD:USD:1d',
      providerId: manifest.asset, market: 'crypto', venue: 'composite_reference',
      currency: 'USD', metric: CM_DAILY.metric, frequency: '1d',
      periodConvention: 'utc_date_end', adjustment: 'provider_reference',
      type: 'reference_price',
    },
    identity: 'reconstructed', vintage: 'current_vintage',
    attribution: CM_DAILY.attribution, license: CM_DAILY.license, licenseUrl: CM_DAILY.licenseUrl,
    notice: CM_DAILY.notice,
    provenance: {
      commit: manifest.commit, blobSha: blob, sha256: sha(bytes), bytes: bytes.byteLength,
      receivedAt, sourcePublishedAt: null, publicationPrecision: 'unknown',
      authentication: 'not_proven_by_checksum',
    },
    range: { from, cutoff },
    coverage: {
      status: missing.length ? 'partial' : 'date_grid_present',
      expectedDates: (cutoff - from) / DAY, presentValues: points.length,
      missing, sourceRows: lines.length - 1, excludedOutsideRange: outsideRange, excludedIncomplete: incomplete,
      limitation: 'A present date grid does not prove source accuracy, historical point-in-time availability, or exchange OHLC coverage.',
    },
    points,
    analysis: { short90m: 'unsupported_frequency', medium180m: 'unsupported_frequency', forward30m: 'unsupported_frequency' },
  };
}

