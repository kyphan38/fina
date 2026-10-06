import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEED_BUCKETS } from '@/types/fina';

// Firestore rules enforce `standardVnd is int`. One float multiplication
// (4.1 * 1_000_000 = 4099999.9999999995) rejects the whole seed batch, and
// the only UI symptom is "12 rows appear, then vanish" - very hard to guess.
test('every seed amount is an integer', () => {
  for (const b of SEED_BUCKETS) {
    assert.ok(
      Number.isInteger(b.standardVnd),
      `${b.id}.standardVnd = ${b.standardVnd} is not an integer`,
    );
  }
});

test('every bucket has a content hint', () => {
  for (const b of SEED_BUCKETS) {
    assert.ok(b.hint && b.hint.length > 10, `${b.id} has no hint`);
  }
});

test('seed has no negatives and no duplicate id / order', () => {
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const b of SEED_BUCKETS) {
    assert.ok(b.standardVnd >= 0, `${b.id} has a negative standard`);
    assert.ok(!ids.has(b.id), `duplicate id: ${b.id}`);
    assert.ok(!orders.has(b.order), `duplicate order: ${b.order} (${b.id})`);
    ids.add(b.id);
    orders.add(b.order);
  }
});

test('seed matches the agreed structure: 6 VCB budgets, 5 BIDV funds, 1 ETF at VPS', () => {
  const budget = SEED_BUCKETS.filter((b) => b.kind === 'budget');
  const funds = SEED_BUCKETS.filter((b) => b.kind === 'fund');
  assert.equal(budget.length, 6);
  assert.ok(budget.every((b) => b.bank === 'VCB'));
  assert.equal(funds.filter((b) => b.bank === 'BIDV').length, 5);
  assert.deepEqual(
    funds.filter((b) => b.bank === 'VPS').map((b) => b.id),
    ['etf'],
  );
});

test('the allocation total matches the number agreed in ROADMAP', () => {
  const sum = (kind: 'budget' | 'fund', bank: string) =>
    SEED_BUCKETS.filter((b) => b.kind === kind && b.bank === bank).reduce(
      (a, b) => a + b.standardVnd,
      0,
    );
  // The numbers the user agreed on 2026-09-02 - see AMENDMENT-limits-and-standards.md
  assert.equal(sum('budget', 'VCB'), 7_000_000);
  assert.equal(sum('fund', 'BIDV'), 10_500_000);
});
