import assert from 'node:assert/strict';
import { test } from 'node:test';
import { average, byYear } from '@/lib/salary';
import type { Salary } from '@/types/fina';

const row = (cycle: string, amountVnd: number): Salary => ({
  cycle, amountVnd, note: null, updatedAt: 0,
});

test('byYear - cộng theo năm, năm mới đứng trước', () => {
  const out = byYear([
    row('2027-01', 40_000_000),
    row('2026-12', 39_000_000),
    row('2026-11', 39_000_000),
  ]);
  assert.deepEqual(out, [
    { year: '2027', totalVnd: 40_000_000, months: 1 },
    { year: '2026', totalVnd: 78_000_000, months: 2 },
  ]);
});

test('byYear - đếm SỐ THÁNG ĐÃ GHI, không phải 12', () => {
  // Ghi 3 tháng thì tổng năm là tổng của 3 tháng đó. Suy ra cả năm là bịa.
  const out = byYear([row('2026-06', 10_000_000), row('2026-07', 10_000_000)]);
  assert.equal(out[0].months, 2);
});

test('average - chia cho số tháng đã ghi, không chia cho 12', () => {
  assert.equal(average([row('2026-06', 30_000_000), row('2026-07', 40_000_000)]), 35_000_000);
});

test('average - chưa ghi gì thì là 0, không phải NaN', () => {
  assert.equal(average([]), 0);
});

test('byYear - chưa ghi gì thì không có năm nào', () => {
  assert.deepEqual(byYear([]), []);
});
