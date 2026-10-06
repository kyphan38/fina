// ============================================================
// fina - Numbers for the iPhone widget (Scriptable)
//
// Pure function, no Firestore: the /api/widget route reads the data and
// passes it in. The numbers MUST match the Summary screen - a widget saying
// "4.550 left" while the app says "4.300 left" loses trust in both.
//
//   left  = sum of the cycle's limits - net spent of the budget buckets
//   used  (per bucket) = spent + amount drawn to cover others  (like BudgetRow)
//
// Salary never passes through here.
// ============================================================

import { cycleOf, cycleProgress } from '@/lib/cycle';
import type { Bucket, Cover, Transaction } from '@/types/fina';

export interface WidgetBucket {
  name: string;
  usedVnd: number;
  /** null when the cycle has no limit for this bucket. */
  limitVnd: number | null;
}

export interface WidgetData {
  cycle: string;
  day: number;
  totalDays: number;
  limitVnd: number;
  spentVnd: number;
  leftVnd: number;
  /** What is left, spread over the remaining days including today. Negative becomes 0. */
  perDayVnd: number;
  buckets: WidgetBucket[];
}

/**
 * Vietnam time as a "local time" Date.
 *
 * Vercel servers run in UTC, while cycleOf/cycleProgress read getDate() in
 * device time. Rebuilding a Date from Vietnam time parts makes both correct
 * on any timezone. 01:00 on the 25th in Vietnam is still 18:00 on the 24th
 * UTC - without this, the widget opens the new cycle 7 hours late.
 */
export function vnWallClock(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

export function widgetData(args: {
  now: Date;
  buckets: Bucket[];
  txs: Transaction[];
  limits: Record<string, number>;
  covered: Record<string, number>;
}): WidgetData {
  const { now, buckets, txs, limits, covered } = args;
  const cycle = cycleOf(now);
  const { day, total } = cycleProgress(cycle, now);

  const spent: Record<string, number> = {};
  for (const tx of txs) {
    const signed = tx.direction === 'in' ? -tx.amountVnd : tx.amountVnd;
    spent[tx.bucketId] = (spent[tx.bucketId] ?? 0) + signed;
  }

  const monthly = buckets
    .filter((b) => b.active && b.kind === 'budget')
    .sort((a, b) => a.order - b.order);

  const limitVnd = Object.values(limits).reduce((a, b) => a + b, 0);
  const spentVnd = monthly.reduce((sum, b) => sum + (spent[b.id] ?? 0), 0);
  const leftVnd = limitVnd - spentVnd;
  const daysLeft = total - day + 1;

  return {
    cycle,
    day,
    totalDays: total,
    limitVnd,
    spentVnd,
    leftVnd,
    perDayVnd: Math.max(0, Math.floor(leftVnd / daysLeft)),
    buckets: monthly.map((b) => ({
      name: b.name,
      usedVnd: (spent[b.id] ?? 0) + (covered[b.id] ?? 0),
      limitVnd: limits[b.id] ?? null,
    })),
  };
}

/** Like coveredByBucket in covers.ts, but that file pulls in the Firebase client. */
export function coveredOf(covers: Cover[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of covers) {
    if (c.status !== 'done') continue;
    out[c.fromBucketId] = (out[c.fromBucketId] ?? 0) + c.amountVnd;
    out[c.toBucketId] = (out[c.toBucketId] ?? 0) - c.amountVnd;
  }
  return out;
}
