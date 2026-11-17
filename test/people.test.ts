import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  balanceWord,
  balancesFromTxs,
  bankExtra,
  canArchive,
  historyRows,
  canCountAsSpending,
  cleanPersonName,
  openBalances,
  personDelta,
  runningBalance,
} from '@/lib/people';
import { isSpending, netSpending } from '@/lib/spending';
import type { Person, Transaction } from '@/types/fina';

const person = (over: Partial<Person>): Person => ({
  id: 'p', name: 'Mẹ', balanceVnd: 0, archived: false, createdAt: 0, updatedAt: 0, ...over,
});
const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', occurredAt: 0, cycle: '2026-11', bucketId: 'people', bank: 'VCB',
  amountVnd: 100_000, direction: 'out', note: null, source: 'web',
  createdAt: 0, updatedAt: 0, personId: 'me', ...over,
});

test('personDelta - out raises, in lowers', () => {
  assert.equal(personDelta('out', 500), 500);
  assert.equal(personDelta('in', 500), -500);
});

test('People entries are never spending', () => {
  assert.equal(isSpending(tx({})), false);
  assert.equal(isSpending(tx({ direction: 'in' })), false);
  // A loan in and real spending: only the spending counts.
  const rows = [tx({ direction: 'in', amountVnd: 2_000_000 }), tx({ personId: undefined, bucketId: 'beauty', amountVnd: 300_000 })];
  assert.equal(netSpending(rows), 300_000);
});

test('case A - insurance pays back part, the rest can count as spending', () => {
  const bal = balancesFromTxs([
    tx({ personId: 'ins', direction: 'out', amountVnd: 1_200_000 }),
    tx({ personId: 'ins', direction: 'in', amountVnd: 1_000_000 }),
  ]);
  assert.equal(bal.ins, 200_000);
  assert.equal(canCountAsSpending(person({ balanceVnd: bal.ins })), true);
});

test('case D - money held for a trip ends at zero', () => {
  const bal = balancesFromTxs([
    tx({ personId: 'trip', direction: 'in', amountVnd: 10_000_000 }),
    tx({ personId: 'trip', direction: 'out', amountVnd: 3_000_000 }),
    tx({ personId: 'trip', direction: 'out', amountVnd: 6_500_000 }),
    tx({ personId: 'trip', direction: 'out', amountVnd: 500_000 }),
  ]);
  assert.equal(bal.trip, 0);
});

test('cleanPersonName - trims and refuses duplicates and empty names', () => {
  const people = [person({ name: 'Mẹ' }), person({ name: 'Old', archived: true })];
  assert.equal(cleanPersonName('  Anh   Hai ', people), 'Anh Hai');
  assert.equal(cleanPersonName('mẹ', people), null);
  assert.equal(cleanPersonName('Old', people), 'Old');
  assert.equal(cleanPersonName('   ', people), null);
});

test('openBalances - only open people with money, biggest first', () => {
  const list = openBalances([
    person({ id: 'a', name: 'A', balanceVnd: 200_000 }),
    person({ id: 'b', name: 'B', balanceVnd: -5_000_000 }),
    person({ id: 'c', name: 'C', balanceVnd: 0 }),
    person({ id: 'd', name: 'D', balanceVnd: 900, archived: true }),
  ]);
  assert.deepEqual(list.map((p) => p.id), ['b', 'a']);
});

test('balanceWord, archive and bank check', () => {
  assert.equal(balanceWord(1), 'owes you');
  assert.equal(balanceWord(-1), 'you owe');
  assert.equal(balanceWord(0), 'settled');
  assert.equal(canArchive(person({ balanceVnd: 0 })), true);
  assert.equal(canArchive(person({ balanceVnd: 5 })), false);
  // Owe 2.000, owed 500: the bank holds 1.500 more than the buckets.
  assert.equal(bankExtra([person({ balanceVnd: -2_000_000 }), person({ balanceVnd: 500_000 })]), 1_500_000);
});

test('runningBalance - oldest first with the balance after each', () => {
  const rows = runningBalance([
    tx({ occurredAt: 2, direction: 'out', amountVnd: 2_000_000 }),
    tx({ occurredAt: 1, direction: 'in', amountVnd: 2_000_000 }),
  ]);
  assert.deepEqual(rows.map((r) => r.after), [-2_000_000, 0]);
});

test('historyRows - People hidden by default, a person filter shows only them', () => {
  const rows = [tx({ id: 'a', personId: 'me' }), tx({ id: 'b', personId: 'dv' }), tx({ id: 'c', personId: undefined, bucketId: 'food' })];
  assert.deepEqual(historyRows(rows, null, false).map((t) => t.id), ['c']);
  assert.deepEqual(historyRows(rows, null, true).map((t) => t.id), ['a', 'b', 'c']);
  assert.deepEqual(historyRows(rows, 'person:dv', false).map((t) => t.id), ['b']);
  assert.deepEqual(historyRows(rows, 'food', false).map((t) => t.id), ['c']);
});
