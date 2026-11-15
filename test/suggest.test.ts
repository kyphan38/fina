import assert from 'node:assert/strict';
import { test } from 'node:test';

import { topAmounts } from '@/lib/suggest';

const NOW = Date.UTC(2026, 10, 15);
const DAY = 86_400_000;
const tx = (amountVnd: number, daysAgo: number, extra: Partial<{ bucketId: string; direction: 'out' | 'in'; source: 'web' | 'import' | 'allocation' | 'opening' | 'move' }> = {}) => ({
  bucketId: 'food',
  direction: 'out' as const,
  source: 'web' as const,
  amountVnd,
  occurredAt: NOW - daysAgo * DAY,
  ...extra,
});

test('most often logged amounts come first, ties go to the most recent', () => {
  const txs = [tx(35_000, 1), tx(35_000, 2), tx(35_000, 3), tx(50_000, 10), tx(50_000, 11), tx(25_000, 4), tx(25_000, 5)];
  assert.deepEqual(topAmounts(txs, 'food', NOW), [35_000, 25_000, 50_000]);
});

test('an amount logged once is not a habit yet', () => {
  assert.deepEqual(topAmounts([tx(35_000, 1), tx(99_000, 1), tx(35_000, 2)], 'food', NOW), [35_000]);
});

test('only this bucket, only spending, only typed or imported, only the last 60 days', () => {
  const txs = [
    tx(35_000, 1), tx(35_000, 2),
    tx(40_000, 1, { bucketId: 'coffee' }), tx(40_000, 2, { bucketId: 'coffee' }),
    tx(60_000, 1, { direction: 'in' }), tx(60_000, 2, { direction: 'in' }),
    tx(500_000, 1, { source: 'allocation' }), tx(500_000, 2, { source: 'allocation' }),
    tx(70_000, 61), tx(70_000, 62),
    tx(45_000, 1, { source: 'import' }), tx(45_000, 3, { source: 'import' }),
  ];
  assert.deepEqual(topAmounts(txs, 'food', NOW), [35_000, 45_000]);
});

test('no history gives no buttons', () => {
  assert.deepEqual(topAmounts([], 'food', NOW), []);
});
