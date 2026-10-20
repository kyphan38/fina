'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Tells when every Firestore listener of a screen has delivered once, plus one
 * frame. Bars and changed numbers animate only after that, so a screen that
 * fills in as its listeners answer does not play an animation on load.
 * `mark(i)` goes in each listener's callback; `settled` is false until all
 * `count` have answered.
 */
export function useFirstSnapshots(count: number) {
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [settled, setSettled] = useState(false);
  const all = done.size >= count;

  const mark = useCallback(
    (i: number) => setDone((d) => (d.has(i) ? d : new Set(d).add(i))),
    [],
  );

  // One frame later, so the render that brings the last data is still "load".
  useEffect(() => {
    if (!all) return;
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, [all]);

  return { settled, mark };
}
