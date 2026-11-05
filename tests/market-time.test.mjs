import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDisplayTimePreference, resolveDisplayTimezone, formatMarketTime, marketTimezoneLabel } from '../lib/market-time.ts';

test('saved display preferences have a stable UTC fallback before device hydration', () => {
  assert.equal(normalizeDisplayTimePreference(undefined), 'device');
  assert.equal(normalizeDisplayTimePreference('America/New_York'), 'device');
  assert.equal(normalizeDisplayTimePreference('Asia/Shanghai'), 'Asia/Shanghai');
  assert.equal(resolveDisplayTimezone('device'), 'UTC');
  assert.equal(resolveDisplayTimezone('device', 'not/a-zone'), 'UTC');
  assert.equal(resolveDisplayTimezone('device', 'America/New_York'), 'America/New_York');
  assert.equal(resolveDisplayTimezone('UTC', 'Asia/Shanghai'), 'UTC');
  assert.equal(resolveDisplayTimezone('Asia/Shanghai', 'UTC'), 'Asia/Shanghai');
});

test('the same instant changes only presentation across UTC and Shanghai date boundaries', () => {
  const at = Date.parse('2026-11-05T23:30:45Z');
  assert.match(formatMarketTime(at, 'UTC'), /2026\/11\/05 23:30:45 UTC$/);
  assert.match(formatMarketTime(at, 'Asia/Shanghai'), /2026\/11\/06 07:30:45 UTC\+08:00$/);
  assert.equal(at, Date.parse('2026-11-05T23:30:45Z'));
  assert.equal(formatMarketTime(0, 'UTC', 'clock'), '00:00:00 UTC');
  for (const value of [undefined, null, NaN, Infinity, 8_640_000_000_000_001]) assert.equal(formatMarketTime(value, 'UTC'), '—');
  assert.equal(formatMarketTime(at, 'bad-zone'), formatMarketTime(at, 'UTC'));
});

test('fall-back repeated wall times disclose their own date-specific offset', () => {
  const first = Date.parse('2026-11-01T05:30:00Z'), second = Date.parse('2026-11-01T06:30:00Z');
  assert.equal(formatMarketTime(first, 'America/New_York', 'clock'), '01:30:00 UTC−04:00');
  assert.equal(formatMarketTime(second, 'America/New_York', 'clock'), '01:30:00 UTC−05:00');
  assert.equal(marketTimezoneLabel('America/New_York', first), 'America/New_York · UTC−04:00');
  assert.equal(marketTimezoneLabel('America/New_York', second), 'America/New_York · UTC−05:00');
});

test('spring-forward omits nonexistent local times without shifting timestamps', () => {
  const before = Date.parse('2026-03-08T06:30:00Z'), after = Date.parse('2026-03-08T07:30:00Z');
  assert.equal(formatMarketTime(before, 'America/New_York', 'clock'), '01:30:00 UTC−05:00');
  assert.equal(formatMarketTime(after, 'America/New_York', 'clock'), '03:30:00 UTC−04:00');
  assert.equal(formatMarketTime(after, 'America/New_York', 'short', false), '03/08 03:30');
});
