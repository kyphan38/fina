'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useFirstSnapshots } from '@/hooks/useFirstSnapshots';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { historyCycleStore } from '@/lib/prefs';
import { listCycles } from '@/lib/cycles';
import { watchCycleTransactions } from '@/lib/transactions';
import { netSpending } from '@/lib/spending';
import { collapseMoves, pairMoves } from '@/lib/moves';
import { usePeople } from '@/hooks/usePeople';
import { historyRows, PERSON_FILTER } from '@/lib/people';
import type { Bucket, Transaction } from '@/types/fina';

export function useHistory() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const { cycle: currentCycle } = useCurrentCycle();

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
  // People entries are not spending: hidden unless shown or filtered by a person.
  const [showPeople, setShowPeople] = useState(false);
  const people = usePeople(uid);
  // Row animations wait for both listeners to have answered once.
  const { settled, mark } = useFirstSnapshots(2);

  const selected = cycle ?? currentCycle;

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, (v) => {
      setBuckets(v);
      mark(0);
    });
  }, [uid, mark]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, selected, (v) => {
      setTxs(v);
      mark(1);
    });
  }, [uid, selected, mark]);

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

  const peopleCount = useMemo(() => collapsed.filter((t) => t.personId).length, [collapsed]);

  const rows = useMemo(() => {
    let filtered = showAllocations
      ? collapsed
      : collapsed.filter((t) => t.source !== 'allocation' && t.source !== 'move');
    filtered = historyRows(filtered, bucketFilter, showPeople);
    if (bucketFilter && !bucketFilter.startsWith(PERSON_FILTER)) {
      filtered = filtered.filter((t) => {
        if (t.bucketId === bucketFilter) return true;
        // Filtering by the source fund must still find the move (the row is the target side).
        const pair = t.moveId ? moves.get(t.moveId) : undefined;
        return pair?.from?.bucketId === bucketFilter;
      });
    }
    return [...filtered].sort((a, b) => b.occurredAt - a.occurredAt);
  }, [collapsed, moves, bucketFilter, showAllocations, showPeople]);

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
    showPeople,
    setShowPeople,
    peopleCount,
    people,
    allocationCount,
    moves,
    rows,
    total,
    /** Both listeners have answered: now rows and totals may animate. */
    settled,
  };
}
