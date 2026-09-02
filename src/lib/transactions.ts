import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { cycleOf } from '@/lib/cycle';
import { bucketsCol } from '@/lib/buckets';
import type { Bucket, Transaction } from '@/types/fina';

export const txCol = (uid: string) => collection(db, 'users', uid, 'transactions');

function toTx(id: string, data: Record<string, unknown>): Transaction {
  return {
    id,
    occurredAt: Number(data.occurredAt ?? 0),
    cycle: String(data.cycle ?? ''),
    bucketId: String(data.bucketId ?? ''),
    bank: (data.bank as Transaction['bank']) ?? 'VCB',
    amountVnd: Number(data.amountVnd ?? 0),
    note: (data.note as string | null) ?? null,
    source: data.source === 'import' ? 'import' : 'web',
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/**
 * MỘT query cho cả chu kỳ, không phải một query mỗi bucket.
 * Firestore free tier có 50k lượt đọc/ngày; rò listener là cách nhanh nhất đốt hết.
 */
export function watchCycleTransactions(
  uid: string,
  cycle: string,
  cb: (txs: Transaction[]) => void,
): () => void {
  const q = query(txCol(uid), where('cycle', '==', cycle));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toTx(d.id, d.data())));
  });
}

/**
 * Ghi một giao dịch. Với bucket dạng fund thì trừ luôn balanceVnd trong
 * CÙNG một batch - hai lệnh ghi rời sẽ có lúc lệch nhau.
 *
 * Trả về id sinh ở client, nên UI cập nhật ngay không đợi server.
 */
export async function addTransaction(
  uid: string,
  bucket: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): Promise<string> {
  const ref = doc(txCol(uid));
  const now = Date.now();
  const batch = writeBatch(db);

  batch.set(ref, {
    occurredAt,
    cycle: cycleOf(new Date(occurredAt)),
    bucketId: bucket.id,
    // Chép ngân hàng vào record. Bucket đổi ngân hàng sau này thì lịch sử
    // cũ vẫn nói đúng chuyện đã xảy ra.
    bank: bucket.bank,
    amountVnd,
    note: note && note.length > 0 ? note : null,
    source: 'web',
    createdAt: now,
    updatedAt: now,
  });

  if (bucket.kind === 'fund') {
    batch.update(doc(bucketsCol(uid), bucket.id), {
      balanceVnd: increment(-amountVnd),
      updatedAt: now,
    });
  }

  await batch.commit();
  return ref.id;
}

/** Tổng đã tiêu theo từng bucket. Tính ở client, KHÔNG denormalize -
 *  Stage 4 cho sửa giao dịch, denormalize sẽ lệch ngay. */
export function spentByBucket(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tx of txs) {
    out[tx.bucketId] = (out[tx.bucketId] ?? 0) + tx.amountVnd;
  }
  return out;
}
