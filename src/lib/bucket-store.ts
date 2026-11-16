// Adding a monthly bucket from Settings (FX3). Firestore writes; the rules live
// in bucket-admin.ts. Hiding uses updateBucket(..., { active }) in buckets.ts.

import { doc, getDoc, writeBatch } from 'firebase/firestore';

import { newBucketId, nextMonthlyOrder } from '@/lib/bucket-admin';
import { bucketsCol } from '@/lib/buckets';
import { cyclesCol } from '@/lib/cycles';
import { db } from '@/lib/firebase-client';
import type { Bucket } from '@/types/fina';

/**
 * Creates a VCB monthly bucket that counts from the running cycle: its standard
 * also goes into this cycle's frozen limits, so Log and Summary agree at once.
 * A cycle doc that does not exist yet will freeze it from the standard anyway.
 */
export async function addMonthlyBucket(
  uid: string,
  buckets: Bucket[],
  input: { name: string; standardVnd: number },
  cycleId: string,
): Promise<string> {
  const id = newBucketId(input.name, buckets.map((b) => b.id));
  const ref = doc(bucketsCol(uid), id);
  // A stale list could hide an existing id; never overwrite a bucket.
  if ((await getDoc(ref)).exists()) throw new Error(`Bucket ${id} already exists`);
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(ref, {
    name: input.name.trim(),
    kind: 'budget',
    bank: 'VCB',
    standardVnd: input.standardVnd,
    hint: null,
    order: nextMonthlyOrder(buckets),
    active: true,
    evenlySpent: false,
    createdAt: now,
    updatedAt: now,
  });
  const cycleRef = doc(cyclesCol(uid), cycleId);
  const cycle = await getDoc(cycleRef);
  if (cycle.exists() && cycle.get('status') !== 'closed') {
    batch.update(cycleRef, { [`limits.${id}`]: input.standardVnd });
  }
  await batch.commit();
  return id;
}
