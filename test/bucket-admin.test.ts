import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hideBlocker, newBucketId, nextMonthlyOrder } from '@/lib/bucket-admin';

test('new bucket ids are readable and never reuse a taken id', () => {
  assert.equal(newBucketId('Bố mẹ', ['food']), 'bo-me');
  assert.equal(newBucketId('Food', ['food']), 'food-2');
  assert.equal(newBucketId('Food', ['food', 'food-2']), 'food-3');
  assert.equal(newBucketId('!!!', []), 'bucket');
});

test('a new monthly bucket goes right after the last monthly one', () => {
  const b = (kind: 'budget' | 'fund', order: number) => ({ kind, order });
  assert.equal(nextMonthlyOrder([b('budget', 10), b('budget', 60), b('fund', 70)]), 61);
  assert.equal(nextMonthlyOrder([b('fund', 70)]), 10);
});

test('only a fund holding money cannot be hidden', () => {
  assert.equal(hideBlocker({ kind: 'budget', balanceVnd: 0 }), null);
  assert.equal(hideBlocker({ kind: 'fund', balanceVnd: 0 }), null);
  assert.match(hideBlocker({ kind: 'fund', balanceVnd: 500_000 }) ?? '', /Move the money/);
});
