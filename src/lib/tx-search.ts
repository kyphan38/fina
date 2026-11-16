// F5: search every transaction by note or amount (History). Pure file.

import { toVnd } from '@/lib/money';
import type { Transaction } from '@/types/fina';

export const SEARCH_MAX = 100;

/** Lowercase, no Vietnamese marks, single spaces: "Cà  phê" -> "ca phe". */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A number ("35" or "35.5", in thousands like the numpad) matches that amount;
 * any other text matches notes and bucket names. Newest first, at most SEARCH_MAX.
 */
export function searchTxs(
  txs: readonly Transaction[],
  query: string,
  bucketName: (id: string) => string,
): { rows: Transaction[]; total: number; more: boolean } {
  const q = fold(query);
  if (!q) return { rows: [], total: 0, more: false };
  const amount = /^\d+([.,]\d+)?$/.test(q) ? toVnd(q) : null;
  const hits = txs.filter((t) => {
    if (amount !== null) return t.amountVnd === amount;
    return fold(t.note ?? '').includes(q) || fold(bucketName(t.bucketId)).includes(q);
  });
  hits.sort((a, b) => b.occurredAt - a.occurredAt);
  // Total of what was spent: money back ('in') counts against it.
  const total = hits.reduce((sum, t) => sum + (t.direction === 'in' ? -t.amountVnd : t.amountVnd), 0);
  return { rows: hits.slice(0, SEARCH_MAX), total, more: hits.length > SEARCH_MAX };
}
