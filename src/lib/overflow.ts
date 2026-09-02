// ============================================================
// fina - Phát hiện tiêu lố
//
// Tính theo trạng thái TRƯỚC khi ghi giao dịch. Gọi sau khi đã ghi thì
// listener có thể đã cộng chính giao dịch đó vào rồi, và phần vượt sẽ bị
// đếm hai lần.
// ============================================================

import type { BucketKind } from '@/types/fina';

export interface OverflowArgs {
  bucketId: string;
  kind: BucketKind;
  /** budget: hạn mức đã đóng băng của chu kỳ. undefined = chu kỳ lịch sử. */
  limitVnd: number | undefined;
  /** budget: đã tiêu trước giao dịch này. */
  spentVnd: number;
  /** fund: số dư trước giao dịch này. Có thể âm. */
  balanceVnd: number;
  amountVnd: number;
}

/** Phần vượt của một giao dịch. 0 nghĩa là không lố. */
export function overflowOf(a: OverflowArgs): number {
  // ETF chỉ nhận tiền vào - không có gì để vượt.
  if (a.bucketId === 'etf') return 0;

  let available: number;
  if (a.kind === 'budget') {
    // Chu kỳ lịch sử không có hạn mức: không có mốc nào để nói là vượt.
    if (a.limitVnd === undefined) return 0;
    available = a.limitVnd - a.spentVnd;
  } else {
    available = a.balanceVnd;
  }

  // Đang âm sẵn thì phần còn dùng được là 0, không phải số âm - nếu không,
  // tiêu thêm 100 khi đang âm 500 sẽ báo lố 600.
  const usable = Math.max(0, available);
  return Math.max(0, a.amountVnd - usable);
}
