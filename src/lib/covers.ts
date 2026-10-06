import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import type { Bucket, BucketKind, Cover } from '@/types/fina';

export const coversCol = (uid: string) => collection(db, 'users', uid, 'covers');

function toCover(id: string, data: Record<string, unknown>): Cover {
  return {
    id,
    txId: String(data.txId ?? ''),
    cycle: String(data.cycle ?? ''),
    toBucketId: String(data.toBucketId ?? ''),
    fromBucketId: String(data.fromBucketId ?? ''),
    toName: String(data.toName ?? data.toBucketId ?? ''),
    fromName: String(data.fromName ?? data.fromBucketId ?? ''),
    amountVnd: Number(data.amountVnd ?? 0),
    needsTransfer: data.needsTransfer === true,
    status: data.status === 'done' ? 'done' : 'pending',
    createdAt: Number(data.createdAt ?? 0),
    confirmedAt: data.confirmedAt == null ? null : Number(data.confirmedAt),
  };
}

export interface CoverOption {
  bucket: Bucket;
  availableVnd: number;
  enough: boolean;
}

/**
 * Possible cover sources. ONE source per cover - no 200 from here and 590
 * from there; splitting clutters the books for nothing.
 *
 * Sources without enough money still show, but faded. Hiding them leaves the
 * user wondering why they vanished.
 */
export function coverOptions(args: {
  buckets: Bucket[];
  toBucketId: string;
  bufferLimitVnd: number;
  bufferUsedVnd: number;
  neededVnd: number;
}): CoverOption[] {
  const out: CoverOption[] = [];

  for (const b of args.buckets) {
    if (!b.active) continue;
    // Never cover itself, and ETF is a destination, not a wallet.
    if (b.id === args.toBucketId || b.id === 'etf') continue;

    if (b.id === 'buffer') {
      const availableVnd = Math.max(0, args.bufferLimitVnd - args.bufferUsedVnd);
      out.push({ bucket: b, availableVnd, enough: availableVnd >= args.neededVnd });
      continue;
    }
    if (b.kind === 'fund') {
      const availableVnd = Math.max(0, b.balanceVnd);
      out.push({ bucket: b, availableVnd, enough: availableVnd >= args.neededVnd });
    }
  }

  // Buffer first, then funds in display order.
  return out.sort((a, c) =>
    a.bucket.id === 'buffer' ? -1 : c.bucket.id === 'buffer' ? 1 : a.bucket.order - c.bucket.order,
  );
}

/**
 * NET effect of COMPLETED covers on each bucket: money taken out counts
 * positive, money received counts negative. Every screen reads it with the
 * same formula `used = spent + covered`.
 *
 * BOTH ends, not one. Counting only the giver means money leaves but never
 * arrives: after moving 505 from Purchases to Social, Social would still sit
 * at -500 as if nothing moved, while the money is already in the wallet.
 *
 * Fund buckets must NOT use this table: `coverBalanceDeltas` already adds to
 * or subtracts from their balance, so reading it here counts twice.
 * Today only budget buckets read it (Log, Summary, closing).
 */
export function coveredByBucket(covers: Cover[]): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (bucketId: string, value: number) => {
    out[bucketId] = (out[bucketId] ?? 0) + value;
  };

  for (const c of covers) {
    if (c.status !== 'done') continue;
    add(c.fromBucketId, c.amountVnd);
    add(c.toBucketId, -c.amountVnd);
  }

  for (const [id, v] of Object.entries(out)) {
    if (v === 0) delete out[id];
  }
  return out;
}

/**
 * Cover money flowing FROM BIDV INTO VCB. Only these change the cycle total,
 * because `computeSurplus` only reads VCB buckets.
 *
 * Both ends, not one. A cover from Buffer is already inside VCB, so it is an
 * internal move. A cover from one BIDV fund to another is too - it never
 * passes through VCB; counting it here would invent a surplus and then put
 * it into ETF at closing.
 */
export function coveredFromOutside(covers: Cover[], buckets: Bucket[]): number {
  const bankOf = new Map(buckets.map((b) => [b.id, b.bank]));
  return covers
    .filter(
      (c) =>
        c.status === 'done' &&
        bankOf.get(c.fromBucketId) === 'BIDV' &&
        bankOf.get(c.toBucketId) === 'VCB',
    )
    .reduce((sum, c) => sum + c.amountVnd, 0);
}

/**
 * How much to add to fund balances when a cover COMPLETES.
 *
 * Both ends, not one. A fund source really loses the money, so subtract.
 * A fund target receives money, so add - the original transaction already
 * took it from the target fund when logged; forget to add it back and ONE
 * expense is taken from BOTH funds, and every cover silently eats that amount.
 *
 * Budget buckets (Buffer and the VCB buckets) have no balance, so they never
 * show up here: their used amount is spent + covered.
 */
export function coverBalanceDeltas(args: {
  fromBucketId: string;
  fromKind: BucketKind;
  toBucketId: string;
  toKind: BucketKind;
  amountVnd: number;
}): Record<string, number> {
  const deltas: Record<string, number> = {};

  const add = (bucketId: string, value: number) => {
    deltas[bucketId] = (deltas[bucketId] ?? 0) + value;
  };

  if (args.fromKind === 'fund') add(args.fromBucketId, -args.amountVnd);
  if (args.toKind === 'fund') add(args.toBucketId, args.amountVnd);

  for (const [id, v] of Object.entries(deltas)) {
    if (v === 0) delete deltas[id];
  }
  return deltas;
}

/**
 * The kind of each end of a cover. A cover stores only ids, but the kind
 * decides which balance changes - read it from the bucket, do not guess by id.
 */
async function kindsOf(
  uid: string,
  cover: Cover,
): Promise<{ fromKind: BucketKind; toKind: BucketKind }> {
  const [from, to] = await Promise.all([
    getDoc(doc(bucketsCol(uid), cover.fromBucketId)),
    getDoc(doc(bucketsCol(uid), cover.toBucketId)),
  ]);
  return {
    fromKind: from.data()?.kind === 'fund' ? 'fund' : 'budget',
    toKind: to.data()?.kind === 'fund' ? 'fund' : 'budget',
  };
}

export function watchCycleCovers(
  uid: string,
  cycle: string,
  cb: (covers: Cover[]) => void,
): () => void {
  return onSnapshot(query(coversCol(uid), where('cycle', '==', cycle)), (snap) =>
    cb(snap.docs.map((d) => toCover(d.id, d.data()))),
  );
}

export function watchPendingCovers(uid: string, cb: (covers: Cover[]) => void): () => void {
  return onSnapshot(query(coversCol(uid), where('status', '==', 'pending')), (snap) =>
    cb(snap.docs.map((d) => toCover(d.id, d.data())).sort((a, b) => a.createdAt - b.createdAt)),
  );
}

/**
 * Creates a cover.
 *
 * Whether a transfer is needed depends on the TWO ENDS being in different
 * banks, not on where the source is. Purchases to Health are both BIDV: no
 * money leaves the bank, it is just a relabel - asking for a transfer (to
 * VCB!) names the wrong receiver. But Buffer in VCB covering a BIDV fund
 * means the money must really move, even though the source is in VCB.
 *
 * Different banks → `pending`, and balances do NOT change yet. They change
 * only after the user confirms the real transfer, so the app's numbers always
 * match money that actually moved.
 *
 * Written before the user leaves the app: iOS often kills the PWA when
 * switching to the bank app, and the question must survive a restart.
 */
export async function createCover(
  uid: string,
  args: { txId: string; cycle: string; to: Bucket; from: Bucket; amountVnd: number },
): Promise<Cover> {
  const needsTransfer = args.from.bank !== args.to.bank;
  const ref = doc(coversCol(uid));
  const now = Date.now();

  const data = {
    txId: args.txId,
    cycle: args.cycle,
    toBucketId: args.to.id,
    fromBucketId: args.from.id,
    toName: args.to.name,
    fromName: args.from.name,
    amountVnd: args.amountVnd,
    needsTransfer,
    status: needsTransfer ? ('pending' as const) : ('done' as const),
    createdAt: now,
    confirmedAt: needsTransfer ? null : now,
  };

  const batch = writeBatch(db);
  batch.set(ref, data);
  // Done at once (same bank) means balances change in the SAME batch. A cover
  // from Buffer subtracts nowhere - Buffer is a budget bucket - but the TARGET
  // fund must still get back what the original transaction took.
  if (!needsTransfer) {
    const deltas = coverBalanceDeltas({
      fromBucketId: args.from.id,
      fromKind: args.from.kind,
      toBucketId: args.to.id,
      toKind: args.to.kind,
      amountVnd: args.amountVnd,
    });
    for (const [bucketId, delta] of Object.entries(deltas)) {
      batch.update(doc(bucketsCol(uid), bucketId), {
        balanceVnd: increment(delta),
        updatedAt: now,
      });
    }
  }
  await batch.commit();

  return { id: ref.id, ...data };
}

/**
 * The user confirms the transfer. Only now do balances change - at BOTH
 * ends, since money leaving the source fund just entered the target fund.
 */
export async function confirmCover(uid: string, cover: Cover): Promise<void> {
  const { fromKind, toKind } = await kindsOf(uid, cover);
  const deltas = coverBalanceDeltas({
    fromBucketId: cover.fromBucketId,
    fromKind,
    toBucketId: cover.toBucketId,
    toKind,
    amountVnd: cover.amountVnd,
  });

  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(coversCol(uid), cover.id), { status: 'done', confirmedAt: now });
  for (const [bucketId, delta] of Object.entries(deltas)) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(delta),
      updatedAt: now,
    });
  }
  await batch.commit();
}

/**
 * Drops a cover. The original transaction is untouched.
 *
 * A completed cover taken from a fund must GIVE BACK the balance - otherwise
 * cancelling a cover silently eats the fund's money. Often used when the
 * expense is refunded later and the cover is no longer needed.
 */
export async function cancelCover(uid: string, cover: Cover): Promise<void> {
  const ref = doc(coversCol(uid), cover.id);

  // Still pending means no balance changed - the real money has not moved either.
  if (cover.status !== 'done') {
    await deleteDoc(ref);
    return;
  }

  const { fromKind, toKind } = await kindsOf(uid, cover);
  const deltas = coverBalanceDeltas({
    fromBucketId: cover.fromBucketId,
    fromKind,
    toBucketId: cover.toBucketId,
    toKind,
    amountVnd: cover.amountVnd,
  });

  const now = Date.now();
  const batch = writeBatch(db);
  batch.delete(ref);
  // Give back EXACTLY what the cover took, at both ends.
  for (const [bucketId, delta] of Object.entries(deltas)) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(-delta),
      updatedAt: now,
    });
  }
  await batch.commit();
}
