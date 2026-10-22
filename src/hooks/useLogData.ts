'use client';

import { useEffect, useMemo, useState } from 'react';

import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useFirstSnapshots } from '@/hooks/useFirstSnapshots';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { coveredByBucket, watchCycleCovers } from '@/lib/covers';
import { watchCycle } from '@/lib/cycles';
import { spentByBucket, watchCycleTransactions } from '@/lib/transactions';
import { isGoal, openGoals } from '@/lib/goals';
import type { Bucket, Cover, Cycle, Transaction } from '@/types/fina';

/**
 * Two listeners for the whole Log screen: buckets (12 docs) and the current
 * cycle's transactions (one query). Both unsubscribe on unmount.
 */
export function useLogData() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cycleDoc, setCycleDoc] = useState<Cycle | null>(null);
  const [covers, setCovers] = useState<Cover[]>([]);
  // Animations wait for all four listeners to have answered once.
  const { settled, mark } = useFirstSnapshots(4);

  // The shared clock ticks every minute, so an app left open at midnight on
  // the 25th moves to the new cycle by itself. If the cycle string does not
  // change, the listener does not resubscribe.
  const { cycle } = useCurrentCycle();

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, (v) => {
      setBuckets(v);
      mark(0);
    });
  }, [uid, mark]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, cycle, (v) => {
      setTxs(v);
      mark(1);
    });
  }, [uid, cycle, mark]);

  useEffect(() => {
    if (!uid) return;
    return watchCycle(uid, cycle, (v) => {
      setCycleDoc(v);
      mark(2);
    });
  }, [uid, cycle, mark]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleCovers(uid, cycle, (v) => {
      setCovers(v);
      mark(3);
    });
  }, [uid, cycle, mark]);

  const spent = useMemo(() => spentByBucket(txs), [txs]);
  const covered = useMemo(() => coveredByBucket(covers), [covers]);

  // The cycle's frozen limits. No document yet (cycle just turned, or Summary
  // never opened) → use the baseline for now; Summary will lock it in.
  const limits = useMemo(() => cycleDoc?.limits ?? null, [cycleDoc]);
  const limitOf = useMemo(
    () => (b: Bucket) => limits?.[b.id] ?? b.standardVnd,
    [limits],
  );

  const { monthly, funds, goals } = useMemo(() => {
    const active = (buckets ?? []).filter((b) => b.active);
    return {
      monthly: active.filter((b) => b.kind === 'budget'),
      // ETF is outside the Log grid: money only goes IN, never out. A
      // transaction on ETF would subtract from its balance - the exact
      // opposite. ETF top-ups come from the Generator and closing (Stage 3).
      funds: active.filter((b) => b.kind === 'fund' && b.id !== 'etf' && !isGoal(b)),
      // Logged into only when the thing is bought, so only goals still saving.
      goals: openGoals(active).filter((b) => b.goal?.status === 'saving'),
    };
  }, [buckets]);

  const monthlyLeft = useMemo(
    () =>
      monthly.reduce(
        (sum, b) => sum + Math.max(0, limitOf(b) - (spent[b.id] ?? 0) - (covered[b.id] ?? 0)),
        0,
      ),
    [monthly, spent, covered, limitOf],
  );

  // Room per monthly bucket. Negative stays negative: a cover source reads it
  // as "none", the overflow check needs the real number.
  const budgetLeftVnd = useMemo(
    () =>
      Object.fromEntries(
        monthly.map((b) => [b.id, limitOf(b) - (spent[b.id] ?? 0) - (covered[b.id] ?? 0)]),
      ),
    [monthly, spent, covered, limitOf],
  );

  return {
    uid,
    cycle,
    buckets: buckets ?? [],
    monthly,
    funds,
    goals,
    spent,
    covered,
    limits,
    limitOf,
    cycleDoc,
    monthlyLeft,
    budgetLeftVnd,
    /** null = still loading; empty array = loaded, no buckets seeded. */
    loading: buckets === null,
    /** All listeners have answered: now bars and numbers may animate. */
    settled,
  };
}
