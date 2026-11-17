// ============================================================
// fina - People in Firestore (PLAN-people.md)
//
// Every write that changes a balance does it in the SAME batch as the entry,
// like funds: two writes would sometimes disagree.
// ============================================================

import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { cycleOf } from '@/lib/cycle';
import { personDelta } from '@/lib/people';
import { PEOPLE_BUCKET, type Bank, type Bucket, type Person, type Transaction, type TxDirection } from '@/types/fina';

export const peopleCol = (uid: string) => collection(db, 'users', uid, 'people');
// Local copies: lib/transactions imports this file.
const txCol = (uid: string) => collection(db, 'users', uid, 'transactions');
const bucketRef = (uid: string, id: string) => doc(db, 'users', uid, 'buckets', id);

function toPerson(id: string, d: Record<string, unknown>): Person {
  return {
    id,
    name: String(d.name ?? id),
    balanceVnd: Number(d.balanceVnd ?? 0),
    archived: d.archived === true,
    createdAt: Number(d.createdAt ?? 0),
    updatedAt: Number(d.updatedAt ?? 0),
  };
}

export function watchPeople(uid: string, cb: (people: Person[]) => void): () => void {
  return onSnapshot(query(peopleCol(uid), orderBy('createdAt')), (snap) => cb(snap.docs.map((d) => toPerson(d.id, d.data()))));
}

/** A new person with a zero balance. The name must already be clean (lib/people). */
export async function createPerson(uid: string, name: string): Promise<Person> {
  const ref = doc(peopleCol(uid));
  const now = Date.now();
  const p = { name, balanceVnd: 0, archived: false, createdAt: now, updatedAt: now };
  const batch = writeBatch(db);
  batch.set(ref, p);
  await batch.commit();
  return { id: ref.id, ...p };
}

export async function setArchived(uid: string, id: string, archived: boolean): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(peopleCol(uid), id), { archived, updatedAt: Date.now() });
  await batch.commit();
}

/** One People entry and the person's balance, in one batch. */
export async function addPersonTx(
  uid: string,
  person: Person,
  amountVnd: number,
  note: string | null,
  direction: TxDirection,
  bank: Bank,
  occurredAt: number = Date.now(),
): Promise<{ id: string; occurredAt: number }> {
  const ref = doc(txCol(uid));
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(ref, {
    occurredAt,
    cycle: cycleOf(new Date(occurredAt)),
    bucketId: PEOPLE_BUCKET,
    personId: person.id,
    bank,
    amountVnd,
    direction,
    note: note && note.length > 0 ? note : null,
    source: 'web',
    createdAt: now,
    updatedAt: now,
  });
  batch.update(doc(peopleCol(uid), person.id), {
    balanceVnd: increment(personDelta(direction, amountVnd)),
    updatedAt: now,
  });
  await batch.commit();
  return { id: ref.id, occurredAt };
}

/** Removes a People entry and takes its effect off the balance. */
export async function deletePersonTx(uid: string, tx: Transaction): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.delete(doc(txCol(uid), tx.id));
  if (tx.personId) {
    batch.update(doc(peopleCol(uid), tx.personId), {
      balanceVnd: increment(-personDelta(tx.direction, tx.amountVnd)),
      updatedAt: now,
    });
  }
  await batch.commit();
}

/**
 * "Count as spending" (case A): money a person will not pay back becomes
 * your own spending in the CURRENT cycle. Two entries sharing a settleId:
 * an `out` on the bucket and an `in` on the person, so the balance goes down.
 */
export async function countAsSpending(
  uid: string,
  person: Person,
  bucket: Bucket,
  amountVnd: number,
  occurredAt: number = Date.now(),
): Promise<string> {
  const settleId = doc(txCol(uid)).id;
  const now = Date.now();
  const cycle = cycleOf(new Date(occurredAt));
  const note = `${person.name}, not paid back`;
  const batch = writeBatch(db);
  batch.set(doc(txCol(uid), `${settleId}-spend`), {
    occurredAt, cycle, bucketId: bucket.id, bank: bucket.bank, amountVnd, direction: 'out',
    note, source: 'web', settleId, createdAt: now, updatedAt: now,
  });
  batch.set(doc(txCol(uid), `${settleId}-person`), {
    occurredAt, cycle, bucketId: PEOPLE_BUCKET, personId: person.id, bank: bucket.bank, amountVnd,
    direction: 'in', note, source: 'web', settleId, createdAt: now, updatedAt: now,
  });
  batch.update(doc(peopleCol(uid), person.id), { balanceVnd: increment(-amountVnd), updatedAt: now });
  if (bucket.kind === 'fund') batch.update(bucketRef(uid, bucket.id), { balanceVnd: increment(-amountVnd), updatedAt: now });
  await batch.commit();
  return settleId;
}

/** Deletes both entries of a "Count as spending" and undoes both balances. */
export async function deleteSettle(uid: string, settleId: string): Promise<void> {
  const refs = [doc(txCol(uid), `${settleId}-spend`), doc(txCol(uid), `${settleId}-person`)];
  const snaps = await Promise.all(refs.map((r) => getDoc(r)));
  const now = Date.now();
  const batch = writeBatch(db);
  for (const s of snaps) {
    if (!s.exists()) continue;
    const d = s.data();
    const amount = Number(d.amountVnd ?? 0);
    batch.delete(s.ref);
    if (typeof d.personId === 'string') {
      batch.update(doc(peopleCol(uid), d.personId), { balanceVnd: increment(-personDelta(d.direction === 'in' ? 'in' : 'out', amount)), updatedAt: now });
    } else {
      const b = await getDoc(bucketRef(uid, String(d.bucketId)));
      if (b.exists() && b.data().kind === 'fund') batch.update(b.ref, { balanceVnd: increment(amount), updatedAt: now });
    }
  }
  await batch.commit();
}
