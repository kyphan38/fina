// ============================================================
// fina - Moving money between two of your own funds
//
// A move is TWO entries with one `moveId`: `out` on the source fund and `in`
// on the target, both `source: 'move'`. Entries (not a direct balance edit)
// so `recompute-balances` can rebuild them and History shows them.
//
// Pure helpers live here so tests do not load Firebase. Writes are in
// lib/transactions.ts.
// ============================================================

import { formatVnd } from '@/lib/money';
import type { Bucket, Transaction } from '@/types/fina';

/**
 * Funds that can take part in a move: BIDV only. Same bank on both sides
 * means no money leaves the account, so no real transfer. ETF (VPS) is out.
 */
export function movableFunds(buckets: Bucket[]): Bucket[] {
  return buckets.filter((b) => b.active && b.kind === 'fund' && b.bank === 'BIDV');
}

/** Why the move is not allowed, or null. Shown as is in the UI. */
export function moveError(
  from: Bucket | null,
  to: Bucket | null,
  amountVnd: number | null,
): string | null {
  if (!from || !to) return 'Pick both funds.';
  if (from.id === to.id) return 'Pick two different funds.';
  if (amountVnd === null || amountVnd <= 0) return null; // nothing typed yet is not an error
  if (amountVnd > from.balanceVnd) return `${from.name} has only ${formatVnd(from.balanceVnd)}.`;
  return null;
}

export interface MovePair {
  moveId: string;
  /** The `out` entry on the source fund. Missing if only one side was read. */
  from: Transaction | null;
  /** The `in` entry on the target fund. */
  to: Transaction | null;
}

/** Group `move` entries by `moveId`. */
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
 * Drop one side of each move so History shows ONE row per move. Keeps the
 * `in` side (target fund), or the other side when it is missing.
 */
export function collapseMoves(txs: Transaction[]): Transaction[] {
  const pairs = pairMoves(txs);
  return txs.filter((t) => {
    if (t.source !== 'move' || !t.moveId) return true;
    const pair = pairs.get(t.moveId)!;
    return pair.to ? t === pair.to : t === pair.from;
  });
}
