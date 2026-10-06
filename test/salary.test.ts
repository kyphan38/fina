import assert from 'node:assert/strict';
import { test } from 'node:test';
import { average, byYear, monthOf } from '@/lib/salary';
import type { Salary } from '@/types/fina';

const row = (month: string, amountVnd: number): Salary => ({
  month, amountVnd, note: null, updatedAt: 0,
});

test('byYear - sums per year, newest year first', () => {
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

test('byYear - counts MONTHS RECORDED, not 12', () => {
  // 3 recorded months means the year total is those 3. Extrapolating the year is made up.
  const out = byYear([row('2026-06', 10_000_000), row('2026-07', 10_000_000)]);
  assert.equal(out[0].months, 2);
});

test('average - divides by months recorded, not by 12', () => {
  assert.equal(average([row('2026-06', 30_000_000), row('2026-07', 40_000_000)]), 35_000_000);
});

test('average - nothing recorded is 0, not NaN', () => {
  assert.equal(average([]), 0);
});

test('byYear - nothing recorded means no years', () => {
  assert.deepEqual(byYear([]), []);
});

test('monthOf - uses the calendar month, NOT the cycle that turns on the 25th', () => {
  // Payday is the easiest case to get wrong: cycleOf('2026-09-25') is already '2026-10'.
  // September's salary must sit in September.
  assert.equal(monthOf(new Date('2026-09-25T12:00:00')), '2026-09');
  assert.equal(monthOf(new Date('2026-09-30T23:00:00')), '2026-09');
  assert.equal(monthOf(new Date('2026-09-01T00:00:00')), '2026-09');
  assert.equal(monthOf(new Date('2026-12-31T12:00:00')), '2026-12');
  assert.equal(monthOf(new Date('2026-01-05T12:00:00')), '2026-01');
});
