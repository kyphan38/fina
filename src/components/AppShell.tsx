import type { ReactNode } from 'react';
import BottomNav from '@/components/BottomNav';
import PendingCovers from '@/components/PendingCovers';

/**
 * The app frame is exactly one screen tall, never taller.
 *
 * It used to be min-h-dvh + a sticky nav: the whole page scrolled, the nav
 * drifted and the Log Save button sank to the bottom. Now only the content
 * scrolls and the nav is a fixed flex item - no sticky, nothing can drift.
 *
 * min-h-0 is required: without it the flex item cannot shrink and the
 * scroll area pushes the nav off screen.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <main className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col px-4 min-[900px]:max-w-5xl min-[900px]:px-6">
        {children}
      </main>
      <PendingCovers />
      <BottomNav />
    </div>
  );
}
