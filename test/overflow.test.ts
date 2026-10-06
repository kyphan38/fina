import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overflowOf } from '@/lib/overflow';

const budget = (limitVnd: number | undefined, spentVnd: number, amountVnd: number) =>
  overflowOf({ bucketId: 'tech', kind: 'budget', limitVnd, spentVnd, balanceVnd: 0, amountVnd });

const fund = (balanceVnd: number, amountVnd: number, bucketId = 'travel') =>
  overflowOf({ bucketId, kind: 'fund', limitVnd: undefined, spentVnd: 0, balanceVnd, amountVnd });

test('budget - 200 left, spend 990, over by 790', () => {
  assert.equal(budget(1_000_000, 800_000, 990_000), 790_000);
});

test('budget - an exact fit is not over', () => {
  assert.equal(budget(1_000_000, 800_000, 200_000), 0);
  assert.equal(budget(1_000_000, 0, 1_000_000), 0);
});

test('budget - a historical cycle with no limit is never over', () => {
  assert.equal(budget(undefined, 9_000_000, 5_000_000), 0);
});

test('budget - already over: every extra amount is over', () => {
  assert.equal(budget(1_000_000, 1_500_000, 100_000), 100_000);
});

test('fund - 7.400 left, spend 9.000, over by 1.600', () => {
  assert.equal(fund(7_400_000, 9_000_000), 1_600_000);
});

test('fund - a negative balance has 0 usable, not a negative amount', () => {
  // The easy mistake: amount − balance = 100 − (−500) = 600.
  assert.equal(fund(-500_000, 100_000), 100_000);
});

test('fund - enough money is not over', () => {
  assert.equal(fund(7_400_000, 1_000_000), 0);
  assert.equal(fund(7_400_000, 7_400_000), 0);
});

test('ETF is never over - money only goes in', () => {
  assert.equal(fund(0, 50_000_000, 'etf'), 0);
});
