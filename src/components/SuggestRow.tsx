'use client';

import { formatVnd } from '@/lib/money';

/**
 * Log's suggestion row above the note: amounts often logged for the bucket, or
 * notes often written while the note field has focus. Fixed height, so picking
 * a bucket never moves the numpad.
 */
export default function SuggestRow({
  showNotes,
  amounts,
  notes,
  onAmount,
  onNote,
}: {
  showNotes: boolean;
  amounts: number[];
  notes: string[];
  onAmount: (vnd: number) => void;
  onNote: (text: string) => void;
}) {
  return (
    <div className="flex h-7 items-center gap-1.5 overflow-hidden px-1 pb-1.5" aria-label="Often logged">
      {showNotes && notes.length > 0
        ? notes.map((text) => (
            <button
              key={text}
              type="button"
              // Keep focus in the note: a blur would swap the row back before the tap lands.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onNote(text)}
              className="max-w-[40%] shrink-0 truncate rounded-md border border-line px-2.5 py-0.5 text-[12px] text-muted hover:text-ink"
            >
              {text}
            </button>
          ))
        : amounts.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onAmount(v)}
              className="rounded-md border border-line px-2.5 py-0.5 text-[12px] text-muted hover:text-ink"
            >
              {formatVnd(v)}
            </button>
          ))}
    </div>
  );
}
