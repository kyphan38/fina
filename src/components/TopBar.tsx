import type { ReactNode } from 'react';
import SettingsLink from '@/components/SettingsLink';

/**
 * The first row of every main page: what the page is on the left, the gear
 * on the right. One fixed height, so the gear never moves between pages.
 * Meta (day, amounts) goes in the page's own line below, not in this row.
 */
export default function TopBar({ children, settings = false }: { children: ReactNode; settings?: boolean }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center">{children}</div>
      <SettingsLink current={settings} />
    </header>
  );
}
