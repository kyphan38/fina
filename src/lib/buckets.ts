import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { SEED_BUCKETS, type Bucket, type Goal } from '@/types/fina';

export const bucketsCol = (uid: string) => collection(db, 'users', uid, 'buckets');

function toGoal(raw: unknown): Goal | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  return {
    targetVnd: typeof g.targetVnd === 'number' ? g.targetVnd : null,
    targetMonth: typeof g.targetMonth === 'string' ? g.targetMonth : null,
    status: g.status === 'later' || g.status === 'done' ? g.status : 'saving',
  };
}

function toBucket(id: string, data: Record<string, unknown>): Bucket {
  return {
    id,
    name: String(data.name ?? id),
    kind: data.kind === 'fund' ? 'fund' : 'budget',
    bank: (data.bank as Bucket['bank']) ?? 'VCB',
    standardVnd: Number(data.standardVnd ?? data.baselineVnd ?? 0),
    hint: (data.hint as string | null) ?? null,
    balanceVnd: Number(data.balanceVnd ?? 0),
    order: Number(data.order ?? 0),
    active: data.active !== false,
    evenlySpent: data.evenlySpent === true,
    goal: toGoal(data.goal),
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/** Listen to bucket changes. Returns an unsubscribe - the caller MUST call it on unmount. */
export function watchBuckets(uid: string, cb: (buckets: Bucket[]) => void): () => void {
  const q = query(bucketsCol(uid), orderBy('order'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toBucket(d.id, d.data())));
  });
}

/**
 * Writes the starting buckets. Safe to rerun: if any bucket exists, skip all,
 * never overwrite - a baseline the user edited is real data.
 */
export async function seedBuckets(uid: string): Promise<'seeded' | 'skipped'> {
  const existing = await getDocs(bucketsCol(uid));
  if (!existing.empty) return 'skipped';

  const now = Date.now();
  const batch = writeBatch(db);
  for (const seed of SEED_BUCKETS) {
    batch.set(doc(bucketsCol(uid), seed.id), {
      name: seed.name,
      kind: seed.kind,
      bank: seed.bank,
      standardVnd: seed.standardVnd,
      hint: seed.hint,
      balanceVnd: 0,
      order: seed.order,
      active: true,
      evenlySpent: seed.evenlySpent,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  return 'seeded';
}

export async function updateBucket(
  uid: string,
  bucketId: string,
  patch: Partial<Pick<Bucket, 'name' | 'standardVnd' | 'hint' | 'order' | 'active' | 'goal'>>,
): Promise<void> {
  await updateDoc(doc(bucketsCol(uid), bucketId), { ...patch, updatedAt: Date.now() });
}

// serverTimestamp is not used in Stage 2 - every timestamp comes from the
// device clock so the optimistic write shows at once, without waiting for the server.
void serverTimestamp;
