// Adding a monthly bucket and hiding one (Settings). Pure file.
// Hiding keeps every transaction: it only sets `active: false`, which Log,
// Generator and Summary already skip.

import type { Bucket } from '@/types/fina';

export const BUCKET_NAME_MAX = 24;

/** A stable, readable id from the name ('Bố mẹ' -> 'bo-me'), never one already taken. */
export function newBucketId(name: string, takenIds: Iterable<string>): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'bucket';
  const taken = new Set(takenIds);
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

/** Right after the last monthly bucket, so it shows with the others on Log and Summary. */
export function nextMonthlyOrder(buckets: readonly Pick<Bucket, 'kind' | 'order'>[]): number {
  const orders = buckets.filter((b) => b.kind === 'budget').map((b) => b.order);
  return orders.length === 0 ? 10 : Math.max(...orders) + 1;
}

/** A fund that still holds money cannot be hidden: the money would vanish from every total. */
export function hideBlocker(bucket: Pick<Bucket, 'kind' | 'balanceVnd'>): string | null {
  if (bucket.kind === 'fund' && (bucket.balanceVnd ?? 0) !== 0) return 'Move the money out first.';
  return null;
}
