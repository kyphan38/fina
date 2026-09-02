'use client';

import { useState } from 'react';

import Numpad from '@/components/Numpad';
import { formatVnd, fromVnd, pressKey, toVnd } from '@/lib/money';
import { deleteTransaction, updateTransaction } from '@/lib/transactions';
import type { Bucket, Transaction } from '@/types/fina';

/** yyyy-mm-ddThh:mm cho <input type="datetime-local"> theo giờ máy. */
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
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />
      <div className="max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pt-3">
        <div className="flex items-baseline justify-between pb-2">
          <span className="text-xs font-semibold">Edit entry</span>
          <span className="flex items-baseline gap-2">
            <button
              type="button"
              onClick={() => setDirection((d) => (d === 'out' ? 'in' : 'out'))}
              aria-label={direction === 'in' ? 'Money in' : 'Money out'}
              className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${
                direction === 'in' ? 'border-ink bg-ink text-bg' : 'border-line text-faint'
              }`}
            >
              {direction === 'in' ? '+' : '−'}
            </button>
            <span className={`text-[30px] leading-none font-medium ${buf ? '' : 'text-faint'}`}>
              {buf || '0'}
            </span>
          </span>
        </div>

        <select
          value={bucketId}
          onChange={(e) => setBucketId(e.target.value)}
          aria-label="Bucket"
          className="mb-1.5 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[13px]"
        >
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {b.bank}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label="Date and time"
          className="mb-1.5 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[13px]"
        />

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="mb-1.5 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[13px] placeholder:text-faint"
        />

        {error && <p className="mb-2 text-xs text-over">{error}</p>}

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
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-center text-xs text-muted"
          >
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
            className={`flex-1 rounded-lg py-2 text-center text-xs ${
              confirmDelete ? 'bg-over font-semibold text-bg' : 'text-over'
            }`}
          >
            {confirmDelete ? `Delete ${formatVnd(tx.amountVnd)} — tap again` : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
