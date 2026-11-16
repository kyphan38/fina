'use client';

import { useEffect, useMemo, useState } from 'react';

import { cycleRange } from '@/lib/cycle';
import { dueItems, EMPTY_RECURRING, type RecurringDoc } from '@/lib/recurring';
import { markRecurringDone, watchRecurring } from '@/lib/recurring-store';

/**
 * F2: recurring entries due on Log. `now` is the screen's clock tick, so an
 * item appears on its day without a reload.
 */
export function useRecurringDue(uid: string | null, cycle: string, now: number) {
  const [doc, setDoc] = useState<RecurringDoc>(EMPTY_RECURRING);

  useEffect(() => {
    if (!uid) return;
    return watchRecurring(uid, setDoc);
  }, [uid]);

  const due = useMemo(() => dueItems(doc, cycle, cycleRange(cycle), now), [doc, cycle, now]);
  const markDone = (id: string) => {
    if (uid) void markRecurringDone(uid, id, cycle).catch(() => {});
  };

  return { due, markDone };
}
