// ============================================================
// fina - Chuyển tiền giữa hai quỹ của chính mình
//
// Một lần chuyển là HAI giao dịch cùng `moveId`: `out` ở quỹ nguồn và `in`
// ở quỹ đích, cả hai mang `source: 'move'`. Ghi thành giao dịch (không cộng
// thẳng vào số dư) để `recompute-balances` dựng lại được và History thấy.
//
// Hàm thuần ở đây để test được mà không kéo Firebase vào. Phần ghi nằm ở
// lib/transactions.ts.
// ============================================================

import { formatVnd } from '@/lib/money';
import type { Bucket, Transaction } from '@/types/fina';

/**
 * Quỹ nào được chuyển qua lại. Chỉ quỹ BIDV: hai đầu cùng một ngân hàng thì
 * không có đồng nào rời tài khoản, nên không cần chuyển khoản thật. ETF ở VPS
 * nằm ngoài.
 */
export function movableFunds(buckets: Bucket[]): Bucket[] {
  return buckets.filter((b) => b.active && b.kind === 'fund' && b.bank === 'BIDV');
}

/** Lý do không cho chuyển, hoặc null khi được. Chữ hiện thẳng trên UI. */
export function moveError(
  from: Bucket | null,
  to: Bucket | null,
  amountVnd: number | null,
): string | null {
  if (!from || !to) return 'Pick both funds.';
  if (from.id === to.id) return 'Pick two different funds.';
  if (amountVnd === null || amountVnd <= 0) return null; // chưa gõ số: chưa phải lỗi
  if (amountVnd > from.balanceVnd) return `${from.name} has only ${formatVnd(from.balanceVnd)}.`;
  return null;
}

export interface MovePair {
  moveId: string;
  /** Giao dịch `out` ở quỹ nguồn. Có thể thiếu nếu chu kỳ chỉ đọc được một nửa. */
  from: Transaction | null;
  /** Giao dịch `in` ở quỹ đích. */
  to: Transaction | null;
}

/** Gom các giao dịch `move` theo `moveId`. */
export function pairMoves(txs: Transaction[]): Map<string, MovePair> {
  const out = new Map<string, MovePair>();
  for (const t of txs) {
    if (t.source !== 'move' || !t.moveId) continue;
    const pair = out.get(t.moveId) ?? { moveId: t.moveId, from: null, to: null };
    if (t.direction === 'out') pair.from = t;
    else pair.to = t;
    out.set(t.moveId, pair);
  }
  return out;
}

/**
 * Bỏ một nửa của mỗi cặp move để History hiện MỘT dòng cho một lần chuyển.
 * Giữ nửa `in` (quỹ đích); thiếu nó thì giữ nửa còn lại.
 */
export function collapseMoves(txs: Transaction[]): Transaction[] {
  const pairs = pairMoves(txs);
  return txs.filter((t) => {
    if (t.source !== 'move' || !t.moveId) return true;
    const pair = pairs.get(t.moveId)!;
    return pair.to ? t === pair.to : t === pair.from;
  });
}
