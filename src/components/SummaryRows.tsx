'use client';

// Rows and small blocks of the Summary screen (split out of SummaryView.tsx to keep it small).

import BarFill from '@/components/BarFill';
import BucketDot from '@/components/BucketDot';
import SectionTitle from '@/components/SectionTitle';
import Settle from '@/components/Settle';
import { etaMonth, goalProgress, monthLabel, needPerMonth } from '@/lib/goals';
import { barScale } from '@/lib/motion';
import { formatVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

export function BudgetRow({
  bucket,
  spentVnd,
  coveredVnd,
  limit,
  runOut,
  settled,
}: {
  bucket: Bucket;
  spentVnd: number;
  /** Amount taken from this bucket to cover another. */
  coveredVnd: number;
  limit: number | undefined;
  /** When it runs out at the current pace (F3), or null. */
  runOut?: number | null;
  settled: boolean;
}) {
  // Buffer drawn to cover elsewhere is still "used", even with no transaction.
  const used = spentVnd + coveredVnd;
  const over = limit !== undefined && used > limit;
  const fraction = barScale(used, limit);
  // Same number as the Log tile: what is left, not what is spent.
  const shown = limit === undefined ? used : over ? used - limit : limit - used;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span className="flex min-w-0 items-center gap-2">
          <BucketDot id={bucket.id} />
          <span className="truncate">{bucket.name}</span>
          {runOut != null && !over && (
            <span className="shrink-0 text-[12px] text-faint">out by {new Date(runOut).getDate()}</span>
          )}
        </span>
        <span className="whitespace-nowrap">
          <Settle value={shown} settled={settled}>
            <span className={over ? 'font-semibold text-over' : ''}>
              {formatVnd(shown)}
              {over && ' over'}
            </span>
            {limit !== undefined && (
              <span className="text-[13px] text-faint"> / {formatVnd(limit)}</span>
            )}
          </Settle>
        </span>
      </div>
      <span className="mt-1 ml-4 block h-0.5 rounded-full bg-sunk">
        <BarFill
          fraction={over ? 1 : fraction}
          settled={settled}
          className="rounded-full"
          color={over ? 'var(--over)' : 'var(--faint)'}
        />
      </span>
    </li>
  );
}

export function GoalRow({
  bucket,
  now,
  settled,
  onTopUp,
  onClose,
}: {
  bucket: Bucket;
  now: Date;
  settled: boolean;
  onTopUp: () => void;
  onClose: () => void;
}) {
  const g = bucket.goal!;
  const progress = goalProgress(bucket, now);
  const need = needPerMonth(bucket, now);
  const eta = progress === 'behind' ? etaMonth(bucket, now) : null;
  const pct =
    g.targetVnd && g.targetVnd > 0
      ? Math.max(0, Math.min(100, (bucket.balanceVnd / g.targetVnd) * 100))
      : null;

  const details = [
    g.targetMonth ? monthLabel(g.targetMonth) : null,
    progress === 'later' || progress === 'ready'
      ? null
      : need !== null
        ? `needs ${formatVnd(need)}/mo`
        : `${formatVnd(bucket.standardVnd)}/mo`,
    progress === 'behind'
      ? `set ${formatVnd(bucket.standardVnd)}${eta ? `, done ${monthLabel(eta)}` : ''}`
      : null,
    progress,
  ].filter(Boolean);

  return (
    <li className={`group ${progress === 'later' ? 'text-faint' : ''}`}>
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span>{bucket.name}</span>
        <span className="flex items-baseline gap-3">
          <span className={bucket.balanceVnd < 0 ? 'font-semibold text-over' : ''}>
            <Settle value={bucket.balanceVnd} settled={settled}>
              {formatVnd(bucket.balanceVnd)}
              {g.targetVnd ? (
                <span className="text-[13px] text-faint"> / {formatVnd(g.targetVnd)}</span>
              ) : null}
            </Settle>
          </span>
          <button
            type="button"
            onClick={onTopUp}
            aria-label={`Add to ${bucket.name}`}
            className={TOP_UP}
          >
            add
          </button>
        </span>
      </div>
      {pct !== null && progress !== 'later' && (
        <span className="mt-1 block h-1 w-full rounded-full bg-sunk">
          <BarFill fraction={pct / 100} settled={settled} className="rounded-full" color="var(--muted)" />
        </span>
      )}
      <div className="mt-1 flex items-baseline gap-3 text-[13px]">
        <p className={`min-w-0 flex-1 ${progress === 'behind' ? 'font-medium text-ink' : 'text-faint'}`}>
          {details.join(' · ')}
        </p>
        {/* After the purchase: settle what is left and retire the goal. */}
        <button type="button" onClick={onClose} className="shrink-0 text-faint hover:text-ink active:text-ink">
          Close
        </button>
      </div>
    </li>
  );
}

export function FundRow({
  bucket,
  settled,
  onTopUp,
}: {
  bucket: Bucket;
  settled: boolean;
  onTopUp: () => void;
}) {
  return (
    <li className="group">
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span>{bucket.name}</span>
        <span className="flex items-baseline gap-3">
          <span className={bucket.balanceVnd < 0 ? 'font-semibold text-over' : ''}>
            <Settle value={bucket.balanceVnd} settled={settled}>
              {bucket.balanceVnd < 0
                ? `${formatVnd(-bucket.balanceVnd)} over`
                : formatVnd(bucket.balanceVnd)}
            </Settle>
          </span>
          <button
            type="button"
            onClick={onTopUp}
            aria-label={`Add to ${bucket.name}`}
            className={TOP_UP}
          >
            add
          </button>
        </span>
      </div>
    </li>
  );
}

export function Block({
  title,
  action,
  first = false,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** Right under the top bar's line, so it needs no line of its own. */
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`${first ? 'mt-2' : 'mt-7'} min-[900px]:mt-2`}>
      <SectionTitle action={action} className="mb-1">
        {title}
      </SectionTitle>
      {children}
    </section>
  );
}

export function Totals({ left, right, settled }: { left: string; right: string; settled: boolean }) {
  return (
    <div className="mt-3 flex justify-between border-t border-line pt-2 text-[13px]">
      <span className="text-muted">{left}</span>
      <span className="font-semibold">
        <Settle value={right} settled={settled}>
          {right}
        </Settle>
      </span>
    </div>
  );
}

/** "+" top-up: used a few times a month, so it waits for the pointer on a
 * computer and stays faint but visible on touch screens (no hover there). */
export const TOP_UP =
  'w-8 text-right text-[13px] text-faint hover:text-ink focus-visible:opacity-100 min-[900px]:opacity-0 min-[900px]:group-hover:opacity-100 min-[900px]:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';
