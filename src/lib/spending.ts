// ============================================================
// fina - What counts as spending, and how much net
//
// The two exclusions below are the easiest part of the app to get wrong, so
// they live in a tested pure function, not spread across components. There
// was a real bug: the History total once subtracted ETF top-ups, showing 415
// for September when real spending was 3.840.
// ============================================================

import type { Transaction } from '@/types/fina';

export const ETF_BUCKET = 'etf';

/** A pre-existing balance: the starting state, not an expense. */
export function isOpening(tx: Transaction): boolean {
  return tx.source === 'opening';
}

/** Whether this transaction counts as spending. */
export function isSpending(tx: Transaction): boolean {
  if (isOpening(tx)) return false;
  // Splitting salary to BIDV is moving money between two of your own buckets.
  if (tx.source === 'allocation') return false;
  // Moving between funds (Purchases to Phone) only relabels the money.
  if (tx.source === 'move') return false;
  // Investing is not spending.
  if (tx.bucketId === ETF_BUCKET) return false;
  return true;
}

/** Net spending: `out` adds, `in` (refunds) subtracts. */
export function netSpending(txs: Transaction[]): number {
  return txs
    .filter(isSpending)
    .reduce((sum, t) => sum + (t.direction === 'in' ? -t.amountVnd : t.amountVnd), 0);
}
