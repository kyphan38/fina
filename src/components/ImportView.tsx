'use client';

import Link from 'next/link';

import CoverSheet from '@/components/CoverSheet';
import AddRow from '@/components/import/AddRow';
import ImportFooter from '@/components/import/ImportFooter';
import ImportHeader from '@/components/import/ImportHeader';
import RemovedList from '@/components/import/RemovedList';
import RowItem from '@/components/import/RowItem';
import { MAX_IMAGES, useImportDraft } from '@/hooks/useImportDraft';
import { addDraftRow, setDraftMerge } from '@/lib/import-draft';
import { formatVnd } from '@/lib/money';
import { groupByDay } from '@/lib/momo-import';

/** Review MoMo screenshots as a table, then save them as entries. State: useImportDraft. */
export default function ImportView() {
  const {
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
  } = useImportDraft();
  const filePicker = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => void read(Array.from(e.target.files ?? []))}
    />
  );

  if (draft === undefined) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pb-6">
        <ImportHeader />
        <p className="pt-6 text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const next = overflows[0];
  const coverSheet = next && uid && (
    <CoverSheet
      // One sheet per over bucket, in turn. The key resets its state.
      key={next.bucket.id}
      uid={uid}
      request={{
        txId: next.txId,
        cycle: live.cycle,
        toBucket: next.bucket,
        amountVnd: next.amountVnd,
      }}
      buckets={buckets}
      bufferLimitVnd={live.limitOf(buckets.find((b) => b.id === 'buffer') ?? next.bucket)}
      bufferUsedVnd={(live.spent.buffer ?? 0) + (live.covered.buffer ?? 0)}
      budgetLeftVnd={live.budgetLeftVnd}
      onDone={() => setOverflows((o) => o.slice(1))}
    />
  );

  if (!draft && savedCount !== null) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pb-6">
        {coverSheet}
        <ImportHeader />
        <p className="pt-6 text-sm">
          Saved {savedCount} {savedCount === 1 ? 'entry' : 'entries'}.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/history"
            className="flex-1 rounded-[10px] bg-ink py-3 text-center text-sm font-semibold text-bg"
          >
            Open History
          </Link>
          <button
            type="button"
            onClick={() => setSavedCount(null)}
            className="flex-1 rounded-[10px] border border-line py-3 text-sm"
          >
            Import more
          </button>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pb-6">
        <ImportHeader />
        <div className="pt-6">
          {notice && <p className="mb-3 text-xs text-up">{notice}</p>}
          <p className="text-sm text-muted">
            Up to {MAX_IMAGES} MoMo screenshots (
            <span className="font-medium text-ink">Giao dịch</span> tab). Overlap is fine.
          </p>
          {filePicker}
          <button
            type="button"
            disabled={reading || !uid}
            onClick={() => fileRef.current?.click()}
            className="mt-4 w-full rounded-[10px] bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-40"
          >
            {reading ? 'Reading screenshots…' : 'Choose screenshots'}
          </button>
          {error && <p className="mt-2 text-xs font-medium text-over">{error}</p>}
          <p className="mt-4 text-[11px] text-faint">
            Screenshots go to Gemini, then get deleted. Names never reach your entries.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupByDay(rows);
  const importedCount = removed.filter((r) => r.removed === 'imported').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pb-4">
        <ImportHeader />

        <div className="flex items-center gap-2 pt-3">
          <p className="min-w-0 flex-1 text-[11px] text-faint">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
            {draft.overlap > 0 && ` · ${draft.overlap} overlapping merged`}
            {importedCount > 0 && ` · ${importedCount} already imported`}
            {draft.unreadable > 0 && ` · ${draft.unreadable} unreadable skipped`}
          </p>
          {filePicker}
          <button
            type="button"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
            className="shrink-0 rounded-[10px] border border-line px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
          >
            {reading ? 'Reading…' : '+ Screenshots'}
          </button>
        </div>

        <div className="mt-2 flex rounded-[10px] border border-line p-0.5 text-xs">
          {[
            { on: true, label: 'Merge by bucket' },
            { on: false, label: 'One per row' },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              aria-pressed={merge === m.on}
              onClick={() => uid && run(() => setDraftMerge(uid, m.on))}
              className={`flex-1 rounded-[10px] py-1.5 ${
                merge === m.on ? 'bg-ink font-semibold text-bg' : 'text-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {merge && (
          <p className="mt-1 px-1 text-[11px] text-faint">Rows with a note stay separate.</p>
        )}

        {groups.map(([day, list]) => (
          <section key={day} className="pt-4">
            <h2 className="flex px-1 pb-1.5 text-[13px] font-medium text-muted">
              {day}
              <span className="ml-auto font-medium normal-case tracking-normal">
                {formatVnd(
                  list.reduce((s, r) => s + (r.direction === 'in' ? -r.amountVnd : r.amountVnd), 0),
                )}
              </span>
            </h2>
            <ul className="divide-y divide-line rounded-[10px] border border-line bg-surface">
              {list.map((r) => (
                <RowItem
                  key={r.id}
                  row={r}
                  choices={choices}
                  byId={byId}
                  onPatch={(c) => patch(r.id, c)}
                  onRemove={() => patch(r.id, { removed: 'removed' })}
                />
              ))}
            </ul>
          </section>
        ))}

        <AddRow
          defaultBucket={fallbackBucket}
          choices={choices}
          onAdd={(row) => uid && run(() => addDraftRow(uid, { ...row, removed: null }))}
        />

        <RemovedList rows={removed} onAddBack={(id) => patch(id, { removed: null })} />
      </div>

      <ImportFooter
        totals={totals}
        byId={byId}
        error={error}
        entries={drafts.length}
        saving={saving}
        confirmDiscard={confirmDiscard}
        onDiscard={discard}
        onDiscardBlur={() => setConfirmDiscard(false)}
        onSave={save}
      />
    </div>
  );
}
