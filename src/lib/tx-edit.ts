// ============================================================
// fina - Editing transactions and fund balances
//
// One edit can touch TWO funds at once (moving Travel to Purchases = refund
// one fund, charge the other). All the math lives in one tested pure
// function instead of spread across components.
// ============================================================

import type { BucketKind, TxDirection } from '@/types/fina';

export interface TxShape {
  bucketId: string;
  kind: BucketKind;
  amountVnd: number;
  direction: TxDirection;
}

/** Effect on a fund balance: out subtracts, in adds. */
function signOf(direction: TxDirection): 1 | -1 {
  return direction === 'in' ? 1 : -1;
}

/**
 * How much each bucket's fund balance must change after an edit or delete.
 *
 * `before = null` → creating. `after = null` → deleting.
 * Budget buckets have no balance, so they never appear in the result.
 * Zero deltas are dropped - no update that changes nothing.
 */
export function balanceDeltas(
  before: TxShape | null,
  after: TxShape | null,
): Record<string, number> {
  const deltas: Record<string, number> = {};

  const add = (bucketId: string, value: number) => {
    deltas[bucketId] = (deltas[bucketId] ?? 0) + value;
  };

  // Remove the old version's effect...
  if (before && before.kind === 'fund') {
    add(before.bucketId, -signOf(before.direction) * before.amountVnd);
  }
  // ...then apply the new version's effect.
  if (after && after.kind === 'fund') {
    add(after.bucketId, signOf(after.direction) * after.amountVnd);
  }

  for (const [id, v] of Object.entries(deltas)) {
    if (v === 0) delete deltas[id];
  }
  return deltas;
}
