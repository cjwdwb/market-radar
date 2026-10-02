// Synthetic prices only. Never loaded by production or presented as historical market evidence.
import { packageDigest } from '../../lib/history/package.ts';
export const start = Date.parse('2026-09-01T00:00:00Z');
export async function historyFixture({ count = 900, intervalMs = 300000, close = i => 100 * 1.0002 ** i, market = 'us' } = {}) {
  const cutoff = start + count * intervalMs, exportedAt = cutoff + 2000;
  const p = { format: 'history-package-v1', identity: 'fixture', vintage: 'current_vintage', source: 'fixture:history28',
    asset: { id: `fixture:${market}:TEST:USD`, market, venue: 'TEST', providerId: 'fixture:TEST', currency: 'USD', adjustment: 'raw' },
    intervalMs, sessionEvidence: 'fixture_only', readRevision: 1, range: { from: start, cutoff }, exportedAt, coverage: 'not_verified',
    bars: Array.from({ length: count }, (_, i) => ({ time: start + i * intervalMs, open: close(i), high: close(i) + .01, low: close(i) - .01, close: close(i), volume: null, version: 1, receivedAt: cutoff + 1000 })) };
  return { ...p, digest: await packageDigest(p) };
}
export async function signed(p) { const { digest: ignored, ...body } = p; void ignored; return { ...body, digest: await packageDigest(body) }; }
