import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import { cycleRange } from '@/lib/cycle';
import type { Bucket, Cycle, SurplusTarget } from '@/types/fina';

export const cyclesCol = (uid: string) => collection(db, 'users', uid, 'cycles');
const cycleRef = (uid: string, id: string) => doc(cyclesCol(uid), id);

function toCycle(id: string, data: Record<string, unknown>): Cycle {
  return {
    id,
    startAt: Number(data.startAt ?? 0),
    endAt: Number(data.endAt ?? 0),
    incomeVnd: data.incomeVnd == null ? null : Number(data.incomeVnd),
    limits: (data.limits as Record<string, number>) ?? {},
    status: data.status === 'closed' ? 'closed' : 'open',
    closedAt: data.closedAt == null ? null : Number(data.closedAt),
    surplusVnd: data.surplusVnd == null ? null : Number(data.surplusVnd),
    surplusTo: (data.surplusTo as SurplusTarget | null) ?? null,
  };
}

/**
 * Đọc chu kỳ, tạo mới nếu chưa có.
 *
 * `limits` được chép từ baseline lúc tạo rồi ĐÓNG BĂNG. Sửa baseline trong
 * Settings không được phép làm đổi con số của một chu kỳ đã mở - nếu không,
 * mở lại biểu đồ tháng trước sẽ thấy số khác lần trước và không ai biết số
 * nào đúng.
 *
 * CHỈ gọi cho chu kỳ hiện tại. Chu kỳ quá khứ chưa có document nghĩa là nó
 * có trước khi app tồn tại - ta không biết hạn mức cũ là bao nhiêu và không
 * được bịa ra bằng baseline hôm nay.
 */
export async function ensureCycle(
  uid: string,
  cycleId: string,
  buckets: Bucket[],
): Promise<Cycle> {
  const ref = cycleRef(uid, cycleId);
  const snap = await getDoc(ref);
  if (snap.exists()) return toCycle(snap.id, snap.data());

  const { startAt, endAt } = cycleRange(cycleId);
  const limits: Record<string, number> = {};
  for (const b of buckets) {
    if (b.kind === 'budget' && b.active) limits[b.id] = b.baselineVnd;
  }

  const fresh = {
    startAt,
    endAt,
    incomeVnd: null,
    limits,
    status: 'open' as const,
    closedAt: null,
    surplusVnd: null,
    surplusTo: null,
  };
  await setDoc(ref, fresh);
  return { id: cycleId, ...fresh };
}

export function watchCycle(
  uid: string,
  cycleId: string,
  cb: (cycle: Cycle | null) => void,
): () => void {
  return onSnapshot(cycleRef(uid, cycleId), (snap) =>
    cb(snap.exists() ? toCycle(snap.id, snap.data()) : null),
  );
}

/** Danh sách chu kỳ có document, mới nhất trước. Dùng cho bộ chọn. */
export async function listCycles(uid: string): Promise<Cycle[]> {
  const snap = await getDocs(query(cyclesCol(uid), orderBy('startAt', 'desc')));
  return snap.docs.map((d) => toCycle(d.id, d.data()));
}

/**
 * Dư (+) hoặc lố (−) của cả chu kỳ, cộng trên mọi bucket dạng budget.
 * Hàm thuần - có test.
 */
export function computeSurplus(
  limits: Record<string, number>,
  spent: Record<string, number>,
): number {
  return Object.entries(limits).reduce(
    (sum, [bucketId, limit]) => sum + (limit - (spent[bucketId] ?? 0)),
    0,
  );
}

/**
 * Đóng sổ. Một batch: chốt chu kỳ, và chuyển phần dư vào quỹ đích.
 *
 * Không tự chuyển tiền thật, không tự tạo giao dịch. Chỉ ghi con số.
 */
export async function closeCycle(
  uid: string,
  cycleId: string,
  surplusVnd: number,
  surplusTo: SurplusTarget,
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(cycleRef(uid, cycleId), {
    status: 'closed',
    closedAt: Date.now(),
    surplusVnd,
    surplusTo,
  });

  // 'hold' = để nguyên, không cộng vào đâu cả.
  if (surplusVnd > 0 && surplusTo !== 'hold') {
    batch.update(doc(bucketsCol(uid), surplusTo === 'etf' ? 'etf' : 'reserve'), {
      balanceVnd: increment(surplusVnd),
      updatedAt: Date.now(),
    });
  }

  await batch.commit();
}
