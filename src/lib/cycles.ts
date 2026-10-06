import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import { cycleRange } from '@/lib/cycle';
import { txCol } from '@/lib/transactions';
import type { Bucket, Cycle, SurplusTarget } from '@/types/fina';

export const cyclesCol = (uid: string) => collection(db, 'users', uid, 'cycles');
const cycleRef = (uid: string, id: string) => doc(cyclesCol(uid), id);

function toCycle(id: string, data: Record<string, unknown>): Cycle {
  return {
    id,
    startAt: Number(data.startAt ?? 0),
    endAt: Number(data.endAt ?? 0),
    limits: (data.limits as Record<string, number>) ?? {},
    status: data.status === 'closed' ? 'closed' : 'open',
    closedAt: data.closedAt == null ? null : Number(data.closedAt),
    surplusVnd: data.surplusVnd == null ? null : Number(data.surplusVnd),
    surplusTo: (data.surplusTo as SurplusTarget | null) ?? null,
    closedTotals: (data.closedTotals as Cycle['closedTotals']) ?? null,
  };
}

/**
 * Reads a cycle, creating it if missing.
 *
 * `limits` are copied from `standardVnd` at creation, then FROZEN. Editing
 * the baseline in Settings must not change an open cycle's numbers -
 * otherwise last month's chart shows different numbers each time and nobody
 * knows which is right.
 *
 * ONLY call for the current cycle. A past cycle with no document predates the
 * app - we do not know its old limits and must not invent them from today's
 * baseline.
 */
export async function ensureCycle(
  uid: string,
  cycleId: string,
  buckets: Bucket[],
): Promise<Cycle> {
  const ref = cycleRef(uid, cycleId);
  const snap = await getDoc(ref);
  if (snap.exists()) return toCycle(snap.id, snap.data());

  const { startAt, endAt } = cycleRange(cycleId);
  const limits: Record<string, number> = {};
  for (const b of buckets) {
    if (b.kind === 'budget' && b.active) limits[b.id] = b.standardVnd;
  }

  const fresh = {
    startAt,
    endAt,
    limits,
    status: 'open' as const,
    closedAt: null,
    surplusVnd: null,
    surplusTo: null,
    closedTotals: null,
  };
  await setDoc(ref, fresh);
  return { id: cycleId, ...fresh };
}

export function watchCycle(
  uid: string,
  cycleId: string,
  cb: (cycle: Cycle | null) => void,
): () => void {
  return onSnapshot(cycleRef(uid, cycleId), (snap) =>
    cb(snap.exists() ? toCycle(snap.id, snap.data()) : null),
  );
}

/** Cycles that have a document, newest first. For the picker. */
export async function listCycles(uid: string): Promise<Cycle[]> {
  const snap = await getDocs(query(cyclesCol(uid), orderBy('startAt', 'desc')));
  return snap.docs.map((d) => toCycle(d.id, d.data()));
}

/**
 * Surplus (+) or overspend (−) for the whole cycle, summed over all budget buckets.
 * Pure function - tested.
 */
export function computeSurplus(
  limits: Record<string, number>,
  spent: Record<string, number>,
): number {
  return Object.entries(limits).reduce(
    (sum, [bucketId, limit]) => sum + (limit - (spent[bucketId] ?? 0)),
    0,
  );
}

/**
 * MANUAL edit of the running cycle's limits - the path used by the `Edit
 * limits` button in Summary, and only by it.
 *
 * The other path is `applyCyclePlan`, run on the 25th, which does much more
 * (records salary, funds the funds). Both write `limits`, so the names must
 * say which is which.
 */
export async function overrideCycleLimits(
  uid: string,
  cycleId: string,
  limits: Record<string, number>,
): Promise<void> {
  await updateDoc(cycleRef(uid, cycleId), { limits });
}

/**
 * The 25th: one action, three jobs.
 *
 *  1. Write the cycle's income record
 *  2. Freeze limits for the VCB buckets
 *  3. Fund each BIDV fund with an `in` transaction, `source: 'allocation'`
 *
 * Job three closes a gap: funds used to only ever go down, never get money.
 * It is written as a TRANSACTION, not a direct balance change, so
 * `recompute-balances` can rebuild it and the user sees the money arrive in
 * History.
 *
 * ETF is deliberately NOT funded automatically: the user enters it when the
 * money really moves to VPS; doing both counts every dong twice.
 *
 * Rerunnable: ids are fixed, and the cycle's old allocations are removed
 * (refunding fund balances) before the new set is written.
 */
export async function applyCyclePlan(
  uid: string,
  cycleId: string,
  plan: {
    /** The amount to split this cycle: leftover plus what just came in. NOT
     *  salary - salary is tracked separately and never goes through here. */
    divideVnd: number;
    limits: Record<string, number>;
    /** bucketId -> amount, funds only. No etf. */
    fundAllocations: Record<string, number>;
    occurredAt?: number;
  },
): Promise<void> {
  const now = plan.occurredAt ?? Date.now();

  // Remove this cycle's old allocations, refund the balances, then rewrite.
  //
  // ONLY remove rows this function created (id `alloc-<cycle>-<bucket>`).
  // A manual mid-cycle top-up also has source 'allocation' - it is also a
  // VCB to BIDV move - but deleting it here would eat the user's money.
  const prefix = `alloc-${cycleId}-`;
  const old = await getDocs(
    query(txCol(uid), where('cycle', '==', cycleId), where('source', '==', 'allocation')),
  );

  const batch = writeBatch(db);

  for (const d of old.docs) {
    if (!d.id.startsWith(prefix)) continue;
    const t = d.data();
    batch.delete(d.ref);
    batch.update(doc(bucketsCol(uid), String(t.bucketId)), {
      balanceVnd: increment(-Number(t.amountVnd ?? 0)),
      updatedAt: now,
    });
  }

  // The amount to split is NOT stored anywhere. It is only an input for the
  // limits; keeping it would rebuild exactly what was dropped (cash-flow tracking).
  batch.update(cycleRef(uid, cycleId), { limits: plan.limits });

  for (const [bucketId, amountVnd] of Object.entries(plan.fundAllocations)) {
    if (amountVnd <= 0) continue;
    batch.set(doc(txCol(uid), `alloc-${cycleId}-${bucketId}`), {
      occurredAt: now,
      cycle: cycleId,
      bucketId,
      bank: 'BIDV',
      amountVnd,
      direction: 'in',
      note: `Allocation ${cycleId}`,
      source: 'allocation',
      createdAt: now,
      updatedAt: now,
    });
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(amountVnd),
      updatedAt: now,
    });
  }

  await batch.commit();
}

/**
 * Close the books. One batch: lock the cycle and move the surplus to the target fund.
 *
 * Never moves real money, never creates transactions. Only records the numbers.
 */
export async function closeCycle(
  uid: string,
  cycleId: string,
  surplusVnd: number,
  surplusTo: SurplusTarget,
  /** Snapshot, so Trend and Notes do not reread every transaction of the cycle. */
  snapshot: { byBucket: Record<string, number> },
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(cycleRef(uid, cycleId), {
    status: 'closed',
    closedAt: Date.now(),
    surplusVnd,
    surplusTo,
    closedTotals: { byBucket: snapshot.byBucket },
  });

  // 'hold' = leave it, add it nowhere.
  if (surplusVnd > 0 && surplusTo !== 'hold') {
    batch.update(doc(bucketsCol(uid), surplusTo === 'etf' ? 'etf' : 'reserve'), {
      balanceVnd: increment(surplusVnd),
      updatedAt: Date.now(),
    });
  }

  await batch.commit();
}
