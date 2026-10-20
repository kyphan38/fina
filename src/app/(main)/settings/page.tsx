import SettingsView from '@/components/SettingsView';
import TopBar from '@/components/TopBar';
import { getSessionUser } from '@/lib/server-auth';

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none">
      <TopBar settings>
        <h1 className="text-lg font-semibold">Settings</h1>
      </TopBar>
      <SettingsView email={user?.email ?? null} />
    </section>
  );
}
