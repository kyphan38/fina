import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balanceDeltas, type TxShape } from '@/lib/tx-edit';

const fund = (id: string, amountVnd: number): TxShape =>
  ({ bucketId: id, kind: 'fund', amountVnd, direction: 'out' });
const budget = (id: string, amountVnd: number): TxShape =>
  ({ bucketId: id, kind: 'budget', amountVnd, direction: 'out' });
const inTo = (id: string, amountVnd: number): TxShape =>
  ({ bucketId: id, kind: 'fund', amountVnd, direction: 'in' });

test('sửa số tiền, cùng một quỹ', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 500_000), fund('travel', 800_000)), {
    travel: -300_000,
  });
  assert.deepEqual(balanceDeltas(fund('travel', 800_000), fund('travel', 500_000)), {
    travel: 300_000,
  });
});

test('đổi quỹ A sang quỹ B', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 800_000), fund('purchases', 800_000)), {
    travel: 800_000,
    purchases: -800_000,
  });
});

test('đổi budget sang quỹ', () => {
  assert.deepEqual(balanceDeltas(budget('food', 250_000), fund('travel', 250_000)), {
    travel: -250_000,
  });
});

test('đổi quỹ sang budget', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 250_000), budget('food', 250_000)), {
    travel: 250_000,
  });
});

test('xoá giao dịch của quỹ thì hoàn lại', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 250_000), null), { travel: 250_000 });
});

test('mọi thay đổi trong nhóm budget đều không đụng số dư', () => {
  assert.deepEqual(balanceDeltas(budget('food', 25_000), budget('social', 90_000)), {});
  assert.deepEqual(balanceDeltas(budget('food', 25_000), null), {});
  assert.deepEqual(balanceDeltas(null, budget('food', 25_000)), {});
});

test('chỉ sửa note hoặc ngày thì không sinh lệnh update nào', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 500_000), fund('travel', 500_000)), {});
});

test('tạo mới trừ số dư quỹ', () => {
  assert.deepEqual(balanceDeltas(null, fund('travel', 500_000)), { travel: -500_000 });
});

test('tiền đi VÀO thì cộng số dư - nạp ETF và khoản được hoàn', () => {
  assert.deepEqual(balanceDeltas(null, inTo('etf', 3_425_000)), { etf: 3_425_000 });
  assert.deepEqual(balanceDeltas(inTo('etf', 3_425_000), null), { etf: -3_425_000 });
  assert.deepEqual(balanceDeltas(inTo('etf', 1_000_000), inTo('etf', 1_500_000)), {
    etf: 500_000,
  });
  // Ứng tiền đi picnic từ quỹ Travel rồi được trả lại
  assert.deepEqual(balanceDeltas(null, inTo('travel', 1_000_000)), { travel: 1_000_000 });
});

test('đổi chiều của một giao dịch thì số dư nhảy gấp đôi', () => {
  // Ghi nhầm khoản hoàn tiền thành khoản chi, rồi sửa lại
  assert.deepEqual(balanceDeltas(fund('travel', 500_000), inTo('travel', 500_000)), {
    travel: 1_000_000,
  });
});

test('chuyển một khoản chi nhầm sang ETF: cả hai quỹ đều đúng chiều', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 1_000_000), inTo('etf', 1_000_000)), {
    travel: 1_000_000,
    etf: 1_000_000,
  });
});
