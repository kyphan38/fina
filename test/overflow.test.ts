import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overflowOf } from '@/lib/overflow';

const budget = (limitVnd: number | undefined, spentVnd: number, amountVnd: number) =>
  overflowOf({ bucketId: 'tech', kind: 'budget', limitVnd, spentVnd, balanceVnd: 0, amountVnd });

const fund = (balanceVnd: number, amountVnd: number, bucketId = 'travel') =>
  overflowOf({ bucketId, kind: 'fund', limitVnd: undefined, spentVnd: 0, balanceVnd, amountVnd });

test('budget - còn 200, tiêu 990 thì lố 790', () => {
  assert.equal(budget(1_000_000, 800_000, 990_000), 790_000);
});

test('budget - vừa khít không phải lố', () => {
  assert.equal(budget(1_000_000, 800_000, 200_000), 0);
  assert.equal(budget(1_000_000, 0, 1_000_000), 0);
});

test('budget - chu kỳ lịch sử không có hạn mức thì không bao giờ lố', () => {
  assert.equal(budget(undefined, 9_000_000, 5_000_000), 0);
});

test('budget - đã lố sẵn thì tiêu thêm bao nhiêu lố bấy nhiêu', () => {
  assert.equal(budget(1_000_000, 1_500_000, 100_000), 100_000);
});

test('fund - còn 7.400, tiêu 9.000 thì lố 1.600', () => {
  assert.equal(fund(7_400_000, 9_000_000), 1_600_000);
});

test('fund - số dư âm thì phần dùng được là 0, không phải số âm', () => {
  // Sai lầm dễ mắc: amount − balance = 100 − (−500) = 600.
  assert.equal(fund(-500_000, 100_000), 100_000);
});

test('fund - đủ tiền thì không lố', () => {
  assert.equal(fund(7_400_000, 1_000_000), 0);
  assert.equal(fund(7_400_000, 7_400_000), 0);
});

test('ETF không bao giờ lố - tiền chỉ đi vào', () => {
  assert.equal(fund(0, 50_000_000, 'etf'), 0);
});
