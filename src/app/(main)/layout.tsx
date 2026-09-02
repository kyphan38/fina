import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getSessionUser } from '@/lib/server-auth';

/**
 * Chốt chặn phía server: chưa có session hợp lệ thì không render gì cả.
 * Client-side guard là để trải nghiệm, đây mới là bảo vệ thật.
 */
export default async function MainLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
