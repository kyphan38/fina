import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { cycleOf } from '@/lib/cycle';
import { bucketsCol } from '@/lib/buckets';
import { balanceDeltas, type TxShape } from '@/lib/tx-edit';
import type { Bucket, Transaction, TxDirection, TxSource } from '@/types/fina';

export const txCol = (uid: string) => collection(db, 'users', uid, 'transactions');

function toTx(id: string, data: Record<string, unknown>): Transaction {
  return {
    id,
    occurredAt: Number(data.occurredAt ?? 0),
    cycle: String(data.cycle ?? ''),
    bucketId: String(data.bucketId ?? ''),
    bank: (data.bank as Transaction['bank']) ?? 'VCB',
    amountVnd: Number(data.amountVnd ?? 0),
    // Bản ghi cũ chưa có `direction`. ETF vốn là tiền đi vào, còn lại đi ra.
    direction:
      data.direction === 'in' || (data.direction == null && data.bucketId === 'etf')
        ? 'in'
        : 'out',
    note: (data.note as string | null) ?? null,
    // Quên 'allocation' ở đây làm mọi khoản chia lương vào quỹ bị tính là chi
    // tiêu (thực ra là bị TRỪ, vì chúng có direction 'in'), và bảng Cash flow
    // hiện Out −6.685 trong khi thật ra là +3.815.
    source:
      data.source === 'import' ||
      data.source === 'allocation' ||
      data.source === 'opening' ||
      data.source === 'move'
        ? (data.source as TxSource)
        : 'web',
    importKeys: Array.isArray(data.importKeys) ? data.importKeys.map(String) : undefined,
    moveId: typeof data.moveId === 'string' ? data.moveId : undefined,
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
 * Trả về id sinh ở client và mốc thời gian đã dùng, nên component không phải
 * tự gọi Date.now() trong lúc render (React 19 cấm).
 */
export async function addTransaction(
  uid: string,
  bucket: Bucket,
  amountVnd: number,
  note: string | null,
  direction: TxDirection = 'out',
  occurredAt: number = Date.now(),
  source: TxSource = 'web',
): Promise<{ id: string; occurredAt: number }> {
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
    direction,
    note: note && note.length > 0 ? note : null,
    source,
    createdAt: now,
    updatedAt: now,
  });

  if (bucket.kind === 'fund') {
    batch.update(doc(bucketsCol(uid), bucket.id), {
      balanceVnd: increment(direction === 'in' ? amountVnd : -amountVnd),
      updatedAt: now,
    });
  }

  await batch.commit();
  return { id: ref.id, occurredAt };
}

/**
 * Nạp tay vào một quỹ giữa chu kỳ - ví dụ khoản thưởng để dành mua xe.
 *
 * Mang `source: 'allocation'` như khoản chia lương ngày 25, vì nó cũng là
 * chuyển tiền VCB sang BIDV chứ không phải chi tiêu. Id sinh ngẫu nhiên nên
 * `applyCyclePlan` không đụng tới nó khi chạy lại.
 */
export async function addFundTopUp(
  uid: string,
  fund: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): Promise<{ id: string; occurredAt: number }> {
  return addTransaction(uid, fund, amountVnd, note, 'in', occurredAt, 'allocation');
}

/**
 * Move money between two of your funds. See lib/moves.ts.
 *
 * Both entries and both balance changes go in ONE batch: a half-done move
 * would take money out of the source without reaching the target.
 */
export async function moveBetweenFunds(
  uid: string,
  from: Bucket,
  to: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): Promise<string> {
  const batch = writeBatch(db);
  const moveId = addMoveToBatch(batch, uid, from, to, amountVnd, note, occurredAt);
  await batch.commit();
  return moveId;
}

/** Both legs of a move and both balance changes, added to a caller's batch. */
export function addMoveToBatch(
  batch: WriteBatch,
  uid: string,
  from: Bucket,
  to: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): string {
  const moveId = doc(txCol(uid)).id;
  const now = Date.now();
  const legs = [
    { bucket: from, direction: 'out' as const, suffix: 'out' },
    { bucket: to, direction: 'in' as const, suffix: 'in' },
  ];

  for (const leg of legs) {
    batch.set(doc(txCol(uid), `${moveId}-${leg.suffix}`), {
      occurredAt,
      cycle: cycleOf(new Date(occurredAt)),
      bucketId: leg.bucket.id,
      bank: leg.bucket.bank,
      amountVnd,
      direction: leg.direction,
      note: note && note.length > 0 ? note : null,
      source: 'move',
      moveId,
      createdAt: now,
      updatedAt: now,
    });
    batch.update(doc(bucketsCol(uid), leg.bucket.id), {
      balanceVnd: increment(leg.direction === 'in' ? amountVnd : -amountVnd),
      updatedAt: now,
    });
  }
  return moveId;
}

/**
 * Delete a move: both sides and both balance changes, in one batch. Never
 * delete one side alone - the money would vanish from one end.
 */
export async function deleteMove(uid: string, legs: Transaction[]): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  for (const t of legs) {
    batch.delete(doc(txCol(uid), t.id));
    batch.update(doc(bucketsCol(uid), t.bucketId), {
      balanceVnd: increment(t.direction === 'in' ? -t.amountVnd : t.amountVnd),
      updatedAt: now,
    });
  }
  await batch.commit();
}

/**
 * Nạp tiền vào ETF. Chỉ là một giao dịch `in` như mọi khoản được hoàn khác -
 * không còn ngoại lệ riêng cho ETF ở đâu nữa.
 */
export async function addEtfDeposit(
  uid: string,
  etf: Bucket,
  amountVnd: number,
  note: string | null,
  occurredAt: number = Date.now(),
): Promise<{ id: string; occurredAt: number }> {
  return addTransaction(uid, etf, amountVnd, note, 'in', occurredAt);
}

/**
 * Tổng đã tiêu RÒNG theo từng bucket: chi trừ đi phần được hoàn.
 *
 * Ứng 1.500 tiền picnic rồi bạn bè trả lại 1.000 thì phần bạn thật sự tiêu
 * là 500 - đó mới là con số hạn mức cần so.
 *
 * Tính ở client, KHÔNG denormalize: Stage 4 cho sửa giao dịch, một tổng lưu
 * sẵn sẽ lệch ngay lần sửa đầu tiên.
 */
export function spentByBucket(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tx of txs) {
    // Moving Purchases to Phone is not Purchases spending it.
    if (tx.source === 'move') continue;
    const signed = tx.direction === 'in' ? -tx.amountVnd : tx.amountVnd;
    out[tx.bucketId] = (out[tx.bucketId] ?? 0) + signed;
  }
  return out;
}

/** Danh sách giao dịch của một chu kỳ, mới nhất trước. Một query. */
export async function listCycleTransactions(
  uid: string,
  cycle: string,
  max = 500,
): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txCol(uid), where('cycle', '==', cycle), orderBy('occurredAt', 'desc'), fsLimit(max)),
  );
  return snap.docs.map((d) => toTx(d.id, d.data()));
}

export interface TxPatch {
  bucket: Bucket;
  amountVnd: number;
  direction: TxDirection;
  note: string | null;
  occurredAt: number;
}

/**
 * Sửa một giao dịch. Ghi bản mới và mọi chỉnh số dư quỹ trong CÙNG một batch -
 * hai lệnh ghi rời sẽ có lúc số dư không khớp với lịch sử.
 *
 * `occurredAt` đi qua mốc ngày 25 thì `cycle` được tính lại. Chỉ đổi một
 * field; tổng của cả hai chu kỳ tự đúng vì `spent` được cộng ở client theo
 * từng chu kỳ.
 */
export async function updateTransaction(
  uid: string,
  before: Transaction,
  beforeKind: Bucket['kind'],
  patch: TxPatch,
): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();

  batch.update(doc(txCol(uid), before.id), {
    occurredAt: patch.occurredAt,
    cycle: cycleOf(new Date(patch.occurredAt)),
    bucketId: patch.bucket.id,
    bank: patch.bucket.bank,
    amountVnd: patch.amountVnd,
    direction: patch.direction,
    note: patch.note && patch.note.length > 0 ? patch.note : null,
    updatedAt: now,
  });

  const beforeShape: TxShape = {
    bucketId: before.bucketId,
    kind: beforeKind,
    amountVnd: before.amountVnd,
    direction: before.direction,
  };
  const afterShape: TxShape = {
    bucketId: patch.bucket.id,
    kind: patch.bucket.kind,
    amountVnd: patch.amountVnd,
    direction: patch.direction,
  };

  for (const [bucketId, delta] of Object.entries(balanceDeltas(beforeShape, afterShape))) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(delta),
      updatedAt: now,
    });
  }

  await batch.commit();
}

/**
 * Xoá hẳn. Khác với bucket (chỉ tắt `active`) - một khoản chi ghi nhầm
 * không có giá trị lịch sử nào, giữ lại chỉ làm mọi tổng sai.
 */
export async function deleteTransaction(
  uid: string,
  tx: Transaction,
  kind: Bucket['kind'],
): Promise<void> {
  const deltas = balanceDeltas(
    { bucketId: tx.bucketId, kind, amountVnd: tx.amountVnd, direction: tx.direction },
    null,
  );

  if (Object.keys(deltas).length === 0) {
    await deleteDoc(doc(txCol(uid), tx.id));
    return;
  }

  const batch = writeBatch(db);
  batch.delete(doc(txCol(uid), tx.id));
  for (const [bucketId, delta] of Object.entries(deltas)) {
    batch.update(doc(bucketsCol(uid), bucketId), {
      balanceVnd: increment(delta),
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
}

/**
 * Mọi giao dịch có `occurredAt` trong [fromMs, toMs]. Một query theo một
 * field - Firestore tự có index, không cần khai báo thêm.
 */
export async function listTransactionsBetween(
  uid: string,
  fromMs: number,
  toMs: number,
): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txCol(uid), where('occurredAt', '>=', fromMs), where('occurredAt', '<=', toMs)),
  );
  return snap.docs.map((d) => toTx(d.id, d.data()));
}
