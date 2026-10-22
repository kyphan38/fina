'use client';

import { useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchCycleOverrides } from '@/lib/payday';

/** Loads payday overrides once for the whole app. Renders nothing. */
export default function CycleOverridesSync() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  useEffect(() => (uid ? watchCycleOverrides(uid) : undefined), [uid]);
  return null;
}
