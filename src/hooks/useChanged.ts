'use client';

import { useState } from 'react';

/**
 * True once `value` has changed while the screen was settled. Changes before
 * that (data still arriving) and the first value never count, so nothing plays
 * on load.
 */
export function useChanged(value: unknown, settled: boolean): boolean {
  const [prev, setPrev] = useState(value);
  const [changed, setChanged] = useState(false);
  if (!Object.is(prev, value)) {
    setPrev(value);
    if (settled) setChanged(true);
  }
  return changed;
}
