'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { computeSurplus, ensureCycle, watchCycle } from '@/lib/cycles';
import { coveredByBucket, coveredFromOutside, watchCycleCovers } from '@/lib/covers';
import { cycleOf } from '@/lib/cycle';
import { clockStore } from '@/lib/clock';
import { spentByBucket, watchCycleTransactions } from '@/lib/transactions';
import { DEFAULT_GOALS_MONTHLY_VND, isGoal, openGoals } from '@/lib/goals';
import { watchGoalsMonthly } from '@/lib/goal-store';
import type { Bucket, Cover, Cycle, Transaction } from '@/types/fina';

export function useSummary() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [goalsBudget, setGoalsBudget] = useState(DEFAULT_GOALS_MONTHLY_VND);

  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  // On the server now = 0 -> cycleId is '1970-01', harmless: there are no
  // buckets yet, so the screen only shows Loading. The first client render
  // has the real time.
  const cycleId = useMemo(() => cycleOf(new Date(now)), [now]);

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, cycleId, setTxs);
  }, [uid, cycleId]);

  useEffect(() => {
    if (!uid) return;
    return watchCycle(uid, cycleId, setCycle);
  }, [uid, cycleId]);

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
    return watchCycleCovers(uid, cycleId, setCovers);
  }, [uid, cycleId]);

  useEffect(() => {
    if (!uid) return;
    return watchGoalsMonthly(uid, setGoalsBudget);
  }, [uid]);

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

  const needsClose = Boolean(cycle && cycle.status === 'open' && now > 0 && now >= cycle.endAt);

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
    needsClose,
    loading: buckets === null,
  };
}
