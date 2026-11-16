'use client';

import BucketDot from '@/components/BucketDot';
import SectionTitle from '@/components/SectionTitle';
import { cycleLabel } from '@/lib/cycle';
import { lastCycles, type CycleSpend } from '@/lib/last-cycles';
import { formatVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

/** F6: spending per monthly bucket over the last closed cycles (up to 12). */
export default function LastCycles({ rows, buckets }: { rows: CycleSpend[]; buckets: Bucket[] }) {
  const monthly = buckets.filter((b) => b.kind === 'budget');
  const r = lastCycles(
    rows,
    monthly.map((b) => b.id),
  );
  if (r.cycleIds.length === 0) return null;
  const name = (id: string) => monthly.find((b) => b.id === id)?.name ?? id;
  const short = (id: string) => {
    const { month, year } = cycleLabel(id);
    return `${month.slice(0, 3)} ${String(year).slice(-2)}`;
  };
  // Buckets with no spending in the window add only noise.
  const shown = r.buckets.filter((b) => b.totalVnd !== 0).sort((a, b) => b.totalVnd - a.totalVnd);

  return (
    <section className="mt-6">
      <SectionTitle className="mb-1.5">
        Last {r.cycleIds.length} {r.cycleIds.length === 1 ? 'cycle' : 'cycles'}
      </SectionTitle>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5 text-[13px]">
        <span className="text-faint">Bucket</span>
        <span className="text-right text-faint">Per cycle</span>
        <span className="text-right text-faint">Highest</span>
        {shown.map((b) => (
          <div key={b.bucketId} className="contents">
            <span className="flex min-w-0 items-center gap-2">
              <BucketDot id={b.bucketId} keepSpace />
              <span className="truncate">{name(b.bucketId)}</span>
            </span>
            <span className="text-right">{formatVnd(b.averageVnd)}</span>
            <span className="whitespace-nowrap text-right text-muted">
              {b.peak ? `${formatVnd(b.peak.vnd)} · ${short(b.peak.cycleId)}` : '-'}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-line pt-2 text-[13px]">
        <span className="text-muted">
          {short(r.cycleIds[r.cycleIds.length - 1])} to {short(r.cycleIds[0])}
        </span>
        <span className="font-semibold">{formatVnd(r.totalVnd)}</span>
      </div>
    </section>
  );
}
