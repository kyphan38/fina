'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { clockStore } from '@/lib/clock';
import { historyCycleStore } from '@/lib/prefs';
import { cycleOf } from '@/lib/cycle';
import { listCycles } from '@/lib/cycles';
import { watchCycleTransactions } from '@/lib/transactions';
import { netSpending } from '@/lib/spending';
import { collapseMoves, pairMoves } from '@/lib/moves';
import type { Bucket, Transaction } from '@/types/fina';

export function useHistory() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const currentCycle = useMemo(() => cycleOf(new Date(now)), [now]);

  const cycle = useSyncExternalStore(
    historyCycleStore.subscribe,
    historyCycleStore.get,
    historyCycleStore.getServer,
  );
  const setCycle = (next: string | null) => historyCycleStore.set(next);
  const [cycleIds, setCycleIds] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);
  // Day-25 allocations and fund moves are noise day to day. Hidden by
  // default; show them to reconcile.
  const [showAllocations, setShowAllocations] = useState(false);

  const selected = cycle ?? currentCycle;

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, selected, setTxs);
  }, [uid, selected]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void listCycles(uid).then((cs) => {
      if (cancelled) return;
      const ids = cs.map((c) => c.id);
      // The current cycle may have no document yet (Summary never opened).
      setCycleIds(ids.includes(currentCycle) ? ids : [currentCycle, ...ids]);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, currentCycle]);

  const byId = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);

  const moves = useMemo(() => pairMoves(txs), [txs]);

  // A move is two entries but shows (and counts) as one row.
  const collapsed = useMemo(() => collapseMoves(txs), [txs]);

  const allocationCount = useMemo(
    () => collapsed.filter((t) => t.source === 'allocation' || t.source === 'move').length,
    [collapsed],
  );

  const rows = useMemo(() => {
    let filtered = showAllocations
      ? collapsed
      : collapsed.filter((t) => t.source !== 'allocation' && t.source !== 'move');
    if (bucketFilter) {
      filtered = filtered.filter((t) => {
        if (t.bucketId === bucketFilter) return true;
        // Filtering by the source fund must still find the move (the row is the target side).
        const pair = t.moveId ? moves.get(t.moveId) : undefined;
        return pair?.from?.bucketId === bucketFilter;
      });
    }
    return [...filtered].sort((a, b) => b.occurredAt - a.occurredAt);
  }, [collapsed, moves, bucketFilter, showAllocations]);

  /**
   * Net total of what is REALLY spending.
   *
   * Same rule as the Cash flow table in Summary - two places computing
   * spending two ways would drift apart.
   */
  const total = useMemo(() => netSpending(rows), [rows]);

  return {
    uid,
    buckets,
    byId,
    cycle: selected,
    cycleIds,
    setCycle,
    bucketFilter,
    setBucketFilter,
    showAllocations,
    setShowAllocations,
    allocationCount,
    moves,
    rows,
    total,
  };
}
