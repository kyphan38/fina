'use client';

import { useState } from 'react';

import Numpad from '@/components/Numpad';
import { formatTyped, formatVnd, fromVnd, pressKey, toVnd } from '@/lib/money';
import { deleteTransaction, updateTransaction } from '@/lib/transactions';
import type { Bucket, Transaction } from '@/types/fina';
import SheetShell from '@/components/SheetShell';
import BucketDot from '@/components/BucketDot';
import DirectionToggle from '@/components/DirectionToggle';
import { WORD } from '@/components/SectionTitle';

/** yyyy-mm-ddThh:mm for <input type="datetime-local"> in local time. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TxEditSheet({
  uid,
  tx,
  buckets,
  beforeKind,
  onClose,
}: {
  uid: string;
  tx: Transaction;
  buckets: Bucket[];
  beforeKind: Bucket['kind'];
  onClose: () => void;
}) {
  const [buf, setBuf] = useState(fromVnd(tx.amountVnd));
  const [note, setNote] = useState(tx.note ?? '');
  const [bucketId, setBucketId] = useState(tx.bucketId);
  const [when, setWhen] = useState(toLocalInput(tx.occurredAt));
  const [direction, setDirection] = useState(tx.direction);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountVnd = toVnd(buf);
  const bucket = buckets.find((b) => b.id === bucketId);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(`Could not save (${(err as { code?: string })?.code ?? 'unknown'}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetShell
      onClose={onClose}
      label="Edit entry"
      z={20}
      dim={30}
      locked={busy}
      className="max-h-[92dvh] overflow-y-auto overflow-x-hidden overscroll-x-none rounded-t-[10px] border-t border-line bg-surface px-4 pt-3"
      header={
        <div className="flex items-baseline justify-between pb-2">
          <span className="text-[15px] font-semibold">Edit entry</span>
          <span className="flex items-baseline gap-3.5">
            {/* Same words as Log: the numpad has a − key, so no − here. */}
            <DirectionToggle
              direction={direction}
              onFlip={() => setDirection((d) => (d === 'out' ? 'in' : 'out'))}
            />
            <span className={`text-[30px] leading-none font-medium ${buf ? '' : 'text-faint'}`}>
              {formatTyped(buf) || '0'}
            </span>
          </span>
        </div>
    }
  >

      <span className="relative mb-1.5 flex items-center">
        <span className="pointer-events-none absolute left-3 flex">
          <BucketDot id={bucketId} />
        </span>
      <select
        value={bucketId}
        onChange={(e) => setBucketId(e.target.value)}
        aria-label="Bucket"
        className="w-full rounded-md border border-line bg-surface-2 py-2 pr-3 pl-7 text-[13px]"
      >
        {buckets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} · {b.bank}
          </option>
        ))}
      </select>
      </span>

      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        aria-label="Date and time"
        className="mb-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px]"
      />

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
        className="mb-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] placeholder:text-faint"
      />

      {error && <p className="mb-2 text-[13px] font-medium text-over">{error}</p>}

      <Numpad
        onKey={(k) => setBuf((cur) => pressKey(cur, k))}
        canSave={amountVnd !== null && Boolean(bucket) && !busy}
        saveLabel={busy ? 'Saving…' : 'Save changes'}
        onSave={() =>
          run(() =>
            updateTransaction(uid, tx, beforeKind, {
              bucket: bucket!,
              amountVnd: amountVnd!,
              direction,
              note: note.trim() || null,
              occurredAt: new Date(when).getTime(),
            }),
          )
        }
      />

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={onClose} className={`${WORD} flex-1 py-2 text-center`}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            confirmDelete
              ? run(() => deleteTransaction(uid, tx, beforeKind))
              : setConfirmDelete(true)
          }
          // One filled button per sheet (Save), so the second tap is ink words.
          className={`flex-1 py-2 text-center text-[13px] ${
            confirmDelete ? 'font-semibold text-over' : 'text-faint hover:text-ink active:text-ink'
          }`}
        >
          {confirmDelete ? `Tap again to delete ${formatVnd(tx.amountVnd)}` : 'Delete'}
        </button>
      </div>
    </SheetShell>
  );
}
