import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverBalanceDeltas, coverOptions, coveredByBucket, coveredFromOutside } from '@/lib/covers';
import { computeSurplus } from '@/lib/cycles';
import { SEED_BUCKETS, type Bucket, type Cover } from '@/types/fina';

const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s,
  goal: null,
  balanceVnd: s.kind === 'fund' ? 5_000_000 : 0,
  active: true,
  createdAt: 0,
  updatedAt: 0,
}));

const cover = (over: Partial<Cover> = {}): Cover => ({
  id: 'c1', txId: 't1', cycle: '2026-09', toBucketId: 'tech', fromBucketId: 'buffer',
  toName: 'Tech', fromName: 'Buffer',
  amountVnd: 790_000, needsTransfer: false, status: 'done', createdAt: 0, confirmedAt: 0,
  ...over,
});

test('coverOptions - Buffer comes first, ETF is never a source', () => {
  const opts = coverOptions({
    buckets, toBucketId: 'tech', bufferLimitVnd: 1_000_000, bufferUsedVnd: 190_000,
    neededVnd: 790_000,
  });
  assert.equal(opts[0].bucket.id, 'buffer');
  assert.ok(!opts.some((o) => o.bucket.id === 'etf'));
});

test('coverOptions - never covers itself', () => {
  const opts = coverOptions({
    buckets, toBucketId: 'travel', bufferLimitVnd: 1_000_000, bufferUsedVnd: 0,
    neededVnd: 100_000,
  });
  assert.ok(!opts.some((o) => o.bucket.id === 'travel'));
});

test('coverOptions - a Buffer without enough still shows, only marked short', () => {
  const opts = coverOptions({
    buckets, toBucketId: 'tech', bufferLimitVnd: 1_000_000, bufferUsedVnd: 800_000,
    neededVnd: 790_000,
  });
  const buffer = opts.find((o) => o.bucket.id === 'buffer')!;
  assert.equal(buffer.availableVnd, 200_000);
  assert.equal(buffer.enough, false);
  // Still in the list - hiding it leaves nobody knowing why it vanished.
  assert.ok(opts.length > 1);
});

test('coverOptions - a negative fund has 0 usable, not a negative amount', () => {
  const negative = buckets.map((b) => (b.id === 'travel' ? { ...b, balanceVnd: -300_000 } : b));
  const opts = coverOptions({
    buckets: negative, toBucketId: 'tech', bufferLimitVnd: 0, bufferUsedVnd: 0,
    neededVnd: 100_000,
  });
  assert.equal(opts.find((o) => o.bucket.id === 'travel')!.availableVnd, 0);
});

test('coveredByBucket - only counts completed covers', () => {
  const covers = [
    cover({ id: 'a', amountVnd: 300_000 }),
    cover({ id: 'b', amountVnd: 500_000, status: 'pending', fromBucketId: 'reserve' }),
    cover({ id: 'c', amountVnd: 200_000 }),
  ];
  // The giver counts positive, the receiver negative. Pending covers do not count.
  assert.deepEqual(coveredByBucket(covers), { buffer: 500_000, tech: -500_000 });
});

test('coveredByBucket - the RECEIVER is credited, not only the giver', () => {
  // Real case: Social short 500, 505 moved from Purchases. Recording only the
  // giver leaves Social at -500 even though the money is in the wallet.
  //   limit 1.000, spent 1.500 -> used = 1.500 - 505 = 995 -> 5 left.
  const net = coveredByBucket([
    cover({ fromBucketId: 'purchases', toBucketId: 'social', amountVnd: 505_000 }),
  ]);
  assert.equal(net.purchases, 505_000);
  assert.equal(net.social, -505_000);

  const limit = 1_000_000;
  const spent = 1_500_000;
  assert.equal(limit - (spent + net.social), 5_000);
});

test('coveredByBucket - a cover inside the VCB group keeps the total', () => {
  // Buffer covers Tech: Buffer uses more, Tech uses less, the sum is 0.
  const net = coveredByBucket([
    cover({ fromBucketId: 'buffer', toBucketId: 'tech', amountVnd: 190_000 }),
  ]);
  assert.equal(Object.values(net).reduce((a, b) => a + b, 0), 0);
});

test('coveredFromOutside - only counts money flowing in from BIDV', () => {
  const covers = [
    cover({ id: 'a', fromBucketId: 'buffer', amountVnd: 300_000 }),
    cover({ id: 'b', fromBucketId: 'reserve', amountVnd: 500_000, needsTransfer: true }),
    cover({ id: 'c', fromBucketId: 'travel', amountVnd: 120_000, needsTransfer: true, status: 'pending' }),
  ];
  // Buffer is in VCB, so it does not count; travel is still pending, so not yet.
  assert.equal(coveredFromOutside(covers, buckets), 500_000);
});

test('coverBalanceDeltas - fund covers fund: one end subtracts, one end ADDS', () => {
  // Health 0, spends 250 -> the original transaction put Health at -250. Taking
  // 250 from Purchases must bring Health back to 0, not leave it negative forever.
  const deltas = coverBalanceDeltas({
    fromBucketId: 'purchases', fromKind: 'fund',
    toBucketId: 'healthFund', toKind: 'fund',
    amountVnd: 250_000,
  });
  assert.deepEqual(deltas, { purchases: -250_000, healthFund: 250_000 });
});

test('coverBalanceDeltas - covering a VCB bucket only charges the source fund', () => {
  // Budget buckets have no balance: Tech's overage reads from limit − spent.
  const deltas = coverBalanceDeltas({
    fromBucketId: 'reserve', fromKind: 'fund',
    toBucketId: 'tech', toKind: 'budget',
    amountVnd: 190_000,
  });
  assert.deepEqual(deltas, { reserve: -190_000 });
});

test('coverBalanceDeltas - Buffer covers a fund: only the target fund gains', () => {
  const deltas = coverBalanceDeltas({
    fromBucketId: 'buffer', fromKind: 'budget',
    toBucketId: 'healthFund', toKind: 'fund',
    amountVnd: 250_000,
  });
  assert.deepEqual(deltas, { healthFund: 250_000 });
});

test('coverBalanceDeltas - Buffer covers a VCB bucket: no balance changes', () => {
  const deltas = coverBalanceDeltas({
    fromBucketId: 'buffer', fromKind: 'budget',
    toBucketId: 'tech', toKind: 'budget',
    amountVnd: 190_000,
  });
  assert.deepEqual(deltas, {});
});

test('coverBalanceDeltas - all deltas sum to 0 when both ends are funds', () => {
  // A cover MOVES money between two funds, it is not extra spending: the fund total stays.
  const deltas = coverBalanceDeltas({
    fromBucketId: 'travel', fromKind: 'fund',
    toBucketId: 'reserve', toKind: 'fund',
    amountVnd: 400_000,
  });
  assert.equal(Object.values(deltas).reduce((a, b) => a + b, 0), 0);
});

test('coveredFromOutside - BIDV fund to BIDV fund never passes VCB, so it does not count', () => {
  const covers = [
    // Purchases to Health: both in BIDV, VCB sees nothing.
    cover({ id: 'a', fromBucketId: 'purchases', toBucketId: 'healthFund', amountVnd: 250_000 }),
    cover({ id: 'b', fromBucketId: 'reserve', toBucketId: 'tech', amountVnd: 500_000 }),
  ];
  assert.equal(coveredFromOutside(covers, buckets), 500_000);
});

test('surplus - a cover from Buffer keeps the total, one from BIDV changes it', () => {
  const limits = { food: 3_000_000, tech: 800_000 };
  const spent = { food: 2_640_000, tech: 990_000 };
  const base = computeSurplus(limits, spent); // 360.000 − 190.000 = 170.000

  const fromBuffer = [cover({ fromBucketId: 'buffer', amountVnd: 190_000 })];
  assert.equal(base + coveredFromOutside(fromBuffer, buckets), 170_000);

  const fromReserve = [cover({ fromBucketId: 'reserve', amountVnd: 190_000, needsTransfer: true })];
  assert.equal(base + coveredFromOutside(fromReserve, buckets), 360_000);
});
