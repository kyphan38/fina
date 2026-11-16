import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fold, searchTxs } from '@/lib/tx-search';
import type { Transaction } from '@/types/fina';

const tx = (id: string, amountVnd: number, note: string | null, occurredAt: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, amountVnd, note, occurredAt, cycle: '2026-11', bucketId: 'food', bank: 'VCB', direction: 'out', source: 'web', createdAt: 0, updatedAt: 0, ...extra,
});
const names = (id: string) => ({ food: 'Food', social: 'Social' })[id] ?? id;

test('fold ignores case, marks and extra spaces', () => {
  assert.equal(fold('  Cà  Phê Đá '), 'ca phe da');
});

test('text finds notes and bucket names, newest first, with a spending total', () => {
  const txs = [tx('a', 35_000, 'cà phê', 1), tx('b', 40_000, 'Cafe', 3), tx('c', 30_000, 'Cà Phê sữa', 2), tx('d', 10_000, 'refund cà phê', 4, { direction: 'in' })];
  const r = searchTxs(txs, 'ca phe', names);
  assert.deepEqual(r.rows.map((t) => t.id), ['d', 'c', 'a']);
  assert.equal(r.total, 55_000);
  assert.equal(searchTxs(txs, 'food', names).rows.length, 4);
});

test('a number finds that amount in thousands', () => {
  const txs = [tx('a', 35_000, 'x', 1), tx('b', 35_500, 'y', 2), tx('c', 350_000, 'z', 3)];
  assert.deepEqual(searchTxs(txs, '35', names).rows.map((t) => t.id), ['a']);
  assert.deepEqual(searchTxs(txs, '35.5', names).rows.map((t) => t.id), ['b']);
});

test('empty query finds nothing', () => {
  assert.deepEqual(searchTxs([tx('a', 1000, 'x', 1)], '  ', names), { rows: [], total: 0, more: false });
});
