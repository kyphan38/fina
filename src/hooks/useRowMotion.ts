'use client';

import { useEffect, useState } from 'react';

import { reducedMotion, rowChanges } from '@/lib/motion';

/**
 * Tells a list which rows a live update just added (`rose`) or removed
 * (`goingIds`, still in `shown` for 180ms so they can slide out). A change of
 * `scope` (cycle, filter), the first load (`settled` false) and a big swap of
 * rows play nothing: the list is replaced, not edited.
 */
export function useRowMotion<T extends { id: string; occurredAt: number }>(
  rows: T[],
  scope: string,
  settled: boolean,
) {
  const [seen, setSeen] = useState({ scope, rows });
  const [leaving, setLeaving] = useState<T[]>([]);
  const [rose, setRose] = useState<Set<string>>(() => new Set());

  // Derived during render, so a leaving row never blinks out for one frame.
  if (rows !== seen.rows) {
    if (scope !== seen.scope) {
      setLeaving([]);
      setRose(new Set());
    } else if (settled && !reducedMotion()) {
      const delta = rowChanges(
        seen.rows.map((t) => t.id),
        rows.map((t) => t.id),
      );
      if (delta) {
        const gone = seen.rows.filter((t) => delta.removed.includes(t.id));
        if (gone.length > 0) setLeaving((l) => [...l, ...gone]);
        if (delta.added.length > 0) setRose((r) => new Set([...r, ...delta.added]));
      }
    }
    setSeen({ scope, rows });
  }

  useEffect(() => {
    if (leaving.length === 0) return;
    const ids = new Set(leaving.map((t) => t.id));
    const timer = setTimeout(() => setLeaving((l) => l.filter((t) => !ids.has(t.id))), 180);
    return () => clearTimeout(timer);
  }, [leaving]);

  const live = new Set(rows.map((t) => t.id));
  const going = leaving.filter((t) => !live.has(t.id));
  const goingIds = new Set(going.map((t) => t.id));
  const shown = going.length > 0 ? [...rows, ...going].sort((a, b) => b.occurredAt - a.occurredAt) : rows;

  return { shown, goingIds, rose };
}
