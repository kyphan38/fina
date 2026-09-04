import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import type { Bucket, BucketKind, Cover } from '@/types/fina';

export const coversCol = (uid: string) => collection(db, 'users', uid, 'covers');

function toCover(id: string, data: Record<string, unknown>): Cover {
  return {
    id,
    txId: String(data.txId ?? ''),
    cycle: String(data.cycle ?? ''),
    toBucketId: String(data.toBucketId ?? ''),
    fromBucketId: String(data.fromBucketId ?? ''),
    toName: String(data.toName ?? data.toBucketId ?? ''),
    fromName: String(data.fromName ?? data.fromBucketId ?? ''),
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
 * Phần bù chảy TỪ BIDV VÀO VCB. Chỉ những khoản này mới làm đổi tổng của
 * chu kỳ, vì `computeSurplus` chỉ đọc các hũ VCB.
 *
 * Hai đầu, không phải một. Bù từ Buffer nằm sẵn trong VCB nên chỉ là di
 * chuyển nội bộ. Bù từ quỹ BIDV này sang quỹ BIDV kia cũng vậy - nó không
 * hề đi qua VCB, tính vào đây là bịa ra một khoản dư không tồn tại rồi đem
 * nạp vào ETF lúc đóng sổ.
 */
export function coveredFromOutside(covers: Cover[], buckets: Bucket[]): number {
  const bankOf = new Map(buckets.map((b) => [b.id, b.bank]));
  return covers
    .filter(
      (c) =>
        c.status === 'done' &&
        bankOf.get(c.fromBucketId) === 'BIDV' &&
        bankOf.get(c.toBucketId) === 'VCB',
    )
    .reduce((sum, c) => sum + c.amountVnd, 0);
}

/**
 * Số dư quỹ phải cộng thêm bao nhiêu khi một lần bù HOÀN TẤT.
 *
 * Hai đầu, không phải một. Nguồn là quỹ thì tiền rời nó thật nên phải trừ.
 * Đích là quỹ thì tiền chảy VÀO nó nên phải cộng - giao dịch gốc đã trừ quỹ
 * đích ngay lúc ghi rồi, quên cộng lại thì MỘT khoản chi bị trừ ở CẢ HAI quỹ
 * và mỗi lần bù âm thầm ăn mất đúng số tiền đó.
 *
 * Bucket dạng budget (Buffer và các hũ VCB) không có số dư nên không bao giờ
 * xuất hiện ở đây: phần đã dùng của chúng là spent + covered.
 */
export function coverBalanceDeltas(args: {
  fromBucketId: string;
  fromKind: BucketKind;
  toBucketId: string;
  toKind: BucketKind;
  amountVnd: number;
}): Record<string, number> {
  const deltas: Record<string, number> = {};

  const add = (bucketId: string, value: number) => {
    deltas[bucketId] = (deltas[bucketId] ?? 0) + value;
  };

  if (args.fromKind === 'fund') add(args.fromBucketId, -args.amountVnd);
  if (args.toKind === 'fund') add(args.toBucketId, args.amountVnd);

  for (const [id, v] of Object.entries(deltas)) {
    if (v === 0) delete deltas[id];
  }
  return deltas;
}

/**
 * Kind của hai đầu một lần bù. Cover chỉ lưu id, mà kind mới là thứ quyết
 * định số dư nào bị đụng - đọc thẳng từ bucket thay vì đoán theo id.
 */
async function kindsOf(
  uid: string,
  cover: Cover,
): Promise<{ fromKind: BucketKind; toKind: BucketKind }> {
  const [from, to] = await Promise.all([
    getDoc(doc(bucketsCol(uid), cover.fromBucketId)),
    getDoc(doc(bucketsCol(uid), cover.toBucketId)),
  ]);
  return {
    fromKind: from.data()?.kind === 'fund' ? 'fund' : 'budget',
    toKind: to.data()?.kind === 'fund' ? 'fund' : 'budget',
  };
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
 * Cần chuyển khoản hay không là do HAI ĐẦU khác ngân hàng, không phải do
 * nguồn nằm ở đâu. Purchases sang Health đều ở BIDV: không có đồng nào rời
 * ngân hàng, chỉ là đổi tên hũ - bắt người dùng chuyển khoản (và chuyển sang
 * VCB!) là sai chỗ nhận. Ngược lại Buffer ở VCB bù cho một quỹ BIDV thì tiền
 * phải đi thật, dù nguồn nằm ở VCB.
 *
 * Khác ngân hàng → `pending`, và số dư CHƯA đổi. Nó chỉ đổi sau khi người
 * dùng xác nhận đã chuyển khoản thật, để con số trong app luôn khớp với tiền
 * đã thật sự di chuyển.
 *
 * Ghi trước khi người dùng rời app: iOS hay kill PWA lúc chuyển sang app
 * ngân hàng, và câu hỏi phải sống sót qua một lần khởi động lại.
 */
export async function createCover(
  uid: string,
  args: { txId: string; cycle: string; to: Bucket; from: Bucket; amountVnd: number },
): Promise<Cover> {
  const needsTransfer = args.from.bank !== args.to.bank;
  const ref = doc(coversCol(uid));
  const now = Date.now();

  const data = {
    txId: args.txId,
    cycle: args.cycle,
    toBucketId: args.to.id,
    fromBucketId: args.from.id,
    toName: args.to.name,
    fromName: args.from.name,
    amountVnd: args.amountVnd,
    needsTransfer,
    status: needsTransfer ? ('pending' as const) : ('done' as const),
    createdAt: now,
    confirmedAt: needsTransfer ? null : now,
  };

  const batch = writeBatch(db);
  batch.set(ref, data);
  // Xong ngay (cùng ngân hàng) thì số dư phải đổi trong CÙNG batch. Bù từ
  // Buffer không trừ đâu cả - Buffer là bucket dạng budget - nhưng quỹ ĐÍCH
  // vẫn phải được cộng lại phần vừa bị giao dịch gốc trừ đi.
  if (!needsTransfer) {
    const deltas = coverBalanceDeltas({
      fromBucketId: args.from.id,
      fromKind: args.from.kind,
      toBucketId: args.to.id,
      toKind: args.to.kind,
      amountVnd: args.amountVnd,
    });
    for (const [bucketId, delta] of Object.entries(deltas)) {
      batch.update(doc(bucketsCol(uid), bucketId), {
        balanceVnd: increment(delta),
        updatedAt: now,
      });
    }
  }
  await batch.commit();

  return { id: ref.id, ...data };
}

/**
 * Người dùng xác nhận đã chuyển khoản. Chỉ tới đây số dư mới đổi - và đổi ở
 * CẢ HAI đầu, vì tiền vừa rời quỹ nguồn thì cũng vừa vào quỹ đích.
 */
export async function confirmCover(uid: string, cover: Cover): Promise<void> {
  const { fromKind, toKind } = await kindsOf(uid, cover);
  const deltas = coverBalanceDeltas({
    fromBucketId: cover.fromBucketId,
    fromKind,
    toBucketId: cover.toBucketId,
    toKind,
    amountVnd: cover.amountVnd,
  });

  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(coversCol(uid), cover.id), { status: 'done', confirmedAt: now });
  for (const [bucketId, delta] of Object.entries(deltas)) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(delta),
      updatedAt: now,
    });
  }
  await batch.commit();
}

/**
 * Bỏ một lần bù. Giao dịch gốc không đụng tới.
 *
 * Cover đã xong và lấy từ quỹ thì phải TRẢ LẠI số dư - nếu không, huỷ một
 * cover sẽ âm thầm ăn mất tiền của quỹ. Hay dùng khi khoản chi được hoàn lại
 * sau đó và việc bù không còn cần nữa.
 */
export async function cancelCover(uid: string, cover: Cover): Promise<void> {
  const ref = doc(coversCol(uid), cover.id);

  // Còn pending thì chưa có số dư nào đổi - tiền thật cũng chưa di chuyển.
  if (cover.status !== 'done') {
    await deleteDoc(ref);
    return;
  }

  const { fromKind, toKind } = await kindsOf(uid, cover);
  const deltas = coverBalanceDeltas({
    fromBucketId: cover.fromBucketId,
    fromKind,
    toBucketId: cover.toBucketId,
    toKind,
    amountVnd: cover.amountVnd,
  });

  const now = Date.now();
  const batch = writeBatch(db);
  batch.delete(ref);
  // Trả lại ĐÚNG những gì lúc bù đã lấy đi, ở cả hai đầu.
  for (const [bucketId, delta] of Object.entries(deltas)) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(-delta),
      updatedAt: now,
    });
  }
  await batch.commit();
}
