import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import type { Salary } from '@/types/fina';

export const salaryCol = (uid: string) => collection(db, 'users', uid, 'salary');

/**
 * One record per month, and the id IS the month ('2026-09').
 *
 * So re-entering an old month overwrites instead of creating a second record,
 * and there are never two numbers for one month.
 */
function toSalary(id: string, data: Record<string, unknown>): Salary {
  return {
    month: id,
    amountVnd: Number(data.amountVnd ?? 0),
    note: (data.note as string | null) ?? null,
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/** The full salary history, newest first. A few dozen documents, read once. */
export function watchSalaries(uid: string, cb: (rows: Salary[]) => void): () => void {
  return onSnapshot(salaryCol(uid), (snap) =>
    cb(
      snap.docs
        .map((d) => toSalary(d.id, d.data()))
        .sort((a, b) => (a.month < b.month ? 1 : -1)),
    ),
  );
}

export async function setSalary(
  uid: string,
  month: string,
  amountVnd: number,
  note: string | null,
): Promise<void> {
  await setDoc(doc(salaryCol(uid), month), {
    amountVnd,
    note: note && note.length > 0 ? note : null,
    updatedAt: Date.now(),
  });
}

export async function removeSalary(uid: string, month: string): Promise<void> {
  await deleteDoc(doc(salaryCol(uid), month));
}

/**
 * The calendar month of a timestamp: '2026-09'.
 *
 * Deliberately NOT `cycleOf`. The spending cycle turns on the 25th, so on
 * payday itself (25/09) `cycleOf` already returns '2026-10' - September's
 * salary would land in October, and the whole table shifts by a month.
 */
export function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Totals per year, newest year first. The year comes from the month id. */
export function byYear(rows: Salary[]): { year: string; totalVnd: number; months: number }[] {
  const map = new Map<string, { totalVnd: number; months: number }>();
  for (const r of rows) {
    const y = r.month.slice(0, 4);
    const cur = map.get(y) ?? { totalVnd: 0, months: 0 };
    map.set(y, { totalVnd: cur.totalVnd + r.amountVnd, months: cur.months + 1 });
  }
  return [...map.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => (a.year < b.year ? 1 : -1));
}

/**
 * Average per month RECORDED, not divided by 12. Recording 4 months and
 * dividing by 12 lies about real income.
 */
export function average(rows: Salary[]): number {
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((a, r) => a + r.amountVnd, 0) / rows.length);
}
