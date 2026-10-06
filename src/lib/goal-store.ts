import { doc, getDoc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import { DEFAULT_GOALS_MONTHLY_VND, goalId, nextGoalOrder } from '@/lib/goals';
import type { Bucket, Goal } from '@/types/fina';

const settingsRef = (uid: string) => doc(db, 'users', uid, 'meta', 'settings');

/** Create a goal fund with a zero balance. Money comes in by Move or on day 25. */
export async function createGoal(
  uid: string,
  buckets: Bucket[],
  input: { name: string; targetVnd: number | null; targetMonth: string | null; standardVnd: number },
): Promise<string> {
  const id = goalId(input.name, buckets.map((b) => b.id));
  // A stale list could hide an existing id; never overwrite a fund.
  if ((await getDoc(doc(bucketsCol(uid), id))).exists()) {
    throw new Error(`Bucket ${id} already exists`);
  }
  const now = Date.now();
  const goal: Goal = { targetVnd: input.targetVnd, targetMonth: input.targetMonth, status: 'saving' };
  await setDoc(doc(bucketsCol(uid), id), {
    name: input.name.trim(),
    kind: 'fund',
    bank: 'BIDV',
    standardVnd: input.standardVnd,
    hint: null,
    balanceVnd: 0,
    order: nextGoalOrder(buckets),
    active: true,
    evenlySpent: false,
    goal,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Swap two goals' priority in one batch. */
export async function swapGoalOrder(uid: string, a: Bucket, b: Bucket): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(bucketsCol(uid), a.id), { order: b.order, updatedAt: now });
  batch.update(doc(bucketsCol(uid), b.id), { order: a.order, updatedAt: now });
  await batch.commit();
}

export function watchGoalsMonthly(uid: string, cb: (vnd: number) => void): () => void {
  return onSnapshot(settingsRef(uid), (snap) => {
    const v = snap.data()?.goalsMonthlyVnd;
    cb(typeof v === 'number' ? v : DEFAULT_GOALS_MONTHLY_VND);
  });
}

export async function setGoalsMonthly(uid: string, vnd: number): Promise<void> {
  await setDoc(settingsRef(uid), { goalsMonthlyVnd: vnd }, { merge: true });
}
