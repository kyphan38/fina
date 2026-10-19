import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';

// One free-text note (debts, reminders). Plain text on purpose: no logic
// reads it, so it can hold anything the app does not model yet.
const notesRef = (uid: string) => doc(db, 'users', uid, 'meta', 'notes');

export function watchNotes(uid: string, cb: (text: string) => void): () => void {
  return onSnapshot(notesRef(uid), (snap) => {
    const v = snap.data()?.text;
    cb(typeof v === 'string' ? v : '');
  });
}

export async function saveNotes(uid: string, text: string): Promise<void> {
  await setDoc(notesRef(uid), { text, updatedAt: Date.now() });
}
