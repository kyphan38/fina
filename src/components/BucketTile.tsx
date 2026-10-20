'use client';

import BarFill from '@/components/BarFill';
import Settle from '@/components/Settle';
import { barScale } from '@/lib/motion';
import { formatVnd } from '@/lib/money';
import { bucketAccent } from '@/lib/bucket-color';
import type { Bucket } from '@/types/fina';

/**
 * Bucket tile. Shows what is LEFT (budget) or the BALANCE (fund), with a
 * progress bar at the bottom - readable while logging, no report needed.
 */
export default function BucketTile({
  bucket,
  spentVnd,
  coveredVnd = 0,
  limitVnd,
  selected,
  settled,
  onSelect,
}: {
  bucket: Bucket;
  spentVnd: number;
  /** Amount taken from this bucket to cover another (mostly Buffer). */
  coveredVnd?: number;
  /** The cycle's frozen limit. Empty = use the baseline. */
  limitVnd?: number;
  selected: boolean;
  /** The screen has loaded: the bar and the number may animate when they change. */
  settled: boolean;
  onSelect: () => void;
}) {
  const isFund = bucket.kind === 'fund';
  const limit = limitVnd ?? bucket.standardVnd;
  const used = spentVnd + coveredVnd;
  const value = isFund ? bucket.balanceVnd : limit - used;
  const over = value < 0;
  const fraction = isFund ? 1 : barScale(used, limit);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative overflow-hidden rounded-[10px] border px-2.5 pb-3 pt-2.5 text-left transition-colors duration-150 ${
        isFund ? 'border-dashed' : ''
      } ${selected ? 'border-ink bg-ink' : 'border-line bg-surface-2'}`}
    >
      <span className={`block text-[12.5px] font-medium ${selected ? 'text-bg' : ''}`}>
        {bucket.name}
      </span>
      <span
        className={`block text-[11.5px] ${
          selected ? 'text-bg' : over ? 'font-medium text-over' : 'text-muted'
        }`}
      >
        <Settle value={value} settled={settled}>
          {over ? `${formatVnd(-value)} over` : formatVnd(value)}
        </Settle>
      </span>
      <span className={`absolute inset-x-0 bottom-0 h-0.5 ${selected ? 'bg-white/20' : 'bg-sunk'}`}>
        <BarFill
          fraction={over ? 1 : fraction}
          settled={settled}
          // Over the limit, strong ink beats the identity color: what matters
          // then is "over", not "which bucket".
          color={selected ? 'var(--bg)' : over ? 'var(--over)' : bucketAccent(bucket.id)}
        />
      </span>
    </button>
  );
}
