'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { computeSurplus, ensureCycle, watchCycle } from '@/lib/cycles';
import { coveredByBucket, coveredFromOutside, watchCycleCovers } from '@/lib/covers';
import { spentByBucket, watchCycleTransactions } from '@/lib/transactions';
import { DEFAULT_GOALS_MONTHLY_VND, isGoal, openGoals } from '@/lib/goals';
import { watchGoalsMonthly } from '@/lib/goal-store';
import { cycleToClose, previousCycle } from '@/lib/cycle';
import type { Bucket, Cover, Cycle, Transaction } from '@/types/fina';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useFirstSnapshots } from '@/hooks/useFirstSnapshots';

export function useSummary() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [goalsBudget, setGoalsBudget] = useState(DEFAULT_GOALS_MONTHLY_VND);
  // The cycle before, tagged with its id so a stale snapshot is never used
  // after the cycle turns.
  const [prev, setPrev] = useState<{ id: string; cycle: Cycle | null } | null>(null);
  const [prevTxs, setPrevTxs] = useState<{ id: string; txs: Transaction[] } | null>(null);
  const [prevCovers, setPrevCovers] = useState<{ id: string; covers: Cover[] } | null>(null);
  // Animations wait for these six listeners to have answered once.
  const { settled, mark } = useFirstSnapshots(6);

  const { now, cycle: cycleId } = useCurrentCycle();
  const prevId = previousCycle(cycleId);

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, (v) => {
      setBuckets(v);
      mark(0);
    });
  }, [uid, mark]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, cycleId, (v) => {
      setTxs(v);
      mark(1);
    });
  }, [uid, cycleId, mark]);

  useEffect(() => {
    if (!uid) return;
    return watchCycle(uid, cycleId, (v) => {
      setCycle(v);
      mark(2);
    });
  }, [uid, cycleId, mark]);

  // Create the cycle document the first time, freezing limits from the
  // current baseline. Only for the CURRENT cycle - a past cycle with no
  // document predates the app, and nobody knows its old limits.
  useEffect(() => {
    if (!uid || !buckets || buckets.length === 0 || cycle !== null) return;
    void ensureCycle(uid, cycleId, buckets).catch(() => {
      // The listener gets the document once written; on a network error the next open retries.
    });
  }, [uid, buckets, cycle, cycleId]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleCovers(uid, cycleId, (v) => {
      setCovers(v);
      mark(3);
    });
  }, [uid, cycleId, mark]);

  useEffect(() => {
    if (!uid) return;
    return watchGoalsMonthly(uid, (v) => {
      setGoalsBudget(v);
      mark(4);
    });
  }, [uid, mark]);

  // One doc read. Usually closed, so nothing more is read.
  useEffect(() => {
    if (!uid) return;
    return watchCycle(uid, prevId, (v) => {
      setPrev({ id: prevId, cycle: v });
      mark(5);
    });
  }, [uid, prevId, mark]);

  const closeId = cycleToClose(
    cycleId,
    prev?.id === prevId ? prev.cycle : null,
    now,
  );

  // Its transactions and covers only while it still waits to be closed.
  useEffect(() => {
    if (!uid || !closeId) return;
    return watchCycleTransactions(uid, closeId, (v) => setPrevTxs({ id: closeId, txs: v }));
  }, [uid, closeId]);

  useEffect(() => {
    if (!uid || !closeId) return;
    return watchCycleCovers(uid, closeId, (v) => setPrevCovers({ id: closeId, covers: v }));
  }, [uid, closeId]);

  const etfDeposits = useMemo(
    () => txs.filter((t) => t.bucketId === 'etf').sort((a, b) => b.occurredAt - a.occurredAt),
    [txs],
  );

  const spent = useMemo(() => spentByBucket(txs), [txs]);
  const covered = useMemo(() => coveredByBucket(covers), [covers]);
  const pendingCovers = useMemo(() => covers.filter((c) => c.status === 'pending'), [covers]);

  const active = useMemo(() => (buckets ?? []).filter((b) => b.active), [buckets]);
  const monthly = useMemo(() => active.filter((b) => b.kind === 'budget'), [active]);
  const bidv = useMemo(
    () => active.filter((b) => b.kind === 'fund' && b.id !== 'etf'),
    [active],
  );
  const funds = useMemo(() => bidv.filter((b) => !isGoal(b)), [bidv]);
  const goals = useMemo(() => openGoals(active), [active]);
  const etf = useMemo(() => active.find((b) => b.id === 'etf') ?? null, [active]);

  const limits = useMemo(() => cycle?.limits ?? {}, [cycle]);
  const monthlySpent = useMemo(
    () => monthly.reduce((sum, b) => sum + (spent[b.id] ?? 0), 0),
    [monthly, spent],
  );
  const monthlyLimit = useMemo(
    () => Object.values(limits).reduce((a, b) => a + b, 0),
    [limits],
  );
  // Goals included: this is what the BIDV account should hold.
  const fundsTotal = useMemo(() => bidv.reduce((s, b) => s + b.balanceVnd, 0), [bidv]);
  // Only money from BIDV flowing INTO a VCB bucket changes the total. A cover
  // inside one bank is just an internal move.
  const surplus = useMemo(
    () => computeSurplus(limits, spent) + coveredFromOutside(covers, buckets ?? []),
    [limits, spent, covers, buckets],
  );

  // The close screen waits for the old cycle's own data, so it never shows
  // the current cycle's numbers or a half-loaded surplus.
  const closing = useMemo(() => {
    if (!closeId || !prev?.cycle) return null;
    if (prevTxs?.id !== closeId || prevCovers?.id !== closeId) return null;
    const pSpent = spentByBucket(prevTxs.txs);
    const pCovers = prevCovers.covers;
    return {
      cycle: prev.cycle,
      spent: pSpent,
      covered: coveredByBucket(pCovers),
      surplus:
        computeSurplus(prev.cycle.limits, pSpent) + coveredFromOutside(pCovers, buckets ?? []),
      pendingCount: pCovers.filter((c) => c.status === 'pending').length,
    };
  }, [closeId, prev, prevTxs, prevCovers, buckets]);

  return {
    uid,
    cycleId,
    cycle,
    buckets: buckets ?? [],
    monthly,
    funds,
    goals,
    goalsBudget,
    now,
    etf,
    etfDeposits,
    spent,
    covered,
    covers,
    pendingCovers,
    limits,
    monthlySpent,
    monthlyLimit,
    fundsTotal,
    surplus,
    /** The ended cycle still open, with its own numbers, or null. */
    closing,
    loading: buckets === null,
    /** All listeners have answered: now bars and numbers may animate. */
    settled,
  };
}
