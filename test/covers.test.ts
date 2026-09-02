import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverOptions, coveredByBucket, coveredFromOutside } from '@/lib/covers';
import { computeSurplus } from '@/lib/cycles';
import { SEED_BUCKETS, type Bucket, type Cover } from '@/types/fina';

const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s,
  balanceVnd: s.kind === 'fund' ? 5_000_000 : 0,
  active: true,
  createdAt: 0,
  updatedAt: 0,
}));

const cover = (over: Partial<Cover> = {}): Cover => ({
  id: 'c1', txId: 't1', cycle: '2026-09', toBucketId: 'tech', fromBucketId: 'buffer',
  amountVnd: 790_000, needsTransfer: false, status: 'done', createdAt: 0, confirmedAt: 0,
  ...over,
});

test('coverOptions - Buffer đứng đầu, ETF không bao giờ là nguồn', () => {
  const opts = coverOptions({
    buckets, toBucketId: 'tech', bufferLimitVnd: 1_000_000, bufferUsedVnd: 190_000,
    neededVnd: 790_000,
  });
  assert.equal(opts[0].bucket.id, 'buffer');
  assert.ok(!opts.some((o) => o.bucket.id === 'etf'));
});

test('coverOptions - không tự bù cho chính mình', () => {
  const opts = coverOptions({
    buckets, toBucketId: 'travel', bufferLimitVnd: 1_000_000, bufferUsedVnd: 0,
    neededVnd: 100_000,
  });
  assert.ok(!opts.some((o) => o.bucket.id === 'travel'));
});

test('coverOptions - Buffer không đủ thì vẫn hiện, chỉ đánh dấu không đủ', () => {
  const opts = coverOptions({
    buckets, toBucketId: 'tech', bufferLimitVnd: 1_000_000, bufferUsedVnd: 800_000,
    neededVnd: 790_000,
  });
  const buffer = opts.find((o) => o.bucket.id === 'buffer')!;
  assert.equal(buffer.availableVnd, 200_000);
  assert.equal(buffer.enough, false);
  // Vẫn nằm trong danh sách - ẩn đi thì không ai hiểu vì sao nó biến mất.
  assert.ok(opts.length > 1);
});

test('coverOptions - quỹ âm thì phần dùng được là 0, không phải số âm', () => {
  const negative = buckets.map((b) => (b.id === 'travel' ? { ...b, balanceVnd: -300_000 } : b));
  const opts = coverOptions({
    buckets: negative, toBucketId: 'tech', bufferLimitVnd: 0, bufferUsedVnd: 0,
    neededVnd: 100_000,
  });
  assert.equal(opts.find((o) => o.bucket.id === 'travel')!.availableVnd, 0);
});

test('coveredByBucket - chỉ tính lần bù đã xong', () => {
  const covers = [
    cover({ id: 'a', amountVnd: 300_000 }),
    cover({ id: 'b', amountVnd: 500_000, status: 'pending', fromBucketId: 'reserve' }),
    cover({ id: 'c', amountVnd: 200_000 }),
  ];
  assert.deepEqual(coveredByBucket(covers), { buffer: 500_000 });
});

test('coveredFromOutside - chỉ đếm tiền từ BIDV chảy vào', () => {
  const covers = [
    cover({ id: 'a', fromBucketId: 'buffer', amountVnd: 300_000 }),
    cover({ id: 'b', fromBucketId: 'reserve', amountVnd: 500_000, needsTransfer: true }),
    cover({ id: 'c', fromBucketId: 'travel', amountVnd: 120_000, needsTransfer: true, status: 'pending' }),
  ];
  // Buffer ở VCB nên không tính; travel còn pending nên chưa tính.
  assert.equal(coveredFromOutside(covers, buckets), 500_000);
});

test('surplus - bù từ Buffer không đổi tổng, bù từ BIDV thì có', () => {
  const limits = { food: 3_000_000, tech: 800_000 };
  const spent = { food: 2_640_000, tech: 990_000 };
  const base = computeSurplus(limits, spent); // 360.000 − 190.000 = 170.000

  const fromBuffer = [cover({ fromBucketId: 'buffer', amountVnd: 190_000 })];
  assert.equal(base + coveredFromOutside(fromBuffer, buckets), 170_000);

  const fromReserve = [cover({ fromBucketId: 'reserve', amountVnd: 190_000, needsTransfer: true })];
  assert.equal(base + coveredFromOutside(fromReserve, buckets), 360_000);
});
