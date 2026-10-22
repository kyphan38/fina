// ============================================================
// fina - Overspend detection
//
// Computed from the state BEFORE the transaction is written. After writing,
// the listener may already include that transaction, and the overage would
// be counted twice.
// ============================================================

import type { Bucket, BucketKind, TxDirection } from '@/types/fina';

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

export interface WrittenTx {
  id: string;
  bucketId: string;
  cycle: string;
  amountVnd: number;
  direction: TxDirection;
  occurredAt: number;
}

export interface BatchOverflow {
  bucket: Bucket;
  /** The latest `out` entry in that bucket, so a cover rolls back with it. */
  txId: string;
  amountVnd: number;
}

/**
 * Overages caused by many entries saved at once (MoMo import). Same rule as
 * one entry, applied to each bucket's NET amount: a refund in the same batch
 * offsets spending. Only the open cycle counts - older cycles have no live
 * limit to be over.
 *
 * `usedBefore` and `buckets` must be read BEFORE the write, like overflowOf.
 */
export function batchOverflows(args: {
  written: WrittenTx[];
  cycle: string;
  buckets: Bucket[];
  limitOf: (b: Bucket) => number | undefined;
  usedBefore: Record<string, number>;
}): BatchOverflow[] {
  const net = new Map<string, { amountVnd: number; lastOut: WrittenTx | null }>();
  for (const t of args.written) {
    if (t.cycle !== args.cycle) continue;
    const cur = net.get(t.bucketId) ?? { amountVnd: 0, lastOut: null };
    cur.amountVnd += t.direction === 'in' ? -t.amountVnd : t.amountVnd;
    if (t.direction === 'out' && (!cur.lastOut || t.occurredAt >= cur.lastOut.occurredAt)) {
      cur.lastOut = t;
    }
    net.set(t.bucketId, cur);
  }

  const out: BatchOverflow[] = [];
  for (const bucket of args.buckets) {
    const n = net.get(bucket.id);
    if (!n || !n.lastOut || n.amountVnd <= 0) continue;
    const amountVnd = overflowOf({
      bucketId: bucket.id,
      kind: bucket.kind,
      limitVnd: bucket.kind === 'budget' ? args.limitOf(bucket) : undefined,
      spentVnd: args.usedBefore[bucket.id] ?? 0,
      balanceVnd: bucket.balanceVnd,
      amountVnd: n.amountVnd,
    });
    if (amountVnd > 0) out.push({ bucket, txId: n.lastOut.id, amountVnd });
  }
  return out;
}
