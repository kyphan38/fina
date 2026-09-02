import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { cycleOf } from '@/lib/cycle';
import type { Income, IncomeKind } from '@/types/fina';

export const incomeCol = (uid: string) => collection(db, 'users', uid, 'income');

function toIncome(id: string, data: Record<string, unknown>): Income {
  return {
    id,
    occurredAt: Number(data.occurredAt ?? 0),
    cycle: String(data.cycle ?? ''),
    amountVnd: Number(data.amountVnd ?? 0),
    kind: data.kind === 'other' ? 'other' : 'salary',
    note: (data.note as string | null) ?? null,
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

export function watchCycleIncome(
  uid: string,
  cycle: string,
  cb: (rows: Income[]) => void,
): () => void {
  return onSnapshot(query(incomeCol(uid), where('cycle', '==', cycle)), (snap) =>
    cb(snap.docs.map((d) => toIncome(d.id, d.data())).sort((a, b) => b.occurredAt - a.occurredAt)),
  );
}

/**
 * Ghi một khoản thu.
 *
 * `id` truyền vào để lương của một chu kỳ luôn ghi đè chính nó
 * (`income-2026-10-salary`) - bấm Apply hai lần không tạo hai bản lương.
 */
export async function addIncome(
  uid: string,
  args: {
    id?: string;
    amountVnd: number;
    kind: IncomeKind;
    note: string | null;
    occurredAt?: number;
  },
): Promise<string> {
  const occurredAt = args.occurredAt ?? Date.now();
  const ref = args.id ? doc(incomeCol(uid), args.id) : doc(incomeCol(uid));
  const now = Date.now();

  await setDoc(ref, {
    occurredAt,
    cycle: cycleOf(new Date(occurredAt)),
    amountVnd: args.amountVnd,
    kind: args.kind,
    note: args.note && args.note.length > 0 ? args.note : null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function deleteIncome(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(incomeCol(uid), id));
}
