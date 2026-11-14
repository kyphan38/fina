import Link from 'next/link';
import type { ReactNode } from 'react';

import TopBar from '@/components/TopBar';

/**
 * Entries and Trends share the History tab, so the bottom bar stays at 3.
 * The title is the page name like every other page; the two views are words
 * in the row under it.
 */
export default function HistoryTabs({
  active,
  right,
}: {
  active: 'entries' | 'trends';
  right?: ReactNode;
}) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={on ? 'font-semibold text-ink' : 'text-faint hover:text-ink active:text-ink'}
    >
      {label}
    </Link>
  );

  return (
    <>
      <TopBar>
        <h1 className="text-xl font-semibold">History</h1>
      </TopBar>
      <div className="flex min-h-10 shrink-0 items-center justify-between gap-3 text-[13px]">
        <nav className="flex gap-4">
          {tab('/history', 'Entries', active === 'entries')}
          {tab('/insights', 'Trends', active === 'trends')}
        </nav>
        {right}
      </div>
    </>
  );
}
