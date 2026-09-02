'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { clockStore } from '@/lib/clock';
import { cycleOf, previousCycle } from '@/lib/cycle';
import { listCycles } from '@/lib/cycles';
import { cashFlow } from '@/lib/cashflow';
import { watchCycleIncome } from '@/lib/income';
import { watchCycleTransactions } from '@/lib/transactions';
import type { Bucket, Cycle, Income, Transaction } from '@/types/fina';

export interface CycleRow {
  id: string;
  closed: boolean;
  inVnd: number;
  outVnd: number;
  investedVnd: number;
  leftVnd: number;
  byBucket: Record<string, number>;
}

/**
 * Insights đọc `closedTotals` của các chu kỳ đã đóng - mỗi chu kỳ một
 * document, không phải vài nghìn giao dịch. Chỉ chu kỳ ĐANG CHẠY mới tính
 * trực tiếp, vì nó chưa có ảnh chụp.
 */
export function useInsights() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const currentCycle = useMemo(() => cycleOf(new Date(now)), [now]);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [liveTxs, setLiveTxs] = useState<Transaction[]>([]);
  const [liveIncome, setLiveIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, currentCycle, setLiveTxs);
  }, [uid, currentCycle]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleIncome(uid, currentCycle, setLiveIncome);
  }, [uid, currentCycle]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void listCycles(uid)
      .then((cs) => {
        if (cancelled) return;
        setCycles(cs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const live = useMemo(() => cashFlow(liveIncome, liveTxs), [liveIncome, liveTxs]);

  const rows: CycleRow[] = useMemo(() => {
    const out = cycles.map((c) => {
      if (c.id === currentCycle) {
        const byBucket: Record<string, number> = {};
        for (const t of liveTxs) {
          if (t.source === 'allocation' || t.bucketId === 'etf') continue;
          const signed = t.direction === 'in' ? -t.amountVnd : t.amountVnd;
          byBucket[t.bucketId] = (byBucket[t.bucketId] ?? 0) + signed;
        }
        return {
          id: c.id,
          closed: false,
          inVnd: live.inVnd,
          outVnd: live.outVnd,
          investedVnd: live.investedVnd,
          leftVnd: live.leftVnd,
          byBucket,
        };
      }
      const t = c.closedTotals;
      const inVnd = c.closedIncomeVnd ?? 0;
      return {
        id: c.id,
        closed: true,
        inVnd,
        outVnd: t?.outVnd ?? 0,
        investedVnd: t?.investedVnd ?? 0,
        leftVnd: inVnd - (t?.outVnd ?? 0) - (t?.investedVnd ?? 0),
        byBucket: t?.byBucket ?? {},
      };
    });
    // Chu kỳ hiện tại có thể chưa có document.
    if (!out.some((r) => r.id === currentCycle)) {
      out.unshift({
        id: currentCycle,
        closed: false,
        inVnd: live.inVnd,
        outVnd: live.outVnd,
        investedVnd: live.investedVnd,
        leftVnd: live.leftVnd,
        byBucket: {},
      });
    }
    return out.sort((a, b) => (a.id < b.id ? 1 : -1));
  }, [cycles, currentCycle, live, liveTxs]);

  const years = useMemo(
    () => [...new Set(rows.map((r) => r.id.slice(0, 4)))].sort().reverse(),
    [rows],
  );

  /** Sáu chu kỳ gần nhất, cũ trước - để vẽ biểu đồ đọc từ trái sang phải. */
  const recent = useMemo(() => {
    const ids: string[] = [];
    let id = currentCycle;
    for (let n = 0; n < 6; n++) {
      ids.unshift(id);
      id = previousCycle(id);
    }
    return ids.map((cycleId) => rows.find((r) => r.id === cycleId) ?? null);
  }, [rows, currentCycle]);

  return { uid, buckets, rows, years, recent, currentCycle, loading };
}
