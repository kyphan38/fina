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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import { cycleRange } from '@/lib/cycle';
import { txCol } from '@/lib/transactions';
import type { Bucket, Cycle, SurplusTarget } from '@/types/fina';

export const cyclesCol = (uid: string) => collection(db, 'users', uid, 'cycles');
const cycleRef = (uid: string, id: string) => doc(cyclesCol(uid), id);

function toCycle(id: string, data: Record<string, unknown>): Cycle {
  return {
    id,
    startAt: Number(data.startAt ?? 0),
    endAt: Number(data.endAt ?? 0),
    limits: (data.limits as Record<string, number>) ?? {},
    status: data.status === 'closed' ? 'closed' : 'open',
    closedAt: data.closedAt == null ? null : Number(data.closedAt),
    surplusVnd: data.surplusVnd == null ? null : Number(data.surplusVnd),
    surplusTo: (data.surplusTo as SurplusTarget | null) ?? null,
    closedTotals: (data.closedTotals as Cycle['closedTotals']) ?? null,
  };
}

/**
 * Đọc chu kỳ, tạo mới nếu chưa có.
 *
 * `limits` được chép từ `standardVnd` lúc tạo rồi ĐÓNG BĂNG. Sửa baseline trong
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
    if (b.kind === 'budget' && b.active) limits[b.id] = b.standardVnd;
  }

  const fresh = {
    startAt,
    endAt,
    limits,
    status: 'open' as const,
    closedAt: null,
    surplusVnd: null,
    surplusTo: null,
    closedTotals: null,
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
 * Sửa TAY hạn mức của chu kỳ đang chạy - đường dùng bởi nút `Edit limits` ở
 * Summary, và chỉ nó.
 *
 * Đường còn lại là `applyCyclePlan`, chạy ngày 25 và làm nhiều việc hơn hẳn
 * (ghi lương, chia tiền vào quỹ). Hai hàm cùng ghi `limits` nên tên phải nói
 * rõ cái nào là cái nào.
 */
export async function overrideCycleLimits(
  uid: string,
  cycleId: string,
  limits: Record<string, number>,
): Promise<void> {
  await updateDoc(cycleRef(uid, cycleId), { limits });
}

/**
 * Ngày 25: một hành động, ba việc.
 *
 *  1. Ghi bản ghi thu nhập của chu kỳ
 *  2. Đóng băng hạn mức cho các bucket VCB
 *  3. Nạp tiền vào từng quỹ BIDV bằng một giao dịch `in`, `source: 'allocation'`
 *
 * Việc thứ ba là phần vá lỗ hổng: trước đây quỹ chỉ bao giờ giảm, không bao
 * giờ được cấp tiền. Ghi nó thành GIAO DỊCH chứ không phải cộng thẳng vào số
 * dư, để `recompute-balances` dựng lại được và để người dùng nhìn thấy tiền
 * vào quỹ trong History.
 *
 * ETF cố ý KHÔNG được phân bổ tự động: người dùng nhập tay lúc thật sự
 * chuyển sang VPS, làm cả hai là mỗi đồng bị đếm hai lần.
 *
 * Chạy lại được: id sinh cố định, và mọi allocation cũ của chu kỳ bị gỡ (hoàn
 * lại số dư quỹ) trước khi ghi bộ mới.
 */
export async function applyCyclePlan(
  uid: string,
  cycleId: string,
  plan: {
    /** Số đem chia của kỳ này: phần dư còn lại cộng khoản vừa nhận. KHÔNG
     *  phải lương - lương được theo dõi riêng và không đi qua đây. */
    divideVnd: number;
    limits: Record<string, number>;
    /** bucketId -> số tiền, chỉ quỹ. Không gồm etf. */
    fundAllocations: Record<string, number>;
    occurredAt?: number;
  },
): Promise<void> {
  const now = plan.occurredAt ?? Date.now();

  // Gỡ allocation cũ của chính chu kỳ này, hoàn số dư về, rồi mới ghi lại.
  //
  // CHỈ gỡ những dòng do chính hàm này sinh ra (id `alloc-<chu kỳ>-<bucket>`).
  // Khoản nạp tay giữa chừng cũng mang source 'allocation' - nó cũng là
  // chuyển tiền VCB sang BIDV - nhưng xoá nó ở đây là ăn mất tiền của người dùng.
  const prefix = `alloc-${cycleId}-`;
  const old = await getDocs(
    query(txCol(uid), where('cycle', '==', cycleId), where('source', '==', 'allocation')),
  );

  const batch = writeBatch(db);

  for (const d of old.docs) {
    if (!d.id.startsWith(prefix)) continue;
    const t = d.data();
    batch.delete(d.ref);
    batch.update(doc(bucketsCol(uid), String(t.bucketId)), {
      balanceVnd: increment(-Number(t.amountVnd ?? 0)),
      updatedAt: now,
    });
  }

  // Con số đem chia KHÔNG được lưu lại ở đâu cả. Nó chỉ là đầu vào để tính
  // hạn mức; giữ nó lại là dựng lại đúng thứ vừa bỏ đi (theo dõi dòng tiền).
  batch.update(cycleRef(uid, cycleId), { limits: plan.limits });

  for (const [bucketId, amountVnd] of Object.entries(plan.fundAllocations)) {
    if (amountVnd <= 0) continue;
    batch.set(doc(txCol(uid), `alloc-${cycleId}-${bucketId}`), {
      occurredAt: now,
      cycle: cycleId,
      bucketId,
      bank: 'BIDV',
      amountVnd,
      direction: 'in',
      note: `Allocation ${cycleId}`,
      source: 'allocation',
      createdAt: now,
      updatedAt: now,
    });
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(amountVnd),
      updatedAt: now,
    });
  }

  await batch.commit();
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
  /** Chụp lại để Trend và Notes khỏi đọc lại toàn bộ giao dịch của kỳ. */
  snapshot: { byBucket: Record<string, number> },
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(cycleRef(uid, cycleId), {
    status: 'closed',
    closedAt: Date.now(),
    surplusVnd,
    surplusTo,
    closedTotals: { byBucket: snapshot.byBucket },
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
