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

// --- batchOverflows: MoMo import saves many entries at once ---

import { batchOverflows, type WrittenTx } from '@/lib/overflow';
import type { Bucket } from '@/types/fina';

const bucket = (id: string, kind: Bucket['kind'], balanceVnd = 0): Bucket => ({
  id, name: id, kind, bank: kind === 'fund' ? 'BIDV' : 'VCB', standardVnd: 0, hint: null,
  order: 0, evenlySpent: false, goal: null, balanceVnd, active: true, createdAt: 0, updatedAt: 0,
});
const w = (id: string, bucketId: string, amountVnd: number, direction: 'in' | 'out' = 'out', occurredAt = 0, cycle = '2026-10'): WrittenTx =>
  ({ id, bucketId, cycle, amountVnd, direction, occurredAt });

const limits: Record<string, number> = { food: 3_000_000, beauty: 3_500_000 };
const run = (written: WrittenTx[], usedBefore: Record<string, number>, buckets = [bucket('food', 'budget'), bucket('beauty', 'budget')]) =>
  batchOverflows({ written, cycle: '2026-10', buckets, limitOf: (b) => limits[b.id], usedBefore });

test('batch - seven payments together push Food over by their sum minus the room', () => {
  const out = run([w('a', 'food', 200_000, 'out', 1), w('b', 'food', 243_000, 'out', 2)], { food: 2_998_525 });
  assert.equal(out.length, 1);
  assert.equal(out[0].bucket.id, 'food');
  assert.equal(out[0].amountVnd, 441_525);
  assert.equal(out[0].txId, 'b', 'the latest out entry carries the cover');
});

test('batch - a refund in the same batch offsets spending', () => {
  const out = run([w('a', 'food', 500_000), w('b', 'food', 400_000, 'in')], { food: 2_950_000 });
  assert.equal(out[0].amountVnd, 50_000);
});

test('batch - entries from an older cycle never count as over', () => {
  assert.deepEqual(run([w('a', 'food', 9_000_000, 'out', 0, '2026-09')], { food: 2_999_000 }), []);
});

test('batch - a fund goes over once its balance runs out', () => {
  const out = run([w('a', 'travel', 900_000)], {}, [bucket('travel', 'fund', 500_000)]);
  assert.equal(out[0].amountVnd, 400_000);
});
