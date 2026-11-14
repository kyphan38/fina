import type { ReactNode } from 'react';

/**
 * The one heading style for a part of a page or sheet: sentence case, 13px,
 * muted. An optional word action sits on the right.
 */
export default function SectionTitle({
  children,
  action,
  className = '',
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`flex min-h-8 items-center justify-between gap-3 text-[13px] font-medium text-muted ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2">{children}</span>
      {action}
    </h2>
  );
}

/** A secondary action written as a word: faint, ink on hover and press. */
export const WORD = 'text-[13px] text-faint hover:text-ink active:text-ink disabled:opacity-30';

/** A word that opens another page or sheet: same look plus a small ›. */
export const WORD_GO = `${WORD} after:ml-1 after:content-['›']`;
