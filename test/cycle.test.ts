import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cycleOf,
  cycleRange,
  cycleLabel,
  cycleProgress,
  parseCycle,
  previousCycle,
  nextCycle,
} from '@/lib/cycle';

const at = (s: string) => new Date(`${s}T12:00:00`);

test('cycleOf - dates from the real Budget.numbers', () => {
  // Real data: 24 Jul logged as "July", 27 Jul as "August"
  assert.equal(cycleOf(at('2026-07-24')), '2026-07');
  assert.equal(cycleOf(at('2026-07-25')), '2026-08');
  assert.equal(cycleOf(at('2026-07-27')), '2026-08');
  assert.equal(cycleOf(at('2026-08-24')), '2026-08');
  assert.equal(cycleOf(at('2026-08-25')), '2026-09');
  assert.equal(cycleOf(at('2026-09-02')), '2026-09');
  assert.equal(cycleOf(at('2026-04-25')), '2026-05');
  assert.equal(cycleOf(at('2026-03-28')), '2026-04');
});

test('cycleOf - across New Year, the easiest case to get wrong', () => {
  assert.equal(cycleOf(at('2026-12-24')), '2026-12');
  assert.equal(cycleOf(at('2026-12-25')), '2027-01');
  assert.equal(cycleOf(at('2026-12-31')), '2027-01');
  assert.equal(cycleOf(at('2027-01-01')), '2027-01');
  assert.equal(cycleOf(at('2027-01-24')), '2027-01');
  assert.equal(cycleOf(at('2027-01-25')), '2027-02');
});

test('cycleOf - day boundaries, independent of the hour', () => {
  assert.equal(cycleOf(new Date('2026-08-24T23:59:59')), '2026-08');
  assert.equal(cycleOf(new Date('2026-08-25T00:00:00')), '2026-09');
});

test('cycleOf - the cycle start day can change', () => {
  assert.equal(cycleOf(at('2026-08-01'), 1), '2026-09');
  assert.equal(cycleOf(at('2026-07-31'), 1), '2026-08');
  assert.equal(cycleOf(at('2026-08-14'), 15), '2026-08');
  assert.equal(cycleOf(at('2026-08-15'), 15), '2026-09');
});

test('parseCycle - rejects junk instead of guessing', () => {
  assert.deepEqual(parseCycle('2026-09'), { year: 2026, month: 9 });
  for (const bad of ['2026-9', '2026-13', '2026-00', 'September', '', '2026/09']) {
    assert.throws(() => parseCycle(bad), /Invalid cycle id/);
  }
});

test('cycleRange - the September cycle runs 25/08 -> 25/09', () => {
  const { startAt, endAt } = cycleRange('2026-09');
  assert.equal(new Date(startAt).toDateString(), new Date(2026, 7, 25).toDateString());
  assert.equal(new Date(endAt).toDateString(), new Date(2026, 8, 25).toDateString());
});

test('cycleRange - January steps back to December of the year before', () => {
  const { startAt } = cycleRange('2027-01');
  assert.equal(new Date(startAt).getFullYear(), 2026);
  assert.equal(new Date(startAt).getMonth(), 11);
  assert.equal(new Date(startAt).getDate(), 25);
});

test('cycleRange - matches cycleOf at both ends', () => {
  for (const cycle of ['2026-01', '2026-02', '2026-09', '2026-12', '2027-01']) {
    const { startAt, endAt } = cycleRange(cycle);
    assert.equal(cycleOf(new Date(startAt)), cycle, `start of cycle ${cycle}`);
    assert.equal(cycleOf(new Date(endAt - 1)), cycle, `end of cycle ${cycle}`);
    assert.equal(cycleOf(new Date(endAt)), nextCycle(cycle), `after cycle ${cycle}`);
  }
});

test('cycleLabel - derives the month name, not stored in the DB', () => {
  assert.deepEqual(cycleLabel('2026-09'), { month: 'September', year: 2026 });
  assert.deepEqual(cycleLabel('2027-01'), { month: 'January', year: 2027 });
});

test('cycleProgress - which day / out of how many', () => {
  // September cycle: 25/08 -> 25/09 = 31 days
  assert.deepEqual(cycleProgress('2026-09', at('2026-08-25')), { day: 1, total: 31 });
  assert.deepEqual(cycleProgress('2026-09', at('2026-09-02')), { day: 9, total: 31 });
  assert.deepEqual(cycleProgress('2026-09', at('2026-09-24')), { day: 31, total: 31 });
  // Clamped at both ends
  assert.equal(cycleProgress('2026-09', at('2026-01-01')).day, 1);
  assert.equal(cycleProgress('2026-09', at('2027-01-01')).day, 31);
});

test('previousCycle / nextCycle - across the year boundary', () => {
  assert.equal(previousCycle('2026-01'), '2025-12');
  assert.equal(nextCycle('2026-12'), '2027-01');
  assert.equal(nextCycle(previousCycle('2026-09')), '2026-09');
});
