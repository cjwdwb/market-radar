// 全部CSV为本测试生成的模拟输入；不作为Coin Metrics实际取得/覆盖证据。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseCoinMetricsCsv, coinMetricsFile, CM_DAILY } from '../collector/coinmetrics-source.mjs';

const DAY = 86400000, FROM = Date.parse('2026-09-01T00:00:00Z'), NOW = Date.parse('2026-10-03T02:00:00Z');
const commit = 'a'.repeat(40);
const blobSha = b => createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
function sample(text = 'time,PriceUSD,Other\n2026-09-01,100.012345678901234567,1\n2026-09-02,101.0,\n', change = {}) {
  const bytes = Buffer.isBuffer(text) ? text : Buffer.from(text);
  return { bytes, options: { manifest: { asset: 'btc', commit, blobSha: blobSha(bytes), bytes: bytes.length },
    from: FROM, cutoff: FROM + 2 * DAY, receivedAt: NOW - 1000, now: NOW, ...change } };
}
const parse = s => parseCoinMetricsCsv(s.bytes, s.options);
test('日终时间、原始精度、身份和许可保留；无OHLC或分钟研究伪能力', () => {
  const s = sample(), before = structuredClone(s), v = parse(s);
  assert.equal(v.points[0].price, '100.012345678901234567');
  assert.equal(v.points[0].evidenceEndAt, FROM + DAY);
  assert.equal(v.points[0].periodStartAt, FROM);
  assert.equal(v.series.currency, 'USD');
  assert.equal(v.series.type, 'reference_price');
  assert.equal(v.identity, 'reconstructed');
  assert.equal(v.vintage, 'current_vintage');
  assert.equal(v.license, 'CC-BY-NC-4.0');
  assert.equal(v.provenance.sourcePublishedAt, null);
  assert.equal(v.provenance.receivedAt, NOW - 1000);
  assert.equal(v.analysis.short90m, 'unsupported_frequency');
  assert.ok(!Object.hasOwn(v.points[0], 'open'));
  assert.deepEqual(new Uint8Array(s.bytes), before.bytes);
  assert.deepEqual(s.options, before.options);
  assert.deepEqual(parse(s), v);
});
test('BTC/ETH规范身份分开，不接受USDT、任意路径或未知asset', () => {
  const btc = sample(), eth = sample(); eth.options.manifest.asset = 'eth';
  assert.notEqual(parse(btc).series.id, parse(eth).series.id);
  assert.match(coinMetricsFile(eth.options.manifest), /\/csv\/eth\.csv$/);
  for (const asset of ['BTC-USDT','../btc','sol','BTC']) {
    assert.throws(() => coinMetricsFile({ ...btc.options.manifest, asset }), /INVALID_MANIFEST/);
  }
  assert.throws(() => coinMetricsFile({ ...btc.options.manifest, url: 'https://example.invalid' }), /INVALID_MANIFEST/);
});
test('Git blob hash不是普通文件SHA1；字节/commit/manifest大小必须对应', () => {
  const s = sample();
  assert.throws(() => parse({ ...s, options: { ...s.options, manifest: { ...s.options.manifest, blobSha: createHash('sha1').update(s.bytes).digest('hex') } } }), /BLOB_MISMATCH/);
  assert.throws(() => parse({ ...s, bytes: Buffer.concat([s.bytes, Buffer.from('\n')]) }), /SIZE_MISMATCH/);
  for (const change of [{commit:'master'}, {blobSha:'x'.repeat(40)}, {bytes:CM_DAILY.limits.bytes+1}]) {
    assert.throws(() => coinMetricsFile({...s.options.manifest,...change}), /INVALID_MANIFEST/);
  }
});
test('半开日期范围排除两侧，不借源文件首尾声明目标完整', () => {
  const v = parse(sample('time,PriceUSD\n2026-08-31,99\n2026-09-01,100\n2026-09-02,101\n2026-09-03,102\n'));
  assert.equal(v.points.length, 2);
  assert.equal(v.coverage.excludedOutsideRange, 2);
  assert.equal(v.coverage.status, 'date_grid_present');
});
test('空值和完全缺日期分别报告，不填0、不丢覆盖分母', () => {
  const v = parse(sample('time,PriceUSD\n2026-09-01,\n2026-09-03,103\n', {cutoff:FROM+3*DAY}));
  assert.deepEqual(v.coverage.missing, [
    {sourceDate:'2026-09-01',reason:'missing_value'}, {sourceDate:'2026-09-02',reason:'missing_date'},
  ]);
  assert.equal(v.coverage.expectedDates, 3);
  assert.equal(v.coverage.presentValues, 1);
  assert.equal(v.coverage.status, 'partial');
});
test('全范围无值仍返回明确缺口，不能成为中性/零价', () => {
  const v = parse(sample('time,PriceUSD\n2026-08-01,100\n'));
  assert.equal(v.points.length, 0);
  assert.equal(v.coverage.missing.length, 2);
});
test('当前未完成日被排除，未来日期拒绝', () => {
  const v = parse(sample('time,PriceUSD\n2026-09-01,100\n2026-10-03,999\n'));
  assert.equal(v.coverage.excludedIncomplete, 1);
  assert.equal(v.points.length, 1);
  assert.throws(() => parse(sample('time,PriceUSD\n2026-10-04,1\n')), /FUTURE_DATE/);
});
test('日期窗口整日、有界，不能以后来的now掩盖旧接收时间', () => {
  for (const change of [
    {from:FROM+1}, {cutoff:FROM}, {cutoff:FROM+32*DAY}, {receivedAt:FROM+DAY},
    {now:NOW-2000}, {cutoff:NOW+DAY},
  ]) assert.throws(() => parse(sample(undefined, change)), /INVALID_RANGE/);
});
test('跨月/跨年/闰日使用真实UTC日历，拒绝自动rollover', () => {
  for (const date of ['2024-02-28','2024-02-29','2025-12-31']) {
    const at=Date.parse(date+'T00:00:00Z'),v=parse(sample('time,PriceUSD\n'+date+',1\n',{from:at,cutoff:at+DAY}));
    assert.equal(v.points[0].evidenceEndAt,at+DAY);
  }
  for (const date of ['2026-02-29','2026-09-31','2026-9-01','2026-09-01T00:00:00Z'])
    assert.throws(() => parse(sample('time,PriceUSD\n'+date+',1\n')), /INVALID_DATE/);
});
test('不排序掩盖乱序或重复', () => {
  for (const rows of ['2026-09-02,1\n2026-09-01,2','2026-09-01,1\n2026-09-01,1'])
    assert.throws(() => parse(sample('time,PriceUSD\n'+rows+'\n')), /INVALID_ORDER/);
});
test('错误decimal语法、无限/负值/零及格式注入全部拒绝', () => {
  for (const value of ['0','-1','NaN','Infinity','1e3','+1','01.2','1.',' 1','1 ','<b>1</b>','9'.repeat(81),'0.'+'0'.repeat(79)+'1'])
    assert.throws(() => parse(sample('time,PriceUSD\n2026-09-01,'+value+'\n')), /INVALID_PRICE|INVALID_CSV/);
});
test('UTF8、CSV列名、列数、引号、控制字符和空行严格验证', () => {
  for (const text of [
    Buffer.from([0xff]), 'time,PriceUSD,PriceUSD\n2026-09-01,1,1\n',
    'time,Other\n2026-09-01,1\n','time,PriceUSD\n2026-09-01,1,2\n',
    'time,PriceUSD\n"2026-09-01",1\n','time,PriceUSD\n\n2026-09-01,1\n',
    'time,PriceUSD\r2026-09-01,1\n','time,PriceUSD\n2026-09-01,1\0\n',
  ]) assert.throws(() => parse(sample(text)), /INVALID_|LINE_LIMIT/);
});
test('LF/CRLF可等价解析，最后换行不是数据行', () => {
  const a=sample(),b=sample(a.bytes.toString().replace(/\n/g,'\r\n'));
  assert.deepEqual(parse(a).points,parse(b).points);
  assert.deepEqual(parse(a).points,parse(sample(a.bytes.toString().trimEnd())).points);
});
test('字段位置按名字识别，其他指标不泄入导出', () => {
  const v=parse(sample('time,Extra,PriceUSD\n2026-09-01,123,10\n'));
  assert.equal(v.points[0].price,'10');
  assert.equal(Object.hasOwn(v.points[0],'Extra'),false);
});
test('单文件/行/列与最大数据行硬限额', () => {
  const tooBig=Buffer.alloc(CM_DAILY.limits.bytes+1);
  assert.throws(()=>parseCoinMetricsCsv(tooBig,{}),/INVALID_INPUT/);
  assert.throws(()=>parse(sample('time,PriceUSD,Other\n2026-09-01,1,'+'x'.repeat(16384)+'\n')),/LINE_LIMIT/);
  const cols=['time','PriceUSD',...Array.from({length:255},(_,i)=>'C'+i)];
  assert.throws(()=>parse(sample(cols.join(',')+'\n'+['2026-09-01','1',...Array(255).fill('')].join(',')+'\n')),/INVALID_COLUMNS/);
  assert.throws(()=>parse(sample('time,PriceUSD\n'+Array(10001).fill('2026-09-01,1').join('\n'))),/ROW_LIMIT/);
});
test('31日期恰好可查询，32日期拒绝', () => {
  const from=Date.parse('2026-08-01T00:00:00Z');
  const s=sample('time,PriceUSD\n2026-08-01,1\n',{from,cutoff:from+31*DAY});
  assert.equal(parse(s).coverage.expectedDates,31);
  s.options.cutoff=from+32*DAY;
  assert.throws(()=>parse(s),/INVALID_RANGE/);
});


test('版本标识必须为字符串，不进行数组/对象隐式转换', () => {
  const s=sample();
  for (const field of ['commit','blobSha']) {
    for (const bad of [[s.options.manifest[field]],new String(s.options.manifest[field]),{toString:()=>s.options.manifest[field]}]) {
      const manifest={...s.options.manifest,[field]:bad};
      assert.throws(()=>coinMetricsFile(manifest),/INVALID_MANIFEST/);
      assert.throws(()=>parse({...s,options:{...s.options,manifest}}),/INVALID_MANIFEST/);
    }
  }
});
