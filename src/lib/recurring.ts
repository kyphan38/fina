// F2: recurring entries (rent, phone, subscriptions). Pure file.
// Nothing is logged by itself: on its day an item shows on Log, and one tap logs it.

import { parseCycle, type CycleId } from '@/lib/cycle';

export interface RecurringItem {
  id: string;
  name: string;
  bucketId: string;
  amountVnd: number;
  /** Day of the month it is due, 1-31 (clamped to short months). */
  day: number;
}

export interface RecurringDoc {
  items: RecurringItem[];
  /** item id -> the cycle it was last logged or skipped in. */
  done: Record<string, CycleId>;
}

export const EMPTY_RECURRING: RecurringDoc = { items: [], done: {} };

/** Same day number in a given month, clamped (31 in February is the 28th or 29th). */
function onDay(year: number, month0: number, day: number): Date {
  const last = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, last));
}

/**
 * When the item falls due inside `cycle`. A cycle spans the end of one month
 * and the start of the next (25 Oct - 24 Nov for '2026-11'), so the day can
 * land in either month.
 */
export function dueAt(day: number, cycle: CycleId, range: { startAt: number; endAt: number }): number | null {
  const { year, month } = parseCycle(cycle);
  for (const d of [onDay(year, month - 2, day), onDay(year, month - 1, day)]) {
    const t = d.getTime();
    if (t >= range.startAt && t < range.endAt) return t;
  }
  return null;
}

/** Items due by now in this cycle and not yet logged or skipped in it, earliest first. */
export function dueItems(
  doc: RecurringDoc,
  cycle: CycleId,
  range: { startAt: number; endAt: number },
  now: number,
): RecurringItem[] {
  return doc.items
    .map((item) => ({ item, at: dueAt(item.day, cycle, range) }))
    .filter(({ item, at }) => at !== null && at <= now && doc.done[item.id] !== cycle)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    .map(({ item }) => item);
}

/** Reads the Firestore doc defensively: anything malformed is dropped. */
export function parseRecurring(raw: unknown): RecurringDoc {
  if (!raw || typeof raw !== 'object') return EMPTY_RECURRING;
  const r = raw as { items?: unknown; done?: unknown };
  const items = Array.isArray(r.items)
    ? r.items.filter(
        (x): x is RecurringItem =>
          !!x &&
          typeof x.id === 'string' &&
          typeof x.name === 'string' &&
          typeof x.bucketId === 'string' &&
          Number.isInteger(x.amountVnd) &&
          x.amountVnd > 0 &&
          Number.isInteger(x.day) &&
          x.day >= 1 &&
          x.day <= 31,
      )
    : [];
  const done: Record<string, CycleId> = {};
  if (r.done && typeof r.done === 'object') {
    for (const [k, v] of Object.entries(r.done as Record<string, unknown>)) if (typeof v === 'string') done[k] = v;
  }
  return { items, done };
}
