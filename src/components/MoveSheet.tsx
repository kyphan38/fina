'use client';

import { useState } from 'react';

import AmountSheet from '@/components/AmountSheet';
import { formatVnd } from '@/lib/money';
import { moveError, movableFunds } from '@/lib/moves';
import { deleteMove, moveBetweenFunds } from '@/lib/transactions';
import type { Bucket, Transaction } from '@/types/fina';

const SELECT =
  'min-w-0 flex-1 rounded-[9px] border border-line bg-surface-2 px-2 py-2 text-[13px]';

/** Chuyển tiền giữa hai quỹ BIDV. Cùng ngân hàng nên không cần chuyển khoản thật. */
export default function MoveSheet({
  uid,
  buckets,
  onClose,
}: {
  uid: string;
  buckets: Bucket[];
  onClose: () => void;
}) {
  const funds = movableFunds(buckets);
  const [fromId, setFromId] = useState(funds[0]?.id ?? '');
  const [toId, setToId] = useState(funds[1]?.id ?? '');
  const from = funds.find((b) => b.id === fromId) ?? null;
  const to = funds.find((b) => b.id === toId) ?? null;

  return (
    <AmountSheet
      title="Move between funds"
      confirmLabel="Move"
      errorFor={(amountVnd) => moveError(from, to, amountVnd)}
      onCancel={onClose}
      onConfirm={async (amountVnd, note) => {
        if (!from || !to) return;
        await moveBetweenFunds(uid, from, to, amountVnd, note);
        onClose();
      }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <select
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          aria-label="From fund"
          className={SELECT}
        >
          {funds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {formatVnd(b.balanceVnd)}
            </option>
          ))}
        </select>
        <span aria-hidden className="text-faint">
          →
        </span>
        <select
          value={toId}
          onChange={(e) => setToId(e.target.value)}
          aria-label="To fund"
          className={SELECT}
        >
          {funds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {formatVnd(b.balanceVnd)}
            </option>
          ))}
        </select>
      </div>
    </AmountSheet>
  );
}

/**
 * Một lần chuyển đã ghi, mở từ History. Không cho sửa: sửa một nửa là lệch
 * nửa kia. Ghi sai thì xoá (cả hai nửa) rồi chuyển lại.
 */
export function MoveDetailSheet({
  uid,
  legs,
  byId,
  onClose,
}: {
  uid: string;
  legs: Transaction[];
  byId: Map<string, Bucket>;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = legs.find((t) => t.direction === 'out');
  const to = legs.find((t) => t.direction === 'in');
  const any = from ?? to!;
  const name = (t?: Transaction) => (t ? (byId.get(t.bucketId)?.name ?? t.bucketId) : '?');

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteMove(uid, legs);
      onClose();
    } catch (err) {
      setError(`Could not delete (${(err as { code?: string })?.code ?? 'unknown'}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />
      <div className="rounded-t-2xl border-t border-line bg-surface px-4 pb-3 pt-3">
        <div className="flex items-baseline justify-between pb-2">
          <span className="text-xs font-semibold">Move</span>
          <span className="text-[30px] font-medium leading-none">
            {formatVnd(any.amountVnd)}
          </span>
        </div>
        <p className="text-sm">
          {name(from)} → {name(to)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {new Date(any.occurredAt).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {any.note ? ` · ${any.note}` : ''}
        </p>
        <p className="mt-3 text-xs text-faint">
          A move cannot be edited. Delete it and move again.
        </p>

        {error && <p className="mt-3 text-xs font-medium text-over">{error}</p>}

        <div className="mt-3 flex gap-2">
          {confirm ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex-1 rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
            >
              {busy ? 'Deleting…' : 'Delete both sides'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="flex-1 rounded-lg border border-line py-2.5 text-sm"
            >
              Delete move
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-line py-2.5 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
