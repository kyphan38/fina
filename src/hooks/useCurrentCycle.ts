'use client';

import { useMemo, useSyncExternalStore } from 'react';

import { clockStore } from '@/lib/clock';
import { cycleOf, cycleOverridesStore } from '@/lib/cycle';

const noOverrides = () => ({});

/**
 * The current cycle id and the shared clock. Re-renders when the minute
 * ticks or when a payday override arrives from meta/settings.
 */
export function useCurrentCycle(): { now: number; cycle: string } {
  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const overrides = useSyncExternalStore(
    cycleOverridesStore.subscribe,
    cycleOverridesStore.get,
    noOverrides,
  );
  // On the server now = 0 -> '1970-01', harmless: screens show Loading until
  // the first client render has the real time.
  const cycle = useMemo(() => {
    void overrides;
    return cycleOf(new Date(now));
  }, [now, overrides]);
  return { now, cycle };
}
