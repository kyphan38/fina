// ============================================================
// fina - Bảng nhập MoMo đang duyệt dở, đồng bộ giữa các máy
//
// Upload trên điện thoại, duyệt trên laptop: cả hai nghe CÙNG một document.
// Mỗi thao tác chỉ ghi đúng field nó đổi (rows.<id>.note, ...), không ghi đè
// cả bảng - hai máy sửa hai dòng khác nhau cùng lúc thì không ai mất gì.
//
// Document này chứa tên người nhận để đối chiếu. Nó sống tới lúc Save hoặc
// Discard rồi bị xoá; transaction ghi ra vẫn không bao giờ có tên.
// ============================================================

import {
  FieldPath,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { bucketsCol } from '@/lib/buckets';
import { cycleOf } from '@/lib/cycle';
import { txCol } from '@/lib/transactions';
import { appendRows, buildDrafts, type ImportRow } from '@/lib/momo-import';
import type { Bucket } from '@/types/fina';

/** `removed`: người dùng bấm ×. `imported`: đã có trong DB từ lần trước. */
export type RemovedReason = 'removed' | 'imported';

export interface DraftRow extends ImportRow {
  removed: RemovedReason | null;
}

/** Firestore: users/{uid}/meta/importDraft */
export interface ImportDraftDoc {
  rows: Record<string, DraftRow>;
  merge: boolean;
  /** Dòng chồng giữa các ảnh, hoặc đã có sẵn trong bảng - để báo lại. */
  overlap: number;
  unreadable: number;
  createdAt: number;
  updatedAt: number;
}

const draftRef = (uid: string) => doc(db, 'users', uid, 'meta', 'importDraft');

/** null = không có bảng nào đang dở. Trả về hàm huỷ. */
export function watchImportDraft(
  uid: string,
  cb: (draft: ImportDraftDoc | null) => void,
): () => void {
  return onSnapshot(draftRef(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as ImportDraftDoc) : null);
  });
}

/**
 * Tạo bảng mới, hoặc thêm vào bảng đang có. Chạy trong transaction: hai máy
 * upload cùng lúc thì lần sau đọc được kết quả của lần trước và không nhân
 * đôi dòng.
 */
export async function addToDraft(
  uid: string,
  incoming: DraftRow[],
  stats: { overlap: number; unreadable: number },
): Promise<number> {
  return runTransaction(db, async (t) => {
    const ref = draftRef(uid);
    const snap = await t.get(ref);
    const now = Date.now();

    if (!snap.exists()) {
      t.set(ref, {
        rows: Object.fromEntries(incoming.map((r) => [r.id, r])),
        merge: true,
        overlap: stats.overlap,
        unreadable: stats.unreadable,
        createdAt: now,
        updatedAt: now,
      } satisfies ImportDraftDoc);
      return incoming.length;
    }

    const current = snap.data() as ImportDraftDoc;
    const added = appendRows(Object.values(current.rows), incoming) as DraftRow[];
    const args: unknown[] = [];
    for (const r of added) args.push(new FieldPath('rows', r.id), r);
    t.update(
      ref,
      'overlap', current.overlap + stats.overlap + (incoming.length - added.length),
      'unreadable', current.unreadable + stats.unreadable,
      'updatedAt', now,
      ...args,
    );
    return added.length;
  });
}

type RowChange = Partial<Pick<DraftRow, 'bucketId' | 'note' | 'removed'>>;

/** Ghi đúng những field đổi của một dòng. */
export async function patchDraftRow(uid: string, id: string, change: RowChange): Promise<void> {
  const args: unknown[] = [];
  for (const [field, value] of Object.entries(change)) {
    args.push(new FieldPath('rows', id, field), value);
  }
  if (args.length === 0) return;
  await updateDoc(draftRef(uid), new FieldPath('updatedAt'), Date.now(), ...args);
}

export async function addDraftRow(uid: string, row: DraftRow): Promise<void> {
  await updateDoc(draftRef(uid), new FieldPath('rows', row.id), row, 'updatedAt', Date.now());
}

export async function setDraftMerge(uid: string, merge: boolean): Promise<void> {
  await updateDoc(draftRef(uid), { merge, updatedAt: Date.now() });
}

export async function discardDraft(uid: string): Promise<void> {
  await deleteDoc(draftRef(uid));
}

/** Dòng còn trong bảng, mới nhất trước. */
export function activeRows(draft: ImportDraftDoc): DraftRow[] {
  return Object.values(draft.rows)
    .filter((r) => !r.removed)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

export class DraftGoneError extends Error {}

/**
 * Ghi các transaction VÀ xoá bảng trong cùng một transaction.
 *
 * Tính lại từ bản đọc trong transaction, không từ những gì màn hình đang
 * hiện: máy kia có thể vừa sửa một dòng. Bảng đã biến mất (máy kia vừa Save)
 * thì dừng - bấm Save trên hai máy không ghi tiền hai lần.
 */
export async function saveDraft(uid: string, buckets: Map<string, Bucket>): Promise<number> {
  return runTransaction(db, async (t) => {
    const ref = draftRef(uid);
    const snap = await t.get(ref);
    if (!snap.exists()) throw new DraftGoneError();

    const draft = snap.data() as ImportDraftDoc;
    const drafts = buildDrafts(activeRows(draft), draft.merge);
    const now = Date.now();
    const fundDeltas: Record<string, number> = {};

    for (const d of drafts) {
      const bucket = buckets.get(d.bucketId);
      if (!bucket) throw new Error(`[import] Unknown bucket: ${d.bucketId}`);
      t.set(doc(txCol(uid)), {
        occurredAt: d.occurredAt,
        cycle: cycleOf(new Date(d.occurredAt)),
        bucketId: bucket.id,
        // Chép ngân hàng vào record, như addTransaction.
        bank: bucket.bank,
        amountVnd: d.amountVnd,
        direction: d.direction,
        note: d.note,
        source: 'import',
        importKeys: d.importKeys,
        createdAt: now,
        updatedAt: now,
      });
      if (bucket.kind === 'fund') {
        const signed = d.direction === 'in' ? d.amountVnd : -d.amountVnd;
        fundDeltas[bucket.id] = (fundDeltas[bucket.id] ?? 0) + signed;
      }
    }

    // Số dư quỹ cộng dồn theo bucket rồi mới ghi - mỗi document một lần.
    for (const [bucketId, delta] of Object.entries(fundDeltas)) {
      if (delta === 0) continue;
      t.update(doc(bucketsCol(uid), bucketId), { balanceVnd: increment(delta), updatedAt: now });
    }

    t.delete(ref);
    return drafts.length;
  });
}
