// ============================================================
// fina - Amounts you often log for a bucket
//
// Shown as small buttons on Log after picking a bucket; a tap fills the
// amount. Only spending you typed or imported counts: salary allocation,
// opening balances and fund moves are not "what a coffee costs".
// Pure file.
// ============================================================

import type { Transaction } from '@/types/fina';

export const SUGGEST_DAYS = 60;
export const SUGGEST_COUNT = 3;

const DAY_MS = 86_400_000;

/** Up to `count` amounts, most often logged first; ties go to the most recent. */
export function topAmounts(
  txs: readonly Pick<Transaction, 'bucketId' | 'amountVnd' | 'direction' | 'source' | 'occurredAt'>[],
  bucketId: string,
  now: number,
  count = SUGGEST_COUNT,
  days = SUGGEST_DAYS,
): number[] {
  const since = now - days * DAY_MS;
  const stats = new Map<number, { n: number; last: number }>();
  for (const t of txs) {
    if (t.bucketId !== bucketId || t.direction === 'in' || t.occurredAt < since) continue;
    if (t.source !== 'web' && t.source !== 'import') continue;
    const s = stats.get(t.amountVnd) ?? { n: 0, last: 0 };
    stats.set(t.amountVnd, { n: s.n + 1, last: Math.max(s.last, t.occurredAt) });
  }
  return [...stats.entries()]
    .filter(([, s]) => s.n >= 2)
    .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)
    .slice(0, count)
    .map(([amount]) => amount);
}

/**
 * Up to `count` notes, most often written first (case and spaces ignored), for
 * the same bucket and window as topAmounts. Shows the most recent spelling.
 */
export function topNotes(
  txs: readonly Pick<Transaction, 'bucketId' | 'note' | 'direction' | 'source' | 'occurredAt'>[],
  bucketId: string,
  now: number,
  count = SUGGEST_COUNT,
  days = SUGGEST_DAYS,
): string[] {
  const since = now - days * DAY_MS;
  const stats = new Map<string, { n: number; last: number; text: string }>();
  for (const t of txs) {
    if (t.bucketId !== bucketId || t.direction === 'in' || t.occurredAt < since || !t.note) continue;
    if (t.source !== 'web' && t.source !== 'import') continue;
    const text = t.note.trim().replace(/\s+/g, ' ');
    if (!text) continue;
    const key = text.toLowerCase();
    const s = stats.get(key) ?? { n: 0, last: 0, text };
    stats.set(key, { n: s.n + 1, last: Math.max(s.last, t.occurredAt), text: t.occurredAt >= s.last ? text : s.text });
  }
  return [...stats.values()]
    .filter((s) => s.n >= 2)
    .sort((a, b) => b.n - a.n || b.last - a.last)
    .slice(0, count)
    .map((s) => s.text);
}
