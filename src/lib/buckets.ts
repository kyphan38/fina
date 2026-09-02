import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { SEED_BUCKETS, type Bucket } from '@/types/fina';

export const bucketsCol = (uid: string) => collection(db, 'users', uid, 'buckets');

function toBucket(id: string, data: Record<string, unknown>): Bucket {
  return {
    id,
    name: String(data.name ?? id),
    kind: data.kind === 'fund' ? 'fund' : 'budget',
    bank: (data.bank as Bucket['bank']) ?? 'VCB',
    baselineVnd: Number(data.baselineVnd ?? 0),
    standardVnd: Number(data.standardVnd ?? data.baselineVnd ?? 0),
    hint: (data.hint as string | null) ?? null,
    balanceVnd: Number(data.balanceVnd ?? 0),
    order: Number(data.order ?? 0),
    active: data.active !== false,
    goal: (data.goal as Bucket['goal']) ?? null,
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/** Nghe thay đổi bucket. Trả về hàm huỷ - người gọi PHẢI gọi khi unmount. */
export function watchBuckets(uid: string, cb: (buckets: Bucket[]) => void): () => void {
  const q = query(bucketsCol(uid), orderBy('order'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toBucket(d.id, d.data())));
  });
}

/**
 * Ghi bộ hũ khởi tạo. Chạy được nhiều lần: đã có bucket nào thì bỏ qua hết,
 * không ghi đè - baseline người dùng đã chỉnh tay là dữ liệu thật.
 */
export async function seedBuckets(uid: string): Promise<'seeded' | 'skipped'> {
  const existing = await getDocs(bucketsCol(uid));
  if (!existing.empty) return 'skipped';

  const now = Date.now();
  const batch = writeBatch(db);
  for (const seed of SEED_BUCKETS) {
    batch.set(doc(bucketsCol(uid), seed.id), {
      name: seed.name,
      kind: seed.kind,
      bank: seed.bank,
      baselineVnd: seed.baselineVnd,
      standardVnd: seed.standardVnd,
      hint: seed.hint,
      balanceVnd: 0,
      order: seed.order,
      active: true,
      goal: seed.goal,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  return 'seeded';
}

export async function updateBucket(
  uid: string,
  bucketId: string,
  patch: Partial<Pick<Bucket, 'name' | 'baselineVnd' | 'standardVnd' | 'order' | 'active'>>,
): Promise<void> {
  await updateDoc(doc(bucketsCol(uid), bucketId), { ...patch, updatedAt: Date.now() });
}

// serverTimestamp chưa dùng ở Stage 2 - mọi mốc thời gian lấy từ đồng hồ máy
// để ghi optimistic hiện ngay, không đợi server trả lời.
void serverTimestamp;
