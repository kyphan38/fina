'use client';

import BarFill from '@/components/BarFill';
import Settle from '@/components/Settle';
import { barScale } from '@/lib/motion';
import { formatVnd } from '@/lib/money';
import BucketDot from '@/components/BucketDot';
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
      <span className={`flex items-center gap-1.5 text-[13px] font-medium ${selected ? 'text-bg' : ''}`}>
        <BucketDot id={bucket.id} />
        <span className="truncate">{bucket.name}</span>
      </span>
      <span
        className={`block text-[13px] ${
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
          // The bucket's color lives in the dot; the bar is gray, and ink when
          // over the limit, so "over" is the one thing that stands out.
          color={selected ? 'var(--bg)' : over ? 'var(--over)' : 'var(--faint)'}
        />
      </span>
    </button>
  );
}
