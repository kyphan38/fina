'use client';

import { useState } from 'react';

import { cycleLabel } from '@/lib/cycle';
import { closeCycle } from '@/lib/cycles';
import { formatVnd } from '@/lib/money';
import { bucketAccent } from '@/lib/bucket-color';
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
  covered,
  surplusVnd,
  snapshot,
  pendingCount,
}: {
  uid: string;
  cycle: Cycle;
  monthly: Bucket[];
  spent: Record<string, number>;
  covered: Record<string, number>;
  /** Đã cộng lại phần bù lấy từ BIDV - tính ở useSummary. */
  surplusVnd: number;
  /** Chụp lại vào document chu kỳ, để bảng theo năm khỏi đọc lại giao dịch. */
  snapshot: {
    outVnd: number;
    investedVnd: number;
    incomeVnd: number;
    byBucket: Record<string, number>;
  };
  pendingCount: number;
}) {
  const [target, setTarget] = useState<SurplusTarget>('etf');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surplus = surplusVnd;
  const { month } = cycleLabel(cycle.id);
  const blocked = pendingCount > 0;

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
          const used = (spent[b.id] ?? 0) + (covered[b.id] ?? 0);
          const diff = limit - used;
          return (
            <li key={b.id} className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2">
                <i
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: bucketAccent(b.id) }}
                />
                {b.name}
              </span>
              <span className="flex gap-3">
                <span className="text-muted">
                  {formatVnd(used)} / {formatVnd(limit)}
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
            Still {formatVnd(-surplus)} short after the covers. The money already left
            VCB - nothing moves on its own.
          </p>
        )
      )}

      {blocked && (
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          {pendingCount} cover{pendingCount > 1 ? 's' : ''} still waiting on a bank
          transfer. This is the last place overspending can slip past, so finish those
          first.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-over">{error}</p>}

      <button
        type="button"
        disabled={busy || blocked}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await closeCycle(uid, cycle.id, surplus, surplus > 0 ? target : 'hold', snapshot);
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
