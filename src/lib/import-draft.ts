// ============================================================
// fina - The MoMo import table under review, synced across devices
//
// Upload on the phone, review on the laptop: both listen to the SAME document.
// Each action writes only the field it changes (rows.<id>.note, ...), never
// the whole table - two devices editing two rows at once lose nothing.
//
// This document holds payee names for checking. It lives until Save or
// Discard, then is deleted; the transactions written never contain names.
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

/** `removed`: the user tapped ×. `imported`: already in the DB from a previous run. */
export type RemovedReason = 'removed' | 'imported';

export interface DraftRow extends ImportRow {
  removed: RemovedReason | null;
}

/** Firestore: users/{uid}/meta/importDraft */
export interface ImportDraftDoc {
  rows: Record<string, DraftRow>;
  merge: boolean;
  /** Rows overlapping between images, or already in the table - to report back. */
  overlap: number;
  unreadable: number;
  createdAt: number;
  updatedAt: number;
}

const draftRef = (uid: string) => doc(db, 'users', uid, 'meta', 'importDraft');

/** null = no unfinished table. Returns an unsubscribe. */
export function watchImportDraft(
  uid: string,
  cb: (draft: ImportDraftDoc | null) => void,
): () => void {
  return onSnapshot(draftRef(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as ImportDraftDoc) : null);
  });
}

/**
 * Creates a new table, or adds to the existing one. Runs in a transaction:
 * two devices uploading at once means the later one reads the earlier result
 * and does not double rows.
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

/** Writes only the changed fields of one row. */
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

/** Rows still in the table, newest first. */
export function activeRows(draft: ImportDraftDoc): DraftRow[] {
  return Object.values(draft.rows)
    .filter((r) => !r.removed)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

export class DraftGoneError extends Error {}

/**
 * Writes the transactions AND deletes the table in one transaction.
 *
 * Recomputes from what the transaction reads, not from what the screen
 * shows: the other device may have just edited a row. If the table is gone
 * (the other device just saved), stop - Save on two devices never writes twice.
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
        // Copy the bank onto the record, like addTransaction.
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

    // Sum fund balances per bucket before writing - one write per document.
    for (const [bucketId, delta] of Object.entries(fundDeltas)) {
      if (delta === 0) continue;
      t.update(doc(bucketsCol(uid), bucketId), { balanceVnd: increment(delta), updatedAt: now });
    }

    t.delete(ref);
    return drafts.length;
  });
}
