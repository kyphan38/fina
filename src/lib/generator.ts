import { isGoal, needPerMonth, openGoals } from '@/lib/goals';
import type { Bucket } from '@/types/fina';

/** Beyond this gap from the standard, show it in bold to stand out. */
export const DEVIATION_THRESHOLD = 0.2;

export interface Allocation {
  bucket: Bucket;
  amountVnd: number;
  /** Percent of salary. A computed RESULT, not an input. */
  percent: number;
  /** The standard amount, for comparison. */
  standardVnd: number;
  /** amountVnd − standardVnd. 0 means exactly on standard. */
  deltaVnd: number;
  /** true when more than 20% off the standard - worth a closer look. */
  farFromStandard: boolean;
  /** Goals only: what reaches the target on time. null without target or month. */
  needVnd: number | null;
  /** Goals only: the amount is below `needVnd`, so the goal falls behind. */
  belowNeed: boolean;
}

export interface GeneratorResult {
  monthly: Allocation[];
  funds: Allocation[];
  /** Saving goals only. Later and done goals get nothing. */
  goals: Allocation[];
  monthlyTotalVnd: number;
  fundsTotalVnd: number;
  goalsTotalVnd: number;
  /** What is left after everything. Negative means the salary is not enough. */
  etfVnd: number;
  etfPercent: number;
}

/**
 * Splits the salary.
 *
 * Groups come from `standardVnd`; ETF takes the rest. Each amount can be
 * edited right in the Generator - edits there are short-term, this cycle only.
 * Percentages are for viewing - never an input.
 */
export function allocate(
  salaryVnd: number,
  buckets: Bucket[],
  /** Amounts edited by hand in the Generator. This cycle only, never written
   *  back to Settings - that is why they live here and not on the bucket. */
  overrides: Record<string, number> = {},
  /**
   * When goal needs are measured. Pass the moment just before the cycle
   * starts, so the allocation being planned counts as one of the months left.
   */
  needAt: Date = new Date(),
): GeneratorResult {
  const pct = (v: number) => (salaryVnd > 0 ? (v / salaryVnd) * 100 : 0);
  const row = (b: Bucket): Allocation => {
    const amountVnd = overrides[b.id] ?? b.standardVnd;
    const deltaVnd = amountVnd - b.standardVnd;
    const needVnd = isGoal(b) ? needPerMonth(b, needAt) : null;
    return {
      bucket: b,
      amountVnd,
      percent: pct(amountVnd),
      standardVnd: b.standardVnd,
      deltaVnd,
      farFromStandard:
        b.standardVnd > 0 && Math.abs(deltaVnd) / b.standardVnd > DEVIATION_THRESHOLD,
      needVnd,
      belowNeed: needVnd !== null && amountVnd < needVnd,
    };
  };

  const monthly = buckets.filter((b) => b.active && b.kind === 'budget').map(row);
  const funds = buckets
    .filter((b) => b.active && b.kind === 'fund' && b.id !== 'etf' && !isGoal(b))
    .map(row);
  const goals = openGoals(buckets)
    .filter((b) => b.goal?.status === 'saving')
    .map(row);
  const sum = (xs: Allocation[]) => xs.reduce((a, x) => a + x.amountVnd, 0);

  const monthlyTotalVnd = sum(monthly);
  const fundsTotalVnd = sum(funds);
  const goalsTotalVnd = sum(goals);
  const etfVnd = salaryVnd - monthlyTotalVnd - fundsTotalVnd - goalsTotalVnd;

  return {
    monthly,
    funds,
    goals,
    monthlyTotalVnd,
    fundsTotalVnd,
    goalsTotalVnd,
    etfVnd,
    etfPercent: pct(etfVnd),
  };
}
