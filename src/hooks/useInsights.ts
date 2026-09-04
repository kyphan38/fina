'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { clockStore } from '@/lib/clock';
import { cycleOf, previousCycle } from '@/lib/cycle';
import { listCycles } from '@/lib/cycles';
import { computeSignals } from '@/lib/signals';
import { cycleProgress } from '@/lib/cycle';
import { watchCycleTransactions } from '@/lib/transactions';
import type { Bucket, Cycle, Transaction } from '@/types/fina';

export interface CycleRow {
  id: string;
  closed: boolean;
  /** Chi tiêu ròng theo từng bucket. */
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

  const liveByBucket = useMemo(() => {
    const byBucket: Record<string, number> = {};
    for (const t of liveTxs) {
      if (t.source === 'allocation' || t.bucketId === 'etf') continue;
      const signed = t.direction === 'in' ? -t.amountVnd : t.amountVnd;
      byBucket[t.bucketId] = (byBucket[t.bucketId] ?? 0) + signed;
    }
    return byBucket;
  }, [liveTxs]);

  const rows: CycleRow[] = useMemo(() => {
    const out = cycles.map((c) => {
      if (c.id === currentCycle) {
        return { id: c.id, closed: false, byBucket: liveByBucket };
      }
      return { id: c.id, closed: true, byBucket: c.closedTotals?.byBucket ?? {} };
    });
    // Chu kỳ hiện tại có thể chưa có document.
    if (!out.some((r) => r.id === currentCycle)) {
      out.unshift({ id: currentCycle, closed: false, byBucket: liveByBucket });
    }
    return out.sort((a, b) => (a.id < b.id ? 1 : -1));
  }, [cycles, currentCycle, liveByBucket]);

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

  const signals = useMemo(() => {
    const byId = new Map(cycles.map((c) => [c.id, c]));
    // Cũ trước, chu kỳ đang chạy ở cuối - đúng thứ tự computeSignals cần.
    const facts = [...rows].reverse().map((r) => ({
      id: r.id,
      closed: r.closed,
      byBucket: r.byBucket,
      limits: byId.get(r.id)?.limits ?? {},
    }));
    const { day, total } = cycleProgress(currentCycle);
    return computeSignals({
      cycles: facts,
      buckets,
      amounts: liveTxs
        .filter((t) => t.source !== 'allocation' && t.bucketId !== 'etf' && t.direction === 'out')
        .map((t) => ({ bucketId: t.bucketId, amountVnd: t.amountVnd })),
      day,
      totalDays: total,
    });
  }, [rows, cycles, buckets, liveTxs, currentCycle]);

  return { uid, buckets, rows, recent, currentCycle, signals, loading };
}
