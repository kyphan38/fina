import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import type { Bucket, Cover } from '@/types/fina';

export const coversCol = (uid: string) => collection(db, 'users', uid, 'covers');

function toCover(id: string, data: Record<string, unknown>): Cover {
  return {
    id,
    txId: String(data.txId ?? ''),
    cycle: String(data.cycle ?? ''),
    toBucketId: String(data.toBucketId ?? ''),
    fromBucketId: String(data.fromBucketId ?? ''),
    amountVnd: Number(data.amountVnd ?? 0),
    needsTransfer: data.needsTransfer === true,
    status: data.status === 'done' ? 'done' : 'pending',
    createdAt: Number(data.createdAt ?? 0),
    confirmedAt: data.confirmedAt == null ? null : Number(data.confirmedAt),
  };
}

export interface CoverOption {
  bucket: Bucket;
  availableVnd: number;
  enough: boolean;
}

/**
 * Các nguồn có thể bù. MỘT nguồn cho mỗi lần bù - không chia 200 chỗ này
 * 590 chỗ kia; chia nhỏ làm sổ sách rối mà chẳng được gì.
 *
 * Nguồn không đủ vẫn hiện nhưng bị làm mờ. Ẩn đi thì người dùng không hiểu
 * vì sao nó biến mất.
 */
export function coverOptions(args: {
  buckets: Bucket[];
  toBucketId: string;
  bufferLimitVnd: number;
  bufferUsedVnd: number;
  neededVnd: number;
}): CoverOption[] {
  const out: CoverOption[] = [];

  for (const b of args.buckets) {
    if (!b.active) continue;
    // Không tự bù cho chính mình, và ETF là đích đến chứ không phải ví.
    if (b.id === args.toBucketId || b.id === 'etf') continue;

    if (b.id === 'buffer') {
      const availableVnd = Math.max(0, args.bufferLimitVnd - args.bufferUsedVnd);
      out.push({ bucket: b, availableVnd, enough: availableVnd >= args.neededVnd });
      continue;
    }
    if (b.kind === 'fund') {
      const availableVnd = Math.max(0, b.balanceVnd);
      out.push({ bucket: b, availableVnd, enough: availableVnd >= args.neededVnd });
    }
  }

  // Buffer trước, rồi quỹ theo thứ tự hiển thị.
  return out.sort((a, c) =>
    a.bucket.id === 'buffer' ? -1 : c.bucket.id === 'buffer' ? 1 : a.bucket.order - c.bucket.order,
  );
}

/** Tổng đã rút ra từ mỗi bucket qua các lần bù ĐÃ xong. */
export function coveredByBucket(covers: Cover[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of covers) {
    if (c.status !== 'done') continue;
    out[c.fromBucketId] = (out[c.fromBucketId] ?? 0) + c.amountVnd;
  }
  return out;
}

/**
 * Phần bù lấy từ BIDV. Chỉ những khoản này mới làm đổi tổng của chu kỳ -
 * bù từ Buffer nằm trong VCB nên chỉ là di chuyển nội bộ.
 */
export function coveredFromOutside(covers: Cover[], buckets: Bucket[]): number {
  const bankOf = new Map(buckets.map((b) => [b.id, b.bank]));
  return covers
    .filter((c) => c.status === 'done' && bankOf.get(c.fromBucketId) === 'BIDV')
    .reduce((sum, c) => sum + c.amountVnd, 0);
}

export function watchCycleCovers(
  uid: string,
  cycle: string,
  cb: (covers: Cover[]) => void,
): () => void {
  return onSnapshot(query(coversCol(uid), where('cycle', '==', cycle)), (snap) =>
    cb(snap.docs.map((d) => toCover(d.id, d.data()))),
  );
}

export function watchPendingCovers(uid: string, cb: (covers: Cover[]) => void): () => void {
  return onSnapshot(query(coversCol(uid), where('status', '==', 'pending')), (snap) =>
    cb(snap.docs.map((d) => toCover(d.id, d.data())).sort((a, b) => a.createdAt - b.createdAt)),
  );
}

/**
 * Tạo một lần bù.
 *
 * Nguồn ở VCB (Buffer) → xong ngay, không có gì để chuyển.
 * Nguồn ở BIDV → `pending`, và số dư quỹ CHƯA giảm. Nó chỉ giảm sau khi
 * người dùng xác nhận đã chuyển khoản thật, để con số trong app luôn khớp
 * với tiền đã thật sự di chuyển.
 *
 * Ghi trước khi người dùng rời app: iOS hay kill PWA lúc chuyển sang app
 * ngân hàng, và câu hỏi phải sống sót qua một lần khởi động lại.
 */
export async function createCover(
  uid: string,
  args: { txId: string; cycle: string; toBucketId: string; from: Bucket; amountVnd: number },
): Promise<Cover> {
  const needsTransfer = args.from.bank !== 'VCB';
  const ref = doc(coversCol(uid));
  const now = Date.now();

  const data = {
    txId: args.txId,
    cycle: args.cycle,
    toBucketId: args.toBucketId,
    fromBucketId: args.from.id,
    amountVnd: args.amountVnd,
    needsTransfer,
    status: needsTransfer ? ('pending' as const) : ('done' as const),
    createdAt: now,
    confirmedAt: needsTransfer ? null : now,
  };

  const batch = writeBatch(db);
  batch.set(ref, data);
  // Bù từ Buffer KHÔNG tạo giao dịch và KHÔNG đụng số dư nào: Buffer là
  // bucket dạng budget, phần đã dùng của nó = spent + covered.
  await batch.commit();

  return { id: ref.id, ...data };
}

/** Người dùng xác nhận đã chuyển khoản. Chỉ tới đây quỹ mới giảm. */
export async function confirmCover(uid: string, cover: Cover): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(coversCol(uid), cover.id), {
    status: 'done',
    confirmedAt: Date.now(),
  });
  batch.update(doc(bucketsCol(uid), cover.fromBucketId), {
    balanceVnd: increment(-cover.amountVnd),
    updatedAt: Date.now(),
  });
  await batch.commit();
}

/** Chọn nhầm nguồn thì bỏ. Giao dịch gốc không đụng tới. */
export async function cancelCover(uid: string, coverId: string): Promise<void> {
  await deleteDoc(doc(coversCol(uid), coverId));
}
