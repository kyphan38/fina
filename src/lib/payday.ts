import { doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { coversCol } from '@/lib/covers';
import { cyclesCol } from '@/lib/cycles';
import {
  cycleOf,
  cycleOverridesStore,
  cycleRange,
  dayString,
  earlyPaydayCycle,
  parseOverrides,
} from '@/lib/cycle';
import { txCol } from '@/lib/transactions';

// Payday overrides live in meta/settings as `cycleStarts: { '2027-02': '2027-01-20' }`.
const settingsRef = (uid: string) => doc(db, 'users', uid, 'meta', 'settings');

/** Keeps the cycle module's override store in step with meta/settings. */
export function watchCycleOverrides(uid: string): () => void {
  return onSnapshot(settingsRef(uid), (snap) => {
    cycleOverridesStore.set(parseOverrides(snap.data()?.cycleStarts));
  });
}

/**
 * Salary came early: start the next cycle today.
 *
 * Entries already logged today belong to the new cycle, so they (and their
 * covers) move with it. One batch: a half-done move would split today
 * between two cycles. The two cycle documents get their new range, so the
 * closing check (`now >= endAt`) fires on the right day.
 */
export async function startCycleToday(uid: string, now: Date = new Date()): Promise<string> {
  const next = earlyPaydayCycle(now);
  if (!next) throw new Error('[payday] Not within the early payday window.');
  const current = cycleOf(now);
  const day = dayString(now);
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const [txSnap, coverSnap] = await Promise.all([
    // One field only: cycle + occurredAt together would need a composite index.
    getDocs(query(txCol(uid), where('cycle', '==', current))),
    getDocs(query(coversCol(uid), where('cycle', '==', current))),
  ]);
  const today = txSnap.docs.filter((d) => Number(d.data().occurredAt) >= from);
  const moved = new Set(today.map((d) => d.id));

  const batch = writeBatch(db);
  for (const d of today) batch.update(d.ref, { cycle: next });
  for (const d of coverSnap.docs) {
    if (moved.has(String(d.data().txId))) batch.update(d.ref, { cycle: next });
  }
  batch.set(settingsRef(uid), { cycleStarts: { [next]: day } }, { merge: true });
  batch.set(doc(cyclesCol(uid), current), { endAt: from }, { merge: true });
  await batch.commit();

  cycleOverridesStore.set({ ...cycleOverridesStore.get(), [next]: day });
  // Fix the next cycle's start only if it already exists (the Generator may
  // have run). Creating it here would freeze limits from the wrong numbers.
  await updateDoc(doc(cyclesCol(uid), next), { startAt: cycleRange(next).startAt }).catch(() => {});
  return next;
}
