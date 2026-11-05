import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, envDir: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true } });
after(() => vite.close());
const { CandleChart } = await vite.ssrLoadModule('/components/candle-chart.tsx');
const { MarketTimeProvider } = await vite.ssrLoadModule('/components/market-time-context.tsx');
const { EventHistory } = await vite.ssrLoadModule('/components/radar/event-history.tsx');
const stamp = Date.parse('2026-11-01T05:30:00Z'), intervalMs = 900_000;
const points = Array.from({ length: 96 }, (_, index) => ({ time: stamp + index * intervalMs, open: index + 100, high: index + 102, low: index + 99, close: index + 101, volume: index + 1 }));
const chart = extra => renderToStaticMarkup(React.createElement(CandleChart, { points, currency: 'USDT', timezone: 'UTC', ...extra }));

test('candle readout renders unknown and elapsed windows without claiming source confirmation', () => {
  const unknown = chart();
  assert.match(unknown, /data-candle-confirmation="unknown"/);
  assert.match(unknown, /收盘状态未知/);
  assert.match(unknown, /周期未知 K 线与成交量/);
  assert.doesNotMatch(unknown, /已收盘|每根 15 分钟/);
  const ended = chart({ points: points.map(p => ({ ...p, windowEnded: true })), intervalMs: 300_000 });
  assert.match(ended, /周期已结束 · 收盘未确认/);
  assert.match(ended, /每根 5 分钟/);
  const confirmed = chart({ points: points.map(p => ({ ...p, confirmed: true })), metadata: { intervalMs } });
  assert.match(confirmed, /已收盘 · 来源确认/);
  assert.match(confirmed, /data-interval-ms="900000"/);
});

test('chart paths restart across a missing bar and warm up a full new SMA window', () => {
  const missing = points.filter((_, index) => index !== 48);
  const html = chart({ points: missing, intervalMs });
  for (const period of [7, 25]) {
    const path = html.match(new RegExp(`data-ma="${period}" d="([^"]*)"`))?.[1];
    assert.ok(path);
    assert.equal((path.match(/M/g) ?? []).length, 2, `MA ${period} contains two separate paths`);
  }
  const recentGap = chart({ points: points.filter((_, index) => index !== 92), intervalMs });
  assert.match(recentGap, /MA 7 · —/);
  assert.match(recentGap, /MA 25 · —/);
  assert.equal((html.match(/data-volume="true"/g) ?? []).length, 60, 'viewport still uses loaded bars without filling the missing interval');
});

test('live event display shares the chosen timezone while ISO evidence and event values remain unchanged', () => {
  const signal = { id: 'event', symbol: 'BTC-USDT', market: 'crypto', status: 'active', severity: 'high', direction: 'up', title: '合成事件', metric: '3%', source: 'fixture', currency: 'USDT', detectedAt: stamp, evidenceAt: stamp, quoteAt: stamp, fetchedAt: stamp, updatedAt: stamp, evidence: { reason: '合成边界验证', items: [], sampleSize: 7, minimumSamples: 7 } };
  const history = { storage: 'available', observations: [{ signal, observedAt: stamp }] }, original = structuredClone(history);
  const content = React.createElement(EventHistory, { history, scope: 'all', onAsset: () => {} });
  const render = timezone => renderToStaticMarkup(timezone ? React.createElement(MarketTimeProvider, { timezone }, content) : content);
  const server = render(), utc = render('UTC'), shanghai = render('Asia/Shanghai'), newYork = render('America/New_York');
  assert.equal(server, utc, 'SSR default is explicit UTC, independent of the machine timezone');
  assert.match(utc, /05:30:00 UTC/);
  assert.match(shanghai, /13:30:00 UTC\+08:00/);
  assert.match(newYork, /01:30:00 UTC−04:00/);
  assert.match(newYork, /显示时区 America\/New_York/);
  for (const html of [utc, shanghai, newYork]) assert.match(html, /dateTime="2026-11-01T05:30:00\.000Z"/);
  assert.deepEqual(history, original);
});
