'use client';

import { useState } from 'react';

import { closeGoal } from '@/lib/goal-store';
import { closePlan } from '@/lib/goals';
import { formatVnd } from '@/lib/money';
import { moveError, movableFunds } from '@/lib/moves';
import type { Bucket } from '@/types/fina';

const SELECT =
  'w-full rounded-[9px] border border-line bg-surface-2 px-2 py-2 text-[13px]';

/** Close a goal after the purchase: settle its balance to zero, then mark it done. */
export default function CloseGoalSheet({
  uid,
  goal,
  buckets,
  onClose,
}: {
  uid: string;
  goal: Bucket;
  buckets: Bucket[];
  onClose: () => void;
}) {
  const plan = closePlan(goal);
  const others = movableFunds(buckets).filter((b) => b.id !== goal.id);
  const [otherId, setOtherId] = useState(
    others.find((b) => b.id === 'purchases')?.id ?? others[0]?.id ?? '',
  );
  const other = others.find((b) => b.id === otherId) ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Covering an overspend takes money out of the other fund, so it must have it.
  const blocked =
    plan.kind === 'short' ? moveError(other, goal, plan.amountVnd) : plan.kind !== 'empty' && !other;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await closeGoal(uid, goal, other);
      onClose();
    } catch (err) {
      setError(`Could not close (${(err as { code?: string })?.code ?? 'unknown'}).`);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />
      <div className="rounded-t-2xl border-t border-line bg-surface px-4 pb-3 pt-3">
        <p className="pb-3 text-xs font-semibold">Close {goal.name}</p>

        {plan.kind === 'empty' && <p className="text-sm">Nothing left in it.</p>}

        {plan.kind !== 'empty' && (
          <label className="flex flex-col gap-1.5 text-sm">
            {plan.kind === 'leftover'
              ? `Move the ${formatVnd(plan.amountVnd)} left to`
              : `Cover the ${formatVnd(plan.amountVnd)} over from`}
            <select
              value={otherId}
              onChange={(e) => setOtherId(e.target.value)}
              aria-label={plan.kind === 'leftover' ? 'Move leftover to' : 'Cover from'}
              className={SELECT}
            >
              {others.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {formatVnd(b.balanceVnd)}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="mt-3 text-xs text-faint">History stays.</p>

        {typeof blocked === 'string' && (
          <p className="mt-2 text-xs font-medium text-over">{blocked}</p>
        )}
        {error && <p className="mt-2 text-xs font-medium text-over">{error}</p>}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={run}
            disabled={busy || Boolean(blocked)}
            className="flex-1 rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {busy ? 'Closing…' : 'Close goal'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-line py-2.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
