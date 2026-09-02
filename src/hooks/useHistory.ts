'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { clockStore } from '@/lib/clock';
import { cycleOf } from '@/lib/cycle';
import { listCycles } from '@/lib/cycles';
import { watchCycleTransactions } from '@/lib/transactions';
import type { Bucket, Transaction } from '@/types/fina';

export function useHistory() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const currentCycle = useMemo(() => cycleOf(new Date(now)), [now]);

  const [cycle, setCycle] = useState<string | null>(null);
  const [cycleIds, setCycleIds] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);

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
      // Chu kỳ hiện tại có thể chưa có document (chưa mở Summary lần nào).
      setCycleIds(ids.includes(currentCycle) ? ids : [currentCycle, ...ids]);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, currentCycle]);

  const byId = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);

  const rows = useMemo(() => {
    const filtered = bucketFilter ? txs.filter((t) => t.bucketId === bucketFilter) : txs;
    return [...filtered].sort((a, b) => b.occurredAt - a.occurredAt);
  }, [txs, bucketFilter]);

  /**
   * Tổng ròng của những khoản THẬT SỰ là chi tiêu.
   *
   * Khoản được hoàn thì trừ đi - ứng 850 tiền picnic rồi nhận lại 430 nghĩa
   * là tiêu 420. Nhưng nạp ETF thì bỏ hẳn ra: đó là chuyển tiền sang đầu tư,
   * không phải chi tiêu, và tính nó là số âm sẽ làm tổng nhìn như bạn tiêu
   * ít hơn thực tế.
   */
  const total = useMemo(
    () =>
      rows
        .filter((t) => t.bucketId !== 'etf')
        .reduce((sum, t) => sum + (t.direction === 'in' ? -t.amountVnd : t.amountVnd), 0),
    [rows],
  );

  return {
    uid,
    buckets,
    byId,
    cycle: selected,
    cycleIds,
    setCycle,
    bucketFilter,
    setBucketFilter,
    rows,
    total,
  };
}
