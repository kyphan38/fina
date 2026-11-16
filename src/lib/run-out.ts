// F3: "out by 22" on Summary - the day a bucket runs out at the pace so far.
// Pure file. Only for evenly spent buckets (Food, Utilities), the same rule as
// signals.ts: lumpy buckets would warn wrongly every month.

const DAY = 86_400_000;
/** Too few days to judge a pace. */
export const MIN_DAYS = 3;

/**
 * When the money left runs out at the average daily spend since the cycle
 * started, or null when it lasts to the cycle end (or there is no pace yet).
 */
export function runOutAt(args: { usedVnd: number; limitVnd: number; startAt: number; endAt: number; now: number }): number | null {
  const { usedVnd, limitVnd, startAt, endAt, now } = args;
  const days = (now - startAt) / DAY;
  if (days < MIN_DAYS || usedVnd <= 0 || limitVnd <= 0 || usedVnd >= limitVnd) return null;
  const perDay = usedVnd / days;
  const at = now + ((limitVnd - usedVnd) / perDay) * DAY;
  return at < endAt ? at : null;
}
