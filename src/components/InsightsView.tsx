'use client';

import { useState } from 'react';

import BarFill from '@/components/BarFill';
import HistoryTabs from '@/components/HistoryTabs';
import InsightPanel from '@/components/InsightPanel';
import { useInsights, type CycleRow } from '@/hooks/useInsights';
import BucketDot from '@/components/BucketDot';
import Page from '@/components/Page';
import SectionTitle from '@/components/SectionTitle';
import WordSelect from '@/components/WordSelect';
import { cycleLabel } from '@/lib/cycle';
import { barScale } from '@/lib/motion';
import { formatVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

export default function InsightsView() {
  const s = useInsights();
  const [focus, setFocus] = useState<string>('food');

  if (s.loading || s.rows.length === 0) {
    return (
      <Page top={<HistoryTabs active="trends" />}>
        <p className="pt-6 text-[15px] text-muted">
          {s.loading ? 'Loading…' : 'Nothing to show until a cycle exists.'}
        </p>
      </Page>
    );
  }

  const buffer = s.buckets.find((b) => b.id === 'buffer');
  const budgets = s.buckets.filter((b) => b.kind === 'budget' && b.active);
  const focusBucket = budgets.find((b) => b.id === focus) ?? budgets[0];

  return (
    <Page top={<HistoryTabs active="trends" />}>

      <div className="min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:items-start min-[900px]:gap-5">
      {buffer && (
        <Block
          title={
            <>
              <BucketDot id="buffer" />
              Buffer, last six cycles
            </>
          }
        >
          <ul className="flex flex-col gap-1.5">
            {s.recent.map((r, n) => (
              <BufferRow key={n} row={r} limitVnd={buffer.standardVnd} />
            ))}
          </ul>
        </Block>
      )}

      {focusBucket && (
        <Block
          title={
            <>
              <BucketDot id={focusBucket.id} />
              {focusBucket.name} per cycle
            </>
          }
          action={
            <WordSelect value={focusBucket.id} onChange={(e) => setFocus(e.target.value)} aria-label="Bucket">
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </WordSelect>
          }
        >
          <Trend rows={s.recent} bucket={focusBucket} />
        </Block>
      )}

      </div>

      {s.uid && <InsightPanel uid={s.uid} signals={s.signals} />}
    </Page>
  );
}

function BufferRow({ row, limitVnd }: { row: CycleRow | null; limitVnd: number }) {
  if (!row) return <li className="text-[13px] text-faint">-</li>;
  const used = row.byBucket.buffer ?? 0;
  const over = used > limitVnd;

  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <span className="w-8 shrink-0 text-faint">{cycleLabel(row.id).month.slice(0, 3)}</span>
      <span className="h-1 min-w-0 flex-1 rounded-full bg-sunk">
        <BarFill
          fraction={over ? 1 : barScale(used, limitVnd)}
          className="rounded-full"
          color={over ? 'var(--over)' : 'var(--faint)'}
        />
      </span>
      {/* nowrap: a long number pushes the bar shorter instead of breaking in two. */}
      <span className={`w-[7.5rem] shrink-0 whitespace-nowrap text-right ${over ? 'font-semibold text-over' : 'text-muted'}`}>
        {over ? `${formatVnd(used - limitVnd)} over` : `${formatVnd(used)} / ${formatVnd(limitVnd)}`}
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
      <div className="relative flex h-32 items-end gap-1.5 border-b border-line">
        {rows.map((_, n) => (
          <span
            key={n}
            className={`flex-1 rounded-t-[3px] ${n === rows.length - 1 ? 'bg-ink' : 'bg-line'}`}
            style={{
              // Net spending can be negative (more refunds than spending). A
              // negative height is invalid and the bar disappears again.
              height: `${Math.max(0, (values[n] / peak) * 100)}%`,
              minHeight: values[n] > 0 ? 3 : 0,
            }}
          />
        ))}
        {/* The standard amount as a dashed line, so "over" reads at a glance. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-faint"
          style={{ bottom: `${(bucket.standardVnd / peak) * 100}%` }}
        />
      </div>
      <div className="mt-1 flex gap-1.5">
        {rows.map((r, n) => (
          <span key={n} className="flex-1 text-center text-[11px] text-faint">
            {r ? cycleLabel(r.id).month.slice(0, 3) : '-'}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-faint">
        Dashed line: standard {formatVnd(bucket.standardVnd)}. Net of refunds.
      </p>
    </>
  );
}

function Block({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 first:mt-1 min-[900px]:mt-2">
      <SectionTitle action={action} className="mb-1.5">
        {title}
      </SectionTitle>
      {children}
    </section>
  );
}
