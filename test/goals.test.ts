import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GOAL_ORDER_START,
  goalId,
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
