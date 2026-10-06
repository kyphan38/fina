'use client';

import { useState } from 'react';

import InsightPanel from '@/components/InsightPanel';
import { useInsights, type CycleRow } from '@/hooks/useInsights';
import { bucketAccent } from '@/lib/bucket-color';
import { cycleLabel } from '@/lib/cycle';
import { formatVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

export default function InsightsView() {
  const s = useInsights();
  const [focus, setFocus] = useState<string>('food');

  if (s.loading) return <p className="pt-6 text-sm text-muted">Loading…</p>;
  if (s.rows.length === 0) {
    return <p className="pt-6 text-sm text-muted">Nothing to show until a cycle exists.</p>;
  }

  const buffer = s.buckets.find((b) => b.id === 'buffer');
  const budgets = s.buckets.filter((b) => b.kind === 'budget' && b.active);
  const focusBucket = budgets.find((b) => b.id === focus) ?? budgets[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <header className="border-b border-line pb-2.5 pt-3">
        <h1 className="text-lg font-semibold">Insights</h1>
      </header>

      <div className="min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:items-start min-[900px]:gap-5">
      {buffer && (
        <Block title="Buffer, last six cycles">
          <ul className="flex flex-col gap-1.5">
            {s.recent.map((r, n) => (
              <BufferRow key={n} row={r} limitVnd={buffer.standardVnd} />
            ))}
          </ul>
        </Block>
      )}

      {focusBucket && (
        <Block
          title="Trend"
          action={
            <select
              value={focusBucket.id}
              onChange={(e) => setFocus(e.target.value)}
              aria-label="Bucket"
              className="ml-auto rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px]"
            >
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          }
        >
          <Trend rows={s.recent} bucket={focusBucket} />
        </Block>
      )}

      </div>

      {s.uid && <InsightPanel uid={s.uid} signals={s.signals} />}
    </div>
  );
}

function BufferRow({ row, limitVnd }: { row: CycleRow | null; limitVnd: number }) {
  if (!row) return <li className="text-xs text-faint">-</li>;
  const used = row.byBucket.buffer ?? 0;
  const pct = limitVnd > 0 ? Math.min(100, (used / limitVnd) * 100) : 0;
  const over = used > limitVnd;

  return (
    <li className="flex items-center gap-2.5 text-xs">
      <span className="w-8 shrink-0 text-faint">{cycleLabel(row.id).month.slice(0, 3)}</span>
      <span className="h-2 flex-1 rounded-full bg-sunk">
        <span
          className="block h-full rounded-full"
          style={{ width: `${over ? 100 : pct}%`, background: over ? 'var(--over)' : 'var(--b6)' }}
        />
      </span>
      <span className={`w-24 shrink-0 text-right ${over ? 'font-medium text-over' : 'text-muted'}`}>
        {formatVnd(used)} / {formatVnd(limitVnd)}
      </span>
    </li>
  );
}

function Trend({ rows, bucket }: { rows: (CycleRow | null)[]; bucket: Bucket }) {
  const values = rows.map((r) => (r ? (r.byBucket[bucket.id] ?? 0) : 0));
  const peak = Math.max(bucket.standardVnd, ...values, 1);

  return (
    <>
      {/* The bars must be DIRECT children of the fixed-height frame. Wrapped in a
          content-height div (items-end does not stretch children), `height: %`
          has nothing to resolve against, the browser ignores it, and every bar
          drops to minHeight - six equal bars look like a chart with no data.
          So month labels sit in their own row, aligned with the same flex-1
          and gap. */}
      <div className="flex h-28 items-end gap-1.5">
        {rows.map((_, n) => (
          <span
            key={n}
            className="flex-1 rounded-t-[3px]"
            style={{
              // Net spending can be negative (more refunds than spending). A
              // negative height is invalid and the bar disappears again.
              height: `${Math.max(0, (values[n] / peak) * 100)}%`,
              minHeight: values[n] > 0 ? 3 : 0,
              background: bucketAccent(bucket.id),
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {rows.map((r, n) => (
          <span key={n} className="flex-1 text-center text-[10px] text-faint">
            {r ? cycleLabel(r.id).month.slice(0, 3) : '-'}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Standard {formatVnd(bucket.standardVnd)}. Net of refunds.
      </p>
    </>
  );
}

function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-xl border border-line bg-surface px-4 py-3">
      <h2 className="mb-2.5 flex items-center text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
        {title}
        {action}
      </h2>
      {children}
    </section>
  );
}
