// ============================================================
// fina - Goals: one BIDV fund per big purchase (PLAN-goals.md)
//
// Pure helpers, so tests do not load Firebase. Writes are in
// lib/goal-store.ts.
// ============================================================

import { DEFAULT_SETTINGS, type Bucket } from '@/types/fina';

/** Monthly budget for all saving goals together, until the owner changes it. */
export const DEFAULT_GOALS_MONTHLY_VND = DEFAULT_SETTINGS.goalsMonthlyVnd;

/** Goals sort after every normal fund (those stop at 120). */
export const GOAL_ORDER_START = 200;

export function isGoal(b: Bucket): boolean {
  return b.goal !== null;
}

/** Goals still in play (not done), in priority order. */
export function openGoals(buckets: Bucket[]): Bucket[] {
  return buckets
    .filter((b) => b.active && b.goal !== null && b.goal.status !== 'done')
    .sort((a, b) => a.order - b.order);
}

/** What the saving goals take each month, from their standard amounts. */
export function savingMonthlyTotal(buckets: Bucket[]): number {
  return openGoals(buckets)
    .filter((b) => b.goal?.status === 'saving')
    .reduce((sum, b) => sum + b.standardVnd, 0);
}

/** 'Phone' -> 'goal-phone'; adds -2, -3 when that id is taken. */
export function goalId(name: string, takenIds: Iterable<string>): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'goal';
  const taken = new Set(takenIds);
  const base = `goal-${slug}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Order for a new goal: after the last goal. */
export function nextGoalOrder(buckets: Bucket[]): number {
  const orders = buckets.filter(isGoal).map((b) => b.order);
  return orders.length === 0 ? GOAL_ORDER_START : Math.max(...orders) + 10;
}

/** '2027-04' or empty. Anything else is not a month. */
export function parseMonth(raw: string): string | null | undefined {
  const v = raw.trim();
  if (v === '') return null;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : undefined;
}

/** Allocations happen on this day each month (the cycle start). */
const ALLOCATION_DAY = 25;

/** Year and month of the next allocation strictly after `now`. */
function firstAllocation(now: Date): { y: number; m: number } {
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  if (now.getDate() >= ALLOCATION_DAY) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { y, m };
}

/**
 * Allocations (day 25) left from `now` up to and including `targetMonth`.
 * On 6 Oct 2026 with target '2027-04' that is 7 (25 Oct ... 25 Apr).
 * Never below 1: a late goal still needs its money next time.
 */
export function monthsLeft(targetMonth: string, now: Date): number {
  const [ty, tm] = targetMonth.split('-').map(Number);
  const { y, m } = firstAllocation(now);
  return Math.max(1, (ty - y) * 12 + (tm - m) + 1);
}

/**
 * What the goal needs each month to reach its target on time, rounded up
 * to the thousand. null when target or month is unknown.
 */
export function needPerMonth(b: Bucket, now: Date): number | null {
  const g = b.goal;
  if (!g || g.targetVnd === null || g.targetMonth === null) return null;
  const missing = g.targetVnd - b.balanceVnd;
  if (missing <= 0) return 0;
  return Math.ceil(missing / monthsLeft(g.targetMonth, now) / 1000) * 1000;
}

export type GoalProgress = 'ready' | 'on track' | 'behind' | 'no target' | 'later';

export function goalProgress(b: Bucket, now: Date): GoalProgress {
  const g = b.goal;
  if (!g) return 'no target';
  if (g.status === 'later') return 'later';
  if (g.targetVnd !== null && b.balanceVnd >= g.targetVnd) return 'ready';
  const need = needPerMonth(b, now);
  if (need === null) return 'no target';
  return b.standardVnd >= need ? 'on track' : 'behind';
}

/**
 * Month the target is reached at the current amount per month, '2027-06'.
 * null without a target or with nothing going in.
 */
export function etaMonth(b: Bucket, now: Date): string | null {
  const target = b.goal?.targetVnd ?? null;
  if (target === null) return null;
  const missing = target - b.balanceVnd;
  if (missing <= 0) return null;
  if (b.standardVnd <= 0) return null;
  const k = Math.ceil(missing / b.standardVnd);
  const { y, m } = firstAllocation(now);
  const idx = y * 12 + (m - 1) + (k - 1);
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** '2027-04' -> 'Apr 2027' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
