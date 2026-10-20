import Link from 'next/link';
import TopBar from '@/components/TopBar';

/** Entries and Trends share the History tab, so the bottom bar stays at 3. */
export default function HistoryTabs({ active }: { active: 'entries' | 'trends' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={on ? 'font-semibold text-ink' : 'text-faint hover:text-ink'}
    >
      {label}
    </Link>
  );

  return (
    <TopBar>
      <nav className="flex gap-5 text-lg">
        {tab('/history', 'Entries', active === 'entries')}
        {tab('/insights', 'Trends', active === 'trends')}
      </nav>
    </TopBar>
  );
}
