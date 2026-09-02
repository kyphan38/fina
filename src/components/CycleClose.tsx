'use client';

import { useState } from 'react';

import { cycleLabel } from '@/lib/cycle';
import { closeCycle, computeSurplus } from '@/lib/cycles';
import { formatVnd } from '@/lib/money';
import type { Bucket, Cycle, SurplusTarget } from '@/types/fina';

const TARGETS: { id: SurplusTarget; label: string }[] = [
  { id: 'etf', label: 'ETF' },
  { id: 'reserve', label: 'Reserve' },
  { id: 'hold', label: 'Hold' },
];

/**
 * Màn hình đóng sổ. Hiện khi chu kỳ đã hết hạn mà chưa chốt.
 *
 * Chu kỳ mới chưa mở cho tới khi bấm Close - một chút ma sát cố ý, để việc
 * tiêu lố không trôi qua trong im lặng như hồi còn dùng Numbers.
 */
export default function CycleClose({
  uid,
  cycle,
  monthly,
  spent,
}: {
  uid: string;
  cycle: Cycle;
  monthly: Bucket[];
  spent: Record<string, number>;
}) {
  const [target, setTarget] = useState<SurplusTarget>('etf');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surplus = computeSurplus(cycle.limits, spent);
  const { month } = cycleLabel(cycle.id);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <header className="pt-4">
        <h1 className="text-lg font-semibold">Cycle {month} ended</h1>
        <p className="mt-1 text-sm text-muted">
          Close it to start the next one.
        </p>
      </header>

      <ul className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3">
        {monthly.map((b) => {
          const limit = cycle.limits[b.id];
          if (limit === undefined) return null;
          const diff = limit - (spent[b.id] ?? 0);
          return (
            <li key={b.id} className="flex items-baseline justify-between text-sm">
              <span>{b.name}</span>
              <span className="flex gap-3">
                <span className="text-muted">
                  {formatVnd(spent[b.id] ?? 0)} / {formatVnd(limit)}
                </span>
                <span className={`w-16 text-right ${diff < 0 ? 'text-over' : ''}`}>
                  {diff >= 0 ? '+' : '−'}
                  {formatVnd(Math.abs(diff))}
                </span>
              </span>
            </li>
          );
        })}
        <li className="mt-1 flex justify-between border-t border-line pt-2 text-sm font-semibold">
          <span>{surplus >= 0 ? 'Surplus' : 'Over'}</span>
          <span className={surplus < 0 ? 'text-over' : ''}>{formatVnd(Math.abs(surplus))}</span>
        </li>
      </ul>

      {surplus > 0 ? (
        <section className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
            Move surplus to
          </p>
          <div className="flex gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTarget(t.id)}
                aria-pressed={target === t.id}
                className={`flex-1 rounded-[10px] border py-2.5 text-sm ${
                  target === t.id ? 'border-ink bg-ink text-bg' : 'border-line'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>
      ) : (
        surplus < 0 && (
          <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            You spent {formatVnd(-surplus)} more than the limits allowed. Nothing moves
            automatically — the money already left VCB.
          </p>
        )
      )}

      {error && <p className="mt-3 text-sm text-over">{error}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await closeCycle(uid, cycle.id, surplus, surplus > 0 ? target : 'hold');
          } catch (err) {
            const code = (err as { code?: string })?.code ?? 'unknown';
            setError(`Could not close the cycle (${code}).`);
          } finally {
            setBusy(false);
          }
        }}
        className="mt-5 w-full rounded-[10px] bg-ink py-3.5 text-sm font-semibold text-bg disabled:opacity-30"
      >
        {busy ? 'Closing…' : 'Close cycle'}
      </button>
    </div>
  );
}
