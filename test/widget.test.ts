import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coveredOf, vnWallClock, widgetData } from '@/lib/widget';
import type { Bucket, Cover, Transaction } from '@/types/fina';

const bucket = (over: Partial<Bucket>): Bucket => ({
  id: 'food', name: 'Food', kind: 'budget', bank: 'VCB', standardVnd: 0, hint: null,
  balanceVnd: 0, order: 10, active: true, evenlySpent: false, goal: null, createdAt: 0, updatedAt: 0,
  ...over,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', occurredAt: 0, cycle: '2026-10', bucketId: 'food', bank: 'VCB',
  amountVnd: 100_000, direction: 'out', note: null, source: 'web',
  createdAt: 0, updatedAt: 0, ...over,
});

const buckets = [
  bucket({ id: 'social', name: 'Social', order: 30 }),
  bucket({ id: 'food', name: 'Food', order: 10 }),
  bucket({ id: 'travel', name: 'Travel', kind: 'fund', bank: 'BIDV', order: 100 }),
  bucket({ id: 'old', name: 'Old', active: false, order: 5 }),
];

// 04/10/2026 nằm trong chu kỳ '2026-10' (25/09 - 24/10), ngày 10 trên 30.
const now = new Date(2026, 9, 4, 9, 0);

test('widgetData - còn lại khớp với Summary: limits trừ chi ròng hũ budget', () => {
  const d = widgetData({
    now,
    buckets,
    txs: [
      tx({ bucketId: 'food', amountVnd: 1_120_000 }),
      tx({ bucketId: 'social', amountVnd: 850_000 }),
      tx({ bucketId: 'social', amountVnd: 250_000, direction: 'in' }),
      // Hũ fund không tính vào tổng chi của chu kỳ.
      tx({ bucketId: 'travel', amountVnd: 2_000_000 }),
    ],
    limits: { food: 3_000_000, social: 1_000_000 },
    covered: {},
  });

  assert.equal(d.cycle, '2026-10');
  assert.equal(d.day, 10);
  assert.equal(d.totalDays, 30);
  assert.equal(d.limitVnd, 4_000_000);
  assert.equal(d.spentVnd, 1_720_000);
  assert.equal(d.leftVnd, 2_280_000);
  // 2.280 chia cho 21 ngày còn lại (tính cả hôm nay).
  assert.equal(d.perDayVnd, 108_571);
  assert.deepEqual(d.buckets.map((b) => b.name), ['Food', 'Social']);
});

test('widgetData - tiêu lố thì mỗi ngày về 0, không âm', () => {
  const d = widgetData({
    now,
    buckets,
    txs: [tx({ amountVnd: 5_000_000 })],
    limits: { food: 3_000_000 },
    covered: {},
  });
  assert.equal(d.leftVnd, -2_000_000);
  assert.equal(d.perDayVnd, 0);
});

test('widgetData - hũ bị rút đi bù tính là đã dùng, giống BudgetRow', () => {
  const covers = [
    { fromBucketId: 'social', toBucketId: 'food', amountVnd: 200_000, status: 'done' },
    { fromBucketId: 'social', toBucketId: 'food', amountVnd: 999_000, status: 'pending' },
  ] as Cover[];
  const d = widgetData({
    now,
    buckets,
    txs: [],
    limits: { food: 3_000_000, social: 1_000_000 },
    covered: coveredOf(covers),
  });
  const social = d.buckets.find((b) => b.name === 'Social');
  assert.equal(social?.usedVnd, 200_000);
  assert.equal(social?.limitVnd, 1_000_000);
});

test('vnWallClock - 18:00 UTC ngày 24 đã là ngày 25 ở Việt Nam', () => {
  const vn = vnWallClock(new Date(Date.UTC(2026, 8, 24, 18, 0)));
  assert.equal(vn.getDate(), 25);
  assert.equal(vn.getHours(), 1);
});
