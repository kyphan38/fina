'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Client-side gate, so every page in (main) is static: served from the CDN and
 * the service worker cache, with no server call before the first paint.
 *
 * The real protection is firestore.rules (per uid) and requireSessionUser in
 * every API route. Views already handle `user === null` while auth loads.
 */
export default function MainLayout({ children }: LayoutProps<'/'>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  return <AppShell>{!loading && !user ? null : children}</AppShell>;
}
