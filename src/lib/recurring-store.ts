// F2: recurring entries in users/{uid}/meta/recurring (meta is owner-only in
// firestore.rules). "log" only fills Log's form; the normal Save writes the
// entry (so covers and Undo still work), then markRecurringDone records it.

import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { parseRecurring, type RecurringDoc, type RecurringItem } from '@/lib/recurring';
import type { CycleId } from '@/lib/cycle';

const recurringRef = (uid: string) => doc(db, 'users', uid, 'meta', 'recurring');

export function watchRecurring(uid: string, cb: (doc: RecurringDoc) => void): () => void {
  return onSnapshot(recurringRef(uid), (snap) => cb(parseRecurring(snap.data())));
}

/** Replaces the list. `done` is kept, so an edit does not bring back a logged item. */
export async function saveRecurringItems(uid: string, items: RecurringItem[]): Promise<void> {
  await setDoc(recurringRef(uid), { items }, { merge: true });
}

/** Logged or skipped: it does not show again until the next cycle. */
export async function markRecurringDone(uid: string, id: string, cycle: CycleId): Promise<void> {
  await setDoc(recurringRef(uid), { done: { [id]: cycle } }, { merge: true });
}
