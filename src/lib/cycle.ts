// ============================================================
// fina - Financial cycle
//
// A cycle starts on the 25th (payday). Spending on 25/08 belongs to the
// September cycle. Every query goes through here, never raw calendar months.
// ============================================================

import { CYCLE_START_DAY } from '@/types/fina';

/** '2026-09' */
export type CycleId = string;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The cycle containing time `d`.
 *
 * From the 25th on, it belongs to the cycle named after the NEXT month.
 * 25/12/2026 falls in cycle '2027-01' - the easiest case to get wrong, with its own test.
 */
export function cycleOf(d: Date, startDay: number = CYCLE_START_DAY): CycleId {
  let year = d.getFullYear();
  // getMonth() counts from 0, so +1 here gives that month's own number 1-12.
  let month = d.getMonth() + 1;
  if (d.getDate() >= startDay) month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Splits '2026-09' into numbers. Throws on a bad format - no guessing. */
export function parseCycle(cycle: CycleId): { year: number; month: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(cycle);
  if (!m) throw new Error(`[cycle] Invalid cycle id: ${cycle}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * The cycle's time range: [startAt, endAt).
 * Cycle '2026-09' runs from 00:00 on 25/08 to 00:00 on 25/09.
 */
export function cycleRange(
  cycle: CycleId,
  startDay: number = CYCLE_START_DAY,
): { startAt: number; endAt: number } {
  const { year, month } = parseCycle(cycle);
  // The month before the cycle name. new Date() turns month 0 into December of the year before.
  const startAt = new Date(year, month - 2, startDay, 0, 0, 0, 0).getTime();
  const endAt = new Date(year, month - 1, startDay, 0, 0, 0, 0).getTime();
  return { startAt, endAt };
}

/** Month name and year for display. Not stored in the DB - always derived from cycle. */
export function cycleLabel(cycle: CycleId): { month: string; year: number } {
  const { year, month } = parseCycle(cycle);
  return { month: MONTH_NAMES[month - 1], year };
}

/**
 * Which day of the cycle it is, out of how many.
 * Day one is 1. Before the cycle clamps to 1, after it clamps to total.
 */
export function cycleProgress(
  cycle: CycleId,
  now: Date = new Date(),
  startDay: number = CYCLE_START_DAY,
): { day: number; total: number } {
  const { startAt, endAt } = cycleRange(cycle, startDay);
  const DAY = 86_400_000;
  const total = Math.round((endAt - startAt) / DAY);
  const elapsed = Math.floor((now.getTime() - startAt) / DAY) + 1;
  return { day: Math.min(Math.max(elapsed, 1), total), total };
}

/** The previous cycle. '2026-01' -> '2025-12' */
export function previousCycle(cycle: CycleId): CycleId {
  const { year, month } = parseCycle(cycle);
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** The next cycle. '2026-12' -> '2027-01' */
export function nextCycle(cycle: CycleId): CycleId {
  const { year, month } = parseCycle(cycle);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}
