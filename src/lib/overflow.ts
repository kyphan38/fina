// ============================================================
// fina - Overspend detection
//
// Computed from the state BEFORE the transaction is written. After writing,
// the listener may already include that transaction, and the overage would
// be counted twice.
// ============================================================

import type { BucketKind } from '@/types/fina';

export interface OverflowArgs {
  bucketId: string;
  kind: BucketKind;
  /** budget: the cycle's frozen limit. undefined = a historical cycle. */
  limitVnd: number | undefined;
  /** budget: spent before this transaction. */
  spentVnd: number;
  /** fund: balance before this transaction. Can be negative. */
  balanceVnd: number;
  amountVnd: number;
}

/** The overage of one transaction. 0 means not over. */
export function overflowOf(a: OverflowArgs): number {
  // ETF only takes money in - nothing to go over.
  if (a.bucketId === 'etf') return 0;

  let available: number;
  if (a.kind === 'budget') {
    // A historical cycle has no limit: nothing to be over.
    if (a.limitVnd === undefined) return 0;
    available = a.limitVnd - a.spentVnd;
  } else {
    available = a.balanceVnd;
  }

  // Already negative means 0 is left to use, not a negative amount - otherwise
  // spending 100 more at -500 would report 600 over.
  const usable = Math.max(0, available);
  return Math.max(0, a.amountVnd - usable);
}
