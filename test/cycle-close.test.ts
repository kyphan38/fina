import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSurplus } from '@/lib/cycles';
import { allocate } from '@/lib/generator';
import { SEED_BUCKETS, type Bucket } from '@/types/fina';

const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s,
  balanceVnd: 0,
  active: true,
  createdAt: 0,
  updatedAt: 0,
}));

test('computeSurplus - cộng trên mọi bucket budget', () => {
  const limits = { food: 3_000_000, beauty: 1_800_000, tech: 800_000 };
  const spent = { food: 2_640_000, beauty: 1_790_000, tech: 990_000 };
  // +360.000 +10.000 −190.000
  assert.equal(computeSurplus(limits, spent), 180_000);
});

test('computeSurplus - bucket chưa tiêu gì thì dư trọn hạn mức', () => {
  assert.equal(computeSurplus({ food: 3_000_000 }, {}), 3_000_000);
});

test('computeSurplus - âm khi tiêu lố tổng thể', () => {
  assert.equal(computeSurplus({ food: 1_000_000 }, { food: 1_500_000 }), -500_000);
});

test('computeSurplus - bỏ qua chi tiêu vào bucket không có trong limits', () => {
  // Quỹ và ETF không nằm trong limits, không được kéo surplus xuống.
  const s = computeSurplus({ food: 1_000_000 }, { food: 400_000, travel: 9_000_000 });
  assert.equal(s, 600_000);
});

test('allocate - ETF là phần dư, phần trăm là kết quả tính ra', () => {
  const r = allocate(39_065_000, buckets);
  assert.equal(r.monthlyTotalVnd, 7_500_000);
  assert.equal(r.fundsTotalVnd, 9_050_000);
  assert.equal(r.etfVnd, 39_065_000 - 7_500_000 - 9_050_000);
  assert.equal(r.etfVnd, 22_515_000);
  assert.equal(Math.round(r.etfPercent), 58);
});

test('allocate - tăng một baseline thì ETF tụt đúng bằng chừng đó', () => {
  const before = allocate(39_065_000, buckets).etfVnd;
  const bumped = buckets.map((b) =>
    b.id === 'food' ? { ...b, baselineVnd: b.baselineVnd + 1_000_000 } : b,
  );
  assert.equal(allocate(39_065_000, bumped).etfVnd, before - 1_000_000);
});

test('allocate - lương thiếu thì ETF âm, không tự cắt bucket nào', () => {
  const r = allocate(10_000_000, buckets);
  assert.ok(r.etfVnd < 0);
  assert.equal(r.monthlyTotalVnd, 7_500_000);
  assert.equal(r.fundsTotalVnd, 9_050_000);
});

test('allocate - ETF không tự tính vào phần quỹ', () => {
  const r = allocate(39_065_000, buckets);
  assert.ok(!r.funds.some((a) => a.bucket.id === 'etf'));
});

test('allocate - bucket đã tắt thì không được phân bổ', () => {
  const off = buckets.map((b) => (b.id === 'travel' ? { ...b, active: false } : b));
  assert.equal(allocate(39_065_000, off).fundsTotalVnd, 9_050_000 - 1_200_000);
});
