import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cycleRange } from '@/lib/cycle';
import { dueAt, dueItems, parseRecurring, type RecurringDoc } from '@/lib/recurring';

// Cycle '2026-12' runs 25 Nov - 24 Dec (25 Nov 2026 is a Wednesday).
const cycle = '2026-12';
const range = cycleRange(cycle);

test('the due day lands in whichever month of the cycle holds it', () => {
  assert.equal(new Date(dueAt(1, cycle, range)!).getMonth(), 11, 'the 1st is in December');
  assert.equal(new Date(dueAt(28, cycle, range)!).getMonth(), 10, 'the 28th is in November');
  assert.equal(new Date(dueAt(31, '2027-03', cycleRange('2027-03'))!).getDate(), 28, '31 clamps to 28 Feb');
});

test('due items: reached their day, not yet done this cycle, earliest first', () => {
  const doc: RecurringDoc = {
    items: [
      { id: 'phone', name: 'Phone', bucketId: 'utilities', amountVnd: 200_000, day: 5 },
      { id: 'rent', name: 'Rent', bucketId: 'utilities', amountVnd: 3_000_000, day: 1 },
      { id: 'gym', name: 'Gym', bucketId: 'beauty', amountVnd: 500_000, day: 20 },
      { id: 'cloud', name: 'Cloud', bucketId: 'tech', amountVnd: 50_000, day: 2 },
    ],
    done: { cloud: '2026-12', phone: '2026-11' },
  };
  const now = new Date(2026, 11, 10).getTime();
  assert.deepEqual(dueItems(doc, cycle, range, now).map((i) => i.id), ['rent', 'phone']);
});

test('a malformed doc reads as empty parts', () => {
  assert.deepEqual(parseRecurring(null), { items: [], done: {} });
  const r = parseRecurring({ items: [{ id: 'x', name: 'X', bucketId: 'food', amountVnd: 1000, day: 40 }, 'junk'], done: { a: '2026-12', b: 3 } });
  assert.deepEqual(r, { items: [], done: { a: '2026-12' } });
});
