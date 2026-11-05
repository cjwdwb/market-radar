import test from 'node:test';
import assert from 'node:assert/strict';
import { candleConfirmation, candleIntervalLabel, prepareCandleAverages, selectedCandleIndex } from '../lib/candle-chart-data.ts';

const interval = 900_000;
const points = Array.from({ length: 96 }, (_, i) => ({ time: 1_700_000_000_000 + i * interval, close: i + 1 }));

test('source confirmation is never inferred from elapsed windows or absent flags', () => {
  assert.equal(candleConfirmation({ confirmed: true }).status, 'confirmed');
  assert.equal(candleConfirmation({ confirmed: false, windowEnded: true }).status, 'current');
  assert.equal(candleConfirmation({ windowEnded: true }).status, 'window_ended');
  assert.match(candleConfirmation({ windowEnded: true }).label, /收盘未确认/);
  assert.equal(candleConfirmation({ windowEnded: false }).status, 'window_open');
  assert.equal(candleConfirmation({}).status, 'unknown');
  assert.doesNotMatch(candleConfirmation({}).label, /已收盘/);
});

test('actual intervals are displayed and unknown intervals do not become 15 minutes', () => {
  for (const value of [undefined, null, NaN, Infinity, -1, 0]) assert.equal(candleIntervalLabel(value), '周期未知');
  assert.equal(candleIntervalLabel(interval), '15 分钟');
  assert.equal(candleIntervalLabel(300_000), '5 分钟');
  assert.equal(candleIntervalLabel(3_600_000), '1 小时');
  assert.equal(candleIntervalLabel(86_400_000), '1 日');
});

test('contiguous SMA values match direct window means; gaps require 7/25 new real bars', () => {
  const original = structuredClone(points), average = prepareCandleAverages(points, interval);
  for (const period of [7, 25]) {
    assert.equal(average(period - 2, period), null);
    for (let i = period - 1; i < points.length; i++) assert.equal(average(i, period), points.slice(i + 1 - period, i + 1).reduce((n, p) => n + p.close, 0) / period);
  }
  const missing = points.filter((_, index) => index !== 48), afterGap = prepareCandleAverages(missing, interval);
  for (const period of [7, 25]) {
    assert.equal(afterGap(47, period), average(47, period));
    for (let i = 48; i < 48 + period - 1; i++) assert.equal(afterGap(i, period), null);
    assert.equal(afterGap(48 + period - 1, period), missing.slice(48, 48 + period).reduce((n, p) => n + p.close, 0) / period);
  }
  assert.deepEqual(points, original);
  assert.equal(missing.length, 95, 'no gap filling');
});

test('unknown intervals do not invent continuity facts and selected candles follow their timestamps', () => {
  const missing = points.filter((_, index) => index !== 48);
  assert.notEqual(prepareCandleAverages(missing, null)(48, 7), null);
  const chosen = points[50].time;
  assert.equal(selectedCandleIndex(points.slice(36), chosen), 14);
  assert.equal(selectedCandleIndex(points.slice(37), chosen), 13);
  assert.equal(selectedCandleIndex(points, null), 95);
  assert.equal(selectedCandleIndex(points.slice(51), chosen), 44, 'a removed selection returns to the visible tail');
});
