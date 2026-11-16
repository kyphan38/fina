'use client';

import { useEffect, useState } from 'react';

import SectionTitle, { WORD } from '@/components/SectionTitle';
import { formatVnd, toVnd } from '@/lib/money';
import { EMPTY_RECURRING, type RecurringItem } from '@/lib/recurring';
import { saveRecurringItems, watchRecurring } from '@/lib/recurring-store';
import type { Bucket } from '@/types/fina';

const INPUT = 'rounded-md border border-line bg-surface-2 px-2 py-1 text-[15px]';

/** F2: rent, phone, subscriptions. On their day they show on Log; nothing is logged by itself. */
export default function RecurringCard({ uid, buckets }: { uid: string; buckets: Bucket[] }) {
  const [items, setItems] = useState<RecurringItem[]>(EMPTY_RECURRING.items);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = buckets.filter((b) => b.active);
  const name = (id: string) => buckets.find((b) => b.id === id)?.name ?? id;

  useEffect(() => watchRecurring(uid, (d) => setItems(d.items)), [uid]);

  const save = async (next: RecurringItem[]) => {
    setError(null);
    try {
      await saveRecurringItems(uid, next);
    } catch (err) {
      setError(`Could not save (${(err as { code?: string })?.code ?? 'unknown'}).`);
    }
  };

  return (
    <section className="border-t border-line pt-3">
      <SectionTitle className="mb-1">Recurring</SectionTitle>
      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((it) => (
            <li key={it.id} className="flex items-baseline gap-3 py-2 text-[15px]">
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              <span className="shrink-0 text-[13px] text-faint">
                {name(it.bucketId)} · day {it.day}
              </span>
              <span className="shrink-0">{formatVnd(it.amountVnd)}</span>
              <button
                type="button"
                onClick={() => void save(items.filter((x) => x.id !== it.id))}
                aria-label={`Remove ${it.name}`}
                className={WORD}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddRecurring
          buckets={active}
          onCancel={() => setAdding(false)}
          onAdd={(it) => {
            setAdding(false);
            void save([...items, it]);
          }}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${WORD} mt-1`}>
          add recurring
        </button>
      )}
      {error && <p className="mt-2 text-[13px] text-over">{error}</p>}
    </section>
  );
}

function AddRecurring({
  buckets,
  onAdd,
  onCancel,
}: {
  buckets: Bucket[];
  onAdd: (item: RecurringItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [bucketId, setBucketId] = useState(buckets[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const amountVnd = toVnd(amount);
  const dayN = Number(day);
  const ok = name.trim() !== '' && bucketId !== '' && amountVnd !== null && Number.isInteger(dayN) && dayN >= 1 && dayN <= 31;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        aria-label="Recurring name"
        maxLength={40}
        autoFocus
        className={INPUT}
      />
      <div className="flex gap-2">
        <select
          value={bucketId}
          onChange={(e) => setBucketId(e.target.value)}
          aria-label="Recurring bucket"
          className={`${INPUT} min-w-0 flex-1`}
        >
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Amount"
          aria-label="Recurring amount"
          className={`${INPUT} w-24 text-right`}
        />
        <input
          value={day}
          onChange={(e) => setDay(e.target.value)}
          inputMode="numeric"
          aria-label="Day of the month"
          className={`${INPUT} w-14 text-right`}
        />
      </div>
      <div className="flex items-baseline gap-4">
        <button
          type="button"
          disabled={!ok}
          onClick={() =>
            ok &&
            amountVnd !== null &&
            onAdd({ id: `r${Date.now().toString(36)}`, name: name.trim(), bucketId, amountVnd, day: dayN })
          }
          className={`${WORD} disabled:opacity-30`}
        >
          add
        </button>
        <button type="button" onClick={onCancel} className={WORD}>
          cancel
        </button>
      </div>
    </div>
  );
}
