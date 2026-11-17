'use client';

import { useEffect, useState } from 'react';

import SheetShell from '@/components/SheetShell';
import { formatVnd } from '@/lib/money';
import { balanceWord, canArchive, canCountAsSpending, runningBalance } from '@/lib/people';
import { countAsSpending, setArchived } from '@/lib/people-store';
import { watchPersonTxs } from '@/lib/transactions';
import type { Bucket, Person, Transaction } from '@/types/fina';

const BTN = 'flex-1 rounded-[10px] border border-line py-2.5 text-sm disabled:opacity-30';
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** One person: entries with the balance after each, Count as spending, Archive. */
export default function PersonSheet({
  uid,
  person,
  buckets,
  onClose,
}: {
  uid: string;
  person: Person;
  buckets: Bucket[];
  onClose: () => void;
}) {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [counting, setCounting] = useState(false);
  const [bucketId, setBucketId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchPersonTxs(uid, person.id, setTxs), [uid, person.id]);

  const targets = buckets.filter((b) => b.active && b.id !== 'etf');
  const target = targets.find((b) => b.id === bucketId) ?? null;
  const rows = txs ? runningBalance(txs).reverse() : [];

  const run = async (fn: () => Promise<unknown>) => {
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
      label={person.name}
      z={20}
      dim={30}
      locked={busy}
      className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pb-3 pt-3"
      header={
        <div className="flex items-baseline justify-between pb-2">
          <span className="text-xs font-semibold">{person.name}</span>
          <span className="text-right">
            <span className="block text-[30px] font-medium leading-none">{formatVnd(Math.abs(person.balanceVnd))}</span>
            <span className="text-xs text-muted">{balanceWord(person.balanceVnd)}</span>
          </span>
        </div>
      }
    >
      {txs === null ? (
        <p className="text-xs text-faint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-faint">No entries yet.</p>
      ) : (
        <ul className="text-[13px]">
          {rows.map(({ tx, after }) => (
            <li key={tx.id} className="flex items-baseline gap-3 border-b border-line py-1.5 last:border-b-0">
              <span className="w-12 shrink-0 text-faint">{dateFmt.format(tx.occurredAt)}</span>
              <span className="w-16 shrink-0 text-muted">{tx.direction === 'out' ? 'to' : 'from'}</span>
              <span className="font-medium">{formatVnd(tx.amountVnd)}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{tx.note ?? ''}</span>
              <span className="shrink-0 text-faint">{after > 0 ? '+' : ''}{formatVnd(after)}</span>
            </li>
          ))}
        </ul>
      )}

      {counting && (
        <div className="mt-3 flex flex-col gap-2">
          <select
            value={bucketId}
            onChange={(e) => setBucketId(e.target.value)}
            aria-label="Bucket"
            className="rounded-md border border-line bg-surface-2 px-2 py-2 text-[13px]"
          >
            <option value="">Pick a bucket</option>
            {targets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!target || busy}
            onClick={() => target && void run(() => countAsSpending(uid, person, target, person.balanceVnd))}
            className="rounded-[10px] bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {target ? `Spend ${formatVnd(person.balanceVnd)} from ${target.name}` : 'Pick a bucket'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium text-over">{error}</p>}

      <div className="mt-3 flex gap-2">
        {canCountAsSpending(person) && !counting && (
          <button type="button" onClick={() => setCounting(true)} className={BTN}>
            Count as spending
          </button>
        )}
        {canArchive(person) && (
          <button type="button" disabled={busy} onClick={() => void run(() => setArchived(uid, person.id, true))} className={BTN}>
            Archive
          </button>
        )}
        <button type="button" onClick={onClose} className={BTN}>
          Close
        </button>
      </div>
    </SheetShell>
  );
}
