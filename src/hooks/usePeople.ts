'use client';

import { useEffect, useState } from 'react';

import { watchPeople } from '@/lib/people-store';
import type { Person } from '@/types/fina';

/** Every person, archived ones too, live. Empty until the first snapshot. */
export function usePeople(uid: string | null): Person[] {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => (uid ? watchPeople(uid, setPeople) : undefined), [uid]);
  return uid ? people : [];
}
