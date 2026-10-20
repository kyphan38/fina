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
