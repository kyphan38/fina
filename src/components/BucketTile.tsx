'use client';

import { formatVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

/**
 * Ô bucket. Hiện số CÒN LẠI (budget) hoặc SỐ DƯ (fund), kèm vạch tiến độ
 * ở đáy - đọc được tình hình ngay lúc đang log, không phải mở báo cáo.
 */
export default function BucketTile({
  bucket,
  spentVnd,
  coveredVnd = 0,
  limitVnd,
  selected,
  onSelect,
}: {
  bucket: Bucket;
  spentVnd: number;
  /** Phần đã rút khỏi bucket này để bù cho bucket khác (Buffer là chính). */
  coveredVnd?: number;
  /** Hạn mức đã đóng băng của chu kỳ. Bỏ trống thì lấy baseline. */
  limitVnd?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const isFund = bucket.kind === 'fund';
  const limit = limitVnd ?? bucket.baselineVnd;
  const used = spentVnd + coveredVnd;
  const value = isFund ? bucket.balanceVnd : limit - used;
  const over = value < 0;
  const pct = isFund ? 100 : limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative overflow-hidden rounded-[10px] border px-2.5 pb-3 pt-2.5 text-left ${
        isFund ? 'border-dashed' : ''
      } ${selected ? 'border-ink bg-ink' : 'border-line bg-surface-2'}`}
    >
      <span className={`block text-[12.5px] font-medium ${selected ? 'text-bg' : ''}`}>
        {bucket.name}
      </span>
      <span
        className={`block text-[11.5px] ${
          selected ? 'text-bg' : over ? 'text-over' : 'text-muted'
        }`}
      >
        {formatVnd(value)}
      </span>
      <span className={`absolute inset-x-0 bottom-0 h-0.5 ${selected ? 'bg-white/20' : 'bg-sunk'}`}>
        <span
          className={`block h-full ${selected ? 'bg-bg' : over ? 'bg-over' : 'bg-muted'}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </span>
    </button>
  );
}
