import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GOAL_ORDER_START,
  closePlan,
  etaMonth,
  goalId,
  goalProgress,
  monthLabel,
  monthsLeft,
  needPerMonth,
  nextGoalOrder,
  openGoals,
  parseMonth,
  savingMonthlyTotal,
} from '@/lib/goals';
import { SEED_BUCKETS, type Bucket, type Goal } from '@/types/fina';

const base: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s, balanceVnd: 0, active: true, goal: null, createdAt: 0, updatedAt: 0,
}));

const goal = (id: string, order: number, standardVnd: number, g: Partial<Goal> = {}): Bucket => ({
  id, name: id, kind: 'fund', bank: 'BIDV', standardVnd, hint: null, balanceVnd: 0, order,
  active: true, evenlySpent: false, createdAt: 0, updatedAt: 0,
  goal: { targetVnd: null, targetMonth: null, status: 'saving', ...g },
});

const phone = goal('goal-phone', 200, 1_929_000, { targetVnd: 15_000_000, targetMonth: '2027-04' });
const vehicle = goal('goal-vehicle', 210, 1_500_000);
const watch = goal('goal-watch', 220, 1_000_000, { status: 'later' });
const done = goal('goal-old', 190, 2_000_000, { status: 'done' });

test('goalId - slug from the name', () => {
  assert.equal(goalId('Phone', []), 'goal-phone');
  assert.equal(goalId('  New Watch! ', []), 'goal-new-watch');
  assert.equal(goalId('Điện thoại', []), 'goal-dien-thoai');
});

test('goalId - never reuses a taken id', () => {
  assert.equal(goalId('Phone', ['goal-phone']), 'goal-phone-2');
  assert.equal(goalId('Phone', ['goal-phone', 'goal-phone-2']), 'goal-phone-3');
});

test('nextGoalOrder - first goal starts after every fund, then +10', () => {
  assert.equal(nextGoalOrder(base), GOAL_ORDER_START);
  assert.ok(GOAL_ORDER_START > Math.max(...base.map((b) => b.order)));
  assert.equal(nextGoalOrder([...base, phone, vehicle]), 220);
});

test('openGoals - drops done goals and normal funds, sorts by priority', () => {
  assert.deepEqual(
    openGoals([...base, vehicle, done, phone, watch]).map((b) => b.id),
    ['goal-phone', 'goal-vehicle', 'goal-watch'],
  );
});

test('savingMonthlyTotal - only saving goals count', () => {
  assert.equal(savingMonthlyTotal([...base, phone, vehicle, watch, done]), 3_429_000);
});

test('parseMonth - empty is null, bad input is undefined', () => {
  assert.equal(parseMonth('2027-04'), '2027-04');
  assert.equal(parseMonth(' '), null);
  assert.equal(parseMonth('2027-13'), undefined);
  assert.equal(parseMonth('04/2027'), undefined);
});

const oct6 = new Date(2026, 9, 6, 12);

test('monthsLeft - counts the day-25 allocations up to the target month', () => {
  assert.equal(monthsLeft('2027-04', oct6), 7);
  // On or after the 25th, this month's allocation is already behind us.
  assert.equal(monthsLeft('2027-04', new Date(2026, 9, 25, 9)), 6);
  assert.equal(monthsLeft('2026-12', new Date(2026, 11, 26)), 1);
  assert.equal(monthsLeft('2026-01', oct6), 1);
});

test('needPerMonth - Phone: 13.500 missing over 7 months', () => {
  assert.equal(needPerMonth({ ...phone, balanceVnd: 1_500_000 }, oct6), 1_929_000);
});

test('needPerMonth - null without target or month, 0 when reached', () => {
  assert.equal(needPerMonth(vehicle, oct6), null);
  assert.equal(needPerMonth({ ...phone, balanceVnd: 15_000_000 }, oct6), 0);
});

test('goalProgress - each state', () => {
  assert.equal(goalProgress({ ...phone, balanceVnd: 1_500_000 }, oct6), 'on track');
  assert.equal(goalProgress({ ...phone, balanceVnd: 1_500_000, standardVnd: 1_500_000 }, oct6), 'behind');
  assert.equal(goalProgress({ ...phone, balanceVnd: 15_000_000 }, oct6), 'ready');
  assert.equal(goalProgress(vehicle, oct6), 'no target');
  assert.equal(goalProgress(watch, oct6), 'later');
});

test('etaMonth - when the money is there at the current pace', () => {
  assert.equal(etaMonth({ ...phone, balanceVnd: 1_500_000 }, oct6), '2027-04');
  // 1.500/mo: 13.500 / 1.500 = 9 allocations, Oct 2026 .. Jun 2027
  assert.equal(etaMonth({ ...phone, balanceVnd: 1_500_000, standardVnd: 1_500_000 }, oct6), '2027-06');
  assert.equal(etaMonth(vehicle, oct6), null);
});

test('monthLabel - short month and year', () => {
  assert.equal(monthLabel('2027-04'), 'Apr 2027');
});

test('closePlan - leftover goes out, an overspend is covered, zero just closes', () => {
  assert.deepEqual(closePlan({ ...phone, balanceVnd: 300_000 }), { kind: 'leftover', amountVnd: 300_000 });
  assert.deepEqual(closePlan({ ...phone, balanceVnd: -200_000 }), { kind: 'short', amountVnd: 200_000 });
  assert.deepEqual(closePlan({ ...phone, balanceVnd: 0 }), { kind: 'empty' });
});
