// ============================================================
// fina - Sửa giao dịch và số dư quỹ
//
// Một lần sửa có thể chạm vào HAI quỹ cùng lúc (đổi Travel sang Purchases
// = hoàn tiền quỹ này, trừ quỹ kia). Giữ toàn bộ phép tính ở một hàm thuần
// và test nó, thay vì rải vào component.
// ============================================================

import type { BucketKind } from '@/types/fina';

export interface TxShape {
  bucketId: string;
  kind: BucketKind;
  amountVnd: number;
}

/**
 * Một giao dịch tác động lên số dư quỹ theo chiều nào.
 *
 * Mọi quỹ đều là tiền ĐI RA (−1). ETF là ngoại lệ duy nhất: tiền chỉ đi
 * VÀO nó (+1). Quên chỗ này thì xoá một lần nạp ETF sẽ làm số dư tăng lên.
 */
function signOf(bucketId: string): 1 | -1 {
  return bucketId === 'etf' ? 1 : -1;
}

/**
 * Số dư quỹ phải cộng thêm bao nhiêu cho mỗi bucket, sau khi sửa hoặc xoá.
 *
 * `before = null` → đang tạo mới. `after = null` → đang xoá.
 * Bucket dạng budget không có số dư nên không bao giờ xuất hiện trong kết quả.
 * Delta bằng 0 bị loại - không ghi một lệnh update chẳng đổi gì.
 */
export function balanceDeltas(
  before: TxShape | null,
  after: TxShape | null,
): Record<string, number> {
  const deltas: Record<string, number> = {};

  const add = (bucketId: string, value: number) => {
    deltas[bucketId] = (deltas[bucketId] ?? 0) + value;
  };

  // Gỡ tác động của bản cũ...
  if (before && before.kind === 'fund') {
    add(before.bucketId, -signOf(before.bucketId) * before.amountVnd);
  }
  // ...rồi áp tác động của bản mới.
  if (after && after.kind === 'fund') {
    add(after.bucketId, signOf(after.bucketId) * after.amountVnd);
  }

  for (const [id, v] of Object.entries(deltas)) {
    if (v === 0) delete deltas[id];
  }
  return deltas;
}
