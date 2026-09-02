import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAnalyze, computeSignals, type CycleFacts } from '@/lib/signals';
import { SEED_BUCKETS, type Bucket } from '@/types/fina';

const K = 1000;
const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s, balanceVnd: 0, active: true, createdAt: 0, updatedAt: 0,
}));

const cycle = (id: string, over: Partial<CycleFacts> = {}): CycleFacts => ({
  id, closed: true, inVnd: 39_065 * K, outVnd: 0, investedVnd: 0, leftVnd: 0,
  byBucket: {}, limits: { food: 3_000 * K, social: 1_000 * K }, ...over,
});

const base = (food: number[], current: number) => ({
  cycles: [
    ...food.map((v, i) => cycle(`2026-0${i + 4}`, { byBucket: { food: v * K }, leftVnd: 10_000 * K })),
    cycle('2026-09', { closed: false, byBucket: { food: current * K } }),
  ],
  buckets, amounts: [], day: 9, totalDays: 30,
});

test('trung vị và độ lệch tính trên các chu kỳ ĐÃ ĐÓNG', () => {
  const s = computeSignals(base([1_000, 2_000, 3_000], 4_000));
  const food = s.buckets.find((b) => b.bucketId === 'food')!;
  assert.equal(food.medianVnd, 2_000 * K);
  assert.equal(food.currentVnd, 4_000 * K);
  assert.equal(food.deviationPct, 100);
  assert.equal(s.closedCount, 3);
});

test('tăng liên tiếp 3 chu kỳ mới gọi là xu hướng', () => {
  assert.equal(computeSignals(base([1_000, 2_000, 3_000], 4_000)).buckets.find((b) => b.bucketId === 'food')!.rising, true);
  // Chững lại ở chu kỳ cuối thì không phải
  assert.equal(computeSignals(base([1_000, 2_000, 3_000], 3_000)).buckets.find((b) => b.bucketId === 'food')!.rising, false);
  // Lên xuống thất thường cũng không phải
  assert.equal(computeSignals(base([1_000, 5_000, 2_000], 4_000)).buckets.find((b) => b.bucketId === 'food')!.rising, false);
});

test('đếm số chu kỳ vượt hạn mức, kèm mẫu số', () => {
  const s = computeSignals(base([3_500, 2_000, 3_900], 100));
  const food = s.buckets.find((b) => b.bucketId === 'food')!;
  assert.equal(food.overCount, 2);
  assert.equal(food.overOf, 3);
});

test('nhịp CHỈ áp cho bucket tiêu đều', () => {
  const s = computeSignals(base([1_000], 1_500));
  const ids = s.pace.map((p) => p.bucketId).sort();
  assert.deepEqual(ids, ['food', 'utilities']);
  // Beauty và Purchases tiêu theo cục - không có mặt ở đây
  assert.ok(!ids.includes('beauty'));
});

test('nhịp so ngày đã trôi với phần hạn mức đã tiêu', () => {
  const s = computeSignals(base([1_000], 1_500));
  const food = s.pace.find((p) => p.bucketId === 'food')!;
  assert.equal(food.elapsedPct, 30); // ngày 9 / 30
  assert.equal(food.spentPct, 50); // 1.500 / 3.000
});

test('khoản lạc loài: lớn hơn 3 lần trung vị của chính bucket đó', () => {
  const args = base([500, 500, 500], 2_000);
  const s = computeSignals({
    ...args,
    amounts: [
      { bucketId: 'food', amountVnd: 1_600 * K }, // > 3x trung vị 500
      { bucketId: 'food', amountVnd: 400 * K },   // bình thường
    ],
  });
  assert.equal(s.outliers.length, 1);
  assert.equal(s.outliers[0].amountVnd, 1_600 * K);
});

test('quỹ im lặng 3 chu kỳ và còn tiền thì mới nhắc', () => {
  const withMoney = buckets.map((b) => (b.id === 'travel' ? { ...b, balanceVnd: 6_400 * K } : b));
  const cycles = ['2026-06', '2026-07', '2026-08'].map((id) => cycle(id));
  const s = computeSignals({
    cycles: [...cycles, cycle('2026-09', { closed: false })],
    buckets: withMoney, amounts: [], day: 9, totalDays: 30,
  });
  const travel = s.idleFunds.find((x) => x.bucketId === 'travel');
  assert.ok(travel);
  assert.ok(travel.idleCycles >= 3);

  // Quỹ rỗng thì im lặng cũng chẳng có gì để nói
  const empty = computeSignals({
    cycles: [...cycles, cycle('2026-09', { closed: false })],
    buckets, amounts: [], day: 9, totalDays: 30,
  });
  assert.equal(empty.idleFunds.length, 0);
});

test('quỹ âm luôn được nêu, không cần chờ đủ chu kỳ', () => {
  const neg = buckets.map((b) => (b.id === 'travel' ? { ...b, balanceVnd: -500 * K } : b));
  const s = computeSignals({
    cycles: [cycle('2026-09', { closed: false })],
    buckets: neg, amounts: [], day: 1, totalDays: 30,
  });
  assert.deepEqual(s.negativeFunds.map((x) => x.bucketId), ['travel']);
});

test('canAnalyze chặn dưới 3 chu kỳ đã đóng', () => {
  assert.equal(canAnalyze(computeSignals(base([1_000, 2_000], 1_000))), false);
  assert.equal(canAnalyze(computeSignals(base([1_000, 2_000, 3_000], 1_000))), true);
});

test('không có lịch sử thì không bịa ra độ lệch', () => {
  const s = computeSignals({
    cycles: [cycle('2026-09', { closed: false, byBucket: { food: 500 * K } })],
    buckets, amounts: [], day: 1, totalDays: 30,
  });
  assert.equal(s.buckets.find((b) => b.bucketId === 'food')!.deviationPct, null);
  assert.equal(s.cashflow.leftDeviationPct, null);
});
