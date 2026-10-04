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
import { addImportedTransactions, listTransactionsBetween } from '@/lib/transactions';
import type { Bucket } from '@/types/fina';

const MAX_IMAGES = 5;
/** Đủ nét để đọc chữ, mà mỗi ảnh chỉ còn vài trăm KB. */
const MAX_WIDTH = 900;
/** Giao dịch nhập tay có thể lệch vài giờ so với giờ MoMo. */
const LOOKUP_MARGIN_MS = 3 * 60 * 60_000;

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

type Phase = 'pick' | 'reading' | 'review' | 'saving' | 'done';
type Removed = ImportRow & { reason: 'removed' | 'imported' };

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

export default function ImportView() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [removed, setRemoved] = useState<Removed[]>([]);
  const [stats, setStats] = useState({ overlap: 0, unreadable: 0 });
  // Mặc định gộp: đa số là ăn uống, một mục một con số là đủ.
  const [merge, setMerge] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
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

  const read = async (files: File[]) => {
    if (!uid || files.length === 0) return;
    if (files.length > MAX_IMAGES) {
      setError(`Pick at most ${MAX_IMAGES} screenshots at a time.`);
      return;
    }
    setError(null);
    setPhase('reading');
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

      setRows(kept);
      setRemoved(imported.map((r) => ({ ...r, reason: 'imported' })));
      setStats({ overlap: merged.overlapCount, unreadable: merged.unreadable });
      setPhase('review');
    } catch (err) {
      setError((err as Error).message || 'Could not read the screenshots.');
      setPhase('pick');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const patch = (id: string, change: Partial<ImportRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const remove = (row: ImportRow) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setRemoved((prev) => [{ ...row, reason: 'removed' }, ...prev]);
  };

  const addBack = (row: Removed) => {
    setRemoved((prev) => prev.filter((r) => r.id !== row.id));
    const { reason, ...rest } = row;
    void reason;
    setRows((prev) => [...prev, rest].sort((a, b) => b.occurredAt - a.occurredAt));
  };

  const addManual = (row: ImportRow) =>
    setRows((prev) => [...prev, row].sort((a, b) => b.occurredAt - a.occurredAt));

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
    setPhase('saving');
    setError(null);
    try {
      setSavedCount(await addImportedTransactions(uid, drafts, byId));
      setPhase('done');
    } catch (err) {
      setError(`Could not save (${(err as { code?: string })?.code ?? 'unknown'}).`);
      setPhase('review');
    }
  };

  const reset = () => {
    setRows([]);
    setRemoved([]);
    setError(null);
    setPhase('pick');
  };

  if (phase === 'pick' || phase === 'reading') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <Header />
        <div className="pt-6">
          <p className="text-sm text-muted">
            Pick up to {MAX_IMAGES} screenshots of the MoMo history (tab{' '}
            <span className="font-medium text-ink">Giao dịch</span>). Overlap between them is fine.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void read(Array.from(e.target.files ?? []))}
          />
          <button
            type="button"
            disabled={phase === 'reading' || !uid}
            onClick={() => fileRef.current?.click()}
            className="mt-4 w-full rounded-[10px] bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-40"
          >
            {phase === 'reading' ? 'Reading screenshots…' : 'Choose screenshots'}
          </button>
          {error && <p className="mt-2 text-xs text-over">{error}</p>}
          <p className="mt-4 text-[11px] text-faint">
            Screenshots are sent to Gemini to read the text, then thrown away. Names are shown
            here only, never saved.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
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
            onClick={reset}
            className="flex-1 rounded-[10px] border border-line py-3 text-sm"
          >
            Import more
          </button>
        </div>
      </div>
    );
  }

  const groups = groupByDay(rows);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <Header />

        <p className="pt-3 text-[11px] text-faint">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          {stats.overlap > 0 && ` · ${stats.overlap} overlapping merged`}
          {removed.some((r) => r.reason === 'imported') &&
            ` · ${removed.filter((r) => r.reason === 'imported').length} already imported`}
          {stats.unreadable > 0 && ` · ${stats.unreadable} unreadable skipped`}
        </p>

        <div className="mt-2 flex rounded-[10px] border border-line p-0.5 text-xs">
          {[
            { on: true, label: 'Merge by bucket' },
            { on: false, label: 'One per row' },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              aria-pressed={merge === m.on}
              onClick={() => setMerge(m.on)}
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
                  onRemove={() => remove(r)}
                />
              ))}
            </ul>
          </section>
        ))}

        <AddRow defaultBucket={fallbackBucket} choices={choices} onAdd={addManual} />

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
                    {r.reason === 'imported' && (
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
                    onClick={() => addBack(r)}
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
            onClick={reset}
            className="rounded-[10px] border border-line px-4 py-3 text-sm text-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={drafts.length === 0 || phase === 'saving'}
            onClick={save}
            className="flex-1 rounded-[10px] bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {phase === 'saving'
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
        <span className="min-w-0 flex-1 truncate text-[13px]">{row.title || '—'}</span>
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
        <input
          value={row.note}
          onChange={(e) => onPatch({ note: e.target.value })}
          placeholder="Note"
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs placeholder:text-faint"
        />
      </div>
      {warning && <p className="mt-1 text-[11px] text-up">{warning}</p>}
    </li>
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
  const seq = useRef(0);

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
            seq.current += 1;
            const key = importKey(occurredAt, 'out', amountVnd!);
            onAdd({
              id: `manual-${seq.current}-${key}`,
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
