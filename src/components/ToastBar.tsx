'use client';

import { useState } from 'react';

import { usePresence } from '@/hooks/usePresence';

/** Matches `.fade-out` in globals.css. */
const EXIT_MS = 200;

export interface ToastData {
  id: number;
  text: string;
  /** Whether the Undo button is part of this toast. */
  undoable: boolean;
}

/**
 * The line above the numpad after a save. Rises in, and keeps the last toast
 * 200ms after it closes so it fades out instead of vanishing. A new toast
 * replaces the old one at once.
 */
export default function ToastBar({
  toast,
  onUndo,
}: {
  toast: ToastData | null;
  /** Null once the undo window is over; the button then does nothing. */
  onUndo: (() => void) | null;
}) {
  // Derived during render, so the leaving toast never blinks out for a frame.
  const [last, setLast] = useState<ToastData | null>(toast);
  if (toast && toast !== last) setLast(toast);

  const { mounted, leaving } = usePresence(toast !== null, EXIT_MS);
  const shown = toast ?? last;
  if (!mounted || !shown) return null;

  return (
    <p
      // A new id is a new toast: its own entry animation.
      key={shown.id}
      role="status"
      aria-hidden={leaving || undefined}
      className={`absolute inset-x-0 bottom-full mb-1.5 flex items-center gap-3 rounded-[9px] bg-ink px-3.5 py-2.5 text-[12.5px] text-bg ${
        // A fading toast must not take a tap meant for its old Undo.
        leaving ? 'fade-out pointer-events-none' : 'rise'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{shown.text}</span>
      {shown.undoable && (
        <button
          type="button"
          disabled={leaving || !onUndo}
          onClick={() => onUndo?.()}
          className="shrink-0 font-semibold"
        >
          Undo
        </button>
      )}
    </p>
  );
}
