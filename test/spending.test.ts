import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSpending, netSpending } from '@/lib/spending';
import type { Transaction } from '@/types/fina';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', occurredAt: 0, cycle: '2026-10', bucketId: 'food', bank: 'VCB',
  amountVnd: 100_000, direction: 'out', note: null, source: 'web',
  createdAt: 0, updatedAt: 0, ...over,
});

test('isSpending - allocation into funds is not spending', () => {
  assert.equal(isSpending(tx({ bucketId: 'travel', source: 'allocation', direction: 'in' })), false);
});

test('isSpending - ETF top-ups and withdrawals are not spending', () => {
  assert.equal(isSpending(tx({ bucketId: 'etf', direction: 'in' })), false);
  assert.equal(isSpending(tx({ bucketId: 'etf', direction: 'out' })), false);
});

test('isSpending - normal spending and refunds both count', () => {
  assert.equal(isSpending(tx({})), true);
  assert.equal(isSpending(tx({ direction: 'in' })), true);
});

test('netSpending - refunds are subtracted', () => {
  // Paid 850 for a picnic, friends paid back 430 -> really spent 420
  const rows = [
    tx({ bucketId: 'social', amountVnd: 850_000 }),
    tx({ bucketId: 'social', amountVnd: 430_000, direction: 'in' }),
  ];
  assert.equal(netSpending(rows), 420_000);
});

test('netSpending - the real bug: an ETF top-up must not pull the total down', () => {
  const rows = [
    tx({ bucketId: 'food', amountVnd: 3_840_000 }),
    tx({ bucketId: 'etf', amountVnd: 3_425_000, direction: 'in' }),
  ];
  // The old version gave 415.000 because it also subtracted the ETF top-up.
  assert.equal(netSpending(rows), 3_840_000);
});

test('netSpending - splitting salary into funds is not spending', () => {
  const rows = [
    tx({ bucketId: 'food', amountVnd: 500_000 }),
    tx({ bucketId: 'travel', amountVnd: 2_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'purchases', amountVnd: 3_000_000, direction: 'in', source: 'allocation' }),
  ];
  assert.equal(netSpending(rows), 500_000);
});

test('netSpending - spending FROM a fund is still spending', () => {
  const rows = [tx({ bucketId: 'travel', bank: 'BIDV', amountVnd: 1_200_000 })];
  assert.equal(netSpending(rows), 1_200_000);
});

test('regression - source must stay "allocation" when read from Firestore', () => {
  // toTx() once forced every unknown source to 'web', so isSpending() missed
  // the salary split and subtracted 10.500 from Out.
  const rows = [
    tx({ bucketId: 'food', amountVnd: 3_815_000 }),
    tx({ bucketId: 'healthFund', amountVnd: 3_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'purchases', amountVnd: 3_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'travel', amountVnd: 2_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'reserve', amountVnd: 2_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'emergency', amountVnd: 500_000, direction: 'in', source: 'allocation' }),
  ];
  assert.equal(netSpending(rows), 3_815_000);
});

test('a pre-existing balance is not spending', () => {
  // The opening balance is a STATE, not any cycle's expense.
  const rows = [
    tx({ bucketId: 'etf', amountVnd: 177_714_000, direction: 'in', source: 'opening' }),
    tx({ bucketId: 'travel', bank: 'BIDV', amountVnd: 3_600_000, direction: 'in', source: 'opening' }),
  ];
  assert.equal(netSpending(rows), 0);
});

test('isSpending - a move between funds is not spending', () => {
  assert.equal(isSpending(tx({ bucketId: 'purchases', source: 'move', direction: 'out' })), false);
  assert.equal(isSpending(tx({ bucketId: 'travel', source: 'move', direction: 'in' })), false);
});
