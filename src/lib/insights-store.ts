import { collection, doc, getDoc, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { digestHash, type Digest } from '@/lib/digest';

export interface StoredInsight {
  cycle: string;
  hash: string;
  lines: string[];
  droppedCount: number;
  createdAt: number;
}

const col = (uid: string) => collection(db, 'users', uid, 'insights');

/** Cùng dữ liệu, cùng chu kỳ → không gọi API lần nữa. */
export async function readInsight(
  uid: string,
  cycle: string,
  digest: Digest,
): Promise<StoredInsight | null> {
  const snap = await getDoc(doc(col(uid), cycle));
  if (!snap.exists()) return null;
  const data = snap.data() as StoredInsight;
  return data.hash === digestHash(digest) ? data : null;
}

export async function saveInsight(
  uid: string,
  cycle: string,
  digest: Digest,
  lines: string[],
  droppedCount: number,
): Promise<StoredInsight> {
  const record: StoredInsight = {
    cycle,
    hash: digestHash(digest),
    lines,
    droppedCount,
    createdAt: Date.now(),
  };
  await setDoc(doc(col(uid), cycle), record);
  return record;
}
