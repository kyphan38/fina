import type { ReactNode } from 'react';

/**
 * A main page: the top bar stays put and only the part under it scrolls.
 * The top bar sits outside the scroll area on purpose: the gear's hit area
 * pokes past the column edge, and inside an `overflow-x-hidden` box that
 * let focus scroll the whole page 8px sideways.
 */
export default function Page({ top, children }: { top: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {top}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pb-6">
        {children}
      </div>
    </div>
  );
}
