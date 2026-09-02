import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balanceDeltas, type TxShape } from '@/lib/tx-edit';

const fund = (id: string, amountVnd: number): TxShape => ({ bucketId: id, kind: 'fund', amountVnd });
const budget = (id: string, amountVnd: number): TxShape => ({ bucketId: id, kind: 'budget', amountVnd });

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

test('ETF đi ngược chiều: tiền chỉ đi VÀO', () => {
  // Nạp mới -> số dư tăng
  assert.deepEqual(balanceDeltas(null, fund('etf', 3_425_000)), { etf: 3_425_000 });
  // Xoá một lần nạp -> số dư giảm
  assert.deepEqual(balanceDeltas(fund('etf', 3_425_000), null), { etf: -3_425_000 });
  // Sửa số tiền nạp
  assert.deepEqual(balanceDeltas(fund('etf', 1_000_000), fund('etf', 1_500_000)), {
    etf: 500_000,
  });
});

test('chuyển một khoản chi nhầm sang ETF: cả hai quỹ đều đúng chiều', () => {
  assert.deepEqual(balanceDeltas(fund('travel', 1_000_000), fund('etf', 1_000_000)), {
    travel: 1_000_000,
    etf: 1_000_000,
  });
});
