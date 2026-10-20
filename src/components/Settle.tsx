'use client';

import type { ReactNode } from 'react';

import { useChanged } from '@/hooks/useChanged';

/**
 * Wraps a number that can change while you look at it (after a save, an
 * Undo, a top-up). The new value fades in once; a value that is already
 * there on load stays still. Keyed by the value, so every later change
 * plays again.
 */
export default function Settle({
  value,
  settled,
  children,
}: {
  value: unknown;
  settled: boolean;
  children: ReactNode;
}) {
  const changed = useChanged(value, settled);
  return (
    <span key={changed ? String(value) : 'still'} className={changed ? 'fade-in' : undefined}>
      {children}
    </span>
  );
}
