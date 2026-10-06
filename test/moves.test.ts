import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collapseMoves, moveError, movableFunds, pairMoves } from '@/lib/moves';
import { netSpending } from '@/lib/spending';
import { SEED_BUCKETS, type Bucket, type Transaction } from '@/types/fina';

const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s, balanceVnd: s.kind === 'fund' ? 2_000_000 : 0, active: true, goal: null,
  createdAt: 0, updatedAt: 0,
}));
const byId = (id: string) => buckets.find((b) => b.id === id)!;

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', occurredAt: 0, cycle: '2026-10', bucketId: 'food', bank: 'VCB',
  amountVnd: 100_000, direction: 'out', note: null, source: 'web',
  createdAt: 0, updatedAt: 0, ...over,
});

// Purchases -> Phone 1.500
const out = tx({ id: 'm1-out', bucketId: 'purchases', bank: 'BIDV', amountVnd: 1_500_000,
  direction: 'out', source: 'move', moveId: 'm1' });
const into = tx({ id: 'm1-in', bucketId: 'travel', bank: 'BIDV', amountVnd: 1_500_000,
  direction: 'in', source: 'move', moveId: 'm1' });

test('movableFunds - BIDV funds only, no VCB buckets or ETF', () => {
  const ids = movableFunds(buckets).map((b) => b.id);
  assert.ok(ids.includes('purchases'));
  assert.ok(!ids.includes('food'));
  assert.ok(!ids.includes('etf'));
});

test('moveError - the two funds must differ', () => {
  assert.equal(moveError(byId('purchases'), byId('purchases'), 100_000), 'Pick two different funds.');
});

test('moveError - cannot move more than the source balance', () => {
  assert.ok(moveError(byId('purchases'), byId('travel'), 2_000_001));
  assert.equal(moveError(byId('purchases'), byId('travel'), 2_000_000), null);
});

test('moveError - no error before an amount is typed', () => {
  assert.equal(moveError(byId('purchases'), byId('travel'), null), null);
});

test('a move is not spending', () => {
  assert.equal(netSpending([out, into]), 0);
  assert.equal(netSpending([out, into, tx({ amountVnd: 50_000 })]), 50_000);
});

test('a move keeps the funds total the same', () => {
  const sum = [out, into].reduce((s, t) => s + (t.direction === 'in' ? t.amountVnd : -t.amountVnd), 0);
  assert.equal(sum, 0);
});

test('pairMoves - groups both sides by moveId', () => {
  const pair = pairMoves([out, tx({}), into]).get('m1')!;
  assert.equal(pair.from, out);
  assert.equal(pair.to, into);
});

test('collapseMoves - one History row per move', () => {
  const food = tx({ id: 'f' });
  assert.deepEqual(collapseMoves([out, food, into]), [food, into]);
});

test('collapseMoves - keeps the source side when the target is missing', () => {
  assert.deepEqual(collapseMoves([out]), [out]);
});
