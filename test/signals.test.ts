import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAnalyze, computeSignals, type CycleFacts } from '@/lib/signals';
import { SEED_BUCKETS, type Bucket } from '@/types/fina';

const K = 1000;
const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s, balanceVnd: 0, active: true, goal: null, createdAt: 0, updatedAt: 0,
}));

const cycle = (id: string, over: Partial<CycleFacts> = {}): CycleFacts => ({
  id, closed: true,
  byBucket: {}, limits: { food: 3_000 * K, social: 1_000 * K }, ...over,
});

const base = (food: number[], current: number) => ({
  cycles: [
    ...food.map((v, i) => cycle(`2026-0${i + 4}`, { byBucket: { food: v * K } })),
    cycle('2026-09', { closed: false, byBucket: { food: current * K } }),
  ],
  buckets, amounts: [], day: 9, totalDays: 30,
});

test('median and gap are computed over CLOSED cycles', () => {
  const s = computeSignals(base([1_000, 2_000, 3_000], 4_000));
  const food = s.buckets.find((b) => b.bucketId === 'food')!;
  assert.equal(food.medianVnd, 2_000 * K);
  assert.equal(food.currentVnd, 4_000 * K);
  assert.equal(food.deviationPct, 100);
  assert.equal(s.closedCount, 3);
});

test('only 3 rising cycles in a row count as a trend', () => {
  assert.equal(computeSignals(base([1_000, 2_000, 3_000], 4_000)).buckets.find((b) => b.bucketId === 'food')!.rising, true);
  // Flattening in the last cycle is not
  assert.equal(computeSignals(base([1_000, 2_000, 3_000], 3_000)).buckets.find((b) => b.bucketId === 'food')!.rising, false);
  // Up and down at random is not either
  assert.equal(computeSignals(base([1_000, 5_000, 2_000], 4_000)).buckets.find((b) => b.bucketId === 'food')!.rising, false);
});

test('counts cycles over the limit, with the denominator', () => {
  const s = computeSignals(base([3_500, 2_000, 3_900], 100));
  const food = s.buckets.find((b) => b.bucketId === 'food')!;
  assert.equal(food.overCount, 2);
  assert.equal(food.overOf, 3);
});

test('pace ONLY applies to evenly spent buckets', () => {
  const s = computeSignals(base([1_000], 1_500));
  const ids = s.pace.map((p) => p.bucketId).sort();
  assert.deepEqual(ids, ['food', 'utilities']);
  // Beauty and Purchases are spent in lumps - not here
  assert.ok(!ids.includes('beauty'));
});

test('pace compares days passed with the share of the limit spent', () => {
  const s = computeSignals(base([1_000], 1_500));
  const food = s.pace.find((p) => p.bucketId === 'food')!;
  assert.equal(food.elapsedPct, 30); // day 9 / 30
  assert.equal(food.spentPct, 50); // 1.500 / 3.000
});

test('outlier: more than 3 times the bucket\'s own median', () => {
  const args = base([500, 500, 500], 2_000);
  const s = computeSignals({
    ...args,
    amounts: [
      { bucketId: 'food', amountVnd: 1_600 * K }, // > 3x the median 500
      { bucketId: 'food', amountVnd: 400 * K },   // normal
    ],
  });
  assert.equal(s.outliers.length, 1);
  assert.equal(s.outliers[0].amountVnd, 1_600 * K);
});

test('a fund quiet for 3 cycles and still holding money gets a mention', () => {
  const withMoney = buckets.map((b) => (b.id === 'travel' ? { ...b, balanceVnd: 6_400 * K } : b));
  const cycles = ['2026-06', '2026-07', '2026-08'].map((id) => cycle(id));
  const s = computeSignals({
    cycles: [...cycles, cycle('2026-09', { closed: false })],
    buckets: withMoney, amounts: [], day: 9, totalDays: 30,
  });
  const travel = s.idleFunds.find((x) => x.bucketId === 'travel');
  assert.ok(travel);
  assert.ok(travel.idleCycles >= 3);

  // An empty fund that is quiet has nothing to say
  const empty = computeSignals({
    cycles: [...cycles, cycle('2026-09', { closed: false })],
    buckets, amounts: [], day: 9, totalDays: 30,
  });
  assert.equal(empty.idleFunds.length, 0);
});

test('a negative fund is always mentioned, no need to wait for cycles', () => {
  const neg = buckets.map((b) => (b.id === 'travel' ? { ...b, balanceVnd: -500 * K } : b));
  const s = computeSignals({
    cycles: [cycle('2026-09', { closed: false })],
    buckets: neg, amounts: [], day: 1, totalDays: 30,
  });
  assert.deepEqual(s.negativeFunds.map((x) => x.bucketId), ['travel']);
});

test('canAnalyze blocks under 3 closed cycles', () => {
  assert.equal(canAnalyze(computeSignals(base([1_000, 2_000], 1_000))), false);
  assert.equal(canAnalyze(computeSignals(base([1_000, 2_000, 3_000], 1_000))), true);
});

test('no history means no made-up gap', () => {
  const s = computeSignals({
    cycles: [cycle('2026-09', { closed: false, byBucket: { food: 500 * K } })],
    buckets, amounts: [], day: 1, totalDays: 30,
  });
  assert.equal(s.buckets.find((b) => b.bucketId === 'food')!.deviationPct, null);
});

test('a goal saving for months is not an idle fund', () => {
  const phone: Bucket = {
    ...buckets.find((b) => b.id === 'travel')!,
    id: 'goal-phone', name: 'Phone', balanceVnd: 1_500 * K, order: 200,
    goal: { targetVnd: 15_000 * K, targetMonth: '2027-04', status: 'saving' },
  };
  const cycles = ['2026-06', '2026-07', '2026-08'].map((id) => cycle(id));
  const s = computeSignals({
    cycles: [...cycles, cycle('2026-09', { closed: false })],
    buckets: [...buckets, phone], amounts: [], day: 9, totalDays: 30,
  });
  assert.equal(s.idleFunds.find((x) => x.bucketId === 'goal-phone'), undefined);
});
