// Motion helpers with no React, so `node --test` can cover them.

/** Users who ask for less motion, and Node (tests, server render), skip motion. */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Items that were in `prev` but are gone from `next`, so they can animate out. */
export function leavingItems<T extends { id: string | number }>(prev: T[], next: T[]): T[] {
  const kept = new Set(next.map((x) => x.id));
  return prev.filter((x) => !kept.has(x.id));
}

/** Close when dragged past a quarter of the sheet, or flicked fast. */
export function sheetShouldClose(dy: number, height: number, velocityPxPerMs: number): boolean {
  return dy > height * 0.25 || velocityPxPerMs > 0.5;
}

/** Dragging up past the top only moves a little. */
export function dragOffset(dy: number): number {
  return dy >= 0 ? dy : dy * 0.2;
}

/** How full a bar is, 0 to 1. No limit, a bad number or a negative use gives 0. */
export function barScale(used: number, limit: number | undefined): number {
  if (limit === undefined || !(limit > 0) || !Number.isFinite(used)) return 0;
  return Math.min(1, Math.max(0, used / limit));
}

/**
 * Which rows a live update added or removed. More than `maxDelta` changes
 * means the list was swapped (another cycle or filter, a big import), not
 * edited, so it returns null and nothing should animate.
 */
export function rowChanges(
  prevIds: string[],
  nextIds: string[],
  maxDelta = 3,
): { added: string[]; removed: string[] } | null {
  const before = new Set(prevIds);
  const after = new Set(nextIds);
  const added = nextIds.filter((id) => !before.has(id));
  const removed = prevIds.filter((id) => !after.has(id));
  return added.length + removed.length > maxDelta ? null : { added, removed };
}
