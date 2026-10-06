import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocate } from '@/lib/generator';
import { SEED_BUCKETS, type Bucket, type Goal } from '@/types/fina';

const base: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s, balanceVnd: 0, active: true, goal: null, createdAt: 0, updatedAt: 0,
}));

const goal = (id: string, order: number, standardVnd: number, balanceVnd: number, g: Partial<Goal> = {}): Bucket => ({
  id, name: id, kind: 'fund', bank: 'BIDV', standardVnd, hint: null, balanceVnd, order,
  active: true, evenlySpent: false, createdAt: 0, updatedAt: 0,
  goal: { targetVnd: null, targetMonth: null, status: 'saving', ...g },
});

const phone = goal('goal-phone', 200, 1_929_000, 1_500_000, { targetVnd: 15_000_000, targetMonth: '2027-04' });
const vehicle = goal('goal-vehicle', 210, 1_500_000, 500_000);
const watch = goal('goal-watch', 220, 1_000_000, 0, { status: 'later' });
const buckets = [...base, phone, vehicle, watch];

// Just before cycle 2026-11 opens on 25 Oct 2026.
const before = new Date(2026, 9, 24, 23, 59);

test('goals are their own group, not funds', () => {
  const r = allocate(40_000_000, buckets, {}, before);
  assert.deepEqual(r.goals.map((a) => a.bucket.id), ['goal-phone', 'goal-vehicle']);
  assert.ok(!r.funds.some((a) => a.bucket.id.startsWith('goal-')));
  assert.equal(r.goalsTotalVnd, 3_429_000);
});

test('ETF gets what is left after goals too', () => {
  const r = allocate(40_000_000, buckets, {}, before);
  assert.equal(r.etfVnd, 40_000_000 - r.monthlyTotalVnd - r.fundsTotalVnd - 3_429_000);
});

test('a later goal gets nothing', () => {
  const r = allocate(40_000_000, buckets, {}, before);
  assert.equal(r.goals.find((a) => a.bucket.id === 'goal-watch'), undefined);
});

test('the allocation being planned counts toward the months left', () => {
  const p = allocate(40_000_000, buckets, {}, before).goals[0];
  assert.equal(p.needVnd, 1_929_000);
  assert.equal(p.belowNeed, false);
});

test('putting less than the need into a goal is flagged', () => {
  const p = allocate(40_000_000, buckets, { 'goal-phone': 1_500_000 }, before).goals[0];
  assert.equal(p.amountVnd, 1_500_000);
  assert.equal(p.belowNeed, true);
});

test('a goal without a target has no need and is never flagged', () => {
  const v = allocate(40_000_000, buckets, { 'goal-vehicle': 0 }, before).goals[1];
  assert.equal(v.needVnd, null);
  assert.equal(v.belowNeed, false);
});
