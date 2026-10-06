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
