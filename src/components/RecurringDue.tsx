'use client';

import { formatVnd } from '@/lib/money';
import type { RecurringItem } from '@/lib/recurring';

/** F2: recurring entries due this cycle, on Log. "log" fills the form; "skip" hides it until next cycle. */
export default function RecurringDue({
  items,
  onLog,
  onSkip,
}: {
  items: RecurringItem[];
  onLog: (item: RecurringItem) => void;
  onSkip: (item: RecurringItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex shrink-0 flex-col gap-0.5 pb-1 text-[13px] text-muted">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline gap-2">
          <span className="min-w-0 truncate">
            {item.name} {formatVnd(item.amountVnd)}
          </span>
          <button type="button" onClick={() => onLog(item)} className="font-medium text-ink">
            log
          </button>
          <span className="text-faint">·</span>
          <button type="button" onClick={() => onSkip(item)} className="text-faint hover:text-ink">
            skip
          </button>
        </li>
      ))}
    </ul>
  );
}
