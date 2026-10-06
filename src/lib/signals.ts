// ============================================================
// fina - Stats, computed by CODE
//
// The rule behind all of Stage 7, in one line:
//   Code does the math. The model only picks what is worth saying.
//
// Nothing in this file touches the network. The model is never asked to add
// or subtract, so every number it says must appear here first.
// ============================================================

import type { Bucket } from '@/types/fina';

/** Threshold for calling a transaction unusual for its own bucket. */
export const OUTLIER_MULTIPLE = 3;
/** Consecutive rising cycles needed to call it a trend. */
export const RISING_RUN = 3;
/** Cycles a fund stays quiet before it is worth a mention. */
export const IDLE_CYCLES = 3;

export interface CycleFacts {
  id: string;
  closed: boolean;
  byBucket: Record<string, number>;
  limits: Record<string, number>;
}

export interface BucketSignal {
  bucketId: string;
  name: string;
  /** Spending this cycle. */
  currentVnd: number;
  medianVnd: number;
  /** Gap from the median, %. null when there is not enough data to compare. */
  deviationPct: number | null;
  limitVnd: number | null;
  /** How many cycles went over the limit, out of how many closed cycles. */
  overCount: number;
  overOf: number;
  /** Rose for RISING_RUN cycles in a row. */
  rising: boolean;
}

export interface PaceSignal {
  bucketId: string;
  name: string;
  /** % of the cycle that has passed. */
  elapsedPct: number;
  /** % of the limit spent. */
  spentPct: number;
}

export interface Signals {
  cycleId: string;
  day: number;
  totalDays: number;
  buckets: BucketSignal[];
  pace: PaceSignal[];
  outliers: { bucketId: string; name: string; amountVnd: number; medianVnd: number }[];
  idleFunds: { bucketId: string; name: string; balanceVnd: number; idleCycles: number }[];
  negativeFunds: { bucketId: string; name: string; balanceVnd: number }[];
  /** Closed cycles used for comparison. Under 3, say nothing about trends. */
  closedCount: number;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function pct(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 100);
}

/**
 * `cycles` are OLDEST FIRST; the last item is the running cycle.
 * `amounts` are the current cycle's transaction amounts, to find outliers.
 */
export function computeSignals(args: {
  cycles: CycleFacts[];
  buckets: Bucket[];
  amounts: { bucketId: string; amountVnd: number }[];
  day: number;
  totalDays: number;
}): Signals {
  const { cycles, buckets, amounts, day, totalDays } = args;
  const current = cycles[cycles.length - 1];
  const past = cycles.filter((c) => c.closed && c.id !== current?.id);

  const byId = new Map(buckets.map((b) => [b.id, b]));
  const budgets = buckets.filter((b) => b.kind === 'budget' && b.active);
  const funds = buckets.filter((b) => b.kind === 'fund' && b.active && b.id !== 'etf');

  const bucketSignals: BucketSignal[] = budgets.map((b) => {
    const history = past.map((c) => c.byBucket[b.id] ?? 0);
    const med = median(history);
    const currentVnd = current?.byBucket[b.id] ?? 0;
    const limitVnd = current?.limits[b.id] ?? null;

    const overCount = past.filter((c) => {
      const lim = c.limits[b.id];
      return lim !== undefined && (c.byBucket[b.id] ?? 0) > lim;
    }).length;

    // Rising run: only counted when there are enough cycles to say so.
    const tail = [...history.slice(-(RISING_RUN - 1)), currentVnd];
    const rising =
      tail.length === RISING_RUN && tail.every((v, i) => i === 0 || v > tail[i - 1]);

    return {
      bucketId: b.id,
      name: b.name,
      currentVnd,
      medianVnd: med,
      deviationPct: med > 0 ? pct(currentVnd - med, med) : null,
      limitVnd,
      overCount,
      overOf: past.filter((c) => c.limits[b.id] !== undefined).length,
      rising,
    };
  });

  // Pace only applies to evenly spent buckets. Health and Purchases come in
  // lumps; against a linear pace they would warn wrongly every month until
  // nobody looks anymore.
  const elapsedPct = totalDays > 0 ? Math.round((day / totalDays) * 100) : 0;
  const pace: PaceSignal[] = budgets
    .filter((b) => b.evenlySpent)
    .map((b) => {
      const lim = current?.limits[b.id] ?? 0;
      return {
        bucketId: b.id,
        name: b.name,
        elapsedPct,
        spentPct: lim > 0 ? Math.round(((current?.byBucket[b.id] ?? 0) / lim) * 100) : 0,
      };
    });

  const outliers = amounts
    .map((t) => {
      const b = byId.get(t.bucketId);
      const med = median(past.map((c) => c.byBucket[t.bucketId] ?? 0));
      return { bucketId: t.bucketId, name: b?.name ?? t.bucketId, amountVnd: t.amountVnd, medianVnd: med };
    })
    .filter((o) => o.medianVnd > 0 && o.amountVnd > o.medianVnd * OUTLIER_MULTIPLE)
    .sort((a, b) => b.amountVnd - a.amountVnd)
    .slice(0, 3);

  // A goal sitting still for months is the point of a goal, not a signal.
  const idleFunds = funds
    .filter((b) => b.goal === null)
    .map((b) => {
      let idle = 0;
      for (let i = cycles.length - 1; i >= 0; i--) {
        if ((cycles[i].byBucket[b.id] ?? 0) !== 0) break;
        idle++;
      }
      return { bucketId: b.id, name: b.name, balanceVnd: b.balanceVnd, idleCycles: idle };
    })
    .filter((x) => x.idleCycles >= IDLE_CYCLES && x.balanceVnd > 0);

  const negativeFunds = funds
    .filter((b) => b.balanceVnd < 0)
    .map((b) => ({ bucketId: b.id, name: b.name, balanceVnd: b.balanceVnd }));

  return {
    cycleId: current?.id ?? '',
    day,
    totalDays,
    buckets: bucketSignals,
    pace,
    outliers,
    idleFunds,
    negativeFunds,
    closedCount: past.length,
  };
}

/** Whether there is enough data to say anything. Not under 3 closed cycles. */
export function canAnalyze(s: Signals): boolean {
  return s.closedCount >= 3;
}
