'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { bucketAccent } from '@/lib/bucket-color';
import { formatVnd, toVnd } from '@/lib/money';
import {
  DEFAULT_BUCKET,
  buildDrafts,
  checkAgainstExisting,
  importKey,
  mergeScreenshots,
  type ImportRow,
  type RawRow,
} from '@/lib/momo-import';
import {
  DraftGoneError,
  activeRows,
  addDraftRow,
  addToDraft,
  discardDraft,
  patchDraftRow,
  saveDraft,
  setDraftMerge,
  watchImportDraft,
  type DraftRow,
  type ImportDraftDoc,
} from '@/lib/import-draft';
import { listTransactionsBetween } from '@/lib/transactions';
import type { Bucket } from '@/types/fina';

const MAX_IMAGES = 5;
/** Đủ nét để đọc chữ, mà mỗi ảnh chỉ còn vài trăm KB. */
const MAX_WIDTH = 900;
/** Giao dịch nhập tay có thể lệch vài giờ so với giờ MoMo. */
const LOOKUP_MARGIN_MS = 3 * 60 * 60_000;

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Thu nhỏ ảnh ở client. Ảnh gốc iPhone 2-3 MB, gửi 5 cái là chậm và tốn. */
async function shrink(file: File): Promise<{ mimeType: string; data: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { mimeType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

/** yyyy-mm-ddThh:mm cho <input type="datetime-local"> theo giờ máy. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const codeOf = (err: unknown) => (err as { code?: string })?.code ?? 'unknown';

/**
 * Bảng duyệt sống trong Firestore (lib/import-draft.ts), không trong state
 * của component: upload trên điện thoại thì laptop thấy ngay, và ngược lại.
 * Component chỉ giữ những gì thuộc về riêng máy này - đang đọc ảnh, đang
 * lưu, lỗi.
 */
export default function ImportView() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  // undefined = đang tải lần đầu, null = không có bảng nào dở.
  const [draft, setDraft] = useState<ImportDraftDoc | null | undefined>(undefined);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Bảng biến mất vì CHÍNH máy này Save/Discard thì không cần báo gì.
  const closingHere = useRef(false);
  const hadDraft = useRef(false);

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

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

  // ETF chỉ nhận tiền vào lúc chia lương - không bao giờ là đích của một
  // khoản chi trên MoMo. Cùng lý do với lưới Log.
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

  // Mọi thao tác ghi thẳng vào Firestore. Listener trả về ngay bản ghi
  // tạm ở máy này, nên màn hình không phải đợi mạng.
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
    try {
      setSavedCount(await saveDraft(uid, byId));
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
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <Header />
        <p className="pt-6 text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!draft && savedCount !== null) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <Header />
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
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <Header />
        <div className="pt-6">
          {notice && <p className="mb-3 text-xs text-up">{notice}</p>}
          <p className="text-sm text-muted">
            Pick up to {MAX_IMAGES} screenshots of the MoMo history (tab{' '}
            <span className="font-medium text-ink">Giao dịch</span>). Overlap between them is fine.
            The table shows up on all your devices.
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
          {error && <p className="mt-2 text-xs text-over">{error}</p>}
          <p className="mt-4 text-[11px] text-faint">
            Screenshots are sent to Gemini to read the text, then thrown away. Names stay in the
            table until you save or discard it, and never go into your entries.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupByDay(rows);
  const importedCount = removed.filter((r) => r.removed === 'imported').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <Header />

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
            className="shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
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
              className={`flex-1 rounded-lg py-1.5 ${
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
            <h2 className="flex px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              {day}
              <span className="ml-auto font-medium normal-case tracking-normal">
                {formatVnd(
                  list.reduce((s, r) => s + (r.direction === 'in' ? -r.amountVnd : r.amountVnd), 0),
                )}
              </span>
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
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

        {removed.length > 0 && (
          <section className="pt-5">
            <h2 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              Removed
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-dashed border-line">
              {removed.map((r) => (
                <li key={r.id} className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-faint">
                  <span className="w-[74px] shrink-0">
                    {timeOf(r.occurredAt)} · {new Date(r.occurredAt).getDate()}/
                    {new Date(r.occurredAt).getMonth() + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {r.removed === 'imported' && (
                      <b className="font-semibold text-muted">Already imported · </b>
                    )}
                    {r.title}
                  </span>
                  <span className="shrink-0">
                    {r.direction === 'in' ? '+' : ''}
                    {formatVnd(r.amountVnd)}
                  </span>
                  <button
                    type="button"
                    onClick={() => patch(r.id, { removed: null })}
                    className="shrink-0 font-semibold text-ink underline"
                  >
                    Add back
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="shrink-0 border-t border-line pb-3 pt-2.5">
        {totals.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-2 text-xs">
            {totals.map(([id, vnd]) => (
              <li key={id} className="flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: bucketAccent(id) }}
                />
                {byId.get(id)?.name ?? id}
                <b className="font-semibold">{formatVnd(vnd)}</b>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="pb-2 text-xs text-over">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={discard}
            onBlur={() => setConfirmDiscard(false)}
            className={`rounded-[10px] border px-4 py-3 text-sm ${
              confirmDiscard ? 'border-over bg-over font-semibold text-bg' : 'border-line text-muted'
            }`}
          >
            {confirmDiscard ? 'Tap again' : 'Discard'}
          </button>
          <button
            type="button"
            disabled={drafts.length === 0 || saving}
            onClick={save}
            className="flex-1 rounded-[10px] bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {saving
              ? 'Saving…'
              : `Save ${drafts.length} ${drafts.length === 1 ? 'entry' : 'entries'}`}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-2 border-b border-line pb-2.5 pt-3">
      <Link href="/history" className="text-xs text-muted">
        ← History
      </Link>
      <span className="ml-auto text-xs font-semibold">Import from MoMo</span>
    </header>
  );
}

function RowItem({
  row,
  choices,
  byId,
  onPatch,
  onRemove,
}: {
  row: ImportRow;
  choices: Bucket[];
  byId: Map<string, Bucket>;
  onPatch: (change: Partial<ImportRow>) => void;
  onRemove: () => void;
}) {
  const isIn = row.direction === 'in';
  const warning =
    row.flag === 'self'
      ? 'Money back to your own bank - probably not spending.'
      : row.flag === 'income'
        ? 'Money in - saved as IN.'
        : row.flag === 'manual' && row.lookalike
          ? `Looks like ${byId.get(row.lookalike.bucketId)?.name ?? row.lookalike.bucketId} ${formatVnd(row.amountVnd)} you logged at ${timeOf(row.lookalike.occurredAt)}.`
          : null;

  return (
    <li
      className="group border-l-[3px] px-3 py-2"
      style={{ borderLeftColor: bucketAccent(row.bucketId) }}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px]">{row.title || '·'}</span>
        <span className={`shrink-0 text-[13px] font-medium ${isIn ? 'text-muted' : ''}`}>
          {isIn ? '+' : ''}
          {formatVnd(row.amountVnd)}
        </span>
        {/* Có chuột thì chỉ hiện khi rê vào. Điện thoại không có hover nên
            luôn hiện, chỉ mờ đi cho đỡ rối. */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.title} ${formatVnd(row.amountVnd)}`}
          className="-mr-1 shrink-0 px-1 text-[15px] leading-none text-faint hover:text-over focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        >
          ×
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="w-10 shrink-0 text-[11px] text-faint">{timeOf(row.occurredAt)}</span>
        <select
          value={row.bucketId}
          onChange={(e) => onPatch({ bucketId: e.target.value })}
          aria-label="Bucket"
          className="w-[108px] shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-1 text-xs"
        >
          {choices.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <NoteInput value={row.note} onCommit={(note) => onPatch({ note })} />
      </div>
      {warning && <p className="mt-1 text-[11px] text-up">{warning}</p>}
    </li>
  );
}

/**
 * Ô note gõ ở máy này, chỉ ghi lên Firestore khi ngừng gõ nửa giây hoặc rời
 * ô. Ghi mỗi phím thì mỗi chữ là một lượt ghi, và bản từ máy kia có thể đè
 * lên chữ đang gõ dở. Không đang gõ thì luôn hiện bản mới nhất từ Firestore.
 */
function NoteInput({ value, onCommit }: { value: string; onCommit: (note: string) => void }) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next !== value) onCommit(next);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <input
      value={editing ? text : value}
      onFocus={() => {
        setText(value);
        setEditing(true);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(next), 500);
      }}
      onBlur={() => {
        setEditing(false);
        commit(text);
      }}
      placeholder="Note"
      enterKeyHint="done"
      className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs placeholder:text-faint"
    />
  );
}

/** Thêm tay một dòng MoMo bị sót (bị cắt ở mép ảnh, hoặc chưa chụp). */
function AddRow({
  defaultBucket,
  choices,
  onAdd,
}: {
  defaultBucket: string;
  choices: Bucket[];
  onAdd: (row: ImportRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState('');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [bucketId, setBucketId] = useState(defaultBucket);

  const amountVnd = toVnd(amount);
  const occurredAt = when ? new Date(when).getTime() : NaN;
  const valid = amountVnd !== null && Number.isFinite(occurredAt);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setWhen(toLocalInput(Date.now()));
          setBucketId(defaultBucket);
          setOpen(true);
        }}
        className="mt-3 w-full rounded-xl border border-dashed border-line py-2 text-xs text-muted"
      >
        + Add row
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label="Date and time"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-xs"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Amount (k)"
          aria-label="Amount in thousands"
          className="w-24 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-right text-xs placeholder:text-faint"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Who (not saved)"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-xs placeholder:text-faint"
        />
        <select
          value={bucketId}
          onChange={(e) => setBucketId(e.target.value)}
          aria-label="Bucket"
          className="w-[108px] rounded-md border border-line bg-surface-2 px-1.5 py-1.5 text-xs"
        >
          {choices.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 py-1.5 text-xs text-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            const key = importKey(occurredAt, 'out', amountVnd!);
            onAdd({
              // Ngẫu nhiên: hai máy cùng thêm tay một lúc không được trùng id.
              id: `manual-${crypto.randomUUID()}`,
              key,
              occurredAt,
              title: title.trim(),
              amountVnd: amountVnd!,
              direction: 'out',
              bucketId,
              note: '',
              flag: null,
              lookalike: null,
            });
            setAmount('');
            setTitle('');
            setOpen(false);
          }}
          className="flex-1 rounded-lg bg-ink py-1.5 text-xs font-semibold text-bg disabled:opacity-30"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function groupByDay(rows: ImportRow[]): [string, ImportRow[]][] {
  const map = new Map<string, ImportRow[]>();
  for (const r of rows) {
    const key = new Date(r.occurredAt).toLocaleDateString('en-GB', DAY_FMT);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return [...map.entries()];
}
