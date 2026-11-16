import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runOutAt } from '@/lib/run-out';

const DAY = 86_400_000;
const start = Date.UTC(2026, 9, 25);
const end = start + 31 * DAY;

test('spending fast runs out before the cycle ends', () => {
  // 10 days in, 2.000 of 3.000 spent: 200/day, 1.000 left lasts 5 more days.
  const at = runOutAt({ usedVnd: 2_000_000, limitVnd: 3_000_000, startAt: start, endAt: end, now: start + 10 * DAY });
  assert.equal(at, start + 15 * DAY);
});

test('on pace or slower: no warning', () => {
  assert.equal(runOutAt({ usedVnd: 900_000, limitVnd: 3_000_000, startAt: start, endAt: end, now: start + 10 * DAY }), null);
});

test('no warning in the first days, with nothing spent, or once already over', () => {
  assert.equal(runOutAt({ usedVnd: 2_000_000, limitVnd: 3_000_000, startAt: start, endAt: end, now: start + 2 * DAY }), null);
  assert.equal(runOutAt({ usedVnd: 0, limitVnd: 3_000_000, startAt: start, endAt: end, now: start + 10 * DAY }), null);
  assert.equal(runOutAt({ usedVnd: 3_100_000, limitVnd: 3_000_000, startAt: start, endAt: end, now: start + 10 * DAY }), null);
});
