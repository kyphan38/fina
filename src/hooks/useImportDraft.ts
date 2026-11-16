'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useLogData } from '@/hooks/useLogData';
import {
  DraftGoneError,
  activeRows,
  addToDraft,
  discardDraft,
  patchDraftRow,
  saveDraft,
  watchImportDraft,
  type DraftRow,
  type ImportDraftDoc,
} from '@/lib/import-draft';
import {
  DEFAULT_BUCKET,
  buildDrafts,
  checkAgainstExisting,
  mergeScreenshots,
  type ImportRow,
  type RawRow,
} from '@/lib/momo-import';
import { batchOverflows, type BatchOverflow } from '@/lib/overflow';
import { shrink } from '@/lib/shrink-image';
import { listTransactionsBetween } from '@/lib/transactions';

export const MAX_IMAGES = 5;
/** A hand-entered transaction may be a few hours off the MoMo time. */
const LOOKUP_MARGIN_MS = 3 * 60 * 60_000;

const codeOf = (err: unknown) => (err as { code?: string })?.code ?? 'unknown';

/**
 * The review table lives in Firestore (lib/import-draft.ts), not component
 * state: upload on the phone and the laptop sees it at once, and back. The
 * component only keeps what belongs to this device - reading images,
 * saving, errors.
 */
export function useImportDraft() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // Same live cycle state as Log, so an import that runs a bucket over can
  // ask where the money came from, like a single entry does.
  const live = useLogData();
  const buckets = live.buckets;
  const [overflows, setOverflows] = useState<BatchOverflow[]>([]);
  // undefined = first load, null = no unfinished table.
  const [draft, setDraft] = useState<ImportDraftDoc | null | undefined>(undefined);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // The table vanished because THIS device saved/discarded it: no message needed.
  const closingHere = useRef(false);
  const hadDraft = useRef(false);

  useEffect(() => {
    if (!uid) return;
    return watchImportDraft(uid, (d) => {
      if (!d && hadDraft.current && !closingHere.current) {
        setNotice('The table was saved or discarded on another device.');
      }
      if (d) setNotice(null);
      hadDraft.current = Boolean(d);
      closingHere.current = false;
      setDraft(d);
    });
  }, [uid]);

  // ETF only receives money when salary is split - never the target of a
  // MoMo expense. Same reason as the Log grid.
  const choices = useMemo(
    () => buckets.filter((b) => b.active && b.id !== 'etf'),
    [buckets],
  );
  const byId = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);
  const fallbackBucket =
    choices.find((b) => b.id === DEFAULT_BUCKET)?.id ?? choices[0]?.id ?? DEFAULT_BUCKET;

  const rows = useMemo(() => (draft ? activeRows(draft) : []), [draft]);
  const removed = useMemo(
    () =>
      draft
        ? Object.values(draft.rows)
            .filter((r) => r.removed)
            .sort((a, b) => b.occurredAt - a.occurredAt)
        : [],
    [draft],
  );
  const merge = draft?.merge ?? true;

  const read = async (files: File[]) => {
    if (!uid || files.length === 0) return;
    if (files.length > MAX_IMAGES) {
      setError(`Pick at most ${MAX_IMAGES} screenshots at a time.`);
      return;
    }
    setError(null);
    setNotice(null);
    setSavedCount(null);
    setReading(true);
    try {
      const images = await Promise.all(files.map(shrink));
      const res = await fetch('/api/momo-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not read the screenshots.');

      const merged = mergeScreenshots(body.images as RawRow[][], new Date());
      const fresh = merged.rows.map((r) => ({ ...r, bucketId: fallbackBucket }));

      let kept = fresh;
      let imported: ImportRow[] = [];
      if (fresh.length > 0) {
        const times = fresh.map((r) => r.occurredAt);
        const existing = await listTransactionsBetween(
          uid,
          Math.min(...times) - LOOKUP_MARGIN_MS,
          Math.max(...times) + LOOKUP_MARGIN_MS,
        );
        ({ kept, imported } = checkAgainstExisting(fresh, existing));
      }

      const incoming: DraftRow[] = [
        ...kept.map((r) => ({ ...r, removed: null })),
        ...imported.map((r) => ({ ...r, removed: 'imported' as const })),
      ];
      await addToDraft(uid, incoming, {
        overlap: merged.overlapCount,
        unreadable: merged.unreadable,
      });
    } catch (err) {
      setError((err as Error).message || 'Could not read the screenshots.');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Every action writes straight to Firestore. The listener returns this
  // device's pending write at once, so the screen does not wait for the network.
  const run = (fn: () => Promise<void>) => {
    fn().catch((err) => setError(`Could not update (${codeOf(err)}).`));
  };
  const patch = (id: string, change: Partial<Pick<DraftRow, 'bucketId' | 'note' | 'removed'>>) =>
    uid && run(() => patchDraftRow(uid, id, change));

  const drafts = useMemo(() => buildDrafts(rows, merge), [rows, merge]);

  const totals = useMemo(() => {
    const out = new Map<string, number>();
    for (const d of drafts) {
      const signed = d.direction === 'in' ? -d.amountVnd : d.amountVnd;
      out.set(d.bucketId, (out.get(d.bucketId) ?? 0) + signed);
    }
    return [...out.entries()].sort((a, b) => b[1] - a[1]);
  }, [drafts]);

  const save = async () => {
    if (!uid || drafts.length === 0) return;
    setSaving(true);
    setError(null);
    closingHere.current = true;
    // State BEFORE the write: after it, the listener may already hold the
    // new entries and count them twice.
    const before = {
      cycle: live.cycle,
      buckets: live.buckets,
      limitOf: live.limitOf,
      usedBefore: Object.fromEntries(
        live.monthly.map((b) => [b.id, (live.spent[b.id] ?? 0) + (live.covered[b.id] ?? 0)]),
      ),
    };
    try {
      const written = await saveDraft(uid, byId);
      setSavedCount(written.length);
      setOverflows(batchOverflows({ written, ...before }));
    } catch (err) {
      closingHere.current = false;
      setError(
        err instanceof DraftGoneError
          ? 'This table was already saved on another device.'
          : `Could not save (${codeOf(err)}).`,
      );
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!uid) return;
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    closingHere.current = true;
    run(() => discardDraft(uid));
  };

  return {
    uid,
    live,
    buckets,
    overflows,
    setOverflows,
    draft,
    reading,
    saving,
    savedCount,
    setSavedCount,
    error,
    notice,
    confirmDiscard,
    setConfirmDiscard,
    fileRef,
    choices,
    byId,
    fallbackBucket,
    rows,
    removed,
    merge,
    read,
    run,
    patch,
    drafts,
    totals,
    save,
    discard,
  };
}
