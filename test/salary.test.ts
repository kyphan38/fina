import assert from 'node:assert/strict';
import { test } from 'node:test';
import { average, byYear, monthOf } from '@/lib/salary';
import type { Salary } from '@/types/fina';

const row = (month: string, amountVnd: number): Salary => ({
  month, amountVnd, note: null, updatedAt: 0,
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

test('monthOf - dùng tháng dương lịch, KHÔNG phải chu kỳ cắt ngày 25', () => {
  // Ngày lĩnh lương là ca dễ sai nhất: cycleOf('2026-09-25') đã là '2026-10'.
  // Lương tháng 9 phải nằm ở tháng 9.
  assert.equal(monthOf(new Date('2026-09-25T12:00:00')), '2026-09');
  assert.equal(monthOf(new Date('2026-09-30T23:00:00')), '2026-09');
  assert.equal(monthOf(new Date('2026-09-01T00:00:00')), '2026-09');
  assert.equal(monthOf(new Date('2026-12-31T12:00:00')), '2026-12');
  assert.equal(monthOf(new Date('2026-01-05T12:00:00')), '2026-01');
});
