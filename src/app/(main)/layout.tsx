import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getSessionUser } from '@/lib/server-auth';

/**
 * Server-side gate: no valid session, render nothing.
 * The client-side guard is for UX; this is the real protection.
 */
export default async function MainLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
