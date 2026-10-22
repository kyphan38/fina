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
 * Cycles from this one on start on PAYDAY: the start day, or the Friday
 * before it when it falls on a weekend (salary is paid early then). Older
 * cycles keep the plain start day, because their entries are already stored
 * with that cycle and must not move.
 */
export const PAYDAY_RULE_FROM: CycleId = '2026-11';

// ------------------------------------------------------------
// Manual overrides: salary came early for another reason (Tet, a holiday).
// cycleId -> 'YYYY-MM-DD', the first day of that cycle. Kept in a module
// store so cycleOf stays sync; the client fills it from meta/settings and the
// widget route sets it per request.
// ------------------------------------------------------------

let overrides: Record<CycleId, string> = {};
const overrideListeners = new Set<() => void>();

export const cycleOverridesStore = {
  get: () => overrides,
  set(next: Record<CycleId, string>) {
    overrides = { ...next };
    overrideListeners.forEach((l) => l());
  },
  subscribe(fn: () => void) {
    overrideListeners.add(fn);
    return () => {
      overrideListeners.delete(fn);
    };
  },
};

/** 'YYYY-MM-DD' of a local date. */
export function dayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * An override must fall in the calendar month before the cycle's name, like
 * the normal start does. cycleOf relies on that: it only checks two cycles.
 */
export function validOverride(cycle: CycleId, day: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return false;
  const { year, month } = parseCycle(cycle);
  const before = new Date(year, month - 2, 1);
  return Number(m[1]) === before.getFullYear() && Number(m[2]) === before.getMonth() + 1;
}

/** `cycleStarts` from meta/settings, junk dropped. */
export function parseOverrides(raw: unknown): Record<CycleId, string> {
  const out: Record<CycleId, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [cycle, day] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle) && typeof day === 'string' && validOverride(cycle, day)) {
      out[cycle] = day;
    }
  }
  return out;
}

/** 00:00 local time on the first day of `cycle`. */
export function cycleStart(cycle: CycleId, startDay: number = CYCLE_START_DAY): Date {
  const o = overrides[cycle];
  if (o && validOverride(cycle, o)) {
    const [y, mo, d] = o.split('-').map(Number);
    return new Date(y, mo - 1, d);
  }
  const { year, month } = parseCycle(cycle);
  // The month before the cycle name. new Date() turns month 0 into December of the year before.
  const start = new Date(year, month - 2, startDay);
  if (cycle >= PAYDAY_RULE_FROM) {
    const dow = start.getDay();
    if (dow === 6) start.setDate(start.getDate() - 1);
    if (dow === 0) start.setDate(start.getDate() - 2);
  }
  return start;
}

/**
 * The cycle containing time `d`.
 *
 * From the cycle start on, it belongs to the cycle named after the NEXT month.
 * 25/12/2026 falls in cycle '2027-01' - the easiest case to get wrong, with its own test.
 */
export function cycleOf(d: Date, startDay: number = CYCLE_START_DAY): CycleId {
  const own = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const next = nextCycle(own);
  return d.getTime() >= cycleStart(next, startDay).getTime() ? next : own;
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
 * Cycle '2026-11' runs from 23/10 (25/10 is a Sunday) to 25/11.
 */
export function cycleRange(
  cycle: CycleId,
  startDay: number = CYCLE_START_DAY,
): { startAt: number; endAt: number } {
  return {
    startAt: cycleStart(cycle, startDay).getTime(),
    endAt: cycleStart(nextCycle(cycle), startDay).getTime(),
  };
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

/** How many days before the normal start "Payday today" is offered. */
export const EARLY_PAYDAY_DAYS = 7;

/** The cycle "Payday today" would start, or null when it is not on offer. */
export function earlyPaydayCycle(now: Date): string | null {
  const next = nextCycle(cycleOf(now));
  const start = cycleStart(next).getTime();
  // Starting tomorrow anyway: nothing to move early.
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return start > tomorrow && start - now.getTime() <= EARLY_PAYDAY_DAYS * 86_400_000 ? next : null;
}

/**
 * The cycle the close screen should show, or null. Only the previous cycle
 * can need closing: once a cycle ends, cycleOf already names the next one.
 * Uses the computed end, not the stored endAt, which may predate the payday rule.
 */
export function cycleToClose(
  current: CycleId,
  previous: { status: 'open' | 'closed' } | null,
  now: number,
): CycleId | null {
  if (!previous || previous.status !== 'open' || now <= 0) return null;
  const prev = previousCycle(current);
  return now >= cycleRange(prev).endAt ? prev : null;
}
