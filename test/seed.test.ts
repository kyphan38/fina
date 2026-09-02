import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEED_BUCKETS } from '@/types/fina';

// Firestore rules chặn `baselineVnd is int`. Một phép nhân với số thực
// (4.1 * 1_000_000 = 4099999.9999999995) làm cả batch seed bị từ chối, và
// triệu chứng ở UI chỉ là "hiện 12 dòng rồi biến mất" - rất khó đoán ra.
test('mọi số tiền trong seed phải là số nguyên', () => {
  for (const b of SEED_BUCKETS) {
    assert.ok(
      Number.isInteger(b.baselineVnd),
      `${b.id}.baselineVnd = ${b.baselineVnd} không phải số nguyên`,
    );
    if (b.goal) {
      assert.ok(
        Number.isInteger(b.goal.targetVnd),
        `${b.id}.goal.targetVnd = ${b.goal.targetVnd} không phải số nguyên`,
      );
    }
  }
});

test('standard và baseline khởi đầu bằng nhau, và đều là số nguyên', () => {
  for (const b of SEED_BUCKETS) {
    assert.ok(Number.isInteger(b.standardVnd), `${b.id}.standardVnd không nguyên`);
    assert.equal(b.standardVnd, b.baselineVnd, `${b.id}: standard khác baseline lúc seed`);
  }
});

test('mọi bucket đều có gợi ý nội dung', () => {
  for (const b of SEED_BUCKETS) {
    assert.ok(b.hint && b.hint.length > 10, `${b.id} thiếu hint`);
  }
});

test('seed không âm và không trùng id / order', () => {
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const b of SEED_BUCKETS) {
    assert.ok(b.baselineVnd >= 0, `${b.id} có baseline âm`);
    assert.ok(!ids.has(b.id), `id trùng: ${b.id}`);
    assert.ok(!orders.has(b.order), `order trùng: ${b.order} (${b.id})`);
    ids.add(b.id);
    orders.add(b.order);
  }
});

test('seed khớp cấu trúc đã chốt: 6 budget VCB, 5 fund BIDV, 1 ETF ở VPS', () => {
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

test('tổng phân bổ khớp con số đã chốt trong ROADMAP', () => {
  const sum = (kind: 'budget' | 'fund', bank: string) =>
    SEED_BUCKETS.filter((b) => b.kind === kind && b.bank === bank).reduce(
      (a, b) => a + b.baselineVnd,
      0,
    );
  // Bộ số người dùng chốt 2026-09-02 - xem AMENDMENT-limits-and-standards.md
  assert.equal(sum('budget', 'VCB'), 7_000_000);
  assert.equal(sum('fund', 'BIDV'), 10_500_000);
});
