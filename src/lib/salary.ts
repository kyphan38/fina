import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import type { Salary } from '@/types/fina';

export const salaryCol = (uid: string) => collection(db, 'users', uid, 'salary');

/**
 * Một tháng một bản ghi, id CHÍNH là tháng ('2026-09').
 *
 * Nhờ vậy nhập lại tháng cũ là ghi đè chứ không đẻ ra bản thứ hai, và không
 * bao giờ có hai con số cho cùng một tháng.
 */
function toSalary(id: string, data: Record<string, unknown>): Salary {
  return {
    month: id,
    amountVnd: Number(data.amountVnd ?? 0),
    note: (data.note as string | null) ?? null,
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/** Toàn bộ lịch sử lương, mới nhất trước. Vài chục document, đọc một lần. */
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
 * Tháng dương lịch của một mốc thời gian: '2026-09'.
 *
 * CỐ Ý không dùng `cycleOf`. Chu kỳ chi tiêu cắt ngày 25, nên đúng hôm lĩnh
 * lương (25/09) `cycleOf` đã trả về '2026-10' - lương tháng 9 sẽ bị ghi vào
 * ô tháng 10, và cả bảng lệch một tháng.
 */
export function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tổng theo năm, năm mới trước. Năm lấy từ id tháng. */
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
 * Trung bình mỗi tháng ĐÃ ghi, không phải chia cho 12. Ghi 4 tháng mà chia
 * cho 12 thì con số nói dối về thu nhập thật.
 */
export function average(rows: Salary[]): number {
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((a, r) => a + r.amountVnd, 0) / rows.length);
}
