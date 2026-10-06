import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balanceDeltas, type TxShape } from '@/lib/tx-edit';

const fund = (id: string, amountVnd: number): TxShape =>
  ({ bucketId: id, kind: 'fund', amountVnd, direction: 'out' });
const budget = (id: string, amountVnd: number): TxShape =>
  ({ bucketId: id, kind: 'budget', amountVnd, direction: 'out' });
const inTo = (id: string, amountVnd: number): TxShape =>
  ({ bucketId: id, kind: 'fund', amountVnd, direction: 'in' });

test('edit the amount, same fund', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 500_000), fund('travel', 800_000)), {
    travel: -300_000,
  });
  assert.deepEqual(balanceDeltas(fund('travel', 800_000), fund('travel', 500_000)), {
    travel: 300_000,
  });
});

test('move from fund A to fund B', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 800_000), fund('purchases', 800_000)), {
    travel: 800_000,
    purchases: -800_000,
  });
});

test('move from budget to fund', () => {
  assert.deepEqual(balanceDeltas(budget('food', 250_000), fund('travel', 250_000)), {
    travel: -250_000,
  });
});

test('move from fund to budget', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 250_000), budget('food', 250_000)), {
    travel: 250_000,
  });
});

test('deleting a fund transaction refunds it', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 250_000), null), { travel: 250_000 });
});

test('changes within budget buckets never touch a balance', () => {
  assert.deepEqual(balanceDeltas(budget('food', 25_000), budget('social', 90_000)), {});
  assert.deepEqual(balanceDeltas(budget('food', 25_000), null), {});
  assert.deepEqual(balanceDeltas(null, budget('food', 25_000)), {});
});

test('editing only the note or date creates no update', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 500_000), fund('travel', 500_000)), {});
});

test('a new transaction reduces the fund balance', () => {
  assert.deepEqual(balanceDeltas(null, fund('travel', 500_000)), { travel: -500_000 });
});

test('money IN adds to the balance - ETF top-ups and refunds', () => {
  assert.deepEqual(balanceDeltas(null, inTo('etf', 3_425_000)), { etf: 3_425_000 });
  assert.deepEqual(balanceDeltas(inTo('etf', 3_425_000), null), { etf: -3_425_000 });
  assert.deepEqual(balanceDeltas(inTo('etf', 1_000_000), inTo('etf', 1_500_000)), {
    etf: 500_000,
  });
  // Paid for a picnic from the Travel fund, then got paid back
  assert.deepEqual(balanceDeltas(null, inTo('travel', 1_000_000)), { travel: 1_000_000 });
});

test('flipping a transaction\'s direction moves the balance twice', () => {
  // A refund logged as an expense by mistake, then fixed
  assert.deepEqual(balanceDeltas(fund('travel', 500_000), inTo('travel', 500_000)), {
    travel: 1_000_000,
  });
});

test('moving a mistaken expense to ETF: both funds go the right way', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 1_000_000), inTo('etf', 1_000_000)), {
    travel: 1_000_000,
    etf: 1_000_000,
  });
});
