'use client';

import { useState } from 'react';

import { toVnd } from '@/lib/money';
import { importKey, toLocalInput, type ImportRow } from '@/lib/momo-import';
import type { Bucket } from '@/types/fina';

/** Add a missed MoMo row by hand (cut off at an image edge, or not captured). */
export default function AddRow({
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
        className="mt-3 w-full rounded-[10px] border border-dashed border-line py-2 text-xs text-muted"
      >
        + Add row
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[10px] border border-line bg-surface p-3">
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
              // Random: two devices adding by hand at once must not share an id.
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
          className="flex-1 rounded-[10px] bg-ink py-1.5 text-xs font-semibold text-bg disabled:opacity-30"
        >
          Add
        </button>
      </div>
    </div>
  );
}
