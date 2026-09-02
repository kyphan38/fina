import SettingsView from '@/components/SettingsView';
import { getSessionUser } from '@/lib/server-auth';

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <section className="pt-6">
      <h1 className="text-lg font-semibold">Settings</h1>
      <SettingsView email={user?.email ?? null} />
    </section>
  );
}
