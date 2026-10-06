import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSurplus } from '@/lib/cycles';
import { allocate } from '@/lib/generator';
import { SEED_BUCKETS, type Bucket } from '@/types/fina';

const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s,
  goal: null,
  balanceVnd: 0,
  active: true,
  createdAt: 0,
  updatedAt: 0,
}));

test('computeSurplus - sums over every budget bucket', () => {
  const limits = { food: 3_000_000, beauty: 1_800_000, tech: 800_000 };
  const spent = { food: 2_640_000, beauty: 1_790_000, tech: 990_000 };
  // +360.000 +10.000 −190.000
  assert.equal(computeSurplus(limits, spent), 180_000);
});

test('computeSurplus - an unused bucket leaves its whole limit', () => {
  assert.equal(computeSurplus({ food: 3_000_000 }, {}), 3_000_000);
});

test('computeSurplus - negative on an overall overspend', () => {
  assert.equal(computeSurplus({ food: 1_000_000 }, { food: 1_500_000 }), -500_000);
});

test('computeSurplus - ignores spending on buckets not in limits', () => {
  // Funds and ETF are not in limits and must not pull the surplus down.
  const s = computeSurplus({ food: 1_000_000 }, { food: 400_000, travel: 9_000_000 });
  assert.equal(s, 600_000);
});

test('allocate - ETF is the remainder, percentages are derived', () => {
  const r = allocate(39_065_000, buckets);
  assert.equal(r.monthlyTotalVnd, 7_000_000);
  assert.equal(r.fundsTotalVnd, 10_500_000);
  assert.equal(r.etfVnd, 39_065_000 - 7_000_000 - 10_500_000);
  assert.equal(r.etfVnd, 21_565_000);
  assert.equal(Math.round(r.etfPercent), 55);
});

test('allocate - raising one baseline lowers ETF by exactly that much', () => {
  const before = allocate(39_065_000, buckets).etfVnd;
  const bumped = buckets.map((b) =>
    b.id === 'food' ? { ...b, standardVnd: b.standardVnd + 1_000_000 } : b,
  );
  assert.equal(allocate(39_065_000, bumped).etfVnd, before - 1_000_000);
});

test('allocate - a short salary makes ETF negative, never cuts a bucket', () => {
  const r = allocate(10_000_000, buckets);
  assert.ok(r.etfVnd < 0);
  assert.equal(r.monthlyTotalVnd, 7_000_000);
  assert.equal(r.fundsTotalVnd, 10_500_000);
});

test('allocate - ETF is never counted in the funds part', () => {
  const r = allocate(39_065_000, buckets);
  assert.ok(!r.funds.some((a) => a.bucket.id === 'etf'));
});

test('allocate - an inactive bucket gets no allocation', () => {
  const off = buckets.map((b) => (b.id === 'travel' ? { ...b, active: false } : b));
  assert.equal(allocate(39_065_000, off).fundsTotalVnd, 10_500_000 - 2_000_000);
});
