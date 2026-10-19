import Link from 'next/link';

import SettingsView from '@/components/SettingsView';
import { getSessionUser } from '@/lib/server-auth';

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pt-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Link href="/guide" className="text-xs text-muted hover:text-ink active:text-ink">
          Hướng dẫn →
        </Link>
      </header>
      <SettingsView email={user?.email ?? null} />
    </section>
  );
}
