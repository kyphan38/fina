// ============================================================
// fina - Cái gì tính là chi tiêu, và tiêu ròng bao nhiêu
//
// Hai chỗ loại trừ dưới đây là phần dễ sai nhất của app, nên chúng nằm ở
// một hàm thuần có test chứ không rải vào component. Đã có một lỗi thật:
// tổng ở History từng trừ khoản nạp ETF, làm tháng 9 hiện 415 trong khi
// thực tiêu 3.840.
// ============================================================

import type { Transaction } from '@/types/fina';

export const ETF_BUCKET = 'etf';

/** Số dư có sẵn từ trước: trạng thái ban đầu, không phải một khoản chi. */
export function isOpening(tx: Transaction): boolean {
  return tx.source === 'opening';
}

/** Giao dịch này có tính là chi tiêu không. */
export function isSpending(tx: Transaction): boolean {
  if (isOpening(tx)) return false;
  // Chia lương sang BIDV là chuyển tiền giữa hai hũ của chính mình.
  if (tx.source === 'allocation') return false;
  // Đầu tư không phải tiêu.
  if (tx.bucketId === ETF_BUCKET) return false;
  return true;
}

/** Chi tiêu ròng: `out` cộng vào, `in` (được hoàn) trừ ra. */
export function netSpending(txs: Transaction[]): number {
  return txs
    .filter(isSpending)
    .reduce((sum, t) => sum + (t.direction === 'in' ? -t.amountVnd : t.amountVnd), 0);
}
