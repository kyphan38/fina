'use client';

import { useState } from 'react';

import SheetShell from '@/components/SheetShell';
import { formatVnd } from '@/lib/money';
import { deleteTransaction } from '@/lib/transactions';
import type { Transaction } from '@/types/fina';

const BTN = 'flex-1 rounded-[10px] border border-line py-2.5 text-sm';

/**
 * A People entry, or one side of "Count as spending". These change a
 * person's balance, so they are not edited: delete and log again.
 */
export default function PersonTxSheet({
  uid,
  tx,
  title,
  onClose,
}: {
  uid: string;
  tx: Transaction;
  title: string;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const both = Boolean(tx.settleId);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTransaction(uid, tx, 'budget');
      onClose();
    } catch (err) {
      setError(`Could not delete (${(err as { code?: string })?.code ?? 'unknown'}).`);
      setBusy(false);
    }
  };

  return (
    <SheetShell
      onClose={onClose}
      label={title}
      z={20}
      dim={30}
      locked={busy}
      className="rounded-t-2xl border-t border-line bg-surface px-4 pb-3 pt-3"
      header={
        <div className="flex items-baseline justify-between pb-2">
          <span className="text-xs font-semibold">{title}</span>
          <span className="text-[30px] font-medium leading-none">{formatVnd(tx.amountVnd)}</span>
        </div>
      }
    >
      <p className="text-xs text-muted">
        {new Date(tx.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {` · ${tx.bank}`}
        {tx.note ? ` · ${tx.note}` : ''}
      </p>
      <p className="mt-3 text-xs text-faint">
        {both ? 'Part of Count as spending. Deleting removes both sides.' : 'A People entry cannot be edited. Delete it and log again.'}
      </p>

      {error && <p className="mt-3 text-xs font-medium text-over">{error}</p>}

      <div className="mt-3 flex gap-2">
        {confirm ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex-1 rounded-[10px] bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {busy ? 'Deleting…' : both ? 'Delete both sides' : 'Delete'}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className={BTN}>
            Delete
          </button>
        )}
        <button type="button" onClick={onClose} className={BTN}>
          Close
        </button>
      </div>
    </SheetShell>
  );
}
