import Link from 'next/link';
import SettingsLink from '@/components/SettingsLink';

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
    <div className="flex items-center gap-5 pt-3 text-lg">
      <nav className="flex gap-5">
        {tab('/history', 'Entries', active === 'entries')}
        {tab('/insights', 'Trends', active === 'trends')}
      </nav>
      <span className="ml-auto flex">
        <SettingsLink />
      </span>
    </div>
  );
}
