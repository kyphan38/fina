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
  const [year, setYear] = useState<string | null>(null);
  const [focus, setFocus] = useState<string>('food');

  if (s.loading) return <p className="pt-6 text-sm text-muted">Loading…</p>;
  if (s.rows.length === 0) {
    return <p className="pt-6 text-sm text-muted">Nothing to show until a cycle exists.</p>;
  }

  const activeYear = year ?? s.years[0];
  const inYear = s.rows.filter((r) => r.id.startsWith(activeYear));
  const total = inYear.reduce(
    (a, r) => ({
      inVnd: a.inVnd + r.inVnd,
      outVnd: a.outVnd + r.outVnd,
      investedVnd: a.investedVnd + r.investedVnd,
      leftVnd: a.leftVnd + r.leftVnd,
    }),
    { inVnd: 0, outVnd: 0, investedVnd: 0, leftVnd: 0 },
  );

  const buffer = s.buckets.find((b) => b.id === 'buffer');
  const budgets = s.buckets.filter((b) => b.kind === 'budget' && b.active);
  const focusBucket = budgets.find((b) => b.id === focus) ?? budgets[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <header className="flex items-center justify-between border-b border-line pb-2.5 pt-3">
        <h1 className="text-lg font-semibold">Insights</h1>
        {s.years.length > 1 && (
          <select
            value={activeYear}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Year"
            className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs"
          >
            {s.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </header>

      <Block title={`Cash flow · ${activeYear}`}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[420px] text-right text-xs">
            <thead>
              <tr className="text-faint">
                <th className="pb-1.5 text-left font-medium">Cycle</th>
                <th className="pb-1.5 font-medium">In</th>
                <th className="pb-1.5 font-medium">Out</th>
                <th className="pb-1.5 font-medium">Invested</th>
                <th className="pb-1.5 font-medium">Left</th>
              </tr>
            </thead>
            <tbody>
              {inYear.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5 text-left">
                    {cycleLabel(r.id).month.slice(0, 3)}
                    {!r.closed && <span className="ml-1.5 text-faint">running</span>}
                  </td>
                  <Cell v={r.inVnd} closed={r.closed} />
                  <Cell v={r.outVnd} closed={r.closed} />
                  <Cell v={r.investedVnd} closed={r.closed} />
                  <Cell v={r.leftVnd} closed={r.closed} strong />
                </tr>
              ))}
              <tr className="border-t border-line font-semibold">
                <td className="py-1.5 text-left">Year</td>
                <td>{formatVnd(total.inVnd)}</td>
                <td>{formatVnd(total.outVnd)}</td>
                <td>{formatVnd(total.investedVnd)}</td>
                <td>{formatVnd(total.leftVnd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-faint">
          A cycle with no snapshot shows <span className="text-ink">—</span>, never a zero.
          Zero would be a claim; the dash is not.
        </p>
      </Block>

      <div className="min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:items-start min-[900px]:gap-5">
      {buffer && (
        <Block title="Buffer, last six cycles">
          <ul className="flex flex-col gap-1.5">
            {s.recent.map((r, n) => (
              <BufferRow key={n} row={r} limitVnd={buffer.standardVnd} />
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-faint">
            Buffer resets every cycle, so nothing accumulates to look at. This is the
            pattern instead.
          </p>
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

function Cell({ v, closed, strong }: { v: number; closed: boolean; strong?: boolean }) {
  const missing = closed && v === 0;
  return (
    <td className={`py-1.5 ${strong ? 'font-semibold' : ''}`}>
      {missing ? <span className="text-faint">—</span> : formatVnd(v)}
    </td>
  );
}

function BufferRow({ row, limitVnd }: { row: CycleRow | null; limitVnd: number }) {
  if (!row) return <li className="text-xs text-faint">—</li>;
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
      <span className={`w-24 shrink-0 text-right ${over ? 'text-over' : 'text-muted'}`}>
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
      <div className="flex h-28 items-end gap-1.5">
        {rows.map((r, n) => (
          <div key={n} className="flex flex-1 flex-col items-center gap-1">
            <span
              className="w-full rounded-t-[3px]"
              style={{
                height: `${(values[n] / peak) * 100}%`,
                minHeight: values[n] > 0 ? 3 : 0,
                background: bucketAccent(bucket.id),
              }}
            />
            <span className="text-[10px] text-faint">
              {r ? cycleLabel(r.id).month.slice(0, 3) : '—'}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Standard is {formatVnd(bucket.standardVnd)}. Bars are net spending — refunds
        already taken off.
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
