import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { cycleOf } from '@/lib/cycle';
import { bucketsCol } from '@/lib/buckets';
import { balanceDeltas, type TxShape } from '@/lib/tx-edit';
import type { Bucket, Transaction, TxDirection, TxSource } from '@/types/fina';

export const txCol = (uid: string) => collection(db, 'users', uid, 'transactions');

function toTx(id: string, data: Record<string, unknown>): Transaction {
  return {
    id,
    occurredAt: Number(data.occurredAt ?? 0),
    cycle: String(data.cycle ?? ''),
    bucketId: String(data.bucketId ?? ''),
    bank: (data.bank as Transaction['bank']) ?? 'VCB',
    amountVnd: Number(data.amountVnd ?? 0),
    // Old records have no `direction`. ETF was always money in, the rest money out.
    direction:
      data.direction === 'in' || (data.direction == null && data.bucketId === 'etf')
        ? 'in'
        : 'out',
    note: (data.note as string | null) ?? null,
    // Forgetting 'allocation' here counts every salary split into funds as
    // spending (actually SUBTRACTS it, since they have direction 'in'), and the
    // Cash flow table shows Out −6.685 when it is really +3.815.
    source:
      data.source === 'import' ||
      data.source === 'allocation' ||
      data.source === 'opening' ||
      data.source === 'move'
        ? (data.source as TxSource)
        : 'web',
    importKeys: Array.isArray(data.importKeys) ? data.importKeys.map(String) : undefined,
    moveId: typeof data.moveId === 'string' ? data.moveId : undefined,
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/**
 * ONE query for the whole cycle, not one per bucket.
 * Firestore's free tier has 50k reads/day; a leaked listener is the fastest way to burn them.
 */
export function watchCycleTransactions(
  uid: string,
  cycle: string,
  cb: (txs: Transaction[]) => void,
): () => void {
  const q = query(txCol(uid), where('cycle', '==', cycle));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toTx(d.id, d.data())));
  });
}

/**
 * Writes a transaction. For a fund bucket, balanceVnd is reduced in the SAME
 * batch - two separate writes would sometimes disagree.
 *
 * Returns the client-generated id and the timestamp used, so components do
 * not call Date.now() during render (React 19 forbids it).
 */
export async function addTransaction(
  uid: string,
  bucket: Bucket,
  amountVnd: number,
  note: string | null,
  direction: TxDirection = 'out',
  occurredAt: number = Date.now(),
  source: TxSource = 'web',
): Promise<{ id: string; occurredAt: number }> {
  const ref = doc(txCol(uid));
  const now = Date.now();
  const batch = writeBatch(db);

  batch.set(ref, {
    occurredAt,
    cycle: cycleOf(new Date(occurredAt)),
    bucketId: bucket.id,
    // Copy the bank onto the record. If the bucket changes bank later, old
    // history still tells what really happened.
    bank: bucket.bank,
    amountVnd,
    direction,
    note: note && note.length > 0 ? note : null,
    source,
    createdAt: now,
    updatedAt: now,
  });

  if (bucket.kind === 'fund') {
    batch.update(doc(bucketsCol(uid), bucket.id), {
      balanceVnd: increment(direction === 'in' ? amountVnd : -amountVnd),
      updatedAt: now,
    });
  }

  await batch.commit();
  return { id: ref.id, occurredAt };
}

/**
 * Manual mid-cycle top-up of a fund - e.g. a bonus saved for a car.
 *
 * Carries `source: 'allocation'` like the salary split on the 25th, since it
 * is also a VCB to BIDV move, not spending. The id is random, so
 * `applyCyclePlan` does not touch it on rerun.
 */
export async function addFundTopUp(
  uid: string,
  fund: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): Promise<{ id: string; occurredAt: number }> {
  return addTransaction(uid, fund, amountVnd, note, 'in', occurredAt, 'allocation');
}

/**
 * Move money between two of your funds. See lib/moves.ts.
 *
 * Both entries and both balance changes go in ONE batch: a half-done move
 * would take money out of the source without reaching the target.
 */
export async function moveBetweenFunds(
  uid: string,
  from: Bucket,
  to: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): Promise<string> {
  const batch = writeBatch(db);
  const moveId = addMoveToBatch(batch, uid, from, to, amountVnd, note, occurredAt);
  await batch.commit();
  return moveId;
}

/** Both legs of a move and both balance changes, added to a caller's batch. */
export function addMoveToBatch(
  batch: WriteBatch,
  uid: string,
  from: Bucket,
  to: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): string {
  const moveId = doc(txCol(uid)).id;
  const now = Date.now();
  const legs = [
    { bucket: from, direction: 'out' as const, suffix: 'out' },
    { bucket: to, direction: 'in' as const, suffix: 'in' },
  ];

  for (const leg of legs) {
    batch.set(doc(txCol(uid), `${moveId}-${leg.suffix}`), {
      occurredAt,
      cycle: cycleOf(new Date(occurredAt)),
      bucketId: leg.bucket.id,
      bank: leg.bucket.bank,
      amountVnd,
      direction: leg.direction,
      note: note && note.length > 0 ? note : null,
      source: 'move',
      moveId,
      createdAt: now,
      updatedAt: now,
    });
    batch.update(doc(bucketsCol(uid), leg.bucket.id), {
      balanceVnd: increment(leg.direction === 'in' ? amountVnd : -amountVnd),
      updatedAt: now,
    });
  }
  return moveId;
}

/**
 * Delete a move: both sides and both balance changes, in one batch. Never
 * delete one side alone - the money would vanish from one end.
 */
export async function deleteMove(uid: string, legs: Transaction[]): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  for (const t of legs) {
    batch.delete(doc(txCol(uid), t.id));
    batch.update(doc(bucketsCol(uid), t.bucketId), {
      balanceVnd: increment(t.direction === 'in' ? -t.amountVnd : t.amountVnd),
      updatedAt: now,
    });
  }
  await batch.commit();
}

/**
 * Tops up ETF. Just an `in` transaction like any refund - no special case
 * for ETF anywhere anymore.
 */
export async function addEtfDeposit(
  uid: string,
  etf: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): Promise<{ id: string; occurredAt: number }> {
  return addTransaction(uid, etf, amountVnd, note, 'in', occurredAt);
}

/**
 * NET spent per bucket: spending minus refunds.
 *
 * Paying 1.500 for a picnic and getting 1.000 back means you really spent
 * 500 - that is the number to compare with the limit.
 *
 * Computed on the client, NOT denormalized: Stage 4 allows editing
 * transactions, and a stored total would drift on the first edit.
 */
export function spentByBucket(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tx of txs) {
    // Moving Purchases to Phone is not Purchases spending it.
    if (tx.source === 'move') continue;
    const signed = tx.direction === 'in' ? -tx.amountVnd : tx.amountVnd;
    out[tx.bucketId] = (out[tx.bucketId] ?? 0) + signed;
  }
  return out;
}

/** A cycle's transactions, newest first. One query. */
export async function listCycleTransactions(
  uid: string,
  cycle: string,
  max = 500,
): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txCol(uid), where('cycle', '==', cycle), orderBy('occurredAt', 'desc'), fsLimit(max)),
  );
  return snap.docs.map((d) => toTx(d.id, d.data()));
}

export interface TxPatch {
  bucket: Bucket;
  amountVnd: number;
  direction: TxDirection;
  note: string | null;
  occurredAt: number;
}

/**
 * Edits a transaction. Writes the new version and every fund balance change
 * in the SAME batch - separate writes would sometimes leave balances out of
 * step with history.
 *
 * If `occurredAt` crosses the 25th, `cycle` is recomputed. Only one field
 * changes; both cycles' totals stay right because `spent` is summed on the
 * client per cycle.
 */
export async function updateTransaction(
  uid: string,
  before: Transaction,
  beforeKind: Bucket['kind'],
  patch: TxPatch,
): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();

  batch.update(doc(txCol(uid), before.id), {
    occurredAt: patch.occurredAt,
    cycle: cycleOf(new Date(patch.occurredAt)),
    bucketId: patch.bucket.id,
    bank: patch.bucket.bank,
    amountVnd: patch.amountVnd,
    direction: patch.direction,
    note: patch.note && patch.note.length > 0 ? patch.note : null,
    updatedAt: now,
  });

  const beforeShape: TxShape = {
    bucketId: before.bucketId,
    kind: beforeKind,
    amountVnd: before.amountVnd,
    direction: before.direction,
  };
  const afterShape: TxShape = {
    bucketId: patch.bucket.id,
    kind: patch.bucket.kind,
    amountVnd: patch.amountVnd,
    direction: patch.direction,
  };

  for (const [bucketId, delta] of Object.entries(balanceDeltas(beforeShape, afterShape))) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(delta),
      updatedAt: now,
    });
  }

  await batch.commit();
}

/**
 * Hard delete. Unlike buckets (only `active` turned off) - a mistyped expense
 * has no history value, keeping it only makes every total wrong.
 */
export async function deleteTransaction(
  uid: string,
  tx: Transaction,
  kind: Bucket['kind'],
): Promise<void> {
  const deltas = balanceDeltas(
    { bucketId: tx.bucketId, kind, amountVnd: tx.amountVnd, direction: tx.direction },
    null,
  );

  if (Object.keys(deltas).length === 0) {
    await deleteDoc(doc(txCol(uid), tx.id));
    return;
  }

  const batch = writeBatch(db);
  batch.delete(doc(txCol(uid), tx.id));
  for (const [bucketId, delta] of Object.entries(deltas)) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(delta),
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
}

/**
 * Every transaction with `occurredAt` in [fromMs, toMs]. One single-field
 * query - Firestore indexes it automatically, nothing to declare.
 */
export async function listTransactionsBetween(
  uid: string,
  fromMs: number,
  toMs: number,
): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txCol(uid), where('occurredAt', '>=', fromMs), where('occurredAt', '<=', toMs)),
  );
  return snap.docs.map((d) => toTx(d.id, d.data()));
}
