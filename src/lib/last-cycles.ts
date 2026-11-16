// F6: "Last 12 cycles" on Trends - spending per bucket over the closed cycles.
// Pure file. The running cycle is left out: half a cycle would pull the average down.

export const LAST_CYCLES = 12;

export interface CycleSpend {
  id: string;
  closed: boolean;
  byBucket: Record<string, number>;
}

export interface BucketYear {
  bucketId: string;
  totalVnd: number;
  /** Over the cycles counted, including ones with nothing spent. */
  averageVnd: number;
  /** The cycle with the most spending, or null when nothing was spent. */
  peak: { cycleId: string; vnd: number } | null;
}

export function lastCycles(
  rows: readonly CycleSpend[],
  bucketIds: readonly string[],
  n = LAST_CYCLES,
): { cycleIds: string[]; buckets: BucketYear[]; totalVnd: number } {
  const closed = rows
    .filter((r) => r.closed)
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, n);
  const buckets = bucketIds.map((bucketId) => {
    let totalVnd = 0;
    let peak: BucketYear['peak'] = null;
    for (const r of closed) {
      const v = r.byBucket[bucketId] ?? 0;
      totalVnd += v;
      if (v > 0 && (!peak || v > peak.vnd)) peak = { cycleId: r.id, vnd: v };
    }
    return { bucketId, totalVnd, averageVnd: closed.length ? Math.round(totalVnd / closed.length) : 0, peak };
  });
  return {
    cycleIds: closed.map((r) => r.id),
    buckets,
    totalVnd: buckets.reduce((sum, b) => sum + b.totalVnd, 0),
  };
}
