import type { Bucket } from '@/types/fina';

/** Money sitting in BIDV: the balance of every BIDV fund and goal. Shown when "left" on Log is tapped. */
export function bidvBalance(buckets: readonly Pick<Bucket, 'bank' | 'kind' | 'balanceVnd'>[]): number {
  return buckets.filter((b) => b.bank === 'BIDV' && b.kind === 'fund').reduce((sum, b) => sum + (b.balanceVnd ?? 0), 0);
}
