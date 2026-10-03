import test from 'node:test';
import assert from 'node:assert/strict';
import { historyFixture, signed } from './fixtures/history28.mjs';
import { researchHistory as original } from './fixtures/history-research-reference-v1.ts';
import { createResearchScan, researchHistory } from '../lib/history/replay.ts';

test('stage29 C stream: v1 exact oracle equivalence across pages, gaps, flat and partial windows', async () => {
  for (const intervalMs of [300000, 900000]) for (const variant of ['gentle', 'oscillating', 'gaps', 'flat', 'partial', 'missing']) {
    let p = await historyFixture({ intervalMs, count: variant === 'partial' ? 22 : 930, close: i => variant === 'flat' ? 100 : variant === 'oscillating' ? 100 + Math.sin(i / 8) : 100 * 1.0002 ** i });
    if (variant === 'gaps') { p.bars = p.bars.filter((_, i) => i % 73 !== 20); p = await signed(p); }
    const asOf = p.range.cutoff - (variant === 'missing' ? 1 : 0), before = JSON.stringify(p);
    const expected = original(p, asOf, p.exportedAt);
    assert.deepEqual(researchHistory(p, asOf, p.exportedAt), expected, variant);
    for (const pageSize of [1, 7, 200]) {
      const scan = createResearchScan(p, asOf, p.exportedAt);
      for (let i = 0; i < p.bars.length; i += pageSize) for (const bar of p.bars.slice(i, i + pageSize)) scan.push(bar);
      assert.deepEqual(scan.finish(), expected, `${variant}/${intervalMs}/${pageSize}`);
      assert.deepEqual(scan.finish(), expected);
    }
    assert.equal(JSON.stringify(p), before);
  }
});

test('stage29 C stream: global nonoverlap before top200, not per-page top-N', async () => {
  const p = await historyFixture({ count: 9000 }); // pure protocol fixture beyond old transport; never a browser package
  const expected = original(p, p.range.cutoff, p.exportedAt);
  assert.equal(expected.samples.length, 200); assert.ok(expected.counts.capped > 0);
  for (const pageSize of [3, 127, 200]) {
    const scan = createResearchScan({ ...p, bars: p.bars.slice(-37) }, p.range.cutoff, p.exportedAt);
    for (let i = 0; i < p.bars.length; i += pageSize) for (const bar of p.bars.slice(i, i + pageSize)) scan.push(bar);
    assert.deepEqual(scan.finish(), expected);
  }
});

test('stage29 C stream: future values cannot change fixed-cutoff selection; bad order rejected', async () => {
  const p = await historyFixture({ count: 1000 }), at = p.bars[700].time + p.intervalMs;
  const q = structuredClone(p); for (const b of q.bars) if (b.time >= at) b.close *= 5;
  assert.deepEqual(researchHistory(q, at, p.exportedAt), original(p, at, p.exportedAt));
  const scan = createResearchScan(p, at, p.exportedAt); scan.push(p.bars[0]);
  assert.throws(() => scan.push(p.bars[0]), /INVALID_RESEARCH_SEQUENCE/);
  scan.finish(); assert.throws(() => scan.push(p.bars[1]), /INVALID_RESEARCH_SEQUENCE/);
});
