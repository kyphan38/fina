import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSpending, netSpending } from '@/lib/spending';
import type { Transaction } from '@/types/fina';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', occurredAt: 0, cycle: '2026-10', bucketId: 'food', bank: 'VCB',
  amountVnd: 100_000, direction: 'out', note: null, source: 'web',
  createdAt: 0, updatedAt: 0, ...over,
});

test('isSpending - phân bổ vào quỹ không phải chi tiêu', () => {
  assert.equal(isSpending(tx({ bucketId: 'travel', source: 'allocation', direction: 'in' })), false);
});

test('isSpending - nạp và rút ETF không phải chi tiêu', () => {
  assert.equal(isSpending(tx({ bucketId: 'etf', direction: 'in' })), false);
  assert.equal(isSpending(tx({ bucketId: 'etf', direction: 'out' })), false);
});

test('isSpending - chi tiêu thường và khoản được hoàn đều tính', () => {
  assert.equal(isSpending(tx({})), true);
  assert.equal(isSpending(tx({ direction: 'in' })), true);
});

test('netSpending - khoản được hoàn trừ ra', () => {
  // Ứng 850 tiền picnic, bạn bè trả lại 430 -> thật sự tiêu 420
  const rows = [
    tx({ bucketId: 'social', amountVnd: 850_000 }),
    tx({ bucketId: 'social', amountVnd: 430_000, direction: 'in' }),
  ];
  assert.equal(netSpending(rows), 420_000);
});

test('netSpending - đúng lỗi đã xảy ra: nạp ETF không được kéo tổng xuống', () => {
  const rows = [
    tx({ bucketId: 'food', amountVnd: 3_840_000 }),
    tx({ bucketId: 'etf', amountVnd: 3_425_000, direction: 'in' }),
  ];
  // Bản cũ ra 415.000 vì trừ cả khoản nạp ETF.
  assert.equal(netSpending(rows), 3_840_000);
});

test('netSpending - chia lương sang quỹ không phải chi tiêu', () => {
  const rows = [
    tx({ bucketId: 'food', amountVnd: 500_000 }),
    tx({ bucketId: 'travel', amountVnd: 2_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'purchases', amountVnd: 3_000_000, direction: 'in', source: 'allocation' }),
  ];
  assert.equal(netSpending(rows), 500_000);
});

test('netSpending - tiêu TỪ quỹ vẫn là chi tiêu', () => {
  const rows = [tx({ bucketId: 'travel', bank: 'BIDV', amountVnd: 1_200_000 })];
  assert.equal(netSpending(rows), 1_200_000);
});

test('regression - source phải giữ nguyên "allocation" khi đọc từ Firestore', () => {
  // toTx() từng ép mọi source lạ về 'web', nên isSpending() không nhận ra
  // khoản chia lương và trừ 10.500 khỏi Out.
  const rows = [
    tx({ bucketId: 'food', amountVnd: 3_815_000 }),
    tx({ bucketId: 'healthFund', amountVnd: 3_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'purchases', amountVnd: 3_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'travel', amountVnd: 2_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'reserve', amountVnd: 2_000_000, direction: 'in', source: 'allocation' }),
    tx({ bucketId: 'emergency', amountVnd: 500_000, direction: 'in', source: 'allocation' }),
  ];
  assert.equal(netSpending(rows), 3_815_000);
});

test('số dư có sẵn từ trước không tính là chi tiêu', () => {
  // Số dư mở đầu là TRẠNG THÁI, không phải một khoản chi của chu kỳ nào.
  const rows = [
    tx({ bucketId: 'etf', amountVnd: 177_714_000, direction: 'in', source: 'opening' }),
    tx({ bucketId: 'travel', bank: 'BIDV', amountVnd: 3_600_000, direction: 'in', source: 'opening' }),
  ];
  assert.equal(netSpending(rows), 0);
});
