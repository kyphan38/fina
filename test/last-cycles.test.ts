import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lastCycles, type CycleSpend } from '@/lib/last-cycles';

test('closed cycles only, newest first, with total, average and peak per bucket', () => {
  const rows: CycleSpend[] = [
    { id: '2026-11', closed: false, byBucket: { food: 9_000_000 } },
    { id: '2026-10', closed: true, byBucket: { food: 3_000_000, tech: 200_000 } },
    { id: '2026-09', closed: true, byBucket: { food: 2_000_000 } },
    { id: '2026-08', closed: true, byBucket: { food: 4_000_000 } },
  ];
  const r = lastCycles(rows, ['food', 'tech', 'beauty']);
  assert.deepEqual(r.cycleIds, ['2026-10', '2026-09', '2026-08']);
  assert.deepEqual(r.buckets[0], { bucketId: 'food', totalVnd: 9_000_000, averageVnd: 3_000_000, peak: { cycleId: '2026-08', vnd: 4_000_000 } });
  assert.equal(r.buckets[1].averageVnd, 66_667);
  assert.equal(r.buckets[2].peak, null);
  assert.equal(r.totalVnd, 9_200_000);
});

test('at most n cycles', () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ id: `2025-${String(i + 1).padStart(2, '0')}`, closed: true, byBucket: { food: 1 } }));
  assert.equal(lastCycles(rows, ['food'], 12).cycleIds.length, 12);
});
